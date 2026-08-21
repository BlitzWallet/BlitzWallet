jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

// NOTE: getBitcoinPaymentsByTxid filters by paymentType and onChainTxid in SQL,
// so these tests mock getAllAsync and assert both the pushed-down query and the
// JS-side Map building over the rows SQLite returns.
describe('getBitcoinPaymentsByTxid', () => {
  let getBitcoinPaymentsByTxid;
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
      getBitcoinPaymentsByTxid,
    } = require('../../../app/functions/spark/transactions'));
  });

  it('queries only bitcoin payments that have an onChainTxid', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await getBitcoinPaymentsByTxid('acc-1');
    const [query, params] = mockDb.getAllAsync.mock.calls[0];
    expect(query).toContain("paymentType = 'bitcoin'");
    expect(query).toContain("json_extract(details, '$.onChainTxid')");
    expect(query).toContain('accountId = ?');
    expect(params).toEqual(['acc-1']);
  });

  it('returns empty Map when there are no bitcoin payments', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await getBitcoinPaymentsByTxid('acc-1');
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('keys payments by their details.onChainTxid', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { sparkID: 'spark-1', details: JSON.stringify({ onChainTxid: 'txid-a' }) },
      { sparkID: 'spark-2', details: JSON.stringify({ onChainTxid: 'txid-b' }) },
    ]);

    const result = await getBitcoinPaymentsByTxid('acc-1');
    expect(result.get('txid-a')).toEqual({
      sparkID: 'spark-1',
      details: JSON.stringify({ onChainTxid: 'txid-a' }),
    });
    expect(result.get('txid-b').sparkID).toBe('spark-2');
    expect(result.size).toBe(2);
  });

  it('skips rows with unparseable details', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { sparkID: 'bad', details: 'NOT JSON' },
      { sparkID: 'good', details: JSON.stringify({ onChainTxid: 'txid-a' }) },
    ]);

    const result = await getBitcoinPaymentsByTxid('acc-1');
    expect(result.size).toBe(1);
    expect(result.has('txid-a')).toBe(true);
  });
});
