import { SATS_DISPLAY_CURRENCY } from './displayCurrency';
import {
  isFreshRate,
  isUsableRate,
  RATE_MAX_INPUT_AGE_MS,
  satsToFiat,
  SNAPSHOT_WINDOW_MS,
} from './money';

// fiatValue = { currency, rate, source: 'entered'|'snapshot', at }
// The value itself stays in sats (details.amount); fiat is computed on demand
// as sats x rate, so it always matches the BTC amount shown. Legacy rows may
// still carry a fiat `amount`; it is ignored.
// SM-2: NONE -> SNAPSHOT -> ENTERED (terminal), or NONE -> ENTERED.
export const isValidFiatValue = v =>
  !!v &&
  typeof v.currency === 'string' &&
  v.currency.length > 0 &&
  Number.isFinite(v.rate) &&
  v.rate > 0 &&
  Number.isFinite(v.at) &&
  (v.source === 'entered' || v.source === 'snapshot');

export const shouldReplaceFiatValue = (incoming, existing) => {
  if (!isValidFiatValue(incoming)) return false;
  if (!isValidFiatValue(existing)) return true;
  return incoming.source === 'entered' && existing.source === 'snapshot';
};

export const buildEnteredFiatValue = ({
  displayCurrency,
  rate,
  now,
}) => {
  if (
    typeof displayCurrency !== 'string' ||
    displayCurrency === SATS_DISPLAY_CURRENCY ||
    !/^[A-Za-z]{3}$/.test(displayCurrency) ||
    !isUsableRate(rate, displayCurrency)
  )
    return null;
  return {
    currency: displayCurrency,
    rate: rate.value,
    source: 'entered',
    at: now,
  };
};

// details.amount is sats for BTC rows; details.time is epoch ms.
export const buildSnapshotFiatValue = (details, rate, now) => {
  if (!details || details.fiatValue || details.isLRC20Payment) return null;
  const time = Number(details.time);
  if (!Number.isFinite(time) || Math.abs(now - time) > SNAPSHOT_WINDOW_MS)
    return null;
  if (!isFreshRate(rate, rate?.coin, now, RATE_MAX_INPUT_AGE_MS)) return null;
  if (satsToFiat(details.amount, rate) == null) return null;
  return {
    currency: rate.coin,
    rate: rate.value,
    source: 'snapshot',
    at: now,
  };
};

// Fiat value of the tx sats at the rate stored with it; null if none.
export const txFiatAmount = details => {
  const fv = details?.fiatValue;
  if (!isValidFiatValue(fv)) return null;
  return satsToFiat(details.amount, { value: fv.rate });
};

// SM-3: what the history row shows in fiat mode.
// null = caller keeps its rendering; {sats:true} = no usable rate, show sats.
export const resolveTxFiatDisplay = ({
  details,
  denomination,
  selectedCurrency,
  marketRate,
}) => {
  if (denomination !== 'fiat' || details?.isLRC20Payment) return null;
  const fv = details?.fiatValue;
  const stored = txFiatAmount(details);
  if (
    stored != null &&
    fv.currency.toUpperCase() === selectedCurrency?.toUpperCase()
  )
    return {
      amount: stored,
      currency: fv.currency.toUpperCase(),
      approx: fv.source === 'snapshot',
    };
  if (isUsableRate(marketRate, selectedCurrency)) {
    const amount = satsToFiat(details?.amount, marketRate);
    if (amount != null)
      return { amount, currency: selectedCurrency, approx: true };
  }
  return { sats: true };
};
