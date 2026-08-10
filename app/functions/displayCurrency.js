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

// Resolves the fiat stats used to convert a displayed line labeled `currency`.
// A fiat conversion may only use stats whose coin matches the displayed
// currency — otherwise the numeric value of one currency would render under
// another currency's symbol (e.g. a stale USD rate labeled EUR). USD lines
// always use the USD stats; for any other currency the pinned entry-time stats
// (paymentDisplayFiatStats) are preferred, then the device fiat stats — only
// when their coin matches. Returns null when nothing matches so callers can
// omit the line rather than render a misleading conversion.
export function resolveFiatStatsForCurrency(
  currency,
  { paymentDisplayFiatStats, usdFiatStats, fiatStats },
) {
  const normalized = normalizeDisplayCurrency(currency);
  if (normalized === SATS_DISPLAY_CURRENCY) return null;
  if (normalized === 'USD') return usdFiatStats || null;
  if (paymentDisplayFiatStats?.coin?.toUpperCase() === normalized) {
    return paymentDisplayFiatStats;
  }
  if (fiatStats?.coin?.toUpperCase() === normalized) return fiatStats;
  return null;
}
