import {
  normalizeLNURLCurrency,
  lnurlCurrencyToRate,
} from '../../../app/functions/sendBitcoin/lnurlCurrencyRate';
import { SATSPERBITCOIN } from '../../../app/constants';

describe('normalizeLNURLCurrency', () => {
  test('prefers the LUD-22 currencies array over the single currency object', () => {
    const result = normalizeLNURLCurrency({
      currencies: [
        { code: 'PHP', symbol: '₱', decimals: 2, multiplier: 100 },
      ],
      currency: { code: 'KES', symbol: 'KSh', multiplier: 200 },
    });
    expect(result).toEqual({
      code: 'PHP',
      decimals: 2,
      multiplier: 100,
      symbol: '₱',
    });
  });

  test('falls back to the single currency object and defaults decimals to 0', () => {
    const result = normalizeLNURLCurrency({
      currency: {
        code: 'php',
        symbol: '₱',
        minSendable: 30,
        maxSendable: 50000,
        multiplier: 26695.55342671,
      },
    });
    expect(result).toEqual({
      code: 'PHP',
      decimals: 0,
      multiplier: 26695.55342671,
      symbol: '₱',
    });
  });

  test('returns null when no currency is advertised', () => {
    expect(normalizeLNURLCurrency({})).toBeNull();
    expect(normalizeLNURLCurrency(null)).toBeNull();
  });

  test('returns null when multiplier is missing or non-positive', () => {
    expect(
      normalizeLNURLCurrency({ currency: { code: 'PHP', symbol: '₱' } }),
    ).toBeNull();
    expect(
      normalizeLNURLCurrency({
        currency: { code: 'PHP', symbol: '₱', multiplier: 0 },
      }),
    ).toBeNull();
  });
});

describe('lnurlCurrencyToRate', () => {
  test('derives the BTC price in the fiat currency (zapremit PHP example)', () => {
    const rate = lnurlCurrencyToRate({
      code: 'PHP',
      decimals: 0,
      multiplier: 26695.55342671,
    });
    const expected = (SATSPERBITCOIN * 1000) / 26695.55342671;
    expect(rate.coin).toBe('PHP');
    expect(rate.value).toBeCloseTo(expected, 5);
    // sanity: ~3.75M PHP per BTC
    expect(rate.value).toBeGreaterThan(3_000_000);
    expect(rate.value).toBeLessThan(5_000_000);
  });

  test('accounts for decimals (smallest-unit multiplier)', () => {
    const rate = lnurlCurrencyToRate({
      code: 'PHP',
      decimals: 2,
      multiplier: 100,
    });
    expect(rate.value).toBeCloseTo(
      (SATSPERBITCOIN * 1000) / (100 * 100),
      5,
    );
  });

  test('returns null for missing or invalid input', () => {
    expect(lnurlCurrencyToRate(null)).toBeNull();
    expect(
      lnurlCurrencyToRate({ code: 'PHP', decimals: 0, multiplier: 0 }),
    ).toBeNull();
  });

  // The wallet sends a millisat-denominated callback request, computing the sat
  // amount from the entered fiat via the derived rate. That conversion must equal
  // LUD-22's multiplier definition: msats = smallestUnits * multiplier, where
  // smallestUnits = fiatMajorAmount * 10^decimals. This locks the two in sync.
  test.each([
    { decimals: 0, multiplier: 26695.55342671, fiat: 100 }, // zapremit PHP
    { decimals: 2, multiplier: 5405.405, fiat: 1.5 }, // standard BRL
    { decimals: 6, multiplier: 26315.789, fiat: 2 }, // standard USDT
  ])(
    'rate-based sat conversion matches the multiplier (decimals=$decimals)',
    ({ decimals, multiplier, fiat }) => {
      const rate = lnurlCurrencyToRate({ code: 'X', decimals, multiplier });
      // How the send screen converts the entered fiat amount to sats:
      const satsFromRate = (SATSPERBITCOIN / rate.value) * fiat;
      // LUD-22 multiplier definition (msats = smallestUnits * multiplier):
      const satsFromMultiplier =
        (fiat * Math.pow(10, decimals) * multiplier) / 1000;
      expect(satsFromRate).toBeCloseTo(satsFromMultiplier, 6);
    },
  );
});
