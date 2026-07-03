import { formatCurrency } from './formatCurrency';

export const SATS_DISPLAY_CURRENCY = 'SATS';

export function getCurrencySymbol(code) {
  if (!code) return '';
  const symbol = formatCurrency({ amount: '', code }).at(2);
  return symbol || String(code).slice(0, 2);
}

export function getDefaultDisplayCurrency({
  paymentMode = 'BTC',
  masterInfoObject,
  fiatStats,
}) {
  if (paymentMode === 'USD') return 'USD';

  const balanceDenomination = masterInfoObject?.userBalanceDenomination;
  if (balanceDenomination === 'fiat') {
    return (
      fiatStats?.coin ||
      masterInfoObject?.fiatCurrency ||
      'USD'
    ).toUpperCase();
  }

  return SATS_DISPLAY_CURRENCY;
}

// Resolves the fiat stats object used for USD display/entry. When the user's
// selected currency is already USD, `fiatStats` is the market USD price that the
// rest of the app (and transaction history) uses — prefer it so entered amounts
// don't float against what's later displayed. Otherwise fall back to the Flashnet
// pool price, which is the only always-USD reference available for non-USD users.
export function resolveUsdFiatStats(fiatStats, swapUSDPriceDollars) {
  if (fiatStats?.coin?.toUpperCase() === 'USD') return fiatStats;
  return { coin: 'USD', value: swapUSDPriceDollars };
}

export function normalizeDisplayCurrency(currency) {
  if (!currency) return SATS_DISPLAY_CURRENCY;
  const normalized = String(currency).toUpperCase();
  if (normalized === 'BTC') return SATS_DISPLAY_CURRENCY;
  return normalized;
}
