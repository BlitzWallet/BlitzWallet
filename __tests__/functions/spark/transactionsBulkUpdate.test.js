const mockOpenDatabaseAsync = jest.fn();
const mockHandleEventEmitterPost = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: mockHandleEventEmitterPost,
}));

const createMockDb = () => ({
  execAsync: jest.fn(async () => undefined),
  getAllAsync: jest.fn(async () => []),
  runAsync: jest.fn(async () => ({ changes: 1 })),
});

const loadTransactionsModule = mockDb => {
  jest.resetModules();
  mockOpenDatabaseAsync.mockReset();
  mockHandleEventEmitterPost.mockClear();
  mockOpenDatabaseAsync.mockResolvedValue(mockDb);
  return require('../../../app/functions/spark/transactions');
};

const findUpdateCall = mockDb =>
  mockDb.runAsync.mock.calls.find(([sql]) =>
    sql.includes('UPDATE SPARK_TRANSACTIONS'),
  );

describe('Spark transaction bulk update guards', () => {
  it('uses insert-only placeholder writes', async () => {
    const mockDb = createMockDb();
    mockDb.runAsync.mockResolvedValue({ changes: 0 });
    const { insertSparkTransactionPlaceholders } =
      loadTransactionsModule(mockDb);

    await insertSparkTransactionPlaceholders([
      {
        id: 'transfer-id',
        paymentStatus: 'pending',
        paymentType: 'unknown',
        accountId: 'identity-pubkey',
        details: {
          isPlaceholder: true,
          direction: 'INCOMING',
        },
      },
    ]);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.runAsync.mock.calls[0];

    expect(sql).toContain('INSERT INTO SPARK_TRANSACTIONS');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).not.toContain('UPDATE SPARK_TRANSACTIONS');
    expect(params.slice(0, 4)).toEqual([
      'transfer-id',
      'pending',
      'unknown',
      'identity-pubkey',
    ]);
    expect(mockHandleEventEmitterPost).not.toHaveBeenCalled();
  });

  it('does not let a late placeholder downgrade a completed payment', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'transfer-id',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: JSON.stringify({
          amount: 2500,
          direction: 'INCOMING',
        }),
      },
    ]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'transfer-id',
        paymentStatus: 'pending',
        paymentType: 'unknown',
        accountId: 'identity-pubkey',
        details: {
          isPlaceholder: true,
          direction: 'INCOMING',
        },
      },
    ]);

    const updateCall = findUpdateCall(mockDb);
    expect(updateCall).toBeDefined();

    const values = updateCall[1];
    expect(values[0]).toBe('completed');
    expect(values[1]).toBe('lightning');
    expect(values[2]).toBe('identity-pubkey');
    expect(JSON.parse(values[3])).toMatchObject({
      amount: 2500,
      direction: 'INCOMING',
    });
  });

  it('allows a final payment object to replace a placeholder', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'transfer-id',
        paymentStatus: 'pending',
        paymentType: 'unknown',
        accountId: 'identity-pubkey',
        details: JSON.stringify({
          isPlaceholder: true,
          direction: 'INCOMING',
        }),
      },
    ]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'transfer-id',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: {
          amount: 2500,
          direction: 'INCOMING',
          address: 'lnbc...',
        },
      },
    ]);

    const updateCall = findUpdateCall(mockDb);
    expect(updateCall).toBeDefined();

    const values = updateCall[1];
    expect(values[0]).toBe('completed');
    expect(values[1]).toBe('lightning');
    expect(values[2]).toBe('identity-pubkey');
    expect(JSON.parse(values[3])).toMatchObject({
      amount: 2500,
      direction: 'INCOMING',
      address: 'lnbc...',
    });
  });

  it('preserves a concrete type when an update omits paymentType', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'transfer-id',
        paymentStatus: 'pending',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: JSON.stringify({
          amount: 2500,
          direction: 'INCOMING',
        }),
      },
    ]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'transfer-id',
        paymentStatus: 'pending',
        accountId: 'identity-pubkey',
        details: {
          description: 'updated memo',
        },
      },
    ]);

    const updateCall = findUpdateCall(mockDb);
    expect(updateCall).toBeDefined();

    const values = updateCall[1];
    expect(values[1]).toBe('lightning');
    expect(JSON.parse(values[3])).toMatchObject({
      amount: 2500,
      description: 'updated memo',
    });
  });
});
