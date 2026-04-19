import {
  calculateFlashnetAmountIn,
  SEND_AMOUNT_INCREASE_BUFFER,
} from '../app/functions/spark/swapAmountUtils';

const PRICE = 1_000_000; // 1 sat = $1.00 at this mock price (simplifies math)

describe('calculateFlashnetAmountIn', () => {
  describe('BTC→USD (isUsdAssetIn = false)', () => {
    it('applies default 1% buffer to sats', () => {
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 10_000,
        isUsdAssetIn: false,
        maxBalance: 100_000,
      });
      expect(result).toBe(Math.round(10_000 * SEND_AMOUNT_INCREASE_BUFFER));
    });

    it('caps to maxBalance when buffer exceeds it', () => {
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 99_999,
        isUsdAssetIn: false,
        maxBalance: 100_000,
      });
      expect(result).toBe(100_000);
    });

    it('accepts a custom bufferMultiplier', () => {
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 10_000,
        isUsdAssetIn: false,
        maxBalance: 100_000,
        bufferMultiplier: 1.02,
      });
      expect(result).toBe(10_200);
    });

    it('returns integer', () => {
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 9999,
        isUsdAssetIn: false,
        maxBalance: 50_000,
      });
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('USD→BTC (isUsdAssetIn = true)', () => {
    // 1_000_000 microdollars = $1.00
    it('applies default 1% buffer and returns microdollars', () => {
      // $10.00 in microdollars; PRICE = 1_000_000 means 1 sat = $1.00
      // dollarBalanceSat = 1_000_000 → satsToDollars(1_000_000, 1_000_000) = $1_000_000
      const base = 10_000_000;
      const result = calculateFlashnetAmountIn({
        baseAmountIn: base,
        isUsdAssetIn: true,
        dollarBalanceSat: 1_000_000,
        currentPriceAInB: PRICE,
      });
      // buffer: 10.00 * 1.01 = 10.10 → 10_100_000 microdollars
      expect(result).toBe(10_100_000);
    });

    it('caps to balance when buffer exceeds it (low balance scenario)', () => {
      // base = $10 but USD balance only covers $5
      // dollarBalanceSat = 5 sats, PRICE = 1_000_000 → satsToDollars(5, 1_000_000) = 5
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 10_000_000, // $10
        isUsdAssetIn: true,
        dollarBalanceSat: 5, // 5 sats → $5 at PRICE
        currentPriceAInB: PRICE,
      });
      // bufferedDollars = 10_000_000 * 1.01 / 1e6 = 10.10
      // balanceDollars = satsToDollars(5, 1_000_000) = 5 * 1_000_000 / 1_000_000 = 5
      // cappedDollars = min(10.10, 5) = 5.00
      expect(result).toBe(5_000_000);
    });

    it('falls back to maxBalance/1e6 when dollarBalanceSat and currentPriceAInB are absent', () => {
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 5_000_000, // $5.00
        isUsdAssetIn: true,
        maxBalance: 10_000_000, // $10.00 in microdollars
      });
      // 5.00 * 1.01 = 5.05 → 5_050_000
      expect(result).toBe(5_050_000);
    });

    it('returns integer', () => {
      const result = calculateFlashnetAmountIn({
        baseAmountIn: 3_333_333,
        isUsdAssetIn: true,
        maxBalance: 100_000_000,
      });
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
