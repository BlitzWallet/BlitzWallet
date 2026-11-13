import {
  acquire,
  release,
  disposeIdentity,
  identityFor,
  peek,
} from './walletRuntime';
import {
  getIntent,
  listClaimedPaymentIds,
  markIntent,
  withSendIntent,
} from './sendIntents';
import { classifyBreezError } from './breezErrors';
import { legacyLightningSend, legacyTransfer } from './breezNormalize';
import { createBreezFlashnetWallet } from './breezFlashnetWallet';
import { decode as decodeBolt11 } from '../decodeBolt11';
import { FlashnetClient } from '@flashnet/sdk';
import { getAllSparkTransactions } from './transactions';
import { SPARK_TO_SPARK_FEE } from '../../constants/math';
import {
  mergeTokensWithCache,
  migrateCachedTokens,
  saveCachedTokens,
} from '../lrc20/cachedTokens';
import sha256Hash from '../hash';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  deriveSparkAddress,
  deriveSparkIdentityKey,
} from '../gift/deriveGiftWallet';
import { DEFAULT_PAYMENT_EXPIRY_SEC, USDB_TOKEN_ID } from '../../constants';

// Breez is the only Spark backend. Every function takes the mnemonic and
// resolves its wallet through walletRuntime. The main wallet is held by
// sparkContext (mode 'client'); this file never releases it.

const flashnetClients = {};

// Hash cache to avoid recalculating hashes
const mnemonicHashCache = new Map();

const getMnemonicHash = mnemonic => {
  if (!mnemonicHashCache.has(mnemonic)) {
    mnemonicHashCache.set(mnemonic, sha256Hash(mnemonic));
  }
  return mnemonicHashCache.get(mnemonic);
};

const handleFor = mnemonic => {
  getMnemonicHash(mnemonic);
  // Reuses a derived wallet a flow opened in server mode; else the main
  // (client) wallet.
  return acquire(mnemonic, { mode: 'client', borrow: true });
};

const errMsg = err => classifyBreezError(err).message;

// RN keeps fields under `.inner`, WASM has them directly.
const fieldsOf = method => method?.inner ?? method;

// Amountless invoices need an explicit amount; fixed ones must not get one.
const explicitAmount = (invoice, amount) => {
  try {
    if (decodeBolt11(invoice).satoshis != null) return undefined;
  } catch {}
  return amount ? Number(amount) : undefined;
};

// Breez does not return the SSP request id, so the unpaid-invoice row is keyed
// by payment hash (decoded locally).
const lightningInvoiceResponse = request => {
  let id = null;
  let expiresAt = null;
  try {
    const tags = decodeBolt11(request).tags;
    const tag = name => tags.find(t => t.tagName === name)?.data;
    id = tag('payment_hash') || null;
    const ts = Number(tag('timestamp'));
    if (ts) {
      expiresAt = new Date(
        (ts + (Number(tag('expiry')) || 3600)) * 1000,
      ).toISOString();
    }
  } catch {}
  return {
    id,
    invoice: { encodedInvoice: request, expiresAt },
    createdAt: new Date(),
  };
};

const legacyFeeQuote = fq => {
  const sats = n => ({ originalValue: Number(n), originalUnit: 'SATOSHI' });
  return {
    id: fq.id,
    expiresAt: Number(fq.expiresAt),
    l1BroadcastFeeFast: sats(fq.speedFast.l1BroadcastFeeSat),
    userFeeFast: sats(fq.speedFast.userFeeSat),
    l1BroadcastFeeMedium: sats(fq.speedMedium.l1BroadcastFeeSat),
    userFeeMedium: sats(fq.speedMedium.userFeeSat),
    l1BroadcastFeeSlow: sats(fq.speedSlow.l1BroadcastFeeSat),
    userFeeSlow: sats(fq.speedSlow.userFeeSat),
  };
};

// Payment by Breez id, or (for hold/receive invoices keyed by hash) by hash.
const findPayment = async (h, id) => {
  const p = await h.getPayment(id);
  if (p || !/^[0-9a-f]{64}$/i.test(id)) return p;
  const recent = await h.listPayments({ limit: 200 });
  return recent.find(x => x.details?.htlcDetails?.paymentHash === id) || null;
};

const legacyRequest = p =>
  p && {
    id: p.id,
    status: p.status,
    fee: { originalValue: Number(p.fees), originalUnit: 'SATOSHI' },
    createdAt: new Date(p.timestamp * 1000),
    updatedAt: new Date(p.timestamp * 1000),
    paymentPreimage: p.details?.htlcDetails?.preimage,
    coopExitTxid: p.details?.type === 'withdraw' ? p.details.txId : undefined,
    transfer:
      p.status === 'completed'
        ? { id: p.id, sparkId: p.id, totalValue: Number(p.amount) }
        : undefined,
  };

export const getFlashnetClient = mnemonic => {
  const client = flashnetClients[getMnemonicHash(mnemonic)];
  if (!client) {
    throw new Error('Flashnet client not initialized');
  }
  return client;
};

// Clear cache when needed (call this on logout/cleanup)
export const clearMnemonicCache = () => {
  const mnemonics = [...mnemonicHashCache.keys()];
  mnemonicHashCache.clear();
  Object.keys(flashnetClients).forEach(key => delete flashnetClients[key]);
  return Promise.allSettled(mnemonics.map(m => disposeIdentity(m)));
};

/**
 * Tears down a short-lived derived wallet (gift/pool/savings) after a flow
 * completes. Only ever call this with a DERIVED mnemonic unless logging out.
 * @param {string} mnemonic
 * @param {{ wipe?: boolean }} [options] wipe: also delete its Breez storage
 * @returns {Promise<{didWork: boolean, error?: string}>}
 */
export const disposeSparkWallet = async (mnemonic, options = {}) => {
  try {
    delete flashnetClients[getMnemonicHash(mnemonic)];
    await disposeIdentity(mnemonic, { wipe: !!options.wipe });
    return { didWork: true };
  } catch (err) {
    console.log('Dispose spark wallet error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

/**
 * Opens a DERIVED wallet (gift/pool/savings/account-transfer source/viewer) in
 * SERVER mode, syncs it and reads its balance. The facade send/balance
 * functions then borrow this handle. Close with disposeSparkWallet (finally +
 * unmount). Never call for the active main wallet (opening it in the other
 * mode throws).
 * @returns {Promise<{isConnected: boolean, didWork: boolean, borrowed?: boolean, balance?: any, tokensObj?: object, error?: string}>}
 */
export const openDerivedWallet = async mnemonic => {
  try {
    getMnemonicHash(mnemonic);
    // Already live (the active main wallet, or a wallet another screen holds):
    // reuse it, never reopen it in the other mode. `borrowed` => caller must
    // not dispose it.
    if (peek(await identityFor(mnemonic))) {
      const balance = await getSparkBalance(mnemonic);
      return { ...balance, isConnected: balance.didWork, borrowed: true };
    }
    const handle = await acquire(mnemonic, { mode: 'server' });
    try {
      const r = await handle.sync();
      const balance = await getSparkBalance(mnemonic);
      // sync() never throws: callers must not act on a zero balance when false.
      return {
        ...balance,
        isConnected: true,
        synced: !r?.timedOut && !r?.error,
      };
    } catch (err) {
      await release(handle, { immediate: true });
      throw err;
    }
  } catch (err) {
    console.log('Open derived wallet error', err);
    return { isConnected: false, didWork: false, error: errMsg(err) };
  }
};

export const initializeSparkWallet = async (
  mnemonic,
  isInitialLoad = true,
  options = {},
) => {
  const {
    maxRetries = 8,
    retryDelay = 15000, // 15 seconds between retries
    enableRetry = true,
    shouldCancel,
  } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      getMnemonicHash(mnemonic);
      const h = await acquire(mnemonic, {
        mode: 'client',
        expectedIdentity: await identityFor(mnemonic),
      });
      const info = await h.getInfo();
      return { isConnected: true, identity: info.identityPubkey };
    } catch (err) {
      console.log(
        `Initialize spark wallet error (attempt ${attempt + 1}/${
          maxRetries + 1
        }):`,
        err,
      );
      // A different seed is not transient: never retry it.
      if (
        err?.code === 'IdentityMismatch' ||
        !enableRetry ||
        attempt >= maxRetries
      ) {
        return { isConnected: false, error: errMsg(err) };
      }
      // Caller unmounted / no longer wants this wallet: stop the retry loop.
      if (shouldCancel?.()) return { isConnected: false, cancelled: true };
      await new Promise(res => setTimeout(res, retryDelay));
    }
  }
};

export const initializeFlashnet = async mnemonic => {
  try {
    const h = await handleFor(mnemonic);
    const client = new FlashnetClient(createBreezFlashnetWallet(h), {
      autoAuthenticate: true,
      sparkNetworkType: 'MAINNET',
      clientConfig: 'mainnet',
    });
    await client.initialize();
    flashnetClients[getMnemonicHash(mnemonic)] = client;
    return true;
  } catch (err) {
    console.log('Error initializing flashnet', err);
    return false;
  }
};

export const setPrivacyEnabled = async (mnemonic, freshIdentityPubKey) => {
  try {
    const didSetPrivacySetting =
      (await getLocalStorageItem('didSetPrivacySettingNew').then(JSON.parse)) ||
      {};

    if (didSetPrivacySetting[freshIdentityPubKey]) return;

    const h = await handleFor(mnemonic);
    const settings = await h.getUserSettings();
    if (!settings?.sparkPrivateModeEnabled) {
      await h.updateUserSettings({ sparkPrivateModeEnabled: true });
    }
    didSetPrivacySetting[freshIdentityPubKey] = true;
    setLocalStorageItem(
      'didSetPrivacySettingNew',
      JSON.stringify(didSetPrivacySetting),
    );
    return true;
  } catch (err) {
    console.log('Set privacy error', err);
  }
};

export const getSparkIdentityPubKey = async mnemonic => {
  try {
    // Derive off-wallet (pure JS) so short-lived callers never open a wallet.
    const derived = await deriveSparkIdentityKey(mnemonic, 1);
    if (derived?.publicKeyHex) return derived.publicKeyHex;

    const h = await handleFor(mnemonic);
    return (await h.getInfo()).identityPubkey;
  } catch (err) {
    console.log('Get spark identity pubkey error', err);
  }
};

export const getSparkBalance = async mnemonic => {
  try {
    const hash = getMnemonicHash(mnemonic);
    const h = await handleFor(mnemonic);
    const info = await h.getInfo();
    const cachedTokens = await migrateCachedTokens(mnemonic);

    const currentTokensObj = {};
    for (const [id, t] of info.tokenBalances) {
      currentTokensObj[id] = {
        balance: t.balance,
        tokenMetadata: {
          ...t.tokenMetadata,
          tokenName: t.tokenMetadata.name,
          tokenTicker: t.tokenMetadata.ticker,
          tokenPublicKey: t.tokenMetadata.issuerPublicKey,
          tokenIdentifier: t.tokenMetadata.identifier,
        },
      };
    }

    const allTokens = mergeTokensWithCache(
      currentTokensObj,
      cachedTokens,
      mnemonic,
    );
    await saveCachedTokens(allTokens);

    return {
      tokensObj: allTokens[hash],
      balance: info.balanceSats,
      didWork: true,
      provenance: 'cache',
      verifiedAt: h.lastVerifiedAt(),
    };
  } catch (err) {
    console.log('Get spark balance error', err);
    return { didWork: false };
  }
};

export const getSparkStaticBitcoinL1Address = async mnemonic => {
  try {
    const h = await handleFor(mnemonic);
    return (await h.receive({ type: 'bitcoinAddress', newAddress: false }))
      .request;
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address error', err);
  }
};

export const queryAllStaticDepositAddresses = async mnemonic => {
  const address = await getSparkStaticBitcoinL1Address(mnemonic);
  return address ? [address] : [];
};

// Legacy quote shape; there is no SSP signature on Breez (claim ignores it).
// Quotes the mature claim: depositClaim only claims confirmed deposits.
export const getSparkStaticBitcoinL1AddressQuote = async (
  txid,
  outputIndex,
  mnemonic,
) => {
  try {
    const h = await handleFor(mnemonic);
    const { mature } = await h.fetchClaimDepositQuote(txid, outputIndex);
    return {
      didWork: true,
      quote: {
        transactionId: txid,
        outputIndex,
        creditAmountSats: mature.creditAmountSats,
        signature: '',
        feeSats: mature.feeSats,
        isEstimate: mature.isEstimate,
      },
    };
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address quote error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const refundSparkStaticBitcoinL1AddressQuote = async ({
  depositTransactionId,
  outputIndex = 0,
  destinationAddress,
  fee,
  mnemonic,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const res = await h.refundDeposit(
      depositTransactionId,
      outputIndex,
      destinationAddress,
      { type: 'fixed', amount: fee },
    );
    return { didWork: true, txId: res.txId, txHex: res.txHex };
  } catch (err) {
    console.log('refund reusable Bitcoin mainchain address error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// maxFeeSats is the fee from the quote the caller accepted. Auto-claim is off
// in the Breez config, so a missing ceiling fails closed instead of claiming
// under whatever the SDK defaults to.
export const claimnSparkStaticDepositAddress = async ({
  outputIndex,
  transactionId,
  mnemonic,
  maxFeeSats,
}) => {
  try {
    if (maxFeeSats == null) throw new Error('maxFeeSats is required');
    const h = await handleFor(mnemonic);
    const outcome = await h.claimDeposit(transactionId, outputIndex, {
      type: 'fixed',
      amount: maxFeeSats,
    });
    if (outcome.type === 'settled') {
      return {
        didWork: true,
        response: { transferId: outcome.payment.id, payment: outcome.payment },
      };
    }
    if (outcome.type === 'submitted') {
      return { didWork: true, response: { submitted: true } };
    }
    const reason = outcome.reason;
    return {
      didWork: false,
      error:
        reason.type === 'maxFeeExceeded'
          ? `Claim fee ${reason.requiredFeeSats} exceeds max ${reason.maxFeeSats}`
          : reason.message || reason.type,
    };
  } catch (err) {
    console.log('claim static deposit address error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const getSparkAddress = async (mnemonic, identityPublicKeyHex) => {
  try {
    let derivedPublicKey;
    if (identityPublicKeyHex) {
      derivedPublicKey = Buffer.from(identityPublicKeyHex, 'hex'); // 33-byte compressed
    } else {
      const derivedIdentityPubKey = await deriveSparkIdentityKey(mnemonic, 1);
      derivedPublicKey = derivedIdentityPubKey.publicKey;
    }
    const derivedSparkAddress = deriveSparkAddress(derivedPublicKey);
    if (derivedSparkAddress.address) {
      return { didWork: true, response: derivedSparkAddress.address };
    }

    const h = await handleFor(mnemonic);
    const { request } = await h.receive({ type: 'sparkAddress' });
    return { didWork: true, response: request };
  } catch (err) {
    console.log('Get spark address error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// Failures before the SDK call (no wallet, bad input) provably sent nothing.
const preSendFailure = err => ({
  didWork: false,
  error: errMsg(err),
  outcome: 'failed',
});

export const sendSparkPayment = async ({
  receiverSparkAddress,
  amountSats,
  mnemonic,
  intentId,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const to = receiverSparkAddress.toLowerCase();
    const r = await withSendIntent(
      {
        accountId: h.identity,
        rail: 'sparkAddress',
        requestHash: `${to}:${amountSats}`,
        amount: amountSats,
        intentId,
      },
      async id => {
        const prep = await h.prepare(to, { amount: amountSats });
        return h.send(prep, { intentId: id });
      },
    );
    if (!r.ok) return r.result;
    return {
      didWork: true,
      response: legacyTransfer(r.payment),
      payment: r.payment,
      intentId: r.intentId,
    };
  } catch (err) {
    console.log('Send spark payment error', err);
    return preSendFailure(err);
  }
};

// Token rail: Breez rejects idempotency keys on token transfers, so the intent
// is persisted but never passed to the SDK.
export const sendSparkTokens = async ({
  tokenIdentifier,
  tokenAmount,
  receiverSparkAddress,
  mnemonic,
  intentId,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const r = await withSendIntent(
      {
        accountId: h.identity,
        rail: 'tokenAddress',
        requestHash: `${receiverSparkAddress}:${tokenIdentifier}:${tokenAmount}`,
        amount: tokenAmount,
        tokenId: tokenIdentifier,
        intentId,
      },
      async () => {
        const prep = await h.prepare(receiverSparkAddress, {
          amount: tokenAmount,
          tokenIdentifier,
        });
        return h.send(prep, {});
      },
    );
    if (!r.ok) return r.result;
    return {
      didWork: true,
      response: r.payment.details?.txHash ?? r.payment.id,
      payment: r.payment,
      intentId: r.intentId,
    };
  } catch (err) {
    console.log('Send spark token error', err);
    return preSendFailure(err);
  }
};

export const getSparkLightningPaymentFeeEstimate = async (
  invoice,
  amountSat,
  mnemonic,
) => {
  try {
    const h = await handleFor(mnemonic);
    const lowered = invoice.toLowerCase();
    const prep = await h.prepare(lowered, {
      amount: explicitAmount(lowered, amountSat),
    });
    return {
      didWork: true,
      response: Number(fieldsOf(prep.paymentMethod).lightningFeeSats),
    };
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

/**
 * Third-party Spark sat invoices (an invoice addressed to someone else's
 * identity key) do not exist on Breez: receive invoices are always our own.
 */
export const generateSparkInvoiceFromAddress = async () => ({
  didWork: false,
  error: 'third-party Spark invoices are unsupported',
});

// Pays each invoice (or Spark address) in turn. One failure never aborts the
// rest. Same bucket shape the WebView path returned.
export const fufillSparkInvoices = async ({ mnemonic, invoices = [] }) => {
  try {
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return {
        successful: [],
        failed: [],
        totalPaid: 0,
        error: 'No recipients provided',
      };
    }
    const h = await handleFor(mnemonic);
    const satsTransactionSuccess = [];
    const satsTransactionErrors = [];
    for (const { invoice, amount } of invoices) {
      const r = await withSendIntent(
        {
          accountId: h.identity,
          rail: 'sparkAddress',
          requestHash: `${invoice}:${amount}`,
          amount: amount.toString(),
        },
        async id => {
          const prep = await h.prepare(invoice, { amount: Number(amount) });
          return h.send(prep, { intentId: id });
        },
      );
      if (r.ok) {
        satsTransactionSuccess.push({
          invoice,
          transferResponse: legacyTransfer(r.payment),
        });
      } else {
        satsTransactionErrors.push({
          invoice,
          error: { message: r.result.error },
          outcome: r.result.outcome,
          intentId: r.result.intentId,
        });
      }
    }
    return {
      didWork: true,
      satsTransactionSuccess,
      satsTransactionErrors,
      invalidInvoices: [],
    };
  } catch (err) {
    console.log('fufillSparkInvoices error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// One token transaction paying every recipient; returns its tx hash.
export const batchSendTokens = async ({ mnemonic, invoices = [] }) => {
  try {
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return {
        successful: [],
        failed: [],
        totalPaid: 0,
        error: 'No recipients provided',
      };
    }
    const h = await handleFor(mnemonic);
    const recipients = invoices.map(
      ({ tokenIdentifier, receiverSparkAddress, tokenAmount }) => ({
        destination: receiverSparkAddress,
        amount: tokenAmount,
        tokenIdentifier,
      }),
    );
    const r = await withSendIntent(
      {
        accountId: h.identity,
        rail: 'tokenBatch',
        requestHash: recipients
          .map(x => `${x.destination}:${x.tokenIdentifier}:${x.amount}`)
          .join(','),
        amount: recipients.reduce((sum, x) => sum + BigInt(x.amount), 0n),
        tokenId: recipients[0].tokenIdentifier,
      },
      async () => {
        const payments = await h.sendTokenBatch(recipients);
        return payments[0];
      },
    );
    if (!r.ok) return r.result;
    return {
      didWork: true,
      invoice: r.payment?.details?.txHash,
      intentId: r.intentId,
    };
  } catch (err) {
    console.log('batchSendTokens error', err);
    return preSendFailure(err);
  }
};

export const getSparkBitcoinPaymentRequest = async (paymentId, mnemonic) => {
  try {
    const h = await handleFor(mnemonic);
    return legacyRequest(await h.getPayment(paymentId));
  } catch (err) {
    console.log('Get bitcoin payment request error', err);
  }
};

export const getSparkBitcoinPaymentFeeEstimate = async ({
  amountSats,
  withdrawalAddress,
  mnemonic,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const prep = await h.prepare(withdrawalAddress, { amount: amountSats });
    return {
      didWork: true,
      response: legacyFeeQuote(fieldsOf(prep.paymentMethod).feeQuote),
    };
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// Spark-to-Spark sends are free.
export const getSparkPaymentFeeEstimate = async () => SPARK_TO_SPARK_FEE;

export const receiveSparkLightningPayment = async ({
  amountSats,
  memo,
  mnemonic,
  expirySeconds = DEFAULT_PAYMENT_EXPIRY_SEC, // 12 hour invoice expiry
  receiverIdentityPubkey,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const { request } = await h.receive({
      type: 'bolt11Invoice',
      description: memo || '',
      amountSats,
      expirySecs: expirySeconds,
      receiverIdentityPublicKey: receiverIdentityPubkey,
    });
    return { didWork: true, response: lightningInvoiceResponse(request) };
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const claimSparkHodlLightningPayment = async ({
  preimage,
  mnemonic,
}) => {
  try {
    const h = await handleFor(mnemonic);
    return { didWork: true, response: await h.claimHtlcPayment(preimage) };
  } catch (err) {
    console.log('Claim HODL lightning payment error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// status keeps the legacy numbering: 0 waiting for preimage, 1 shared, 2 returned.
const HTLC_STATUS = { waitingForPreimage: 0, preimageShared: 1, returned: 2 };

export const querySparkHodlLightningPayments = async ({
  paymentHashes = [],
  mnemonic,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const wanted = new Set(paymentHashes);
    const received = await h.listPayments({
      typeFilter: ['receive'],
      limit: 200,
    });
    const paidPreimages = received
      .filter(p => wanted.has(p.details?.htlcDetails?.paymentHash))
      .map(p => {
        const status = p.details.htlcDetails.status;
        return {
          status: typeof status === 'string' ? HTLC_STATUS[status] : status,
          createdTime: new Date(p.timestamp * 1000),
          paymentHash: p.details.htlcDetails.paymentHash,
          transferId: p.id,
          satValue: Number(p.amount),
        };
      });
    return { didWork: true, paidPreimages };
  } catch (err) {
    console.log('Query HODL lightning payments error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const receiveSparkHodlLightningPayment = async ({
  amountSats,
  paymentHash,
  memo,
  expirySeconds,
  mnemonic,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const { request } = await h.receive({
      type: 'bolt11Invoice',
      description: memo || '',
      amountSats,
      expirySecs: expirySeconds,
      paymentHash,
    });
    return { didWork: true, response: lightningInvoiceResponse(request) };
  } catch (err) {
    console.log('Receive HODL lightning payment error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const getSparkLightningSendRequest = async (id, mnemonic) => {
  try {
    const h = await handleFor(mnemonic);
    return legacyRequest(await findPayment(h, id));
  } catch (err) {
    console.log('Get spark lightning send request error', err);
  }
};

export const getSparkLightningPaymentStatus = async ({
  lightningInvoiceId,
  mnemonic,
}) => {
  try {
    const h = await handleFor(mnemonic);
    return legacyRequest(await findPayment(h, lightningInvoiceId));
  } catch (err) {
    console.log('Get lightning payment status error', err);
  }
};

export const sendSparkLightningPayment = async ({
  invoice,
  maxFeeSats,
  amountSats,
  mnemonic,
  intentId,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const lowered = invoice.toLowerCase();
    const r = await withSendIntent(
      {
        accountId: h.identity,
        rail: 'bolt11',
        requestHash: lowered,
        amount: amountSats,
        intentId,
      },
      async id => {
        const prep = await h.prepare(lowered, {
          amount: explicitAmount(lowered, amountSats),
        });
        const fee = Number(fieldsOf(prep.paymentMethod).lightningFeeSats ?? 0);
        if (maxFeeSats != null && fee > maxFeeSats) {
          throw Object.assign(
            new Error(`Prepared fee ${fee} exceeds max ${maxFeeSats}`),
            { tag: 'InvalidInput' },
          );
        }
        return h.send(prep, {
          intentId: id,
          bolt11: { preferSpark: true, completionTimeoutSecs: undefined },
        });
      },
    );
    if (!r.ok) return r.result;
    return {
      didWork: true,
      paymentResponse: legacyLightningSend(r.payment),
      payment: r.payment,
      intentId: r.intentId,
    };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return preSendFailure(err);
  }
};

// Unilateral exit, quote only: nothing is signed or broadcast.
export const previewUnilateralExit = async ({
  mnemonic,
  destination,
  feeRate,
}) => {
  try {
    const h = await handleFor(mnemonic);
    return {
      didWork: true,
      preview: await h.previewRecoverFunds(destination, feeRate),
    };
  } catch (err) {
    console.log('Preview unilateral exit error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// Unilateral exit, BROADCASTS. Refuses quotes that need outside funding.
export const runUnilateralExit = async ({ mnemonic, destination, feeRate }) => {
  try {
    const h = await handleFor(mnemonic);
    return {
      didWork: true,
      result: await h.recoverFundsWithoutFunding(destination, feeRate),
    };
  } catch (err) {
    console.log('Run unilateral exit error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const importUnilateralExitState = async ({ mnemonic, exitState }) => {
  try {
    const h = await handleFor(mnemonic);
    await h.importExitState(exitState);
    return { didWork: true };
  } catch (err) {
    console.log('Import exit state error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const getRecommendedOnchainFees = async mnemonic => {
  try {
    const h = await handleFor(mnemonic);
    return { didWork: true, fees: await h.recommendedFees() };
  } catch (err) {
    console.log('Recommended fees error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const exportUnilateralExitState = async mnemonic => {
  try {
    const h = await handleFor(mnemonic);
    return { didWork: true, exitState: await h.exportExitState() };
  } catch (err) {
    console.log('Export exit state error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// Unclaimed deposits as legacy UTXOs. Breez lists every address of the
// identity at once, so the static address is attached to each.
const listDepositUtxos = async mnemonic => {
  const h = await handleFor(mnemonic);
  const address = await getSparkStaticBitcoinL1Address(mnemonic);
  return (await h.listUnclaimedDeposits()).map(d => ({
    txid: d.txid,
    vout: d.vout,
    amountSats: d.amountSats,
    isConfirmed: d.isMature,
    address,
  }));
};

export const getUtxosForDepositAddress = async ({
  depositAddress,
  mnemonic,
  limit = 100,
  offset = 0,
}) => {
  try {
    const utxos = await listDepositUtxos(mnemonic);
    return {
      didWork: true,
      utxos: utxos
        .map(u => ({ ...u, address: depositAddress || u.address }))
        .slice(offset, offset + limit),
    };
  } catch (err) {
    console.log('Get utxos for deposit address error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

// One call returns every unclaimed deposit of the identity (no paging needed).
export const getUtxosForIdentity = async ({ mnemonic }) => {
  try {
    return {
      didWork: true,
      utxos: await listDepositUtxos(mnemonic),
      pageResponse: { hasNextPage: false, nextCursor: '' },
    };
  } catch (err) {
    console.log('Get utxos for identity error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const sendSparkBitcoinPayment = async ({
  onchainAddress,
  exitSpeed = 'fast',
  amountSats,
  deductFeeFromWithdrawalAmount = false,
  feeQuote,
  mnemonic,
  intentId,
}) => {
  try {
    const h = await handleFor(mnemonic);
    const r = await withSendIntent(
      {
        accountId: h.identity,
        rail: 'bitcoinAddress',
        requestHash: `${onchainAddress}:${amountSats}`,
        amount: amountSats,
        intentId,
      },
      async id => {
        // Re-prepared here (the quote the user saw may be stale).
        const prep = await h.prepare(onchainAddress, {
          amount: amountSats,
          feesIncluded: deductFeeFromWithdrawalAmount,
        });
        // Never charge noticeably more than the fee the user was shown.
        if (feeQuote) {
          const speed = { fast: 'Fast', medium: 'Medium', slow: 'Slow' }[
            String(exitSpeed).toLowerCase()
          ];
          const total = q =>
            (q[`l1BroadcastFee${speed}`]?.originalValue || 0) +
            (q[`userFee${speed}`]?.originalValue || 0);
          const now = total(
            legacyFeeQuote(fieldsOf(prep.paymentMethod).feeQuote),
          );
          if (speed && now > total(feeQuote) * 1.1) {
            throw Object.assign(
              new Error(`Network fee rose to ${now} sats; review again`),
              { tag: 'InvalidInput', preSend: true },
            );
          }
        }
        return h.send(prep, {
          intentId: id,
          onchainSpeed: String(exitSpeed).toLowerCase(),
        });
      },
    );
    if (!r.ok) return r.result;
    return {
      didWork: true,
      response: {
        id: r.payment.id,
        updatedAt: new Date(r.payment.timestamp * 1000),
        coopExitTxid: r.payment.details?.txId || '',
      },
      payment: r.payment,
      intentId: r.intentId,
    };
  } catch (err) {
    console.log('Send Bitcoin payment error', err);
    return preSendFailure(err);
  }
};

// An intent with no payment on record is only called failed after this long;
// Breez persists the payment before sendPayment returns, so none by then means
// the send never happened.
const INTENT_NOT_FOUND_GRACE_MS = 15 * 60 * 1000;
// A send's payment row is stamped when sendPayment runs, seconds after the
// intent row; anything much later is a different send.
const INTENT_MATCH_WINDOW_SECS = 5 * 60;

/**
 * Resolves an 'unknown' send: looks the intent up, then its Breez payment (or
 * a matching recent payment when no payment id was recorded). Never resends.
 * @returns {Promise<{status: 'completed'|'pending'|'failed'|'unknown'}>}
 *   'failed' is definitive: a new send is safe.
 */
export const checkSendIntentStatus = async ({ intentId }) => {
  try {
    const intent = await getIntent(intentId);
    if (!intent || intent.state === 'abandoned') return { status: 'failed' };

    // The wallet that made the send: the cached mnemonic with this identity.
    let mnemonic;
    for (const m of mnemonicHashCache.keys()) {
      if ((await identityFor(m)) === intent.account_id) mnemonic = m;
    }
    if (!mnemonic) return { status: 'unknown' };
    const h = await handleFor(mnemonic);
    let payment = intent.payment_id
      ? await h.getPayment(intent.payment_id)
      : null;

    let synced = false;
    if (!payment) {
      const s = await h.sync();
      synced = !s.timedOut && !s.error;
      // Only sends made right around this intent, and none another intent
      // already owns: a same-amount send elsewhere must not be adopted. The
      // window replaces a fixed page size that a busy wallet could overflow.
      const since = Math.floor(intent.created_at / 1000) - 5;
      const claimed = await listClaimedPaymentIds(intent.account_id, intentId);
      const recent = await h.listPayments({
        typeFilter: ['send'],
        fromTimestamp: since,
        toTimestamp: since + INTENT_MATCH_WINDOW_SECS,
      });
      payment =
        recent.find(p => {
          if (claimed.has(p.id)) return false;
          if (intent.rail === 'bolt11') {
            return p.details?.invoice?.toLowerCase() === intent.request_hash;
          }
          if (intent.token_id) {
            return (
              p.details?.metadata?.identifier === intent.token_id &&
              String(p.amount) === intent.amount
            );
          }
          return String(p.amount) === intent.amount;
        }) || null;
    }

    if (!payment) {
      // Offline / failed sync proves nothing: never call it failed then.
      if (
        !synced ||
        Date.now() - intent.created_at < INTENT_NOT_FOUND_GRACE_MS
      ) {
        return { status: 'unknown' };
      }
      await markIntent(intentId, 'abandoned', { error: 'no payment found' });
      return { status: 'failed' };
    }

    if (payment.status === 'failed') {
      await markIntent(intentId, 'abandoned', { paymentId: payment.id });
    } else if (payment.status === 'completed') {
      await markIntent(intentId, 'done', { paymentId: payment.id });
    }
    return { status: payment.status, payment };
  } catch (err) {
    console.log('check send intent error', err);
    return { status: 'unknown' };
  }
};

export const getSparkTransactions = async (
  transferCount = 100,
  offsetIndex,
  mnemonic,
) => {
  try {
    const h = await handleFor(mnemonic);
    const payments = await h.listPayments({
      limit: transferCount,
      offset: offsetIndex,
    });
    // success:true marks a genuine reply (an empty array means the wallet
    // truly has no more transactions). success:false below is a failed fetch;
    // callers MUST NOT treat that as "no transactions".
    return {
      transfers: payments.map(legacyTransfer),
      offset: (offsetIndex || 0) + payments.length,
      success: true,
    };
  } catch (err) {
    console.log('get spark transactions error', err);
    return { transfers: [], success: false };
  }
};

// Breez history already includes token payments (getSparkTransactions); there
// is no separate token-transaction feed, so this is always empty.
export const getSparkTokenTransactions = async () => ({
  tokenTransactionsWithStatus: [],
  offset: 0,
});

// Our own sat invoice. Invoices for another identity are unsupported.
export const createSatsInvoice = async ({
  mnemonic,
  amountSats,
  memo,
  receiverIdentityPubkey,
}) => {
  try {
    const h = await handleFor(mnemonic);
    if (receiverIdentityPubkey && receiverIdentityPubkey !== h.identity) {
      throw new Error('third-party Spark invoices are unsupported');
    }
    const { request } = await h.receive({
      type: 'sparkInvoice',
      amount: amountSats,
      description: memo,
    });
    return { didWork: true, invoice: request };
  } catch (err) {
    console.log('createSatsInvoice error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const createTokensInvoice = async (
  mnemonic,
  tokenIdentifier = USDB_TOKEN_ID,
) => {
  try {
    const h = await handleFor(mnemonic);
    const { request } = await h.receive({
      type: 'sparkInvoice',
      tokenIdentifier,
    });
    return { didWork: true, invoice: request };
  } catch (err) {
    console.log('createTokensInvoice error', err);
    return { didWork: false, error: errMsg(err) };
  }
};

export const getCachedSparkTransactions = async (limit, identifyPubKey) => {
  try {
    const txResponse = await getAllSparkTransactions({
      limit,
      accountId: identifyPubKey,
    });
    if (!txResponse) throw new Error('Unable to get cached spark transactins');
    return txResponse;
  } catch (err) {
    console.log('get cached spark transaction error', err);
  }
};

export const sparkPaymentType = tx => {
  try {
    const isLightningPayment = tx.type === 'PREIMAGE_SWAP';
    const isBitcoinPayment =
      tx.type === 'COOPERATIVE_EXIT' || tx.type === 'UTXO_SWAP';

    return isLightningPayment
      ? 'lightning'
      : isBitcoinPayment
      ? 'bitcoin'
      : 'spark';
  } catch (err) {
    console.log('Error finding which payment method was used', err);
  }
};

export const getSparkPaymentStatus = status =>
  // Breez payments already carry the normalized status; anything else is
  // not yet settled.
  status === 'completed' || status === 'failed' ? status : 'pending';

export const getSingleTxDetails = async (mnemonic, id) => {
  try {
    const h = await handleFor(mnemonic);
    const payment = await h.getPayment(id);
    return payment ? legacyTransfer(payment) : undefined;
  } catch (err) {
    console.log('get single spark transaction error', err);
    return undefined;
  }
};
