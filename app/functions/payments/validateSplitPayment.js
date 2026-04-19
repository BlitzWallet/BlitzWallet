import displayCorrectDenomination from '../displayCorrectDenomination';
import { dollarsToSats, satsToDollars } from '../spark/flashnet';

/**
 * Determines whether a split payment can be funded from BTC balance, USD balance,
 * or neither. Used in both createSplitBill (to block navigation) and
 * confirmSplitPayment (to derive valid sending options).
 *
 * @param {object} params
 * @param {number} params.totalSats   - Total payment amount in sats
 * @param {string} params.paymentCurrency - 'BTC' | 'USD' — what recipients receive
 * @param {number} params.bitcoinBalance  - User's BTC balance in sats
 * @param {number} params.dollarBalanceSat - User's USD balance expressed in sats
 * @param {{usd: number, bitcoin: number}} params.swapLimits - Min swap amounts
 * @param {number} params.price - poolInfo.currentPriceAInB (sats per dollar)
 * @param {function} params.t - i18n translation function
 * @returns {{ canPayBTC: boolean, canPayUSD: boolean, errorMessage: string|null }}
 */
export function validateSplitPayment({
  totalSats,
  paymentCurrency,
  bitcoinBalance,
  dollarBalanceSat,
  swapLimits,
  price,
  masterInfoObject,
  swapUSDPriceDollars,
  t,
}) {
  const isUSD = paymentCurrency === 'USD';
  const minUsdSwapSats =
    price > 0 ? Math.round(dollarsToSats(swapLimits.usd, price)) : Infinity;
  const minBtcSwapSats = swapLimits.bitcoin;

  // Compare in integer USD cents to avoid fiat→sats round-trip rounding errors.
  // Both user amount and limits are expressed at the same display precision (2 dp).
  const totalCents =
    price > 0 ? Math.round(satsToDollars(totalSats, price) * 100) : 0;
  const minBtcSwapCents =
    price > 0
      ? Math.round(satsToDollars(minBtcSwapSats, price) * 100)
      : Infinity;
  const minUsdSwapCents = Math.round(swapLimits.usd * 100);

  const hasBtcForAmount = bitcoinBalance >= totalSats;
  const hasUsdForAmount = dollarBalanceSat >= totalSats;
  const aboveBtcSwapMin = totalCents >= minBtcSwapCents;
  const aboveUsdSwapMin = totalCents >= minUsdSwapCents;

  let canPayBTC, canPayUSD;
  if (isUSD) {
    // Recipients receive USD tokens: direct USD or BTC→USD swap
    canPayUSD = hasUsdForAmount;
    canPayBTC = hasBtcForAmount && aboveBtcSwapMin;
  } else {
    // Recipients receive BTC: direct BTC or USD→BTC swap
    canPayBTC = hasBtcForAmount;
    canPayUSD = hasUsdForAmount && aboveUsdSwapMin;
  }

  let errorMessage = null;
  if (!canPayBTC && !canPayUSD) {
    if (isUSD && hasBtcForAmount && !aboveBtcSwapMin) {
      errorMessage = t('wallet.sendPages.acceptButton.swapMinimumError', {
        currency1: t('constants.bitcoin_upper'),
        currency2: t('constants.dollars_upper'),
        amount: displayCorrectDenomination({
          amount: minBtcSwapSats,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          fiatStats: {
            value: swapUSDPriceDollars,
            coin: 'USD',
          },
        }),
      });
    } else if (!isUSD && hasUsdForAmount && !aboveUsdSwapMin) {
      errorMessage = t('wallet.sendPages.acceptButton.swapMinimumError', {
        currency1: t('constants.dollars_upper'),
        currency2: t('constants.bitcoin_upper'),
        amount: displayCorrectDenomination({
          amount: minUsdSwapSats,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
          fiatStats: {
            value: swapUSDPriceDollars,
            coin: 'USD',
          },
        }),
      });
    } else {
      errorMessage = t('wallet.sendPages.acceptButton.balanceError');
    }
  }

  return { canPayBTC, canPayUSD, errorMessage };
}
