import {
  isValidFiatValue,
  shouldReplaceFiatValue,
  buildEnteredFiatValue,
  buildSnapshotFiatValue,
  resolveTxFiatDisplay,
} from '../../app/functions/txFiatValue';

const fv = (source, extra = {}) => ({
  amount: 1,
  currency: 'USD',
  rate: 50000,
  source,
  at: 1,
  ...extra,
});
const rate = { coin: 'USD', value: 50000, fetchedAt: 1, status: 'ready' };
const now = 1_000_000_000;

describe('isValidFiatValue', () => {
  it('rejects bad shapes', () => {
    expect(isValidFiatValue(fv('entered'))).toBe(true);
    expect(isValidFiatValue(null)).toBe(false);
    expect(isValidFiatValue(fv('entered', { currency: '' }))).toBe(false);
    expect(isValidFiatValue(fv('entered', { currency: undefined }))).toBe(
      false,
    );
    expect(isValidFiatValue(fv('entered', { amount: NaN }))).toBe(false);
    expect(isValidFiatValue(fv('entered', { rate: 0 }))).toBe(false);
    expect(isValidFiatValue(fv('guess'))).toBe(false);
  });
});

describe('shouldReplaceFiatValue', () => {
  it('never stores invalid', () => {
    expect(
      shouldReplaceFiatValue(fv('entered', { amount: NaN }), undefined),
    ).toBe(false);
    expect(shouldReplaceFiatValue(undefined, fv('snapshot'))).toBe(false);
  });
  it('fills missing/invalid existing', () => {
    expect(shouldReplaceFiatValue(fv('snapshot'), undefined)).toBe(true);
    expect(shouldReplaceFiatValue(fv('entered'), { junk: 1 })).toBe(true);
  });
  it('entered beats snapshot only', () => {
    expect(shouldReplaceFiatValue(fv('entered'), fv('snapshot'))).toBe(true);
    expect(shouldReplaceFiatValue(fv('snapshot'), fv('entered'))).toBe(false);
    expect(shouldReplaceFiatValue(fv('snapshot'), fv('snapshot'))).toBe(false);
    expect(shouldReplaceFiatValue(fv('entered'), fv('entered'))).toBe(false);
  });
});

describe('buildEnteredFiatValue', () => {
  const base = { displayAmount: '12.5', displayCurrency: 'USD', rate, now };
  it('builds for fiat with matching rate', () => {
    expect(buildEnteredFiatValue(base)).toEqual({
      amount: 12.5,
      currency: 'USD',
      rate: 50000,
      source: 'entered',
      at: now,
    });
  });
  it('null for sats, token, wrong coin, bad amount', () => {
    expect(
      buildEnteredFiatValue({ ...base, displayCurrency: 'SATS' }),
    ).toBeNull();
    expect(
      buildEnteredFiatValue({ ...base, displayCurrency: 'USDB' }),
    ).toBeNull();
    expect(
      buildEnteredFiatValue({ ...base, displayCurrency: 'EUR' }),
    ).toBeNull();
    expect(buildEnteredFiatValue({ ...base, displayAmount: 'abc' })).toBeNull();
    expect(buildEnteredFiatValue({ ...base, displayAmount: -1 })).toBeNull();
  });
});

describe('buildSnapshotFiatValue', () => {
  const details = { amount: 100000, time: now - 1000 };
  it('snapshots within window, 2dp', () => {
    expect(buildSnapshotFiatValue(details, rate, now)).toEqual({
      amount: 50,
      currency: 'USD',
      rate: 50000,
      source: 'snapshot',
      at: now,
    });
    expect(
      buildSnapshotFiatValue({ ...details, amount: 123 }, rate, now).amount,
    ).toBe(0.06);
  });
  it('null when old, token, wrong/unusable rate, or already present', () => {
    expect(
      buildSnapshotFiatValue({ ...details, time: now - 11 * 60000 }, rate, now),
    ).toBeNull();
    expect(
      buildSnapshotFiatValue({ ...details, isLRC20Payment: true }, rate, now),
    ).toBeNull();
    expect(buildSnapshotFiatValue(details, null, now)).toBeNull();
    expect(
      buildSnapshotFiatValue(details, { coin: 'USD', value: null }, now),
    ).toBeNull();
    expect(
      buildSnapshotFiatValue(
        { ...details, fiatValue: fv('entered') },
        rate,
        now,
      ),
    ).toBeNull();
    expect(buildSnapshotFiatValue({ amount: 5 }, rate, now)).toBeNull();
  });
});

describe('resolveTxFiatDisplay (SM-3)', () => {
  const base = {
    details: { amount: 100000, fiatValue: fv('entered', { amount: 49 }) },
    denomination: 'fiat',
    selectedCurrency: 'USD',
    marketRate: rate,
  };
  const run = o => resolveTxFiatDisplay({ ...base, ...o });
  it('null when not fiat denomination or token tx', () => {
    expect(run({ denomination: 'sats' })).toBeNull();
    expect(run({ denomination: 'hidden' })).toBeNull();
    expect(
      run({ details: { ...base.details, isLRC20Payment: true } }),
    ).toBeNull();
  });
  it('stored amount when currency matches', () => {
    expect(run()).toEqual({ amount: 49, currency: 'USD', approx: false });
    expect(
      run({
        details: { ...base.details, fiatValue: fv('snapshot', { amount: 49 }) },
      }),
    ).toEqual({ amount: 49, currency: 'USD', approx: true });
  });
  it('matches stored currency case-insensitively', () => {
    expect(run({ selectedCurrency: 'usd' })).toEqual({
      amount: 49,
      currency: 'USD',
      approx: false,
    });
  });
  it('market-now approx when stored currency differs or none (T7)', () => {
    const eur = { coin: 'EUR', value: 40000, fetchedAt: 1, status: 'ready' };
    expect(run({ selectedCurrency: 'EUR', marketRate: eur })).toEqual({
      amount: 40,
      currency: 'EUR',
      approx: true,
    });
    expect(run({ details: { amount: 100000 }, marketRate: rate })).toEqual({
      amount: 50,
      currency: 'USD',
      approx: true,
    });
    expect(run()).toEqual({ amount: 49, currency: 'USD', approx: false });
  });
  it('sats when no usable rate and no match', () => {
    expect(
      run({
        selectedCurrency: 'EUR',
        marketRate: { coin: 'EUR', value: null },
      }),
    ).toEqual({ sats: true });
    expect(run({ details: { amount: 5 }, marketRate: null })).toEqual({
      sats: true,
    });
  });
});
