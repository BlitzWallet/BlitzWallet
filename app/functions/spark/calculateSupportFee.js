// Lightning brackets
export const lightningBrackets = [
  { upTo: 50, fixedFee: 1, percentage: 0 }, // 0% + 1 sat
  { upTo: 1000, fixedFee: 2, percentage: 0.001 }, // 0.1% + 2 sats
  { upTo: 30000, fixedFee: 3, percentage: 0.001 }, // 0.1% + 3 sats
  { upTo: Infinity, fixedFee: 4, percentage: 0.002 }, // fallback: 0.2% + 4 sats
];
export const sparkBrackets = [
  { upTo: 50, fixedFee: 1, percentage: 0 }, // 0% + 1 sat
  { upTo: 1000, fixedFee: 2, percentage: 0.004 }, // 0.4% + 2 sats
  { upTo: Infinity, fixedFee: 4, percentage: 0.004 }, // fallback: 0.4% + 4 sats
];
export const bitcoinBrackets = [
  { upTo: 30000, fixedFee: 3, percentage: 0.003 }, // 0.3% + 3 sats
  { upTo: Infinity, fixedFee: 4, percentage: 0.004 }, // fallback: 0.4% + 4 sats
];
export const LRC20Brackets = [
  { upTo: Infinity, fixedFee: 10, percentage: 0 }, // 0.0% + 10 sats
];
/**
 * Calculates fee based on progressive brackets.
 * @param {number} amount - amount in sats to send
 * @returns {number} fee in sats
 */
export default async function calculateProgressiveBracketFee(
  amount,
  paymentType,
  mnemonic,
) {
  return 0;
  let brackets;
  if (paymentType === 'lightning') {
    brackets = lightningBrackets;
  } else if (paymentType === 'bitcoin') {
    brackets = bitcoinBrackets;
  } else if (paymentType === 'spark') {
    brackets = sparkBrackets;
  } else if (paymentType === 'lrc20') {
    brackets = LRC20Brackets;
  } else {
    brackets = sparkBrackets; // default fallback
  }

  for (const bracket of brackets) {
    if (amount <= bracket.upTo) {
      const fee = Math.ceil(amount * bracket.percentage) + bracket.fixedFee;

      return fee;
    }
  }

  // Should never reach here, but return minimal fee just in case
  return 1;
}
