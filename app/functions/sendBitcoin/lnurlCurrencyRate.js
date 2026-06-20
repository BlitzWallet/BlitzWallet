import { SATSPERBITCOIN } from '../../constants';

// Pulls a single currency descriptor out of a parsed LNURL payRequest's data.
// Prefers the LUD-22 standard `currencies` array (first entry) over the
// non-standard single `currency` object (used by providers like zapremit).
// Returns { code, decimals, multiplier, symbol } or null when no usable
// currency is advertised.
export function normalizeLNURLCurrency(payData) {
  const currency =
    (Array.isArray(payData?.currencies) && payData.currencies[0]) ||
    payData?.currency ||
    null;

  if (!currency || !currency.code) return null;

  const multiplier = Number(currency.multiplier);
  if (!(multiplier > 0)) return null;

  return {
    code: String(currency.code).toUpperCase(),
    // The non-standard single-object shape omits decimals; whole-unit limits
    // (e.g. zapremit minSendable=30) imply 0 decimal places.
    decimals: Number.isFinite(currency.decimals) ? currency.decimals : 0,
    multiplier,
    symbol: currency.symbol,
  };
}

// Converts an LNURL currency descriptor into the app's { coin, value } rate
// shape, where `value` is the price of 1 BTC in that fiat currency (the same
// shape used by fiatStats / currencyRates / useCurrencyDisplay).
//
// `multiplier` is millisatoshis per smallest unit of the currency (LUD-22), so:
//   value = (sats per BTC * 1000 msat/sat) / (multiplier * 10^decimals)
// e.g. PHP multiplier 26695.55342671, decimals 0 -> ~3.75M PHP per BTC.
export function lnurlCurrencyToRate(descriptor) {
  if (!descriptor) return null;
  const { code, multiplier, decimals } = descriptor;
  if (!(multiplier > 0)) return null;

  const value =
    (SATSPERBITCOIN * 1000) / (multiplier * Math.pow(10, decimals || 0));
  if (!Number.isFinite(value) || value <= 0) return null;

  return { coin: code, value };
}
