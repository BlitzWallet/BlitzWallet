import {
  DEFAULT_ROOTSTOCK_SUBMARINE_PAIR,
  buildRootstockSubmarineLimits,
  calculateBufferedBoltzFeeSats,
  calculateInvoiceAmountAfterFees,
  normalizeSubmarineFees,
} from '../../../../app/functions/boltz/rootstock/swapLimits';

describe('Rootstock submarine swap limits', () => {
  it('builds RBTC submarine limits from the submarine pair response', () => {
    const limits = buildRootstockSubmarineLimits(
      {
        RBTC: {
          BTC: {
            limits: { minimal: 2500, maximal: 25000000, maximalZeroConf: 0 },
            fees: { percentage: 0.1, minerFees: 32 },
          },
        },
      },
      { min: 100, max: 200 },
    );

    expect(limits.min).toBe(2500);
    expect(limits.max).toBe(25000000);
    expect(limits.submarine.fees.minerFees).toBe(32);
  });

  it('falls back to hardened defaults before Boltz data is loaded', () => {
    const limits = buildRootstockSubmarineLimits(false, undefined);

    expect(limits.min).toBe(DEFAULT_ROOTSTOCK_SUBMARINE_PAIR.limits.minimal);
    expect(limits.max).toBe(DEFAULT_ROOTSTOCK_SUBMARINE_PAIR.limits.maximal);
    expect(limits.submarine.fees).toEqual(
      DEFAULT_ROOTSTOCK_SUBMARINE_PAIR.fees,
    );
  });

  it('normalizes submarine scalar miner fees', () => {
    expect(
      normalizeSubmarineFees({ percentage: 0.1, minerFees: 32 }),
    ).toEqual({
      percentage: 0.1,
      minerFeeSats: 32,
    });
  });

  it('keeps percentage fees tied to the invoice amount', () => {
    expect(
      calculateBufferedBoltzFeeSats({
        swapAmountSats: 10000n,
        minerFeeSats: 32,
        percentage: 0.1,
      }),
    ).toBe(47);
  });

  it('solves the invoice amount after miner and percentage fees', () => {
    const amount = calculateInvoiceAmountAfterFees({
      availableSats: 10000n,
      minSats: 2500n,
      maxSats: 25000000n,
      minerFeeSats: 32,
      percentage: 0.1,
    });

    expect(amount).toBe(9953n);
  });

  it('clamps the invoice amount to the Boltz maximum', () => {
    const amount = calculateInvoiceAmountAfterFees({
      availableSats: 100000000n,
      minSats: 2500n,
      maxSats: 25000000n,
      minerFeeSats: 32,
      percentage: 0.1,
    });

    expect(amount).toBe(25000000n);
  });

  it('returns zero when the amount is below Boltz minimum', () => {
    const amount = calculateInvoiceAmountAfterFees({
      availableSats: 2000n,
      minSats: 2500n,
      maxSats: 25000000n,
      minerFeeSats: 32,
      percentage: 0.1,
    });

    expect(amount).toBe(0n);
  });
});
