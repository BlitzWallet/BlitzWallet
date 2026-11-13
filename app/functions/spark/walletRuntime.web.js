// Deep relative imports on purpose: the package's `web/index.js` calls init()
// without a wasm URL (import.meta is null after unstable_transformImportMeta)
// and swallows storage load failures. See appendix-G-pwa-wasm.md section 1.7.
import init, * as breez from '../../../node_modules/@breeztech/breez-sdk-spark/web/breez_sdk_spark_wasm.js';
import { createDefaultStorage } from '../../../node_modules/@breeztech/breez-sdk-spark/web/storage/index.js';
import { createWebTreeStore } from '../../../node_modules/@breeztech/breez-sdk-spark/web/tree-store/index.js';

import sha256Hash from '../hash';
import { deriveSparkIdentityKey } from '../gift/deriveGiftWallet';
import { applyBlitzConfig } from './breezConfig';
import { classifyBreezError } from './breezErrors';
import {
  normalizeClaimOutcome,
  normalizeClaimQuote,
  normalizeDeposits,
  normalizeEvent,
  normalizeInfo,
  normalizePayment,
  normalizeRecoverPreview,
} from './breezNormalize';
import { sdkLogger } from './sdkLogs';
import { acquireWebDatabaseOwnership } from '../webDatabaseOwnership.web';

// Metro resolves a .wasm require to its served asset URL string.
const wasmUrl = require('../../../node_modules/@breeztech/breez-sdk-spark/web/breez_sdk_spark_wasm_bg.wasm');

const { RuntimeError, CompileError } = globalThis.WebAssembly;

const CONNECT_TIMEOUT_MS = 30000;
const READ_TIMEOUT_MS = 5000;
const DISCONNECT_TIMEOUT_MS = 10000;
const DERIVED_TTL_MS = 60000;

let ready = null;
const handles = new Map();
const acquiring = new Map();
const disposing = new Map(); // identity -> in-flight close promise
let poisoned = false;

// Errors from prepare() happen before anything is sent (see withSendIntent).
const tagPreSend = e => {
  if (e && typeof e === 'object') e.preSend = true;
  throw e;
};

const delay = ms => new Promise(r => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            Object.assign(new Error(`${label} timed out`), { kind: 'timeout' }),
          ),
        ms,
      );
    }),
  ]);
}

export function ensureBreez() {
  if (poisoned) {
    const e = new Error('Breez runtime is dead; reload required');
    e.code = 'BreezRuntimeDead';
    e.requiresReload = true;
    return Promise.reject(e);
  }
  if (!ready) {
    ready = (async () => {
      globalThis.createDefaultStorage = createDefaultStorage;
      globalThis.createDefaultTreeStore = (db, logger) =>
        createWebTreeStore(`${db}-tree`, logger);
      // Ask for durable storage before the SDK writes anything.
      await navigator.storage?.persist?.();
      await init({ module_or_path: wasmUrl });
      await breez
        .initLogging(sdkLogger, 'info')
        .catch(err => console.log('breez initLogging error', err));
    })().catch(err => {
      ready = null;
      // SPA fallback served HTML for the .wasm: the deploy is stale.
      if (err instanceof CompileError) err.code = 'BreezStaleDeploy';
      throw err;
    });
  }
  return ready;
}

async function identityFor(mnemonic) {
  const d = await deriveSparkIdentityKey(mnemonic, 1);
  if (!d?.publicKeyHex) throw new Error('Unable to derive Spark identity');
  return d.publicKeyHex;
}

const storageDirFor = identity => `blitz-breez/${identity}`;

// A Rust panic is a wasm trap (panic = abort); the instance memory can no
// longer be trusted. Every later call fails until the page reloads.
function poison(err) {
  poisoned = true;
  err.code = err.code || 'BreezRuntimeDead';
  err.kind = 'fatal';
  err.requiresReload = true;
  return err;
}

async function call(fn) {
  try {
    return await fn();
  } catch (e) {
    if (
      e instanceof RuntimeError ||
      e instanceof CompileError ||
      /unreachable/i.test(String(e?.message))
    ) {
      throw poison(e);
    }
    throw e;
  }
}

function attach(sdk, entry) {
  return sdk
    .addEventListener({
      onEvent: e => {
        try {
          const n = normalizeEvent(e, false);
          if (!n) return;
          if (
            n.type === 'synced' ||
            n.type === 'paymentSucceeded' ||
            n.type === 'claimedDeposits'
          ) {
            entry.lastVerifiedAt = Date.now();
          }
          for (const cb of entry.listeners) cb(n);
        } catch (err) {
          console.log('Breez web event error', err);
        }
      },
    })
    .then(id => {
      entry.listenerId = id;
    });
}

function makeHandle(entry) {
  const sdk = entry.sdk;
  const prepareRecover = (destination, feeRateSatPerVbyte) =>
    call(() =>
      sdk.prepareRecoverFunds({
        feeRateSatPerVbyte: Number(feeRateSatPerVbyte),
        fundingKind: { type: 'p2wpkh' },
        destination,
        selection: { type: 'all' },
      }),
    );
  return {
    _entry: entry,
    identity: entry.identity,
    mode: entry.mode,
    async getInfo() {
      return normalizeInfo(
        await call(() =>
          withTimeout(
            sdk.getInfo({ ensureSynced: undefined }),
            READ_TIMEOUT_MS,
            'getInfo',
          ),
        ),
      );
    },
    async sync(timeoutMs = 15000) {
      try {
        await call(() =>
          withTimeout(sdk.syncWallet({}), timeoutMs, 'syncWallet'),
        );
        return { timedOut: false };
      } catch (e) {
        if (e?.requiresReload) throw e;
        return {
          timedOut: e?.kind === 'timeout',
          error: classifyBreezError(e),
        };
      }
    },
    async receive(spec) {
      const method =
        spec.type === 'sparkAddress'
          ? { type: 'sparkAddress' }
          : spec.type === 'sparkInvoice'
          ? {
              type: 'sparkInvoice',
              amount: spec.amount != null ? BigInt(spec.amount) : undefined,
              tokenIdentifier: spec.tokenIdentifier,
              expiryTime:
                spec.expiryTime != null ? Number(spec.expiryTime) : undefined,
              description: spec.description,
              senderPublicKey: spec.senderPublicKey,
            }
          : spec.type === 'bitcoinAddress'
          ? { type: 'bitcoinAddress', newAddress: !!spec.newAddress }
          : {
              type: 'bolt11Invoice',
              description: spec.description || '',
              amountSats:
                spec.amountSats != null ? Number(spec.amountSats) : undefined,
              expirySecs: spec.expirySecs,
              paymentHash: spec.paymentHash,
              receiverIdentityPublicKey: spec.receiverIdentityPublicKey,
              preimage: spec.preimage,
            };
      const res = await call(() =>
        sdk.receivePayment({ paymentMethod: method }),
      );
      return { request: res.paymentRequest, feeSats: BigInt(res.fee) };
    },
    async prepare(input, opts = {}) {
      return call(() =>
        sdk.prepareSendPayment({
          paymentRequest: { type: 'input', input },
          amount: opts.amount != null ? BigInt(opts.amount) : undefined,
          tokenIdentifier: opts.tokenIdentifier,
          conversionOptions: undefined,
          feePolicy: opts.feesIncluded ? 'feesIncluded' : undefined,
        }),
      ).catch(tagPreSend);
    },
    async send(prepared, opts = {}) {
      let options;
      if (opts.bolt11) {
        options = {
          type: 'bolt11Invoice',
          preferSpark: !!opts.bolt11.preferSpark,
          completionTimeoutSecs: opts.bolt11.completionTimeoutSecs,
        };
      } else if (opts.onchainSpeed) {
        options = {
          type: 'bitcoinAddress',
          confirmationSpeed: opts.onchainSpeed,
        };
      } else if (prepared?.paymentMethod?.type === 'sparkAddress') {
        options = { type: 'sparkAddress', htlcOptions: undefined };
      }
      const res = await call(() =>
        sdk.sendPayment({
          prepareResponse: prepared,
          options,
          idempotencyKey: opts.intentId,
        }),
      );
      entry.lastVerifiedAt = Date.now();
      return normalizePayment(res.payment, false);
    },
    async sendTokenBatch(recipients) {
      const prep = await call(() =>
        sdk.prepareSendBatch({
          recipients: recipients.map(r => ({
            paymentRequest: r.destination,
            amount: BigInt(r.amount),
            tokenIdentifier: r.tokenIdentifier,
          })),
        }),
      );
      const res = await call(() => sdk.sendBatch({ prepareResponse: prep }));
      return (res.payments || []).map(p => normalizePayment(p, false));
    },
    // typeFilter / statusFilter take plain strings ('send', 'completed', ...).
    async listPayments(q = {}) {
      const res = await call(() =>
        sdk.listPayments({
          typeFilter: q.typeFilter,
          statusFilter: q.statusFilter,
          assetFilter: q.assetFilter,
          paymentDetailsFilter: q.paymentDetailsFilter,
          fromTimestamp:
            q.fromTimestamp != null ? Number(q.fromTimestamp) : undefined,
          toTimestamp:
            q.toTimestamp != null ? Number(q.toTimestamp) : undefined,
          offset: q.offset,
          limit: q.limit,
          sortAscending: q.sortAscending,
        }),
      );
      return (res.payments || []).map(p => normalizePayment(p, false));
    },
    async getPayment(id) {
      try {
        const res = await call(() => sdk.getPayment({ paymentId: id }));
        return normalizePayment(res.payment, false);
      } catch (e) {
        const c = classifyBreezError(e);
        // Breez reports a missing row as invalidInput "Not found" or as a storage
        // error ("Query returned no rows" native, "... not found" web).
        if (
          (c.kind === 'invalidInput' || c.kind === 'storage') &&
          /not found|no rows/i.test(c.message)
        ) {
          return null;
        }
        throw e;
      }
    },
    async signMessage(message, compact) {
      return (
        await call(() => sdk.signMessage({ message, compact: !!compact }))
      ).signature;
    },
    // Raw 32-byte digest, NOT hashed again (identity key, path 'm').
    async signDigest(digest) {
      if (!(digest instanceof Uint8Array) || digest.length !== 32) {
        throw new Error('signDigest expects a 32-byte Uint8Array');
      }
      const out = await call(() =>
        entry.signers.breezSigner.signEcdsa({ bytes: Array.from(digest) }, 'm'),
      );
      return Uint8Array.from(out.bytes);
    },
    async exportExitState() {
      return (await call(() => sdk.exportUnilateralExitState())).exitState;
    },
    async importExitState(exitState) {
      return call(() => sdk.importUnilateralExitState({ exitState }));
    },
    async prepareRecoverFunds(request) {
      return call(() => sdk.prepareRecoverFunds(request));
    },
    async recoverFunds(request, signer) {
      return call(() => sdk.recoverFunds(request, signer));
    },
    async checkRecoverFunds(request) {
      return call(() => sdk.checkRecoverFunds(request));
    },
    // Quote only: prepareRecoverFunds builds nothing and broadcasts nothing.
    async previewRecoverFunds(destination, feeRateSatPerVbyte) {
      const prepared = await prepareRecover(destination, feeRateSatPerVbyte);
      return normalizeRecoverPreview(prepared, false);
    },
    // Broadcasts. Only quotes with no outside CPFP funding: Blitz has no
    // external UTXO signer, so a funded quote is refused before any signing.
    async recoverFundsWithoutFunding(destination, feeRateSatPerVbyte) {
      const prepared = await prepareRecover(destination, feeRateSatPerVbyte);
      if (prepared.funding) throw new Error('Exit needs outside funding');
      const res = await call(() => sdk.recoverFunds({ prepared }, null));
      return {
        txCount: res.transactions.length,
        failedCount: res.failed.length,
      };
    },
    async recommendedFees() {
      const f = await call(() => sdk.recommendedFees());
      return {
        fastestFee: Number(f.fastestFee),
        halfHourFee: Number(f.halfHourFee),
        hourFee: Number(f.hourFee),
      };
    },
    // Deposits: normalized (see breezNormalize) so callers see one shape.
    async listUnclaimedDeposits() {
      return normalizeDeposits(
        await call(() => sdk.listUnclaimedDeposits({})),
        false,
      );
    },
    async fetchClaimDepositQuote(txid, vout) {
      return normalizeClaimQuote(
        await call(() => sdk.fetchClaimDepositQuote({ txid, vout })),
        false,
      );
    },
    // maxFee: undefined or { type: 'fixed', amount } | { type: 'rate', satPerVbyte }
    async claimDeposit(txid, vout, maxFee) {
      const res = await call(() =>
        sdk.claimDeposit({
          txid,
          vout,
          maxFee: maxFee ? { onchain: maxFee } : undefined,
        }),
      );
      return normalizeClaimOutcome(res, false);
    },
    // fee: { type: 'fixed', amount } | { type: 'rate', satPerVbyte }
    async refundDeposit(txid, vout, destinationAddress, fee) {
      return call(() =>
        sdk.refundDeposit({ txid, vout, destinationAddress, fee }),
      );
    },
    async claimHtlcPayment(preimage) {
      const res = await call(() => sdk.claimHtlcPayment({ preimage }));
      entry.lastVerifiedAt = Date.now();
      return normalizePayment(res.payment, false);
    },
    async getUserSettings() {
      return call(() => sdk.getUserSettings());
    },
    async updateUserSettings(settings) {
      return call(() =>
        sdk.updateUserSettings({
          sparkPrivateModeEnabled: settings.sparkPrivateModeEnabled,
        }),
      );
    },
    on(cb) {
      entry.listeners.add(cb);
      return () => entry.listeners.delete(cb);
    },
    lastVerifiedAt() {
      return entry.lastVerifiedAt || null;
    },
    async dispose({ wipe = false } = {}) {
      await disposeEntry(entry, { wipe });
    },
  };
}

async function createEntry(
  mnemonic,
  mode,
  expectedIdentity,
  storageDirOverride,
) {
  await ensureBreez();
  const ownership = await acquireWebDatabaseOwnership();
  if (!ownership) throw new Error('Web database ownership unavailable');

  const identity = await identityFor(mnemonic);
  if (expectedIdentity && identity !== expectedIdentity) {
    const e = new Error('IdentityMismatch');
    e.code = 'IdentityMismatch';
    throw e;
  }

  const base =
    mode === 'server'
      ? breez.defaultServerConfig('mainnet')
      : breez.defaultConfig('mainnet');
  const config = applyBlitzConfig(base, mode);
  let connectPromise;
  let sdk;
  try {
    sdk = await call(() => {
      connectPromise = breez.connect({
        config,
        seed: { type: 'mnemonic', mnemonic },
        storageDir: storageDirOverride || storageDirFor(identity),
      });
      return withTimeout(connectPromise, CONNECT_TIMEOUT_MS, 'breez connect');
    });
  } catch (e) {
    // A late-resolving connect must not leak a live SDK.
    connectPromise?.then(
      late => Promise.resolve().then(() => late.disconnect()).catch(() => {}),
      () => {},
    );
    throw e;
  }

  let signers;
  try {
    const info = await call(() =>
      withTimeout(
        sdk.getInfo({ ensureSynced: undefined }),
        READ_TIMEOUT_MS,
        'identity gate',
      ),
    );
    if (info.identityPubkey !== identity) {
      const e = new Error('IdentityMismatch');
      e.code = 'IdentityMismatch';
      throw e;
    }

    signers = breez.defaultExternalSigners(
      mnemonic,
      undefined,
      'mainnet',
      undefined,
    );
    const entry = {
      mnemonicHash: sha256Hash(mnemonic),
      identity,
      mode,
      storageDir: storageDirOverride || storageDirFor(identity),
      sdk,
      signers,
      listenerId: null,
      refs: 1,
      listeners: new Set(),
      lastVerifiedAt: 0,
      releaseTimer: null,
      disposed: false,
    };
    await attach(sdk, entry);
    return entry;
  } catch (e) {
    await sdk.disconnect().catch(() => {});
    try {
      sdk.free?.();
      signers?.free?.();
    } catch {}
    throw e;
  }
}

export async function acquire(mnemonic, opts = {}) {
  const mode = opts.mode || 'client';
  const identity = opts.expectedIdentity || (await identityFor(mnemonic));
  const key = `${mode}:${identity}`;

  // borrow: reuse whatever live instance a flow opened (any mode), without
  // taking a reference. Facade calls use this; owners acquire/release.
  if (opts.borrow) {
    const liveHandle = () => {
      for (const m of ['client', 'server']) {
        const e = handles.get(`${m}:${identity}`);
        if (e && !e.disposed) return e.handle;
      }
    };
    const live = liveHandle();
    if (live) return live;
    // An acquire in flight (either mode) will produce the live instance.
    const pending = ['client', 'server']
      .map(m => acquiring.get(`${m}:${identity}`))
      .filter(Boolean);
    if (pending.length) {
      await Promise.all(pending.map(p => p.catch(() => {})));
      const afterWait = liveHandle();
      if (afterWait) return afterWait;
    }
  }

  // One live instance per identity per process (the two modes share storage).
  const other = handles.get(
    `${mode === 'client' ? 'server' : 'client'}:${identity}`,
  );
  if (other && !other.disposed) {
    if (other.refs > 0) {
      throw new Error('Spark identity is already open in a different mode');
    }
    // Only a pending TTL release holds it: close it now.
    await disposeEntry(other);
  }
  // Never connect to a storage dir whose previous instance is still closing.
  if (disposing.has(identity)) await disposing.get(identity);

  const existing = handles.get(key);
  if (existing && !existing.disposed) {
    existing.refs += 1;
    if (existing.releaseTimer) {
      clearTimeout(existing.releaseTimer);
      existing.releaseTimer = null;
    }
    return existing.handle;
  }
  if (acquiring.has(key)) {
    const inFlight = acquiring.get(key);
    if (!inFlight.borrowed || opts.borrow) return inFlight;
    // Joining a borrow-opened instance as an owner: take a real reference.
    await inFlight.catch(() => {});
    return acquire(mnemonic, opts);
  }

  // Other mode still connecting: wait, then re-run the cross-mode check.
  const otherPending = acquiring.get(
    `${mode === 'client' ? 'server' : 'client'}:${identity}`,
  );
  if (otherPending) {
    await otherPending.catch(() => {});
    return acquire(mnemonic, opts);
  }
  const p = createEntry(mnemonic, mode, identity, opts.storageDir)
    .then(entry => {
      entry.handle = makeHandle(entry);
      handles.set(key, entry);
      if (opts.borrow) {
        // Unowned: close by itself unless an owner acquires it meanwhile.
        entry.refs = 0;
        entry.releaseTimer = setTimeout(
          () => disposeEntry(entry),
          DERIVED_TTL_MS,
        );
      }
      return entry.handle;
    })
    .finally(() => acquiring.delete(key));
  p.borrowed = !!opts.borrow;
  acquiring.set(key, p);
  return p;
}

// The wasm names its IndexedDB databases `<storageDir>/mainnet/<hash8>` and
// `<...>-tree`, so everything under the identity's dir prefix is ours.
async function deleteWebStorage(base) {
  const names = await indexedDB.databases?.();
  await Promise.all(
    (names || [])
      .filter(({ name }) => name === base || name?.startsWith(`${base}/`))
      .map(
        ({ name }) =>
          new Promise(resolve => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
  );
}

function disposeEntry(entry, opts = {}) {
  if (!entry || entry.disposed) return disposing.get(entry?.identity);
  entry.disposed = true;
  const p = closeEntry(entry, opts).finally(() => {
    if (disposing.get(entry.identity) === p) disposing.delete(entry.identity);
  });
  disposing.set(entry.identity, p);
  return p;
}

async function closeEntry(entry, { wipe = false } = {}) {
  entry.listeners.clear();
  if (entry.releaseTimer) clearTimeout(entry.releaseTimer);
  try {
    if (entry.listenerId) await entry.sdk.removeEventListener(entry.listenerId);
  } catch {}
  try {
    await Promise.race([entry.sdk.disconnect(), delay(DISCONNECT_TIMEOUT_MS)]);
  } catch {}
  try {
    entry.sdk.free?.();
    entry.signers?.free?.();
  } catch {}
  if (wipe) await deleteWebStorage(entry.storageDir);
  const key = `${entry.mode}:${entry.identity}`;
  if (handles.get(key) === entry) handles.delete(key);
}

export async function release(handle, opts = {}) {
  const entry = handle?._entry;
  if (!entry || entry.disposed) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  if (opts.immediate) return disposeEntry(entry, opts);
  entry.releaseTimer = setTimeout(
    () => disposeEntry(entry, opts),
    opts.ttlMs ?? DERIVED_TTL_MS,
  );
}

export async function disposeIdentity(mnemonic, opts = {}) {
  const identity = await identityFor(mnemonic);
  for (const mode of ['client', 'server']) {
    await acquiring.get(`${mode}:${identity}`)?.catch(() => {});
  }
  for (const mode of ['client', 'server']) {
    const entry = handles.get(`${mode}:${identity}`);
    if (entry) await disposeEntry(entry, opts);
  }
}

// Live handle for an identity in any mode (no reference taken), else null.
export function peek(identity) {
  for (const m of ['client', 'server']) {
    const e = handles.get(`${m}:${identity}`);
    if (e && !e.disposed) return e.handle;
  }
  return null;
}

export const isAppActive = () => document.visibilityState === 'visible';

export { withTimeout, identityFor, storageDirFor };
