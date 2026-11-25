import {
  isValidFiatValue,
  shouldReplaceFiatValue,
  buildEnteredFiatValue,
  buildSnapshotFiatValue,
  resolveTxFiatDisplay,
  txFiatAmount,
} from '../../app/functions/txFiatValue';

const fv = (source, extra = {}) => ({
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
    expect(isValidFiatValue(fv('entered', { rate: NaN }))).toBe(false);
    expect(isValidFiatValue(fv('entered', { rate: 0 }))).toBe(false);
    expect(isValidFiatValue(fv('guess'))).toBe(false);
  });
});

describe('shouldReplaceFiatValue', () => {
  it('never stores invalid', () => {
    expect(
      shouldReplaceFiatValue(fv('entered', { rate: NaN }), undefined),
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
  const base = { displayCurrency: 'USD', rate, now };
  it('builds for fiat with matching rate (no stored fiat amount)', () => {
    expect(buildEnteredFiatValue(base)).toEqual({
      currency: 'USD',
      rate: 50000,
      source: 'entered',
      at: now,
    });
  });
  it('null for sats, token, wrong coin', () => {
    expect(
      buildEnteredFiatValue({ ...base, displayCurrency: 'SATS' }),
    ).toBeNull();
    expect(
      buildEnteredFiatValue({ ...base, displayCurrency: 'USDB' }),
    ).toBeNull();
    expect(
      buildEnteredFiatValue({ ...base, displayCurrency: 'EUR' }),
    ).toBeNull();
  });
});

describe('buildSnapshotFiatValue', () => {
  const details = { amount: 100000, time: now - 1000 };
  const freshRate = { coin: 'USD', value: 50000, fetchedAt: now, status: 'ready' };
  it('snapshots the rate within window', () => {
    expect(buildSnapshotFiatValue(details, freshRate, now)).toEqual({
      currency: 'USD',
      rate: 50000,
      source: 'snapshot',
      at: now,
    });
  });
  it('null when old, token, wrong/unusable rate, or already present', () => {
    expect(
      buildSnapshotFiatValue({ ...details, time: now - 11 * 60000 }, freshRate, now),
    ).toBeNull();
    expect(
      buildSnapshotFiatValue({ ...details, isLRC20Payment: true }, freshRate, now),
    ).toBeNull();
    expect(buildSnapshotFiatValue(details, null, now)).toBeNull();
    expect(
      buildSnapshotFiatValue(details, { coin: 'USD', value: null }, now),
    ).toBeNull();
    expect(
      buildSnapshotFiatValue(
        { ...details, fiatValue: fv('entered') },
        freshRate,
        now,
      ),
    ).toBeNull();
    expect(buildSnapshotFiatValue({ amount: 5 }, freshRate, now)).toBeNull();
  });
  it('null when the rate is stale or has no fetchedAt', () => {
    expect(
      buildSnapshotFiatValue(
        details,
        { ...freshRate, fetchedAt: now - 2 * 60 * 60 * 1000 },
        now,
      ),
    ).toBeNull();
    expect(
      buildSnapshotFiatValue(details, { ...freshRate, fetchedAt: undefined }, now),
    ).toBeNull();
  });
});

describe('resolveTxFiatDisplay (SM-3)', () => {
  const base = {
    details: { amount: 100000, fiatValue: fv('entered', { rate: 49000 }) },
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
  it('sats x stored rate when currency matches', () => {
    expect(run()).toEqual({ amount: 49, currency: 'USD', approx: false });
    expect(
      run({
        details: { ...base.details, fiatValue: fv('snapshot', { rate: 49000 }) },
      }),
    ).toEqual({ amount: 49, currency: 'USD', approx: true });
  });
  it('ignores a legacy stored fiat amount', () => {
    expect(
      run({
        details: {
          ...base.details,
          fiatValue: fv('entered', { rate: 49000, amount: 12 }),
        },
      }),
    ).toEqual({ amount: 49, currency: 'USD', approx: false });
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

describe('txFiatAmount', () => {
  it('converts the tx sats at the stored rate', () => {
    expect(
      txFiatAmount({ amount: 100000, fiatValue: fv('entered', { rate: 49000 }) }),
    ).toBe(49);
  });
  it('null without a valid fiatValue or sats', () => {
    expect(txFiatAmount({ amount: 100000 })).toBeNull();
    expect(txFiatAmount({ fiatValue: fv('entered') })).toBeNull();
    expect(txFiatAmount(undefined)).toBeNull();
  });
});
