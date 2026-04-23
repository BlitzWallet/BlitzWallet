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
}) {
  if (bitcoinBalance >= paymentAmountSats) {
    return { isValid: true, paymentMethod: 'BTC' };
  }
  if (dollarBalanceToken >= paymentAmountUSD) {
    return { isValid: true, paymentMethod: 'USD' };
  }
  return { isValid: false, paymentMethod: null };
}
