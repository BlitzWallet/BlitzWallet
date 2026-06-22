jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

// NOTE: getBulkPaymentGroupTransferIds filters by isBulkPayment and pulls out the
// array via SQLite `json_extract(details, '$.sparkTransferIds') as sparkTransferIds`.
// These tests mock getAllAsync, so they exercise the JS-side row handling and must
// supply rows in the post-extraction shape SQLite returns: a `sparkTransferIds`
// column holding the JSON array string (or null when the field is absent).
describe('getBulkPaymentGroupTransferIds', () => {
  let getBulkPaymentGroupTransferIds;
  let mockDb;

  beforeEach(() => {
    jest.resetModules();
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    jest.mock('expo-sqlite', () => ({
      openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
    }));
    // Re-require after module reset so sqlLiteDB is re-initialized with the new mock
    ({
      getBulkPaymentGroupTransferIds,
    } = require('../../../app/functions/spark/transactions'));
  });

  it('returns empty Set when there are no transactions', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('returns empty Set when no transactions have isBulkPayment', async () => {
    // The SQL WHERE filters out non-bulk rows, so getAllAsync yields nothing.
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(0);
  });

  it('collects sparkTransferIds from BTC bulk payment records', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { sparkTransferIds: JSON.stringify(['transfer-id-a', 'transfer-id-b']) },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.has('transfer-id-a')).toBe(true);
    expect(result.has('transfer-id-b')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('ignores bulk records that have no sparkTransferIds', async () => {
    // json_extract of a missing field returns null for that column.
    mockDb.getAllAsync.mockResolvedValue([{ sparkTransferIds: null }]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(0);
  });

  it('skips null and empty-string IDs inside sparkTransferIds', async () => {
    // Note: undefined serializes to null in JSON arrays, so only null and '' can appear
    mockDb.getAllAsync.mockResolvedValue([
      { sparkTransferIds: JSON.stringify(['valid-id', null, '']) },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(1);
    expect(result.has('valid-id')).toBe(true);
  });

  it('deduplicates IDs that appear in multiple group records', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { sparkTransferIds: JSON.stringify(['shared-id', 'unique-a']) },
      { sparkTransferIds: JSON.stringify(['shared-id', 'unique-b']) },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(3);
    expect(result.has('shared-id')).toBe(true);
    expect(result.has('unique-a')).toBe(true);
    expect(result.has('unique-b')).toBe(true);
  });

  it('tolerates malformed JSON in sparkTransferIds without throwing', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { sparkTransferIds: 'NOT JSON' },
      { sparkTransferIds: JSON.stringify(['good-id']) },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.has('good-id')).toBe(true);
    expect(result.size).toBe(1);
  });
});
