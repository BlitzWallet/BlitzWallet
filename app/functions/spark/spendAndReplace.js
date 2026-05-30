import {
  findBestPool,
  satsToDollars,
  USD_ASSET_ADDRESS,
  BTC_ASSET_ADDRESS,
} from './flashnet';
import { getDollarBalanceToken } from './balanceStore';
import { sendSparkTokens } from '.';
import { USDB_TOKEN_ID } from '../../constants';
import {
  bulkUpdateSparkTransactions,
  runSerializedSparkDbWrite,
} from './transactions';
import fetchBackend from '../../../db/handleBackend';
import { getPublicKey } from 'nostr-tools';
import { privateKeyFromSeedWords } from '../nostrCompatability';
import {
  getEligiblePayments,
  claimIntents,
  resolveIntents,
  releaseIntents,
} from './spendAndReplaceStorage';

const MIN_SWAP_MICRODOLLARS = 1_000_000; // $1.00

// Transient/network failures are safe to retry: the quote step moves no funds,
// and a failed USDB deposit never leaves the wallet. Match on the message since
// the Spark SDK and fetch layer surface errors as plain strings.
const NETWORK_ERROR_PATTERNS = [
  'network',
  'timed out',
  'timeout',
  'connection',
  'econn',
  'socket',
  'fetch',
  'offline',
  'unreachable',
  'temporarily unavailable',
];

const isRetryableError = errLike => {
  const msg = (
    typeof errLike === 'string' ? errLike : errLike?.message || ''
  ).toLowerCase();
  return NETWORK_ERROR_PATTERNS.some(p => msg.includes(p));
};

// Writes the outgoing USDB deposit leg for a submitted USD→BTC replacement so it
// renders like a swap and so the resume re-check (restore.js
// checkFlashnetStablecoinStatusLogic) can finalize it. Keyed by the real
// deposit sparkTxHash and marked isFlashnetStablecoin. The incoming BTC arrives
// at the user's Spark address and is recorded by normal Spark sync.
// Best-effort: never throws (the order is already submitted to the backend).
const writeReplacementLeg = async ({
  accountId,
  sparkAddress,
  t,
  quote,
  sparkTxHash,
  amountInMicro,
}) => {
  try {
    if (!accountId || !sparkAddress || !t || !sparkTxHash) return;

    const now = Date.now();

    const outgoingLeg = {
      id: sparkTxHash,
      paymentStatus: 'pending',
      paymentType: 'spark',
      accountId,
      details: {
        fee: 0,
        totalFee: 0,
        supportFee: 0,
        amount: amountInMicro,
        description: t('screens.inAccount.sendAndReplace.fundingDescription'),
        address: quote.depositAddress,
        sourceSparkAddress: sparkAddress,
        time: now,
        createdAt: now,
        direction: 'OUTGOING',
        isLRC20Payment: true,
        LRC20Token: USDB_TOKEN_ID,
        showSwapLabel: true,
        isFlashnetStablecoin: true,
        quoteId: quote.quoteId,
        destinationChain: 'spark',
        destinationAsset: 'BTC',
        sarFundingTx: true,
      },
    };

    await bulkUpdateSparkTransactions([outgoingLeg], 'fullUpdate');
  } catch (err) {
    console.warn('SpendAndReplace: failed to write replacement leg:', err);
  }
};

// Submits a single USD→BTC replacement swap covering the combined spent sats
// through the Flashnet orchestration backend (quote → send USDB → submit). Once
// submitted, the backend completes the swap server-side even if the app closes.
// The pool is read only for its USDB↔BTC price (to size the USDB input); the
// long-running swap itself runs on the backend.
// Returns one of:
//   { status: 'skipped', reason }   — no pool, or combined < $1 (terminal)
//   { status: 'completed', swapRequestId, amountSwappedMicro } — order placed
//   { status: 'retry', reason }     — transient/network failure before any funds
//                                     moved; the caller releases the claim
//   { status: 'failed', reason }    — backend rejection / non-retryable (terminal)
// Never throws for these expected outcomes; an unexpected throw is classified by
// the caller.
export const runSpendAndReplace = async ({
  paymentAmountsSats,
  mnemonic,
  accountId,
  sparkAddress,
  t,
  poolInfoRef,
  isSameActiveAccount = () => true,
}) => {
  let poolResult = {};

  if (!isSameActiveAccount()) {
    return { status: 'retry', reason: 'account_changed_before_send' };
  }

  if (poolInfoRef?.currentPriceAInB) {
    poolResult = poolInfoRef;
  } else {
    const poolResponse = await findBestPool(
      mnemonic,
      USD_ASSET_ADDRESS,
      BTC_ASSET_ADDRESS,
    );
    if (!isSameActiveAccount()) {
      return { status: 'retry', reason: 'account_changed_before_send' };
    }
    if (!poolResponse.didWork) {
      return { status: 'skipped', reason: 'no_pool' };
    }
    poolResult = poolResponse.pool;
  }

  const { currentPriceAInB } = poolResult;
  const dollarBalanceMicro = getDollarBalanceToken();
  const totalSats = paymentAmountsSats.reduce((a, b) => a + b, 0);
  const totalUSDNeededMicro = Math.round(
    satsToDollars(totalSats * 1.0125, currentPriceAInB) * 1_000_000,
  );
  // Cap at available balance: 'completed' means an order was submitted, not that
  // the full BTC amount was replaced.
  const swapMicro = Math.min(totalUSDNeededMicro, dollarBalanceMicro);

  if (swapMicro < MIN_SWAP_MICRODOLLARS) {
    return { status: 'skipped', reason: 'amount_too_small' };
  }

  const amountIn = Math.round(swapMicro);
  const privateKey = await privateKeyFromSeedWords(mnemonic);
  const publicKey = getPublicKey(privateKey);
  if (!isSameActiveAccount()) {
    return { status: 'retry', reason: 'account_changed_before_send' };
  }

  const quote = await fetchBackend(
    'createSpendAndReplaceQuote',
    {
      amountTokenMicro: amountIn,
      recipientAddress: sparkAddress,
      refundAddress: sparkAddress,
    },
    privateKey,
    publicKey,
  );
  if (!isSameActiveAccount()) {
    return { status: 'retry', reason: 'account_changed_before_send' };
  }

  // fetchBackend returns false on a transport/network/timeout failure (it never
  // throws). No funds have moved, so this is safe to retry.
  if (quote === false) {
    return { status: 'retry', reason: 'quote_network_error' };
  }
  // A truthy-but-malformed response or an explicit backend error is a logical
  // rejection — terminal, not retryable.
  if (!quote.quoteId || !quote.depositAddress || quote.error) {
    return {
      status: 'failed',
      reason: quote.error?.message || 'invalid_quote',
    };
  }

  if (!isSameActiveAccount()) {
    return { status: 'retry', reason: 'account_changed_before_send' };
  }

  const tokenPayment = await sendSparkTokens({
    tokenIdentifier: USDB_TOKEN_ID,
    tokenAmount: Number(quote.amountIn),
    receiverSparkAddress: quote.depositAddress,
    mnemonic,
  });

  // The deposit never left the wallet on failure, so retrying is fund-safe.
  // Retry only transient/network failures; everything else is terminal.
  if (!tokenPayment.didWork) {
    return isRetryableError(tokenPayment.error)
      ? { status: 'retry', reason: 'token_send_network_error' }
      : { status: 'failed', reason: tokenPayment.error || 'token_send_failed' };
  }

  const sparkTxHash = tokenPayment.response;
  // Fire-and-forget: this only speeds the swap up. The backend completes (or
  // refunds) the deposit server-side even if this call never lands, so we don't
  // await it or fail on it.
  fetchBackend(
    'submitFlashnetStablecoinOrder',
    {
      quoteId: quote.quoteId,
      sparkTxHash,
      sourceSparkAddress: sparkAddress,
    },
    privateKey,
    publicKey,
  );

  // The deposit is in motion from here — the backend finishes it server-side.
  // Label the deposit leg so it shows as a swap and the resume poll finalizes it.
  await writeReplacementLeg({
    accountId,
    sparkAddress,
    t,
    quote,
    sparkTxHash,
    amountInMicro: amountIn,
  });

  return {
    status: 'completed',
    swapRequestId: quote.quoteId,
    amountSwappedMicro: amountIn,
  };
};

// Plain async orchestrator (no React). Discovers eligible payments, claims them,
// runs one batched swap, and resolves the claimed intents to a terminal state.
// Returns { processed } so the caller's drain loop can decide whether to rerun.
export const processSpendAndReplaceIntents = async ({
  db,
  accountId,
  mnemonic,
  sparkAddress,
  t,
  poolInfoRef,
  isSameActiveAccount = () => true,
}) => {
  if (!isSameActiveAccount()) return { processed: 0 };

  const rows = await getEligiblePayments(db, accountId);
  if (!rows.length) return { processed: 0 };
  if (!isSameActiveAccount()) return { processed: 0 };

  const claimed = await runSerializedSparkDbWrite(() =>
    claimIntents(db, accountId, rows),
  );
  if (!claimed.length) return { processed: 0 };

  const ids = claimed.map(r => r.payment_id);
  if (!isSameActiveAccount()) {
    await runSerializedSparkDbWrite(() => releaseIntents(db, accountId, ids));
    return { processed: 0 };
  }

  let result;
  try {
    result = await runSpendAndReplace({
      paymentAmountsSats: claimed.map(r => Number(r.amount_sats)),
      mnemonic,
      accountId,
      sparkAddress,
      t,
      poolInfoRef,
      isSameActiveAccount,
    });
  } catch (err) {
    // Unexpected throw from the swap pipeline. Retry transient/network failures
    // (no funds have moved at the points that can throw here); otherwise mark
    // terminal so we never loop forever.
    console.error('SpendAndReplace swap error:', err);
    result = isRetryableError(err) ? { status: 'retry' } : { status: 'failed' };
  }

  if (result.status === 'completed') {
    await runSerializedSparkDbWrite(() =>
      resolveIntents(db, accountId, ids, {
        status: 'completed',
        swapRequestId: result.swapRequestId,
        amountSwappedMicro: result.amountSwappedMicro,
      }),
    );
  } else if (result.status === 'retry') {
    // Transient/network failure before any funds moved — undo the claim so the
    // payments are rediscovered and retried on the next pass.
    await runSerializedSparkDbWrite(() => releaseIntents(db, accountId, ids));
  } else {
    // 'skipped' (no pool / amount too small) or 'failed' (backend rejection /
    // non-retryable) — terminal, never reprocessed.
    await runSerializedSparkDbWrite(() =>
      resolveIntents(db, accountId, ids, { status: result.status }),
    );
  }

  return { processed: claimed.length };
};
