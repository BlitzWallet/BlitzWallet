import {
  isUsableRate,
  isFreshRate,
  satsToFiat,
  fiatToSats,
  homeTotalFiat,
  resolveDisplayUsdRate,
  setCurrentMarketRate,
  getCurrentMarketRate,
  RATE_MAX_INPUT_AGE_MS,
} from '../../app/functions/money';
import numberConverter from '../../app/functions/numberConverter';
import isFiatDustAmount from '../../app/functions/isFiatDustAmount';

const r = { coin: 'USD', value: 100000 };

describe('satsToFiat', () => {
  it('returns null for missing/zero/NaN rate or non-finite sats', () => {
    expect(satsToFiat(1000, undefined)).toBeNull();
    expect(satsToFiat(1000, { coin: 'USD', value: 0 })).toBeNull();
    expect(satsToFiat(1000, { coin: 'USD', value: NaN })).toBeNull();
    expect(satsToFiat(NaN, r)).toBeNull();
  });
  it('converts without exponent or precision loss', () => {
    expect(satsToFiat(1000, r)).toBe(1);
    // 2.1e15 sats = 21,000,000 BTC
    expect(satsToFiat(2_100_000_000_000_000, r)).toBe(2100000000000);
  });
});

describe('isUsableRate', () => {
  it('matches coin case-insensitively', () => {
    expect(isUsableRate({ coin: 'usd', value: 1 }, 'USD')).toBe(true);
    expect(isUsableRate({ coin: 'USD', value: 1 }, 'EUR')).toBe(false);
    expect(isUsableRate({ coin: 'USD', value: 1 }, undefined)).toBe(false);
    expect(isUsableRate({ coin: 'USD', value: null }, 'USD')).toBe(false);
  });
});

describe('isFreshRate', () => {
  const now = 1_000_000_000_000;
  it('rejects stale and null fetchedAt', () => {
    const max = RATE_MAX_INPUT_AGE_MS;
    expect(
      isFreshRate({ ...r, fetchedAt: now - max - 1 }, 'USD', now, max),
    ).toBe(false);
    expect(isFreshRate({ ...r, fetchedAt: null }, 'USD', now, max)).toBe(false);
    expect(isFreshRate({ ...r, fetchedAt: now - max }, 'USD', now, max)).toBe(
      true,
    );
  });
});

describe('fiatToSats', () => {
  it('rounds and rejects bad input', () => {
    expect(fiatToSats(-1, r)).toBeNull();
    expect(fiatToSats(NaN, r)).toBeNull();
    expect(fiatToSats(5, undefined)).toBeNull();
    expect(fiatToSats(5, r)).toBe(5000);
  });
});

describe('current market rate slot', () => {
  it('stores and returns', () => {
    expect(getCurrentMarketRate()).toBeNull();
    setCurrentMarketRate(r);
    expect(getCurrentMarketRate()).toBe(r);
  });
});

describe('numberConverter / isFiatDustAmount without a rate', () => {
  it('returns null for fiat with no usable rate', () => {
    expect(numberConverter(1000, 'fiat', 2, undefined)).toBeNull();
    expect(
      numberConverter(1000, 'fiat', 2, { coin: 'USD', value: null }),
    ).toBeNull();
  });
  it('still converts sats and usable fiat', () => {
    expect(numberConverter(1000, 'sats', 0, undefined)).toBe('1000');
    expect(numberConverter(1000, 'fiat', 2, r)).toBe('1.00');
  });
  it('dust is false with no rate', () => {
    expect(
      isFiatDustAmount({
        amount: 1,
        denomination: 'fiat',
        fiatStats: undefined,
      }),
    ).toBe(false);
    expect(
      isFiatDustAmount({ amount: 1, denomination: 'fiat', fiatStats: r }),
    ).toBe(true);
  });
});

describe('homeTotalFiat', () => {
  const usd = { coin: 'USD', value: 100000 };
  const eur = { coin: 'EUR', value: 90000 };
  it('is exactly btc*rate + usdb when rate === usdRate', () => {
    expect(
      homeTotalFiat({ btcSats: 0, usdbDollars: 100, rate: usd, usdRate: usd }),
    ).toBe(100);
    expect(
      homeTotalFiat({ btcSats: 1000, usdbDollars: 5, rate: usd, usdRate: usd }),
    ).toBe(6);
  });
  it('scales dollars by eur/usd for a non-USD rate', () => {
    expect(
      homeTotalFiat({ btcSats: 0, usdbDollars: 100, rate: eur, usdRate: usd }),
    ).toBeCloseTo(100 * (90000 / 100000), 10);
  });
  it('is null when either rate is unusable', () => {
    expect(
      homeTotalFiat({ btcSats: 1, usdbDollars: 1, rate: usd, usdRate: null }),
    ).toBeNull();
    expect(
      homeTotalFiat({
        btcSats: 1,
        usdbDollars: 1,
        rate: { coin: 'EUR', value: null },
        usdRate: usd,
      }),
    ).toBeNull();
  });
});

describe('resolveDisplayUsdRate', () => {
  const usd = { coin: 'USD', value: 100000 };
  it('prefers a usable market USD rate', () => {
    expect(resolveDisplayUsdRate(usd, 90000)).toBe(usd);
  });
  it('falls back to the pool price', () => {
    const out = resolveDisplayUsdRate({ coin: 'USD', value: null }, 90000);
    expect(out).toMatchObject({ coin: 'USD', value: 90000 });
  });
  it('returns the unusable rate when no pool price', () => {
    const bad = { coin: 'USD', value: null };
    expect(resolveDisplayUsdRate(bad, 0)).toBe(bad);
  });
});
