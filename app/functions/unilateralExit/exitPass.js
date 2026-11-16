import {
  normalizeExitQuote,
  normalizeExitTx,
  normalizeVerdict,
} from '../spark/breezNormalize';
import { classifyBreezError } from '../spark/breezErrors';
import i18next from 'i18next';
import { encodeRecovery, decodeRecovery } from './exitCodec';

const sum = coins => coins.reduce((n, c) => n + c.valueSats, 0);
const unique = ids => [...new Set(ids)];

// Leftover / retry / release rules follow Glow's unilateral exit
// (leftovers.ts, check.ts, rebuild.ts, quoting.ts, quote.ts).
// Skips that mean "prepare again later".
const RETRY_LATER = new Set([
  'unverified',
  'fundsNotFound',
  'operatorsUnavailable',
]);
// Skips that take a leaf out of the exit.
const LEAVING = new Set(['notRecoverable', 'feeExceedsValue']);
// A leaf the operators still report stopped this long after first seen never moves.
const STOPPED_BLOCKS = 6;
const RETRY_BLOCKS = 6;
// A check that keeps failing this long is rebuilt from the stored leaves.
const CHECK_FAIL_BLOCKS = 2;
const RETRY_MAX_BLOCKS = 144;
// About a week: what is still stuck is let go and the exit finishes.
const RELEASE_BLOCKS = 1008;

const outpoint = i => `${i.txid}:${i.vout}`;
const dedupe = inputs => {
  const seen = new Set();
  return inputs.filter(i => !seen.has(outpoint(i)) && seen.add(outpoint(i)));
};
const missingLeafId = err =>
  /Leaf (\S+) cannot be exited: /.exec(classifyBreezError(err).message)?.[1];

const decode = str => {
  try {
    return decodeRecovery(str);
  } catch {
    return null;
  }
};
const leafIdsOf = recovery =>
  new Set((recovery?.leaves ?? []).map(l => l.leafId));
// named leaves the recovery does not hold: failed co-signs, skipped, not yet built
const leftoverIds = (rec, recovery) => {
  const held = leafIdsOf(recovery);
  return (rec.leafIds ?? []).filter(id => !held.has(id));
};
const failedOf = rec =>
  unique([
    ...leftoverIds(rec, decode(rec.recovery)),
    ...(rec.droppedLeafIds ?? []),
    ...(rec.releasedLeafIds ?? []),
  ]);

const txsOf = (recovery, rn) =>
  (recovery?.transactions ?? []).map(x => ({
    raw: x,
    ...normalizeExitTx(x, rn),
  }));
const isCoop = t => t.kind === 'cooperative';
const isLanded = (recovery, rn) =>
  txsOf(recovery, rn).every(t => t.status.type === 'confirmed');
// no unilateral step in flight: only co-signed ones can be
const isUnilateralLanded = (recovery, rn) =>
  txsOf(recovery, rn).every(t => isCoop(t) || t.status.type === 'confirmed');
const stuckCosigned = (recovery, rn) =>
  unique(
    txsOf(recovery, rn).flatMap(t =>
      isCoop(t) && t.status.type === 'unverified' && t.nodeId ? [t.nodeId] : [],
    ),
  );
const retryTargets = (rec, recovery, rn) => {
  const stuck = stuckCosigned(recovery, rn);
  return [
    ...stuck,
    ...leftoverIds(rec, recovery).filter(id => !stuck.includes(id)),
  ];
};

// Six blocks after the clock starts, then at doubling gaps up to a day.
export function retryDue(rec, tip) {
  const since = rec.retrySince;
  if (since == null) return false;
  const last = Math.max(since, rec.retriedAt ?? since);
  const gap = Math.min(RETRY_MAX_BLOCKS, Math.max(RETRY_BLOCKS, last - since));
  return tip - last >= gap;
}

// Not while a unilateral step is in flight: a leftover waits for the rest to land.
const releaseDue = (rec, tip, recovery, rn) =>
  rec.retrySince != null &&
  tip - rec.retrySince >= RELEASE_BLOCKS &&
  isUnilateralLanded(recovery, rn);

// Nothing can move but through a retry: every step confirmed except co-signed
// ones stuck unverified. The engine polls less often then.
export function isStalled(record, rn) {
  if (record?.status !== 'active') return false;
  const recovery = decode(record.recovery);
  if (!recovery) return false;
  const txs = txsOf(recovery, rn);
  return (
    txs.every(
      t =>
        t.status.type === 'confirmed' ||
        (isCoop(t) && t.status.type === 'unverified'),
    ) &&
    (txs.some(t => isCoop(t) && t.status.type === 'unverified') ||
      leftoverIds(record, recovery).length > 0)
  );
}

// The tip at which each leaf a quote stops was first seen.
const stopClock = (since, q, tip) => {
  const fresh = q.stoppedLeafIds.filter(id => since?.[id] === undefined);
  if (!fresh.length) return { since, tip };
  return {
    since: { ...since, ...Object.fromEntries(fresh.map(id => [id, tip])) },
    tip,
  };
};
// A skip that may yet move. A stopped leaf counts as one until the clock says it
// stayed stopped too long, and always without a clock.
const isProvisional = (skip, q, clock) => {
  if (RETRY_LATER.has(skip.reason)) return true;
  if (
    skip.reason !== 'notRecoverable' ||
    !q.stoppedLeafIds.includes(skip.leafId)
  ) {
    return false;
  }
  const since = clock?.since?.[skip.leafId];
  return !clock || since === undefined || clock.tip - since < STOPPED_BLOCKS;
};
// The leaves among `ids` the quote takes out of the exit; notRecoverable ones are hidden too.
const leavingSkips = (q, ids, clock) => {
  const skips = q.skipped.filter(
    s =>
      LEAVING.has(s.reason) &&
      !isProvisional(s, q, clock) &&
      (!ids || ids.includes(s.leafId)),
  );
  return {
    leaving: new Set(skips.map(s => s.leafId)),
    dropped: skips
      .filter(s => s.reason === 'notRecoverable')
      .map(s => s.leafId),
  };
};
// What `named` still names once `q` has priced it: a leaf listed nowhere landed, one
// skipped as unrecoverable or too dear left. `held` (ids a build holds or failed)
// limits which co-signed quote leaves count: one neither held nor failed landed.
const stillNamed = (named, q, held, clock) => {
  const { leaving } = leavingSkips(q, undefined, clock);
  const priced = [
    ...q.skipped.filter(s => !leaving.has(s.leafId)).map(s => s.leafId),
    ...q.leaves
      .filter(l => !held || held.has(l.leafId) || l.method !== 'cooperative')
      .map(l => l.leafId),
  ];
  const kept = named.filter(id => priced.includes(id));
  return unique([
    ...kept,
    ...priced.filter(
      id => !named.includes(id) && q.leaves.some(l => l.leafId === id),
    ),
  ]);
};

// A step the SDK built while the chain was unreadable stays Unverified on every
// check; with none of the exit's own steps left to send, only a rebuild reads
// the chain again (SDK guide: "An Unverified transaction was rejected").
const stuckOnUnverified = (recovery, rn) => {
  const own = recovery.transactions
    .map(x => normalizeExitTx(x, rn))
    .filter(t => t.kind !== 'cooperative');
  return (
    own.some(t => t.status.type === 'unverified') &&
    !own.some(t => t.status.type === 'ready')
  );
};

// `recovery` with each fresh co-signed tx of `built` in place of its leaf's
// unconfirmed one (or added), and each leaf in `gone` taken out with its
// unconfirmed co-signed tx.
function withCosigned(recovery, built, gone, rn) {
  const fresh = new Map(
    (built?.transactions ?? []).flatMap(x => {
      const t = normalizeExitTx(x, rn);
      return t.kind === 'cooperative' && x.nodeId && !gone.has(x.nodeId)
        ? [[x.nodeId, x]]
        : [];
    }),
  );
  const swapped = new Set();
  const transactions = recovery.transactions.flatMap(x => {
    const t = normalizeExitTx(x, rn);
    if (
      t.kind !== 'cooperative' ||
      t.status.type === 'confirmed' ||
      !x.nodeId
    ) {
      return [x];
    }
    if (gone.has(x.nodeId)) return [];
    const next = fresh.get(x.nodeId);
    if (!next) return [x];
    swapped.add(x.nodeId);
    return next.txid === x.txid ? [x] : [next];
  });
  for (const [id, x] of fresh)
    if (!swapped.has(id) && !transactions.includes(x)) transactions.push(x);
  const held = leafIdsOf(recovery);
  const added = (built?.leaves ?? []).filter(
    l => fresh.has(l.leafId) && !held.has(l.leafId),
  );
  return {
    ...recovery,
    transactions,
    leaves: [
      ...(recovery.leaves ?? []).filter(l => !gone.has(l.leafId)),
      ...added,
    ],
    failed: (recovery.failed ?? []).filter(
      f => !gone.has(f.leafId) && !fresh.has(f.leafId),
    ),
  };
}

// Advances one exit record one step. Order is the contract: any new recovery
// is saved BEFORE the first broadcast.
export async function runExitPass({
  record,
  handle,
  chain,
  feeKey,
  save: rawSave,
  rn,
  now = Date.now,
}) {
  let tip = null;
  try {
    tip = await chain.getTipHeight();
  } catch {}

  // the UI's left-behind count is always derived, never carried
  const save = r =>
    rawSave(
      r.status === 'active' || r.status === 'done'
        ? { ...r, failedLeafIds: failedOf(r) }
        : r,
    );

  const toInputs = coins =>
    coins.map(c => ({
      txid: c.txid,
      vout: c.vout,
      valueSats: c.valueSats,
      pubkey: feeKey.publicKeyHex,
    }));

  const errCoopUnavailable = () =>
    new Error(i18next.t('settings.unilateralExit.errCoopUnavailable'));

  // Quotes exactly `ids` (snapshot imported first). A leaf the SDK no longer
  // has is dropped and the rest quoted again. No raw: nothing left to quote.
  async function quoteIds(rec, ids) {
    if (rec.exitStateSnapshot != null) {
      try {
        await handle.importExitState(rec.exitStateSnapshot);
      } catch {}
    }
    let leafIds = ids;
    const missing = [];
    while (leafIds.length) {
      try {
        const raw = await handle.quoteExit({
          destination: rec.destination,
          feeRate: rec.feeRate,
          leafIds,
        });
        return { raw, q: normalizeExitQuote(raw, rn), leafIds, missing };
      } catch (err) {
        const id = missingLeafId(err);
        if (!leafIds.includes(id)) throw err;
        leafIds = leafIds.filter(l => l !== id);
        missing.push(id);
      }
    }
    return { raw: null, leafIds, missing };
  }

  // quote + build of every named leaf. Returns {recovery, inputs, quote, leafIds, ...},
  // {short: needMoreSats}, {later} (only leaves that may yet move) or {finished}.
  // utxos: every fee-address coin, confirmed or not.
  async function quoteAndBuild(rec, utxos) {
    const coins = utxos.filter(u => u.confirmed);
    // the SDK follows stored inputs (RBF over our own unconfirmed child)
    const inputs = dedupe([...(rec.fundingInputs ?? []), ...toInputs(coins)]);
    const { raw, q, leafIds, missing } = await quoteIds(rec, rec.leafIds);
    const dropped = (more = []) =>
      unique([...(rec.droppedLeafIds ?? []), ...missing, ...more]);
    if (!raw) {
      return {
        finished: true,
        leafIds: [],
        droppedLeafIds: dropped(),
        stoppedSince: rec.stoppedSince,
      };
    }
    const clock = tip != null ? stopClock(rec.stoppedSince, q, tip) : undefined;
    const stoppedSince = clock?.since ?? rec.stoppedSince;
    if (!q.leaves.length) {
      if (
        q.skipped.some(
          s => leafIds.includes(s.leafId) && isProvisional(s, q, clock),
        )
      ) {
        return {
          later: true,
          leafIds,
          droppedLeafIds: dropped(),
          stoppedSince,
        };
      }
      return {
        finished: true,
        leafIds: stillNamed(leafIds, q, null, clock),
        droppedLeafIds: dropped(leavingSkips(q, leafIds, clock).dropped),
        stoppedSince,
      };
    }
    if (
      raw.funding &&
      !rec.fundingInputs?.length &&
      sum(coins) < q.fundingSats
    ) {
      return { short: q.fundingSats - sum(coins) };
    }
    let built;
    try {
      built = await handle.buildExit(raw, inputs, feeKey.secretKey);
    } catch (err) {
      const c = classifyBreezError(err);
      if (c.kind !== 'insufficientCpfp') throw err;
      const required =
        Number(err.inner?.requiredSats) ||
        Number(/need at least (\d+) sats/.exec(c.message)?.[1]) ||
        q.fundingSats;
      // mempool view (confirmed + pending): what the funding is worth now
      const have = rec.fundingInputs?.length ? sum(utxos) : sum(coins);
      return { short: Math.max(required - have, 1) };
    }
    if (!built.transactions.length) {
      // every co-sign failed: a failed build, retried next pass
      if (built.failed.length) throw errCoopUnavailable();
      // everything it named landed between the quote and the build
      return {
        finished: true,
        leafIds: stillNamed(leafIds, { ...q, leaves: [] }, null, clock),
        droppedLeafIds: dropped(leavingSkips(q, leafIds, clock).dropped),
        stoppedSince,
      };
    }
    const held = new Set(
      [...(built.leaves ?? []), ...built.failed].map(l => l.leafId),
    );
    return {
      recovery: built,
      inputs,
      quote: q,
      leafIds: stillNamed(leafIds, q, held),
      droppedLeafIds: dropped(leavingSkips(q, leafIds).dropped),
      stoppedSince,
    };
  }

  const saveActive = (
    rec,
    { recovery, inputs, leafIds, droppedLeafIds, stoppedSince },
  ) =>
    save({
      ...rec,
      status: 'active',
      needMoreSats: 0,
      bumpRequested: false,
      bumpFrom: null,
      recovery: encodeRecovery(recovery),
      fundingInputs: inputs,
      leafIds,
      droppedLeafIds,
      stoppedSince,
      checkFailingSince: undefined,
      checkError: undefined,
    });

  async function broadcast(rec, recovery) {
    const refusals = { ...rec.refusals };
    const sent = [];
    for (const t of recovery.transactions.map(x => normalizeExitTx(x, rn))) {
      const send =
        t.status.type === 'ready' ||
        (t.kind === 'cooperative' && t.status.type === 'unverified');
      if (!send) continue;
      try {
        if (t.cpfpTxHex) await chain.broadcastPackage(t.txHex, t.cpfpTxHex);
        else await chain.broadcastTx(t.txHex);
        delete refusals[t.txid];
        sent.push(t.txid);
      } catch (err) {
        refusals[t.txid] = err.message;
      }
    }
    // Steps sent during a temporary bump went out at the higher rate, so the
    // bump lasts until they confirm too.
    const tempBump = rec.tempBump && {
      ...rec.tempBump,
      txids: [...new Set([...rec.tempBump.txids, ...sent])],
    };
    return save({
      ...rec,
      ...(tempBump && { tempBump }),
      refusals,
      tipHeight: tip ?? rec.tipHeight,
      lastCheckedAt: now(),
    });
  }

  // Prepares the stuck / left-out leaves again and builds what co-signs, with no
  // funding. Returns {rec, recovery, done} or {rebuild: true, rec} when the
  // leftover is unilateral and the exit has landed (a full rebuild is the next part).
  async function retryCosigned(rec, recovery, targets) {
    let paced = { ...rec, retriedAt: tip };
    try {
      const first = await quoteIds(paced, targets);
      const q = first.raw
        ? first.q
        : { leaves: [], skipped: [], stoppedLeafIds: [] };
      const clock = stopClock(paced.stoppedSince, q, tip);
      if (clock.since) paced = { ...paced, stoppedSince: clock.since };
      const listed = new Set([...q.leaves, ...q.skipped].map(l => l.leafId));
      const landedIds = targets.filter(
        id => !listed.has(id) && !first.missing.includes(id),
      );
      const landed = isUnilateralLanded(recovery, rn);
      // A stopped leaf is held until the rest lands: with the operators
      // unreachable the SDK quotes from saved data, which never shows a relabel.
      const { leaving, dropped } = leavingSkips(
        q,
        targets,
        landed ? clock : undefined,
      );
      const gone = new Set([...landedIds, ...leaving, ...first.missing]);
      const unilateral = q.leaves.some(l => l.method !== 'cooperative');
      const inFlight = txsOf(recovery, rn).flatMap(t =>
        isCoop(t) && t.status.type !== 'confirmed' && t.nodeId
          ? [t.nodeId]
          : [],
      );
      if (unilateral && landed && inFlight.every(id => targets.includes(id))) {
        return { rebuild: true, rec: paced };
      }
      // co-signed leaves on their own, so none waits on a unilateral leaf's fee
      const coopIds = q.leaves
        .filter(l => l.method === 'cooperative')
        .map(l => l.leafId);
      let built = null;
      if (coopIds.length) {
        const cq = unilateral ? await quoteIds(paced, coopIds) : first;
        if (cq.raw && cq.q.leaves.length) {
          const b = await handle.buildExit(cq.raw, [], feeKey.secretKey);
          built = b.transactions.length ? b : null;
        }
      }
      const nextRecovery = withCosigned(recovery, built, gone, rn);
      const nextRec = {
        ...paced,
        leafIds: paced.leafIds.filter(id => !gone.has(id)),
        droppedLeafIds: unique([
          ...(paced.droppedLeafIds ?? []),
          ...first.missing,
          ...dropped,
        ]),
      };
      return { rec: nextRec, recovery: nextRecovery };
    } catch {
      // never fails the pass: what was stuck stays, tried again later
      return { rec: paced, recovery };
    }
  }

  // Runs the leftover rules over a checked, unchanged recovery.
  async function retryLeftovers(rec, recovery, retryNow) {
    const targets = retryTargets(rec, recovery, rn);
    if (!targets.length) return { rec, recovery };
    if (releaseDue(rec, tip, recovery, rn)) {
      const gone = new Set(targets);
      return {
        rec: {
          ...rec,
          leafIds: rec.leafIds.filter(id => !gone.has(id)),
          releasedLeafIds: unique([...(rec.releasedLeafIds ?? []), ...targets]),
          retrySince: undefined,
          retriedAt: undefined,
        },
        recovery: withCosigned(recovery, null, gone, rn),
      };
    }
    if (!(retryNow || retryDue(rec, tip))) return { rec, recovery };
    return retryCosigned(rec, recovery, targets);
  }

  // Nothing is built and nothing the exit named is still to come.
  const completes = (rec, recovery) =>
    !recovery.transactions.length && !leftoverIds(rec, recovery).length;

  let rec = record;
  let recovery; // what to broadcast

  if (rec.status === 'awaitingFee' || rec.status === 'needsMoreFee') {
    // A live recovery waiting on more fee keeps being checked and sent.
    const waiting = rec.recovery != null ? decode(rec.recovery) : null;
    if (waiting) {
      let res = null;
      try {
        res = await handle.checkExit(waiting);
      } catch {
        // an unreadable check never holds a step back or the rebuild below
        rec = await broadcast(rec, waiting);
      }
      if (res) {
        let verdict = normalizeVerdict(res.verdict, rn);
        if (verdict.type === 'done') {
          if (!leftoverIds(rec, res.recovery).length) {
            return save({ ...rec, status: 'done' });
          }
          verdict = { type: 'valid' };
        }
        if (verdict.type === 'valid') {
          rec = await save({ ...rec, recovery: encodeRecovery(res.recovery) });
          rec = await broadcast(rec, res.recovery);
        }
      }
    }
    const utxos = await chain.getAddressUtxos(feeKey.address);
    const coins = utxos.filter(u => u.confirmed);
    const feeSeen = {
      confirmedSats: sum(coins),
      pendingSats: sum(utxos.filter(u => !u.confirmed)),
    };
    const seenChanged =
      feeSeen.confirmedSats !== (rec.feeSeen?.confirmedSats ?? 0) ||
      feeSeen.pendingSats !== (rec.feeSeen?.pendingSats ?? 0);
    if (seenChanged) rec = { ...rec, feeSeen };
    const flush = () => (seenChanged ? save(rec) : rec);

    if (
      !coins.length &&
      !rec.fundingInputs?.length &&
      rec.quote.fundingSats !== 0
    ) {
      return flush();
    }

    const res = await quoteAndBuild(rec, utxos);
    if (res.short) {
      if (rec.status === 'needsMoreFee' && rec.needMoreSats === res.short) {
        return flush();
      }
      return save({ ...rec, status: 'needsMoreFee', needMoreSats: res.short });
    }
    // nothing sent yet: stays cancellable, retried next pass
    if (res.later) throw errCoopUnavailable();
    if (res.finished) {
      return save({
        ...rec,
        status: 'done',
        leafIds: res.leafIds,
        droppedLeafIds: res.droppedLeafIds,
        stoppedSince: res.stoppedSince,
      });
    }
    rec = await saveActive(rec, res);
    recovery = res.recovery;
  } else if (rec.status === 'active') {
    const stored = decode(rec.recovery);
    let verdict = { type: 'redo' };
    let checked = null;
    let checkedNow = false;
    let unreadableNow = false;
    let doneSet = false;
    let retryNow = false;
    if (stored) {
      const unbuilt =
        !stored.transactions.length && leftoverIds(rec, stored).length > 0;
      if (unbuilt) {
        // nothing built to read back, only leftovers to try
        checked = stored;
        verdict = { type: 'valid' };
      } else {
        let res = null;
        try {
          res = await handle.checkExit(stored);
        } catch (err) {
          // a failing check never holds a step back
          const failingSince = rec.checkFailingSince ?? tip;
          const unreadable =
            tip != null &&
            (classifyBreezError(err).kind === 'invalidInput' ||
              (!err?.tag && err instanceof TypeError) ||
              tip - failingSince >= CHECK_FAIL_BLOCKS);
          const checkError = classifyBreezError(err).message;
          if (!unreadable || rec.unreadableRebuiltAt === tip) {
            return broadcast(
              {
                ...rec,
                checkFailingSince: failingSince,
                ...(unreadable && { checkError }),
              },
              stored,
            );
          }
          // the recovery cannot be read: rebuild it from the stored leaves
          checked = stored;
          verdict = { type: 'valid' };
          unreadableNow = true;
          rec = {
            ...rec,
            checkFailingSince: failingSince,
            unreadableRebuiltAt: tip,
            checkError,
          };
        }
        if (res) {
          checked = res.recovery;
          verdict = normalizeVerdict(res.verdict, rn);
          if (rec.checkFailingSince != null || rec.checkError != null) {
            rec = {
              ...rec,
              checkFailingSince: undefined,
              checkError: undefined,
            };
          }
        }
      }
      checkedNow = !unreadableNow;
      const leftovers = leftoverIds(rec, checked);
      if (verdict.type === 'done') {
        if (!leftovers.length) return save({ ...rec, status: 'done' });
        // the Done verdict covers only the set: a leaf it left out is still part of the exit
        doneSet = true;
        verdict = { type: 'valid' };
      }
      if (tip != null) {
        const retriedAt = rec.retriedAt;
        // the week runs from the pass the last unilateral step lands
        const landsNow =
          leftovers.length > 0 &&
          !isUnilateralLanded(stored, rn) &&
          isUnilateralLanded(checked, rn);
        if (landsNow) rec = { ...rec, retrySince: tip, retriedAt: undefined };
        if (retryTargets(rec, checked, rn).length) {
          if (rec.retrySince == null) rec = { ...rec, retrySince: tip };
        } else if (rec.retrySince != null || rec.retriedAt != null) {
          rec = { ...rec, retrySince: undefined, retriedAt: undefined };
        }
        retryNow =
          landsNow || (doneSet && (!isLanded(stored, rn) || retriedAt == null));
      }
    }

    // Why a valid recovery is rebuilt anyway ("soft": the checked recovery
    // keeps going if the rebuild falls short or fails). A pending bump never
    // stops the check/broadcast above.
    const before = rec;
    let soft = null;
    if (verdict.type === 'valid') {
      if (unreadableNow) {
        soft = 'unreadable';
      } else if (rec.bumpRequested) {
        soft = 'bump';
      } else if (
        rec.tempBump &&
        rec.tempBump.txids.every(id =>
          checked.transactions.some(x => {
            const t = normalizeExitTx(x, rn);
            return t.txid === id && t.status.type === 'confirmed';
          }),
        )
      ) {
        // a temporary bump ends once every step sent at the higher rate has
        // confirmed: rebuild at the base rate before anything new goes out
        soft = 'revert';
        rec = { ...rec, feeRate: rec.tempBump.baseFeeRate, tempBump: null };
      } else if (
        tip != null &&
        rec.unverifiedRebuiltAt !== tip &&
        stuckOnUnverified(checked, rn)
      ) {
        soft = 'unverified';
        rec = { ...rec, unverifiedRebuiltAt: tip };
      }
    }
    if (verdict.type === 'valid') {
      rec = { ...rec, recovery: encodeRecovery(checked) };
    }
    const keepChecked = async () => {
      rec = await save(rec);
      return broadcast(rec, checked);
    };

    // Rebuilds every named leaf. Returns a record to finish the pass with, or
    // null once `rec`/`recovery` hold a new recovery to broadcast. `soft`
    // rebuilds ('retry' included) never lose the checked recovery.
    const rebuild = async kind => {
      let utxos;
      try {
        utxos = await chain.getAddressUtxos(feeKey.address);
      } catch {
        if (kind === 'revert') return before; // a revert retries next pass
        if (kind) return keepChecked(); // a bump stays requested
        return before;
      }
      let res;
      try {
        res = await quoteAndBuild(rec, utxos);
      } catch (err) {
        if (
          kind === 'unverified' ||
          kind === 'revert' ||
          kind === 'retry' ||
          kind === 'unreadable'
        ) {
          return keepChecked();
        }
        if (kind === 'bump') {
          // undo the bump so a failing rebuild is not retried forever
          rec = {
            ...rec,
            feeRate: rec.bumpFrom?.feeRate ?? rec.feeRate,
            tempBump: rec.bumpFrom ? rec.bumpFrom.tempBump : rec.tempBump,
            bumpRequested: false,
            bumpFrom: null,
            needMoreSats: 0,
          };
          await keepChecked();
        }
        // a failed hard rebuild sends nothing: a diverged exit is never broadcast
        throw err;
      }
      if (res.short) {
        // a revert can't be short at a lower rate, but never stall: send what we have
        if (kind === 'revert' || kind === 'unverified') return keepChecked();
        if (kind === 'bump') {
          // stays requested: retried once the top-up confirms
          rec = { ...rec, needMoreSats: res.short };
          return keepChecked();
        }
        if (kind === 'retry' || kind === 'unreadable') {
          rec = { ...rec, status: 'needsMoreFee', needMoreSats: res.short };
          return keepChecked();
        }
        return save({
          ...rec,
          status: 'needsMoreFee',
          needMoreSats: res.short,
        });
      }
      if (res.later) {
        // only leaves that may yet move: wait for them, send nothing new
        rec = {
          ...rec,
          leafIds: res.leafIds,
          droppedLeafIds: res.droppedLeafIds,
          stoppedSince: res.stoppedSince,
        };
        if (kind) return keepChecked();
        if (checked) rec = { ...rec, recovery: encodeRecovery(checked) };
        return save(rec);
      }
      if (res.finished) {
        return save({
          ...rec,
          status: 'done',
          leafIds: res.leafIds,
          droppedLeafIds: res.droppedLeafIds,
          stoppedSince: res.stoppedSince,
        });
      }
      rec = await saveActive(rec, res);
      recovery = res.recovery;
      return null;
    };

    if (verdict.type === 'valid' && !soft) {
      recovery = checked;
      let rebuilt = false;
      if (tip != null && checkedNow) {
        const r = await retryLeftovers(rec, recovery, retryNow);
        rec = r.rec;
        if (r.rebuild) {
          const out = await rebuild('retry');
          if (out) return out;
          rebuilt = true;
        } else {
          recovery = r.recovery;
          rec = { ...rec, recovery: encodeRecovery(recovery) };
          if (completes(rec, recovery)) return save({ ...rec, status: 'done' });
        }
      }
      if (!rebuilt) rec = await save(rec);
    } else {
      const out = await rebuild(soft);
      if (out) return out;
    }
    // what the Done verdict waited on is settled: the exit is finished
    if (
      doneSet &&
      isLanded(recovery, rn) &&
      leftoverIds(rec, recovery).length === 0
    ) {
      return save({ ...rec, status: 'done' });
    }
  } else {
    return rec;
  }

  return broadcast(rec, recovery);
}
