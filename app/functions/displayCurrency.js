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

export function normalizeDisplayCurrency(currency) {
  if (!currency) return SATS_DISPLAY_CURRENCY;
  const normalized = String(currency).toUpperCase();
  if (normalized === 'BTC') return SATS_DISPLAY_CURRENCY;
  return normalized;
}
