import { buildCumulativeData } from '../app/components/admin/homeComponents/analytics/cumulativeLineChartHelpers';

// Mock getSatsFromTx to avoid SDK dependencies
jest.mock('../app/functions/getSatsFromTx', () => ({
  getSatsFromTx: (tx, currentPrice, direction) => {
    try {
      const details = JSON.parse(tx.details);
      // Skip LRC20 payments
      if (details.isLRC20Payment) {
        return 0;
      }
      return Number(details.amount || 0);
    } catch {
      return 0;
    }
  },
}));

// Pin today to April 15, 2026 for deterministic length
const TODAY = new Date(2026, 3, 15); // month is 0-indexed

function makeTx(day, amount, isLRC20 = false) {
  const time = new Date(2026, 3, day).getTime();
  return {
    details: JSON.stringify({ time, amount, isLRC20Payment: isLRC20 }),
  };
}

describe('buildCumulativeData', () => {
  it('returns one entry per day from 1 to today when empty', () => {
    const result = buildCumulativeData([], TODAY);
    expect(result).toHaveLength(15);
    expect(result[0]).toEqual({ timestamp: new Date(2026, 3, 1).getTime(), value: 0 });
    expect(result[14]).toEqual({ timestamp: new Date(2026, 3, 15).getTime(), value: 0 });
  });

  it('single tx on day 3 accumulates from day 3 onward', () => {
    const result = buildCumulativeData([makeTx(3, 1000)], TODAY);
    expect(result[0].value).toBe(0); // day 1
    expect(result[1].value).toBe(0); // day 2
    expect(result[2].value).toBe(1000); // day 3
    expect(result[14].value).toBe(1000); // day 15
  });

  it('multiple txs on same day are summed', () => {
    const result = buildCumulativeData([makeTx(1, 500), makeTx(1, 300)], TODAY);
    expect(result[0].value).toBe(800);
  });

  it('result days are ascending and cumulative is non-decreasing', () => {
    const result = buildCumulativeData(
      [makeTx(5, 200), makeTx(2, 100), makeTx(10, 50)],
      TODAY,
    );
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp).toBeGreaterThan(result[i - 1].timestamp);
      expect(result[i].value).toBeGreaterThanOrEqual(
        result[i - 1].value,
      );
    }
  });

  it('skips LRC20 payment transactions', () => {
    const result = buildCumulativeData([makeTx(1, 1000, true)], TODAY);
    expect(result[0].value).toBe(0);
  });

  it('handles corrupted details gracefully', () => {
    const badTx = { details: 'not-json' };
    const result = buildCumulativeData([badTx], TODAY);
    expect(result[14].value).toBe(0);
  });
});
