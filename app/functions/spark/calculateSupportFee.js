/**
 * Calculates fee based on progressive brackets.
 * @param {number} amount - amount in sats to send
 * @returns {number} fee in sats
 */
export default function calculateProgressiveBracketFee(amount) {
  const brackets = [
    { upTo: 50, fixedFee: 1, percentage: 0 }, // 0% + 1 sat
    { upTo: 1000, fixedFee: 2, percentage: 0.004 }, // 0.4% + 2 sats
    { upTo: Infinity, fixedFee: 4, percentage: 0.004 }, // fallback: 0.4% + 4 sats
  ];

  for (const bracket of brackets) {
    if (amount <= bracket.upTo) {
      const fee = Math.ceil(amount * bracket.percentage) + bracket.fixedFee;
      return fee;
    }
  }

  // Should never reach here, but return minimal fee just in case
  return 1;
}
