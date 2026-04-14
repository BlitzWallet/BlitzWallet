jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

import {
  buildFilterQuery,
  buildDailyBalances,
  SPARK_TRANSACTIONS_TABLE_NAME,
} from '../../../app/functions/spark/transactions';

describe('buildFilterQuery', () => {
  const ACC = 'test-account-id';

  it('returns base query with only accountId when no filters active', () => {
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: null, types: [] },
      ACC,
    );
    expect(params).toEqual([ACC]);
    expect(query).toContain('accountId = ?');
    expect(query).not.toContain("json_extract(details, '$.direction')");
    expect(query).not.toContain("json_extract(details, '$.time') >=");
    expect(query).toContain('ORDER BY json_extract');
    expect(query).toContain(SPARK_TRANSACTIONS_TABLE_NAME);
  });

  it('maps sent direction to OUTGOING', () => {
    const { query, params } = buildFilterQuery(
      { directions: ['sent'], dateRange: null, types: [] },
      ACC,
    );
    expect(query).toContain("json_extract(details, '$.direction') IN (?)");
    expect(params).toContain('OUTGOING');
  });

  it('maps received direction to INCOMING', () => {
    const { params } = buildFilterQuery(
      { directions: ['received'], dateRange: null, types: [] },
      ACC,
    );
    expect(params).toContain('INCOMING');
  });

  it('includes both directions when both selected', () => {
    const { query, params } = buildFilterQuery(
      { directions: ['sent', 'received'], dateRange: null, types: [] },
      ACC,
    );
    expect(params).toContain('OUTGOING');
    expect(params).toContain('INCOMING');
    expect(query).toContain("json_extract(details, '$.direction')");
  });

  it('adds date cutoff as absolute ms timestamp for 7d', () => {
    const fixedNow = 1000000000000; // fixed timestamp
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: '7d', types: [] },
      ACC,
      fixedNow,
    );
    expect(query).toContain("json_extract(details, '$.time') >= ?");
    const cutoff = params.find(p => typeof p === 'number' && p > 1_000_000_000_000 - 7 * 24 * 60 * 60 * 1001);
    expect(cutoff).toBeDefined();
    expect(cutoff).toBe(fixedNow - 7 * 24 * 60 * 60 * 1000);
  });

  it('adds Lightning type as paymentType condition', () => {
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: null, types: ['Lightning'] },
      ACC,
    );
    expect(query).toContain('paymentType = ?');
    expect(params).toContain('lightning');
  });

  it('ORs multiple types together', () => {
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: null, types: ['Lightning', 'Bitcoin'] },
      ACC,
    );
    expect(query).toMatch(/paymentType = \?.*OR.*paymentType = \?/);
    expect(params).toContain('lightning');
    expect(params).toContain('bitcoin');
  });

  it('combines direction AND date AND type with AND logic', () => {
    const { query, params } = buildFilterQuery(
      { directions: ['sent'], dateRange: '30d', types: ['Spark'] },
      ACC,
    );
    expect(query).toContain("json_extract(details, '$.direction')");
    expect(query).toContain("json_extract(details, '$.time')");
    expect(query).toContain('paymentType = ?');
    expect(params).toContain('OUTGOING');
    expect(params).toContain('spark');
  });

  it('wraps each type clause in parens to preserve AND/OR precedence', () => {
    // Contacts clause contains AND internally — must be wrapped so it ORs correctly
    const { query } = buildFilterQuery(
      { directions: [], dateRange: null, types: ['Contacts', 'Lightning'] },
      ACC,
    );
    // Should be: AND ((contacts_expr) OR (paymentType = ?))
    expect(query).toMatch(/\(\(.*\) OR \(.*\)\)/);
  });

  it('adds 1y date cutoff as absolute ms timestamp', () => {
    const fixedNow = 1000000000000;
    const { params } = buildFilterQuery(
      { directions: [], dateRange: '1y', types: [] },
      ACC,
      fixedNow,
    );
    const cutoff = params.find(p => typeof p === 'number' && p > 1_000_000_000_000 - 365 * 24 * 60 * 60 * 1001);
    expect(cutoff).toBeDefined();
    expect(cutoff).toBe(fixedNow - 365 * 24 * 60 * 60 * 1000);
  });

  it('Swaps type generates clause with showSwapLabel and isLRC20Payment conditions', () => {
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: null, types: ['Swaps'] },
      ACC,
    );
    expect(query).toContain('showSwapLabel');
    expect(query).toContain('isLRC20Payment');
    // Swaps has no bound params beyond accountId
    expect(params).toEqual([ACC]);
  });

  it('Gifts type generates isGift condition with no extra params', () => {
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: null, types: ['Gifts'] },
      ACC,
    );
    expect(query).toContain("json_extract(details, '$.isGift') = 1");
    expect(params).toEqual([ACC]);
  });

  it('both directions produces two IN placeholders', () => {
    const { query } = buildFilterQuery(
      { directions: ['sent', 'received'], dateRange: null, types: [] },
      ACC,
    );
    // Robust check: two ? inside the IN clause
    const inClause = query.match(/IN \(([^)]+)\)/)?.[1] ?? '';
    expect(inClause.split('?').length - 1).toBe(2);
  });
});

describe('buildDailyBalances', () => {
  // Helper: build a fake tx row
  const makeTx = (day, amount, direction, month = 3, year = 2026) => ({
    details: JSON.stringify({
      time: new Date(year, month - 1, day, 12).getTime(),
      amount,
      direction,
    }),
  });

  const REF = new Date(2026, 2, 15, 18); // March 15, 2026

  it('returns one entry per day from 1 to today', () => {
    const result = buildDailyBalances([], 1000, REF);
    expect(result).toHaveLength(15);
    expect(result[0].day).toBe(1);
    expect(result[14].day).toBe(15);
  });

  it('all balances equal currentBalance when no transactions', () => {
    const result = buildDailyBalances([], 5000, REF);
    result.forEach(({ balanceSats }) => expect(balanceSats).toBe(5000));
  });

  it('subtracts incoming tx from earlier days to reconstruct past balance', () => {
    // Received 200 sats on day 10; balance before day 10 should be 800
    const txs = [makeTx(10, 200, 'INCOMING')];
    const result = buildDailyBalances(txs, 1000, REF);
    const day10 = result.find(r => r.day === 10);
    const day9 = result.find(r => r.day === 9);
    expect(day10.balanceSats).toBe(1000); // today's balance unchanged
    expect(day9.balanceSats).toBe(800);   // before the incoming tx
  });

  it('adds back outgoing tx from earlier days to reconstruct past balance', () => {
    // Spent 300 sats on day 5; balance before day 5 should be 1300
    const txs = [makeTx(5, 300, 'OUTGOING')];
    const result = buildDailyBalances(txs, 1000, REF);
    const day4 = result.find(r => r.day === 4);
    expect(day4.balanceSats).toBe(1300);
  });

  it('handles multiple txs on the same day', () => {
    const txs = [
      makeTx(8, 500, 'INCOMING'),
      makeTx(8, 100, 'OUTGOING'),
    ];
    // Net on day 8: +400. Before day 8 balance = 1000 - 400 = 600
    const result = buildDailyBalances(txs, 1000, REF);
    const day7 = result.find(r => r.day === 7);
    expect(day7.balanceSats).toBe(600);
  });

  it('skips rows with unparseable details without throwing', () => {
    const txs = [{ details: 'not-json' }, makeTx(3, 50, 'INCOMING')];
    expect(() => buildDailyBalances(txs, 500, REF)).not.toThrow();
  });

  it('returns a single entry on the first of the month', () => {
    const firstOfMonth = new Date(2026, 2, 1, 10);
    const result = buildDailyBalances([], 999, firstOfMonth);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ day: 1, balanceSats: 999 });
  });

  it('ignores transactions from a different month', () => {
    // February transaction passed in by mistake — should be ignored
    const txs = [makeTx(28, 500, 'INCOMING', 2, 2026)]; // Feb 28, not March
    const result = buildDailyBalances(txs, 1000, REF); // REF is March 15
    // All balances should still be 1000 (the feb tx is ignored)
    result.forEach(({ balanceSats }) => expect(balanceSats).toBe(1000));
  });
});
