jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

import {
  buildFilterQuery,
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
    const before = Date.now();
    const { query, params } = buildFilterQuery(
      { directions: [], dateRange: '7d', types: [] },
      ACC,
    );
    const after = Date.now();
    expect(query).toContain("json_extract(details, '$.time') >= ?");
    // The cutoff param is a large ms timestamp (not a small offset duration)
    const cutoff = params.find(p => typeof p === 'number' && p > 1_000_000_000_000);
    expect(cutoff).toBeDefined();
    expect(cutoff).toBeGreaterThanOrEqual(before - 7 * 24 * 60 * 60 * 1000);
    expect(cutoff).toBeLessThanOrEqual(after - 7 * 24 * 60 * 60 * 1000 + 100);
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
    const before = Date.now();
    const { params } = buildFilterQuery(
      { directions: [], dateRange: '1y', types: [] },
      ACC,
    );
    const after = Date.now();
    const cutoff = params.find(p => typeof p === 'number' && p > 1_000_000_000_000);
    expect(cutoff).toBeDefined();
    expect(cutoff).toBeGreaterThanOrEqual(before - 365 * 24 * 60 * 60 * 1000);
    expect(cutoff).toBeLessThanOrEqual(after - 365 * 24 * 60 * 60 * 1000 + 100);
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
