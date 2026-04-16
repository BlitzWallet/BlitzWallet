import { computePieSegments } from '../app/functions/CustomElements/balancePieChartHelpers';

const BASE = {
  bitcoinBalance: 100_000,
  dollarBalanceSat: 50_000,
  dollarBalanceToken: 30,
  savingsBalance: 10,
  btcPrice: 100_000_000,
};

// dollarsToSats(dollars, price) = (dollars * 1_000_000) / price
// with btcPrice=100_000_000: dollarsToSats(10) = 10_000_000 / 100_000_000 = 0.1 sats

describe('computePieSegments', () => {
  it('sats mode: bitcoin stays in sats, dollar combines dollarBalanceSat + savingsSat', () => {
    const result = computePieSegments({ ...BASE, denomination: 'sats' });
    expect(result.btcValue).toBe(100_000);
    const savingsSat = (10 * 1_000_000) / 100_000_000;
    expect(result.dollarValue).toBeCloseTo(50_000 + savingsSat, 5);
  });

  it('hidden denomination treated same as sats', () => {
    const result = computePieSegments({ ...BASE, denomination: 'hidden' });
    expect(result.btcValue).toBe(100_000);
  });

  it('fiat mode: bitcoin converted to USD, dollar combines dollarBalanceToken + savingsBalance', () => {
    const result = computePieSegments({
      ...BASE,
      btcPrice: 100_000,
      denomination: 'fiat',
    });
    // 100_000 sats = 0.001 BTC * $100,000 = $100
    expect(result.btcValue).toBeCloseTo(100, 5);
    expect(result.dollarValue).toBeCloseTo(40, 5); // $30 + $10
  });

  it('returns zeros when all balances are zero', () => {
    const result = computePieSegments({
      bitcoinBalance: 0,
      dollarBalanceSat: 0,
      dollarBalanceToken: 0,
      savingsBalance: 0,
      btcPrice: 100_000,
      denomination: 'sats',
    });
    expect(result.btcValue).toBe(0);
    expect(result.dollarValue).toBe(0);
  });

  it('handles zero btcPrice gracefully in fiat mode', () => {
    const result = computePieSegments({
      ...BASE,
      btcPrice: 0,
      denomination: 'fiat',
    });
    expect(result.btcValue).toBe(0);
    expect(result.dollarValue).toBeCloseTo(40, 5);
  });
});
