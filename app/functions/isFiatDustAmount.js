import { SATSPERBITCOIN } from '../constants/math';

// Fiat displays round to two decimals, so a non-zero balance under one cent
// reads "0.00" (USDB has 6 decimals). Callers show 0.01 with a DustChevron
// instead. `amount` is in sats unless convertAmount is false, matching
// displayCorrectDenomination.
export default function isFiatDustAmount({
  amount,
  denomination,
  fiatStats,
  convertAmount = true,
}) {
  if (denomination !== 'fiat') return false;

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return false;

  const fiatAmount = convertAmount
    ? (numericAmount * (fiatStats?.value || 65000)) / SATSPERBITCOIN
    : numericAmount;

  return fiatAmount > 0 && fiatAmount < 0.01;
}
