/**
 * Determines whether the user can fund a pool contribution and which balance to use.
 *
 * @param {object} params
 * @param {number} params.bitcoinBalance   - BTC balance in sats
 * @param {number} params.dollarBalanceToken - USD balance
 * @param {number} params.paymentAmountSats - Amount to send in sats
 * @returns {{ isValid: boolean, paymentMethod: 'BTC' | 'USD' | null }}
 */
export function validatePoolPayment({
  bitcoinBalance,
  dollarBalanceToken,
  paymentAmountSats,
  paymentAmountUSD,
  swapLimits,
}) {
  if (bitcoinBalance >= paymentAmountSats) {
    return { isValid: true, paymentMethod: 'BTC' };
  }
  if (
    dollarBalanceToken >= paymentAmountUSD &&
    paymentAmountUSD >= swapLimits.usd
  ) {
    return { isValid: true, paymentMethod: 'USD' };
  }
  const errorReason =
    dollarBalanceToken >= paymentAmountUSD && paymentAmountUSD < swapLimits.usd
      ? 'BELOW_USD_SWAP_MINIMUM'
      : 'INSUFFICIENT_FUNDS';
  return { isValid: false, paymentMethod: null, errorReason };
}
