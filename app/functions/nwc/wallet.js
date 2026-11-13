import { documentDirectory } from 'expo-file-system/legacy';
import { retrieveData } from '../secureStore';
import { NWC_SECURE_STORE_MNEMOINC } from '../../constants';
import { acquire, release, identityFor, peek } from '../spark/walletRuntime';
import { legacyTransfer } from '../spark/breezNormalize';
import { asSendResult, classifyBreezError } from '../spark/breezErrors';
import { decode as decodeBolt11 } from '../decodeBolt11';

// JS NWC fallback on the Breez runtime. Every call opens the NWC identity in
// SERVER mode (sync + request + TTL release) unless the main app already holds
// it as the active client wallet, in which case that handle is reused. Storage
// is `breez-nwc/<identity>`, never the native handler's store (Android
// <filesDir>/SQLite/breez-0.28, iOS app-group nwc/breez-0.28) or the main `breez/` dir.
// Results keep the old Spark-SDK shapes so backgroundNofifications.js is
// unchanged.

// Truthy once initializeNWCWallet succeeded (the handler only tests presence).
export let nwcWallet = null;

const NWC_TTL_MS = 20000;
const SYNC_MIN_INTERVAL_MS = 15000;
const DEFAULT_PAGE = 50;

let seedCache = null;
const lastSyncAt = new Map(); // identity -> ms of last successful sync

const nwcStorageDir = identity =>
  documentDirectory
    ? `${decodeURIComponent(
        documentDirectory.replace(/^file:\/\//, ''),
      )}breez-nwc/${identity}`
    : `blitz-breez-nwc/${identity}`;

async function getSeed() {
  if (seedCache) return seedCache;
  const seed = (await retrieveData(NWC_SECURE_STORE_MNEMOINC)).value;
  if (!seed) throw new Error('No seed created');
  seedCache = seed;
  return seed;
}

async function withNwcWallet(fn) {
  const mnemonic = await getSeed();
  const identity = await identityFor(mnemonic);

  // Active account: the main client wallet is already live and synced.
  const live = peek(identity);
  if (live?.mode === 'client') return fn(live);

  const handle = await acquire(mnemonic, {
    mode: 'server',
    storageDir: nwcStorageDir(identity),
  });
  try {
    if (Date.now() - (lastSyncAt.get(identity) || 0) > SYNC_MIN_INTERVAL_MS) {
      const synced = await handle.sync();
      // A failed sync must not be served as a (stale) answer.
      if (synced.timedOut || synced.error) {
        throw new Error(synced.error?.message || 'Wallet sync failed');
      }
      lastSyncAt.set(identity, Date.now());
    }
    return await fn(handle);
  } finally {
    release(handle, { ttlMs: NWC_TTL_MS });
  }
}

const errMsg = err => classifyBreezError(err).message;
const fieldsOf = method => method?.inner ?? method;

// Amountless invoices need an explicit amount; fixed ones must not get one.
const explicitAmount = (invoice, amount) => {
  try {
    if (decodeBolt11(invoice).satoshis != null) return undefined;
  } catch {}
  return amount ? Number(amount) : undefined;
};

const lightningTag = (invoice, name) => {
  try {
    return decodeBolt11(invoice).tags.find(t => t.tagName === name)?.data;
  } catch {
    return undefined;
  }
};

// Payment by Breez id, else by payment hash (stored as the invoice's id).
// Breez reports a missing payment as a storage error, not invalidInput: native
// "Query returned no rows", web "Payment with id '<id>' not found". Matched
// exactly so another storage fault never reads as "payment absent".
const isMissingPayment = e => {
  const c = classifyBreezError(e);
  return (
    c.kind === 'storage' &&
    /Query returned no rows|Payment with id '[^']*' not found/.test(c.message)
  );
};

// sinceSecs: invoice creation time. Incoming invoices are looked up by payment
// hash, so scan every receive since then rather than a fixed recent page.
async function findPayment(h, id, sinceSecs) {
  let p = null;
  try {
    p = await h.getPayment(id);
  } catch (e) {
    if (!isMissingPayment(e)) throw e;
  }
  if (p || !/^[0-9a-f]{64}$/i.test(String(id))) return p;
  const recent = await h.listPayments(
    sinceSecs != null
      ? { typeFilter: ['receive'], fromTimestamp: sinceSecs }
      : { limit: 200 },
  );
  return recent.find(x => x.details?.htlcDetails?.paymentHash === id) || null;
}

const preimageOf = p =>
  p?.details?.htlcDetails?.preimage || p?.details?.preimage || '';

export const initializeNWCWallet = async () => {
  try {
    if (nwcWallet) return { isConnected: true };
    await withNwcWallet(h => h.getInfo());
    console.log('Connected to nwc wallet');
    nwcWallet = { ready: true };
    return { isConnected: true };
  } catch (err) {
    console.log('Initialize spark wallet error nwc', err);
    nwcWallet = null;
    return { isConnected: false, error: errMsg(err) };
  }
};

// Breez has no read-only client: balance reads use the same server-mode open.
export const initializeNWCWalletViewer = initializeNWCWallet;

export const getNWCSparkViewerBalance = async () => {
  try {
    return await withNwcWallet(async h => ({
      balance: Number((await h.getInfo()).balanceSats),
    }));
  } catch (err) {
    console.log('Get spark viewer balance error', err);
    return 0;
  }
};

export const getNWCSparkIdentityPubKey = async () => {
  try {
    return await withNwcWallet(async h => (await h.getInfo()).identityPubkey);
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};

export const getNWCSparkBalance = async () => {
  try {
    return await withNwcWallet(async h => (await h.getInfo()).balanceSats);
  } catch (err) {
    console.log('Get spark balance error', err);
    return 0;
  }
};

export const getNWCSparkAddress = async () => {
  try {
    const response = await withNwcWallet(
      async h => (await h.receive({ type: 'sparkAddress' })).request,
    );
    return { didWork: true, response };
  } catch (err) {
    console.log('Get spark address error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const getNWCSparkLightningPaymentFeeEstimate = async (
  invoice,
  amountSat,
) => {
  try {
    const lowered = invoice.toLowerCase();
    const response = await withNwcWallet(async h => {
      const prep = await h.prepare(lowered, {
        amount: explicitAmount(lowered, amountSat),
      });
      return Number(fieldsOf(prep.paymentMethod).lightningFeeSats);
    });
    return { didWork: true, response };
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const receiveNWCSparkLightningPayment = async ({
  amountSats,
  memo,
  expirySeconds = 60 * 60 * 12,
}) => {
  try {
    const response = await withNwcWallet(async h => {
      const { request } = await h.receive({
        type: 'bolt11Invoice',
        description: memo || '',
        amountSats,
        expirySecs: expirySeconds,
      });
      const paymentHash = lightningTag(request, 'payment_hash');
      const createdAt = Date.now();
      return {
        // The payment hash doubles as the lookup id (Breez has no SSP id).
        id: paymentHash,
        invoice: {
          encodedInvoice: request,
          paymentHash,
          createdAt: new Date(createdAt).toISOString(),
          expiresAt: new Date(createdAt + expirySeconds * 1000).toISOString(),
        },
      };
    });
    return { didWork: true, response };
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// No idempotency key on purpose: the handler's payment_hash claim is the guard
// (a fixed per-invoice key would replay an old failed payment).
export const sendNWCSparkLightningPayment = async ({ invoice, amountSats }) => {
  let sendStarted = false;
  try {
    const lowered = invoice.toLowerCase();
    const paymentResponse = await withNwcWallet(async h => {
      const prep = await h.prepare(lowered, {
        amount: explicitAmount(lowered, amountSats),
      });
      sendStarted = true;
      const payment = await h.send(prep, {
        bolt11: { preferSpark: false, completionTimeoutSecs: 20 },
      });
      return {
        id: payment.id,
        status: payment.status,
        paymentPreimage: preimageOf(payment),
        fee: { originalValue: Number(payment.fees), originalUnit: 'SATOSHI' },
      };
    });
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Send lightning payment error', err);
    // A throw once sendPayment started may still have paid: report unknown so
    // the handler keeps the budget reservation and the pending marker.
    return {
      didWork: false,
      error: errMsg(err),
      outcome: sendStarted ? asSendResult(err).outcome : 'failed',
    };
  }
};

const paymentStatus = async (id, sinceSecs) => {
  try {
    const paymentResponse = await withNwcWallet(async h => {
      const p = await findPayment(h, id, sinceSecs);
      if (!p) throw new Error('Payment not found');
      return { id: p.id, status: p.status, paymentPreimage: preimageOf(p) };
    });
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Get lightning payment status error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const NWCSparkLightningPaymentStatus = paymentStatus;
// An unpaid incoming invoice has no SDK payment yet: report it as pending.
// createdAtMs: the stored invoice created_at; 60s slack for clock skew.
export const getNWCLightningReceiveRequest = async (id, createdAtMs) => {
  const res = await paymentStatus(
    id,
    createdAtMs ? Math.floor(createdAtMs / 1000) - 60 : undefined,
  );
  if (!res.didWork && res.error === 'Payment not found')
    return { didWork: true, paymentResponse: { status: 'pending' } };
  return res;
};

// Old SDK transfer shape; lightning payments also carry `userRequest`.
// Plain Spark transfers come back as type 'TRANSFER' and are dropped by the
// handler, so page counts keep their old meaning.
export const getNWCSparkTransactions = async (
  transferCount = DEFAULT_PAGE,
  offsetIndex = 0,
) => {
  try {
    return await withNwcWallet(async h => {
      const payments = await h.listPayments({
        offset: offsetIndex,
        limit: transferCount,
      });
      return {
        transfers: payments.map(p => {
          const t = legacyTransfer(p);
          if (p.method !== 'lightning') return t;
          const invoice = p.details?.invoice;
          const isSend = p.paymentType === 'send';
          return {
            ...t,
            expiryTime: p.status === 'completed' ? t.createdTime : undefined,
            userRequest: isSend
              ? {
                  typename: 'LightningSendRequest',
                  id: p.id,
                  encodedInvoice: invoice,
                  paymentPreimage: preimageOf(p),
                  fee: {
                    originalValue: Number(p.fees),
                    originalUnit: 'SATOSHI',
                  },
                }
              : {
                  typename: 'LightningReceiveRequest',
                  id: p.id,
                  invoice: { encodedInvoice: invoice },
                  paymentPreimage: preimageOf(p),
                },
          };
        }),
      };
    });
  } catch (err) {
    console.log('get spark transactions error', err);
  }
};

export const sendNWCSparkPayment = async (amount, address) => {
  try {
    const paymentResponse = await withNwcWallet(async h => {
      const prep = await h.prepare(address.toLowerCase(), { amount });
      return legacyTransfer(await h.send(prep, {}));
    });
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: errMsg(err) };
  }
};
