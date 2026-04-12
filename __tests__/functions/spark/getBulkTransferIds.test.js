jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

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
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'spark-abc',
        details: JSON.stringify({ direction: 'OUTGOING', amount: 1000 }),
      },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(0);
  });

  it('collects sparkTransferIds from BTC bulk payment records', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'group-uuid-1',
        details: JSON.stringify({
          isBulkPayment: true,
          sparkTransferIds: ['transfer-id-a', 'transfer-id-b'],
        }),
      },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.has('transfer-id-a')).toBe(true);
    expect(result.has('transfer-id-b')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('ignores USD bulk records that have no sparkTransferIds', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'tx-hash-hex-123',
        details: JSON.stringify({
          isBulkPayment: true,
          isLRC20Payment: true,
          // no sparkTransferIds field
        }),
      },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(0);
  });

  it('skips null and empty-string IDs inside sparkTransferIds', async () => {
    // Note: undefined serializes to null in JSON arrays, so only null and '' can appear
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'group-uuid-2',
        details: JSON.stringify({
          isBulkPayment: true,
          sparkTransferIds: ['valid-id', null, ''],
        }),
      },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(1);
    expect(result.has('valid-id')).toBe(true);
  });

  it('deduplicates IDs that appear in multiple group records', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'group-a',
        details: JSON.stringify({
          isBulkPayment: true,
          sparkTransferIds: ['shared-id', 'unique-a'],
        }),
      },
      {
        sparkID: 'group-b',
        details: JSON.stringify({
          isBulkPayment: true,
          sparkTransferIds: ['shared-id', 'unique-b'],
        }),
      },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.size).toBe(3);
    expect(result.has('shared-id')).toBe(true);
    expect(result.has('unique-a')).toBe(true);
    expect(result.has('unique-b')).toBe(true);
  });

  it('tolerates malformed JSON in details without throwing', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { sparkID: 'bad-row', details: 'NOT JSON' },
      {
        sparkID: 'good-row',
        details: JSON.stringify({
          isBulkPayment: true,
          sparkTransferIds: ['good-id'],
        }),
      },
    ]);

    const result = await getBulkPaymentGroupTransferIds('acc-1');
    expect(result.has('good-id')).toBe(true);
    expect(result.size).toBe(1);
  });
});
