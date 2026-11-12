import { AppState } from 'react-native';
import { documentDirectory, deleteAsync } from 'expo-file-system/legacy';
import {
  connect,
  defaultConfig,
  defaultServerConfig,
  defaultExternalSigners,
  Network,
  Seed,
  Fee,
  FeePolicy,
  MaxOnchainFee,
  PaymentRequest,
  PaymentStatus,
  PaymentType,
  OnchainConfirmationSpeed,
  SendPaymentOptions,
  ReceivePaymentMethod,
  ListPaymentsRequest,
  AssetFilter,
  CpfpFundingKind,
  ExitLeafSelection,
  initLogging,
} from '@breeztech/breez-sdk-spark-react-native';

import sha256Hash from '../hash';
import { deriveSparkIdentityKey } from '../gift/deriveGiftWallet';
import { applyBlitzConfig, storageRootFromDocumentDir } from './breezConfig';
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

const CONNECT_TIMEOUT_MS = 30000;
const READ_TIMEOUT_MS = 5000;
const DISCONNECT_TIMEOUT_MS = 10000;
const DERIVED_TTL_MS = 60000;

// initLogging may be called once per process.
let loggingStarted = false;
function startLogging() {
  if (loggingStarted) return;
  loggingStarted = true;
  try {
    initLogging(undefined, sdkLogger, 'info');
  } catch (err) {
    console.log('breez initLogging error', err);
  }
}

const SPEEDS = {
  fast: OnchainConfirmationSpeed.Fast,
  medium: OnchainConfirmationSpeed.Medium,
  slow: OnchainConfirmationSpeed.Slow,
};
const TYPES = { send: PaymentType.Send, receive: PaymentType.Receive };
const STATUSES = {
  completed: PaymentStatus.Completed,
  pending: PaymentStatus.Pending,
  failed: PaymentStatus.Failed,
};

const handles = new Map();
const acquiring = new Map();
const disposing = new Map(); // identity -> in-flight close promise
const activeApp = { value: AppState.currentState === 'active' };

AppState.addEventListener('change', state => {
  activeApp.value = state === 'active';
});

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

// Errors from prepare() happen before anything is sent (see withSendIntent).
const tagPreSend = e => {
  if (e && typeof e === 'object') e.preSend = true;
  throw e;
};

const delay = ms => new Promise(r => setTimeout(r, ms));

async function identityFor(mnemonic) {
  const d = await deriveSparkIdentityKey(mnemonic, 1);
  if (!d?.publicKeyHex) throw new Error('Unable to derive Spark identity');
  return d.publicKeyHex;
}

function storageDirFor(identity) {
  return `${storageRootFromDocumentDir(documentDirectory)}${identity}`;
}

async function disconnectQuietly(sdk) {
  try {
    await Promise.race([sdk.disconnect(), delay(DISCONNECT_TIMEOUT_MS)]);
  } catch {}
}

function attach(sdk, entry) {
  const listener = {
    onEvent: async event => {
      try {
        const normalized = normalizeEvent(event, true);
        if (!normalized) return;
        if (
          normalized.type === 'synced' ||
          normalized.type === 'paymentSucceeded' ||
          normalized.type === 'claimedDeposits'
        ) {
          entry.lastVerifiedAt = Date.now();
        }
        for (const cb of entry.listeners) cb(normalized);
      } catch (err) {
        console.log('Breez event handler error', err);
      }
    },
  };
  return sdk.addEventListener(listener).then(id => {
    entry.listenerId = id;
  });
}

function makeHandle(entry) {
  const sdk = entry.sdk;
  const prepareRecover = (destination, feeRateSatPerVbyte) =>
    sdk.prepareRecoverFunds({
      feeRateSatPerVbyte: BigInt(feeRateSatPerVbyte),
      fundingKind: new CpfpFundingKind.P2wpkh(),
      fundingStrategy: undefined,
      destination,
      selection: new ExitLeafSelection.All(),
    });
  return {
    _entry: entry,
    identity: entry.identity,
    mode: entry.mode,
    async getInfo() {
      const info = await withTimeout(
        sdk.getInfo({ ensureSynced: undefined }),
        READ_TIMEOUT_MS,
        'getInfo',
      );
      return normalizeInfo(info);
    },
    async sync(timeoutMs = 15000) {
      try {
        await withTimeout(sdk.syncWallet({}), timeoutMs, 'syncWallet');
        return { timedOut: false };
      } catch (e) {
        return {
          timedOut: e?.kind === 'timeout',
          error: classifyBreezError(e),
        };
      }
    },
    async receive(spec) {
      const method =
        spec.type === 'sparkAddress'
          ? new ReceivePaymentMethod.SparkAddress()
          : spec.type === 'sparkInvoice'
          ? new ReceivePaymentMethod.SparkInvoice({
              amount: spec.amount != null ? BigInt(spec.amount) : undefined,
              tokenIdentifier: spec.tokenIdentifier,
              expiryTime:
                spec.expiryTime != null ? BigInt(spec.expiryTime) : undefined,
              description: spec.description,
              senderPublicKey: spec.senderPublicKey,
            })
          : spec.type === 'bitcoinAddress'
          ? new ReceivePaymentMethod.BitcoinAddress({
              newAddress: !!spec.newAddress,
            })
          : new ReceivePaymentMethod.Bolt11Invoice({
              description: spec.description || '',
              amountSats:
                spec.amountSats != null ? BigInt(spec.amountSats) : undefined,
              expirySecs: spec.expirySecs,
              paymentHash: spec.paymentHash,
              receiverIdentityPublicKey: spec.receiverIdentityPublicKey,
              preimage: spec.preimage,
            });
      const res = await sdk.receivePayment({ paymentMethod: method });
      return { request: res.paymentRequest, feeSats: BigInt(res.fee) };
    },
    async prepare(input, opts = {}) {
      return sdk
        .prepareSendPayment({
          paymentRequest: new PaymentRequest.Input({ input }),
          amount: opts.amount != null ? BigInt(opts.amount) : undefined,
          tokenIdentifier: opts.tokenIdentifier,
          conversionOptions: undefined,
          feePolicy: opts.feesIncluded ? FeePolicy.FeesIncluded : undefined,
        })
        .catch(tagPreSend);
    },
    async send(prepared, opts = {}) {
      let options;
      if (opts.bolt11) {
        options = new SendPaymentOptions.Bolt11Invoice({
          preferSpark: !!opts.bolt11.preferSpark,
          completionTimeoutSecs: opts.bolt11.completionTimeoutSecs,
        });
      } else if (opts.onchainSpeed) {
        options = new SendPaymentOptions.BitcoinAddress({
          confirmationSpeed: SPEEDS[opts.onchainSpeed] ?? SPEEDS.fast,
        });
      } else if (prepared?.paymentMethod?.tag === 'SparkAddress') {
        options = new SendPaymentOptions.SparkAddress({
          htlcOptions: undefined,
        });
      }
      const res = await sdk.sendPayment({
        prepareResponse: prepared,
        options,
        idempotencyKey: opts.intentId,
      });
      entry.lastVerifiedAt = Date.now();
      return normalizePayment(res.payment, true);
    },
    async sendTokenBatch(recipients) {
      const prep = await sdk.prepareSendBatch({
        recipients: recipients.map(r => ({
          paymentRequest: r.destination,
          amount: BigInt(r.amount),
          tokenIdentifier: r.tokenIdentifier,
        })),
      });
      const res = await sdk.sendBatch({ prepareResponse: prep });
      return (res.payments || []).map(p => normalizePayment(p, true));
    },
    // typeFilter / statusFilter take plain strings ('send', 'completed', ...).
    async listPayments(q = {}) {
      const req = ListPaymentsRequest.create({
        typeFilter: q.typeFilter?.map(t => TYPES[t]),
        statusFilter: q.statusFilter?.map(s => STATUSES[s]),
        // { type: 'bitcoin' } | { type: 'token', tokenIdentifier } (WASM form)
        assetFilter: q.assetFilter
          ? q.assetFilter.type === 'bitcoin'
            ? new AssetFilter.Bitcoin()
            : new AssetFilter.Token({
                tokenIdentifier: q.assetFilter.tokenIdentifier,
              })
          : undefined,
        paymentDetailsFilter: q.paymentDetailsFilter,
        fromTimestamp:
          q.fromTimestamp != null ? BigInt(q.fromTimestamp) : undefined,
        toTimestamp: q.toTimestamp != null ? BigInt(q.toTimestamp) : undefined,
        offset: q.offset,
        limit: q.limit,
        sortAscending: q.sortAscending,
      });
      const res = await sdk.listPayments(req);
      return (res.payments || []).map(p => normalizePayment(p, true));
    },
    async getPayment(id) {
      try {
        const res = await sdk.getPayment({ paymentId: id });
        return normalizePayment(res.payment, true);
      } catch (e) {
        const c = classifyBreezError(e);
        if (c.kind === 'invalidInput' && /not found/i.test(c.message)) {
          return null;
        }
        throw e;
      }
    },
    async signMessage(message, compact) {
      return (await sdk.signMessage({ message, compact: !!compact })).signature;
    },
    // Raw 32-byte digest, NOT hashed again (identity key, path 'm').
    async signDigest(digest) {
      if (!(digest instanceof Uint8Array) || digest.length !== 32) {
        throw new Error('signDigest expects a 32-byte Uint8Array');
      }
      const out = await entry.signers.breezSigner.signEcdsa(
        { bytes: digest.slice().buffer },
        'm',
      );
      return new Uint8Array(out.bytes);
    },
    async exportExitState() {
      return (await sdk.exportUnilateralExitState()).exitState;
    },
    async importExitState(exitState) {
      return sdk.importUnilateralExitState({ exitState });
    },
    async prepareRecoverFunds(request) {
      return sdk.prepareRecoverFunds(request);
    },
    async recoverFunds(request, signer) {
      return sdk.recoverFunds(request, signer);
    },
    async checkRecoverFunds(request) {
      return sdk.checkRecoverFunds(request);
    },
    // Quote only: prepareRecoverFunds builds nothing and broadcasts nothing.
    async previewRecoverFunds(destination, feeRateSatPerVbyte) {
      const prepared = await prepareRecover(destination, feeRateSatPerVbyte);
      return normalizeRecoverPreview(prepared, true);
    },
    // Broadcasts. Only quotes with no outside CPFP funding: Blitz has no
    // external UTXO signer, so a funded quote is refused before any signing.
    async recoverFundsWithoutFunding(destination, feeRateSatPerVbyte) {
      const prepared = await prepareRecover(destination, feeRateSatPerVbyte);
      if (prepared.funding) throw new Error('Exit needs outside funding');
      const res = await sdk.recoverFunds(
        { prepared, fundingInputs: [] },
        undefined,
      );
      return {
        txCount: res.transactions.length,
        failedCount: res.failed.length,
      };
    },
    async recommendedFees() {
      const f = await sdk.recommendedFees();
      return {
        fastestFee: Number(f.fastestFee),
        halfHourFee: Number(f.halfHourFee),
        hourFee: Number(f.hourFee),
      };
    },
    // Deposits: normalized (see breezNormalize) so callers see one shape.
    async listUnclaimedDeposits() {
      return normalizeDeposits(await sdk.listUnclaimedDeposits({}), true);
    },
    async fetchClaimDepositQuote(txid, vout) {
      return normalizeClaimQuote(
        await sdk.fetchClaimDepositQuote({ txid, vout }),
        true,
      );
    },
    // maxFee: undefined or { type: 'fixed', amount } | { type: 'rate', satPerVbyte }
    async claimDeposit(txid, vout, maxFee) {
      const res = await sdk.claimDeposit({
        txid,
        vout,
        maxFee: maxFee
          ? { onchain: toNativeFee(maxFee, MaxOnchainFee) }
          : undefined,
      });
      return normalizeClaimOutcome(res, true);
    },
    // fee: { type: 'fixed', amount } | { type: 'rate', satPerVbyte }
    async refundDeposit(txid, vout, destinationAddress, fee) {
      return sdk.refundDeposit({
        txid,
        vout,
        destinationAddress,
        fee: toNativeFee(fee, Fee),
      });
    },
    async claimHtlcPayment(preimage) {
      const res = await sdk.claimHtlcPayment({ preimage });
      entry.lastVerifiedAt = Date.now();
      return normalizePayment(res.payment, true);
    },
    async getUserSettings() {
      return sdk.getUserSettings();
    },
    async updateUserSettings(settings) {
      return sdk.updateUserSettings({
        sparkPrivateModeEnabled: settings.sparkPrivateModeEnabled,
        stableBalanceActiveLabel: undefined,
        sparkMasterIdentityPublicKey: undefined,
      });
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

// Fee (refund) and MaxOnchainFee (claim) share the Fixed / Rate variants.
function toNativeFee(fee, Variant) {
  return fee.type === 'fixed'
    ? new Variant.Fixed({ amount: BigInt(fee.amount) })
    : new Variant.Rate({ satPerVbyte: BigInt(fee.satPerVbyte) });
}

async function createEntry(
  mnemonic,
  mode,
  expectedIdentity,
  storageDirOverride,
) {
  const identity = await identityFor(mnemonic);
  if (expectedIdentity && identity !== expectedIdentity) {
    const err = new Error('IdentityMismatch');
    err.code = 'IdentityMismatch';
    throw err;
  }

  const base =
    mode === 'server'
      ? defaultServerConfig(Network.Mainnet)
      : defaultConfig(Network.Mainnet);
  const config = applyBlitzConfig(base, mode);
  const storageDir = storageDirOverride || storageDirFor(identity);

  startLogging();
  const connectPromise = connect({
    config,
    seed: new Seed.Mnemonic({ mnemonic, passphrase: undefined }),
    storageDir,
  });
  let sdk;
  try {
    sdk = await withTimeout(
      connectPromise,
      CONNECT_TIMEOUT_MS,
      'breez connect',
    );
  } catch (e) {
    // A late-resolving connect must not leak a live SDK.
    connectPromise.then(disconnectQuietly, () => {});
    throw e;
  }

  let signers;
  try {
    const info = await withTimeout(
      sdk.getInfo({ ensureSynced: undefined }),
      READ_TIMEOUT_MS,
      'identity gate',
    );
    if (info.identityPubkey !== identity) {
      const err = new Error('IdentityMismatch');
      err.code = 'IdentityMismatch';
      throw err;
    }

    signers = defaultExternalSigners(
      mnemonic,
      undefined,
      Network.Mainnet,
      undefined,
    );
    const entry = {
      mnemonicHash: sha256Hash(mnemonic),
      identity,
      mode,
      storageDir,
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
    await disconnectQuietly(sdk);
    try {
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
  await disconnectQuietly(entry.sdk);
  try {
    entry.signers?.free?.();
  } catch {}
  if (wipe) {
    try {
      await deleteAsync(entry.storageDir, { idempotent: true });
    } catch (e) {
      console.log('Breez storage delete failed', e);
    }
  }
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

export function isAppActive() {
  return activeApp.value;
}

export { withTimeout, identityFor, storageDirFor };
