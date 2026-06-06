import {
  SMALL_BTC_PAYMENT_LIMIT,
  SMALL_USD_PAYMENT_LIMIT,
  USDB_TOKEN_ID,
} from '../../constants';
import { isFlashnetTransfer } from './handleFlashnetTransferIds';

const shouldHideSmallPayment = ({
  hideSmallPaymentsHomepage,
  paymentDetails,
  isLRC20Payment,
  tokenDecimals,
}) => {
  if (!hideSmallPaymentsHomepage) return false;

  const amount = Math.abs(Number(paymentDetails?.amount));
  if (!Number.isFinite(amount)) return false;

  if (isLRC20Payment) {
    if (paymentDetails?.LRC20Token !== USDB_TOKEN_ID) return false;
    const decimals = Number(tokenDecimals ?? 6);
    const usdAmount = amount / 10 ** decimals;
    return usdAmount < SMALL_USD_PAYMENT_LIMIT;
  }

  return amount < SMALL_BTC_PAYMENT_LIMIT;
};

export function filterDisplayableTransactions({
  transactions,
  scrollPosition,
  enabledLRC20,
  tokens,
  forcedPendingMap,
  appliedEpoch = 0,
  limit = 25,
  hideSmallPaymentsHomepage,
}) {
  if (!transactions?.length) return [];

  const shownTxs = new Set();
  const lnFundingTxIds = new Set();
  const result = [];

  for (let i = 0; i < transactions.length && result.length < limit; i++) {
    const tx = transactions[i];

    let paymentDetails;
    try {
      paymentDetails = JSON.parse(tx.details);
    } catch {
      continue;
    }

    const paymentType = tx.paymentType;
    const paymentStatus = tx.paymentStatus;
    const isLRC20Payment = paymentDetails.isLRC20Payment;
    const hasSavedTokenData = tokens?.[paymentDetails.LRC20Token];

    if (paymentDetails?.ln_funding_id) {
      lnFundingTxIds.add(paymentDetails.ln_funding_id);
    }

    if (
      shouldHideSmallPayment({
        hideSmallPaymentsHomepage,
        paymentDetails,
        isLRC20Payment,
        tokenDecimals: hasSavedTokenData?.tokenMetadata?.decimals,
      })
    )
      continue;

    const showSwapConversion =
      paymentDetails.performSwaptoUSD &&
      (!paymentDetails.completedSwaptoUSD || !lnFundingTxIds.has(tx.sparkID));

    // Static filters
    if (
      !enabledLRC20 &&
      isLRC20Payment &&
      paymentDetails.LRC20Token !== USDB_TOKEN_ID
    )
      continue;
    if (paymentType === 'unknown') continue;
    if (
      paymentDetails.senderIdentityPublicKey ===
      process.env.SPARK_IDENTITY_PUBKEY
    )
      continue;
    if (shownTxs.has(tx.sparkID)) continue;
    if (isLRC20Payment && !hasSavedTokenData) continue;
    if (paymentStatus === 'failed') continue;
    if (
      paymentType === 'lightning' &&
      tx.status === 'LIGHTNING_PAYMENT_INITIATED'
    )
      continue;
    if (isFlashnetTransfer(tx.sparkID)) continue;

    // Scroll position filters
    if (
      scrollPosition === 'total' &&
      paymentDetails.showSwapLabel &&
      paymentDetails.direction === 'OUTGOING'
    )
      continue;
    if (
      (scrollPosition === 'sats' && isLRC20Payment) ||
      (scrollPosition === 'sats' && showSwapConversion)
    )
      continue;
    if (
      (scrollPosition === 'usd' &&
        isLRC20Payment &&
        paymentDetails.LRC20Token !== USDB_TOKEN_ID) ||
      (scrollPosition === 'usd' && !isLRC20Payment && !showSwapConversion)
    )
      continue;

    shownTxs.add(tx.sparkID);

    // Apply pending flag
    const pendingMeta = forcedPendingMap?.get(tx.sparkID);
    if (
      pendingMeta &&
      pendingMeta.epoch > appliedEpoch &&
      !tx.isBalancePending
    ) {
      result.push({ ...tx, isBalancePending: true });
    } else {
      result.push(tx);
    }
  }

  return result;
}
