import { SATSPERBITCOIN } from '../constants/math';

export const RATE_MAX_INPUT_AGE_MS = 65 * 60 * 1000;
export const RATE_REFRESH_MS = 30 * 60 * 1000;
export const SNAPSHOT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isUsableRate(rate, code) {
  if (!code) return false;
  return (
    rate?.coin?.toUpperCase() === code.toUpperCase() &&
    Number.isFinite(rate.value) &&
    rate.value > 0
  );
}

export function isFreshRate(rate, code, now, maxAgeMs) {
  return (
    isUsableRate(rate, code) &&
    rate.fetchedAt != null &&
    now - rate.fetchedAt <= maxAgeMs
  );
}

const hasValue = rate => Number.isFinite(rate?.value) && rate.value > 0;

export function satsToFiat(sats, rate) {
  const n = Number(sats);
  if (!hasValue(rate) || sats == null || !Number.isFinite(n)) return null;
  return (n / SATSPERBITCOIN) * rate.value;
}

export function fiatToSats(fiat, rate) {
  const n = Number(fiat);
  if (!hasValue(rate) || fiat == null || !Number.isFinite(n) || n < 0)
    return null;
  return Math.round((n * SATSPERBITCOIN) / rate.value);
}

let currentMarketRate = null;
export const setCurrentMarketRate = rate => {
  currentMarketRate = rate;
};
export const getCurrentMarketRate = () => currentMarketRate;

// Home total in the user's fiat. Dollars are converted at rate/usdRate so a
// USD user gets exactly btc*rate + usdb. Display only.
export function homeTotalFiat({ btcSats, usdbDollars, rate, usdRate }) {
  if (!hasValue(rate) || !hasValue(usdRate)) return null;
  const btc = satsToFiat(btcSats, rate);
  if (btc == null) return null;
  const usdb = Number(usdbDollars) || 0;
  return (
    btc +
    (rate.coin?.toUpperCase() === 'USD'
      ? usdb
      : (usdb * rate.value) / usdRate.value)
  );
}

// D3: USD rate for display/entry only (never execution). Market USD when
// fresh, else the Flashnet pool price, else the market rate as-is (renders sats).
export function resolveDisplayUsdRate(usdFiatStats, swapUSDPriceDollars) {
  if (isFreshRate(usdFiatStats, 'USD', Date.now(), RATE_MAX_INPUT_AGE_MS))
    return usdFiatStats;
  if (swapUSDPriceDollars > 0)
    return { coin: 'USD', value: swapUSDPriceDollars, fetchedAt: Date.now() };
  return usdFiatStats;
}
