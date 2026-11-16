import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import i18next from 'i18next';
import { runExitPass, isStalled } from './exitPass';
import {
  loadExitRecord,
  saveExitRecord,
  archiveExitRecord,
  listKeptRecoveries,
  saveKeptRecovery,
  archiveKeptRecovery,
} from './exitStore';
import { encodeRecovery } from './exitCodec';
import { normalizeExitQuote } from '../spark/breezNormalize';
import { deriveExitFeeKey } from './exitFeeKey';
import * as chain from './exitChain';
import { exitView } from './exitView';
import {
  syncExitReminders,
  clearExitReminders,
  ensureReminderPermission,
} from './exitReminders';
import { getExitHandle } from '../spark';
import { identityFor, acquire, release } from '../spark/walletRuntime';

const POLL_MS = 30000;
// A stalled exit (only stuck co-signed steps or leftovers) moves between Glow's
// retries, blocks apart: poll about once a block. Coming back to the app still runs a pass.
const STALLED_POLL_FACTOR = 20;
const rn = Platform.OS !== 'web';
const t = k => i18next.t(`settings.unilateralExit.${k}`);

let mnemonic = null;
let identity = null;
let feeKey = null;
let record = null;
// Recoveries kept beside the exit slot (Recover Funds), each advanced by the same pass.
let recoveries = [];
let starting = null;
let lastError = null;
let running = false;
let again = false;
let remindersOff = false;
let handle = null;
let generation = 0;
let timer = null;
let ticks = 0;
let appSub = null;
let snapshot = {
  record: null,
  recoveries: [],
  view: null,
  feeAddress: null,
  running: false,
  lastError: null,
  remindersOff: false,
};
const listeners = new Set();

function publish() {
  snapshot = {
    record,
    recoveries,
    view: record ? exitView(record, record.tipHeight) : null,
    feeAddress: feeKey?.address ?? null,
    running,
    lastError,
    remindersOff,
  };
  listeners.forEach(fn => fn());
}

function stopPolling() {
  clearInterval(timer);
  timer = null;
  ticks = 0;
  appSub?.remove();
  appSub = null;
}

function startPolling() {
  if (timer) return;
  timer = setInterval(() => {
    if (Platform.OS === 'web' || AppState.currentState === 'active') {
      if (record && isStalled(record, rn)) {
        if (++ticks % STALLED_POLL_FACTOR !== 0) return;
      } else {
        ticks = 0;
      }
      requestExitPass();
    }
  }, POLL_MS);
  appSub = AppState.addEventListener('change', s => {
    if (s === 'active') requestExitPass();
  });
}

// Owned handle: startExit must not dispose the wallet the passes are using.
async function getHandle() {
  if (handle && !handle._entry?.disposed) return handle;
  try {
    handle = await acquire(mnemonic, { mode: 'client' });
    return handle;
  } catch {
    handle = null;
    return getExitHandle(mnemonic);
  }
}

export function stopExitEngine() {
  generation++;
  stopPolling();
  if (handle) release(handle).catch(() => {});
  handle = null;
  mnemonic = identity = feeKey = record = lastError = starting = null;
  recoveries = [];
  running = again = remindersOff = false;
  publish();
}

export function startExitEngine(m) {
  if (!m) return Promise.resolve();
  if (m === mnemonic) return starting;
  stopExitEngine();
  mnemonic = m;
  starting = load(m);
  return starting;
}

async function load(m) {
  identity = await identityFor(m);
  const loaded = await loadExitRecord(identity);
  if (m !== mnemonic) return;
  if (loaded.corrupt) {
    lastError = t('errCorrupt');
    publish();
    return;
  }
  record = loaded.record;
  if (record) feeKey = deriveExitFeeKey(m);
  if (record?.status === 'done') {
    // archive failed last time; free the live row
    try {
      await archiveExitRecord(identity);
    } catch (err) {
      lastError = err.message;
    }
  }
  try {
    recoveries = (await listKeptRecoveries(identity)) ?? [];
  } catch {
    recoveries = [];
  }
  if (m !== mnemonic) return;
  if (recoveries.length) feeKey ??= deriveExitFeeKey(m);
  publish();
  if (record && record.status !== 'done') {
    startPolling();
    requestExitPass();
    checkReminders(m);
  } else if (recoveries.length) {
    startPolling();
    requestExitPass();
  }
}

// Mobile only: web never has reminders, the tracker says to keep the tab open.
function checkReminders(m) {
  ensureReminderPermission()
    .then(ok => {
      if (!ok && m === mnemonic) {
        remindersOff = true;
        publish();
      }
    })
    .catch(() => {});
}

// One pass over every kept recovery. A failure stays with that recovery: it
// never reaches the main pass or another recovery.
async function runRecoveries(gen) {
  const m = mnemonic;
  const id = identity;
  const next = [];
  for (const r of recoveries) {
    let cur = r;
    try {
      cur = await runExitPass({
        record: r,
        handle: await getHandle(),
        chain,
        feeKey,
        save: x => saveKeptRecovery(id, x),
        rn,
      });
      if (m !== mnemonic || gen !== generation) return;
      if (cur.status === 'done') {
        await archiveKeptRecovery(id, cur.id);
        continue;
      }
    } catch {}
    next.push(cur);
  }
  if (m === mnemonic && gen === generation) recoveries = next;
}

export async function requestExitPass() {
  if ((!record && !recoveries.length) || !mnemonic) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  const gen = generation;
  publish();
  try {
    do {
      again = false;
      const m = mnemonic;
      const id = identity;
      if (record)
        try {
          const next = await runExitPass({
            record,
            handle: await getHandle(),
            chain,
            feeKey,
            save: r => saveExitRecord(id, r),
            rn,
          });
          if (m !== mnemonic) return;
          record = next;
          lastError = next.checkError ?? null;
          await syncExitReminders(exitView(record, record.tipHeight)).catch(
            () => {},
          );
          if (next.status === 'done') {
            await archiveExitRecord(id);
            if (!recoveries.length) stopPolling();
            again = false;
          }
        } catch (err) {
          if (gen !== generation) return;
          lastError = err.message;
          const r = (await loadExitRecord(id).catch(() => null))?.record;
          if (r && m === mnemonic) record = r;
        }
      if (gen !== generation) return;
      if (recoveries.length) await runRecoveries(gen);
    } while (
      again &&
      (record || recoveries.length) &&
      mnemonic &&
      gen === generation
    );
  } finally {
    if (gen === generation) {
      running = false;
      publish();
    }
  }
}

// Opens the main exit slot. `mode: 'recover'` marks a recovery that needs the
// fee flow; an exit leaves the field unset.
async function openMainSlot({
  mnemonic: m,
  destination,
  feeRate,
  quote,
  leafIds = quote.leafIds,
  mode,
}) {
  await startExitEngine(m);
  // an exit (not a recovery) takes over a live recover-mode record
  const prev =
    record && record.status !== 'done' && record.mode === 'recover' && !mode
      ? record
      : null;
  if (record && record.status !== 'done' && !prev) {
    throw new Error(t('errExitInProgress'));
  }
  if (prev && running) throw new Error(t('errBusy'));
  // Holds passes off until the new record is saved: one finishing on `prev`
  // meanwhile would write it back over the new one.
  if (prev) running = true;
  try {
    feeKey ??= deriveExitFeeKey(m);
    if (prev?.exitStateSnapshot != null) {
      await (await getHandle())
        .importExitState(prev.exitStateSnapshot)
        .catch(() => {});
    }
    const next = {
      status: 'awaitingFee',
      createdAt: Date.now(),
      destination,
      feeRate,
      ...(mode && { mode }),
      leafIds: prev
        ? [...new Set([...leafIds, ...(prev.leafIds ?? [])])]
        : leafIds,
      quote: {
        receiveSats: quote.receiveSats,
        totalFeeSats: quote.totalFeeSats,
        fundingSats: quote.fundingSats,
        recoverableSats: quote.recoverableSats,
      },
      fundingInputs: prev?.fundingInputs ?? [],
      recovery: prev?.recovery ?? null,
      ...(prev && {
        droppedLeafIds: prev.droppedLeafIds,
        stoppedSince: prev.stoppedSince,
      }),
      exitStateSnapshot: await (await getHandle()).exportExitState(),
      refusals: {},
      needMoreSats: 0,
      bumpRequested: false,
      tempBump: null,
      failedLeafIds: [],
      tipHeight: null,
      lastCheckedAt: null,
      feeSeen: null,
    };
    record = await saveExitRecord(identity, { v: 1, identity, ...next });
  } finally {
    if (prev) running = false;
  }
  publish();
  startPolling();
  requestExitPass();
  checkReminders(m);
}

export const startExit = args => openMainSlot(args);

// Builds a quote of co-signed leaves with no funding and keeps it beside the
// exit slot (Glow keepRecovery). It names only the leaves it built.
async function keepRecovery(h, raw, destination, feeRate) {
  const q = normalizeExitQuote(raw, rn);
  const built = await h.buildExit(raw, [], feeKey.secretKey);
  if (!built.transactions.length) throw new Error(t('errCoopUnavailable'));
  const kept = {
    v: 1,
    identity,
    id: built.transactions[0].txid,
    mode: 'recover',
    status: 'active',
    createdAt: Date.now(),
    destination,
    feeRate,
    leafIds: (built.leaves ?? []).map(l => l.leafId),
    quote: {
      receiveSats: q.receiveSats,
      totalFeeSats: q.totalFeeSats,
      fundingSats: 0,
      recoverableSats: q.recoverableSats,
    },
    fundingInputs: [],
    recovery: encodeRecovery(built),
    refusals: {},
    needMoreSats: 0,
    bumpRequested: false,
    tempBump: null,
    failedLeafIds: [],
    tipHeight: null,
    lastCheckedAt: null,
  };
  const saved = await saveKeptRecovery(identity, kept);
  recoveries = [...recoveries.filter(r => r.id !== saved.id), saved];
  publish();
  startPolling();
  requestExitPass();
}

// Glow quoteFresh: a recoverable-only quote also takes leaves a running exit or
// a kept recovery is already moving, and building those would compete with it,
// so the rest is quoted again by name. Nothing left gives an empty quote.
export async function quoteRecovery({ mnemonic: m, destination, feeRate }) {
  await startExitEngine(m);
  const h = await getHandle();
  const first = await h.quoteExit({
    destination,
    feeRate,
    selection: 'recoverableOnly',
  });
  const held = new Set(
    [
      ...(record && record.status !== 'done' ? [record] : []),
      ...recoveries,
    ].flatMap(r => r.leafIds ?? []),
  );
  const ids = normalizeExitQuote(first, rn).leaves.map(l => l.leafId);
  if (!ids.some(id => held.has(id))) return first;
  const rest = ids.filter(id => !held.has(id));
  if (!rest.length) {
    const zero = rn ? BigInt(0) : 0;
    return {
      ...first,
      leaves: [],
      funding: undefined,
      recoverableValueSats: zero,
      totalFeeSats: zero,
      cooperativeFeeSats: zero,
      cpfpFeeSats: zero,
      fanoutFeeSats: zero,
      refundFeeSats: zero,
      sweepFeeSats: zero,
    };
  }
  return h.quoteExit({ destination, feeRate, leafIds: rest });
}

// `raw` is the RecoverableOnly quote the review showed. All co-signed: kept
// beside the exit slot. Needing funding: co-signed leaves are split off first,
// the rest goes through the exit slot and its fee flow.
export async function startRecovery({
  mnemonic: m,
  destination,
  feeRate,
  raw,
}) {
  await startExitEngine(m);
  feeKey ??= deriveExitFeeKey(m);
  const q = normalizeExitQuote(raw, rn);
  if (!q.leaves.length) throw new Error(t('nothingToRecover'));
  const h = await getHandle();
  if (!raw.funding) {
    await keepRecovery(h, raw, destination, feeRate);
    return { kept: true };
  }
  if (record && record.status !== 'done') {
    throw new Error(t('errFinishExitFirst'));
  }
  let leafIds = q.leaves.map(l => l.leafId);
  const coopIds = q.leaves
    .filter(l => l.method === 'cooperative')
    .map(l => l.leafId);
  if (coopIds.length) {
    try {
      const coopRaw = await h.quoteExit({
        destination,
        feeRate,
        leafIds: coopIds,
      });
      if (coopRaw.funding) throw new Error('co-signed quote needs funding');
      await keepRecovery(h, coopRaw, destination, feeRate);
      leafIds = q.leaves
        .filter(l => l.method !== 'cooperative')
        .map(l => l.leafId);
    } catch {
      // those leaves stay in the main recovery instead
    }
  }
  if (!leafIds.length) return { kept: true };
  await openMainSlot({
    mnemonic: m,
    destination,
    feeRate,
    quote: q,
    leafIds,
    mode: 'recover',
  });
  return { kept: false };
}

export async function cancelExit(m) {
  if (m !== mnemonic) throw new Error(t('unlockFirst'));
  if (running) throw new Error(t('errBusy'));
  if (
    !record ||
    record.recovery !== null ||
    (record.status !== 'awaitingFee' && record.status !== 'needsMoreFee')
  ) {
    throw new Error(t('errCannotCancel'));
  }
  stopPolling();
  const prev = record;
  record = null;
  publish();
  try {
    await archiveExitRecord(identity);
  } catch (err) {
    record = prev;
    startPolling();
    publish();
    throw err;
  }
  await clearExitReminders().catch(() => {});
}

// `temporary`: the higher rate lasts until the steps waiting to confirm now
// (and any sent meanwhile) confirm, then the exit pass drops back.
export async function bumpExitFee(m, feeRate, { temporary = false } = {}) {
  if (m !== mnemonic) throw new Error(t('unlockFirst'));
  if (running) throw new Error(t('errBusy'));
  const v = record && exitView(record, record.tipHeight);
  if (!record || record.status !== 'active' || v.stepsDone === v.stepsTotal) {
    throw new Error(t('errCannotBump'));
  }
  let tempBump = null;
  if (temporary) {
    const ready = v.txs.filter(x => x.status.type === 'ready').map(x => x.txid);
    if (!ready.length) throw new Error(t('errNothingToConfirm'));
    tempBump = {
      baseFeeRate: record.tempBump?.baseFeeRate ?? record.feeRate,
      txids: [...new Set([...(record.tempBump?.txids ?? []), ...ready])],
    };
  }
  const next = {
    ...record,
    feeRate,
    bumpRequested: true,
    tempBump,
    // lets a failed bump be undone
    bumpFrom: record.bumpFrom ?? {
      feeRate: record.feeRate,
      tempBump: record.tempBump ?? null,
    },
  };
  record = next;
  record = await saveExitRecord(identity, next);
  publish();
  requestExitPass();
}

export function subscribeExit(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getExitSnapshot = () => snapshot;

export const useUnilateralExit = () =>
  useSyncExternalStore(subscribeExit, getExitSnapshot);
