const mockOpenDatabaseAsync = jest.fn();
const mockHandleEventEmitterPost = jest.fn();
const mockLabelSpendAndReplaceIncoming = jest.fn(async () => undefined);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: mockHandleEventEmitterPost,
}));

// transactions.js now imports the SAR correlation module, which pulls in the
// Firebase-backed backend client; stub it so the bulk-update tests stay isolated.
jest.mock('../../../app/functions/spark/spendAndReplaceCorrelation', () => ({
  labelSpendAndReplaceIncoming: mockLabelSpendAndReplaceIncoming,
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
  mockLabelSpendAndReplaceIncoming.mockReset();
  mockLabelSpendAndReplaceIncoming.mockResolvedValue(undefined);
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

  it('skips the insert for an updateOnly write when no row exists', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([]); // settled payment already renamed the row away
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'rootstock-swap-id',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        updateOnly: true,
        details: { amount: 2500, direction: 'INCOMING' },
      },
    ]);

    const insertCall = mockDb.runAsync.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO SPARK_TRANSACTIONS'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('still updates an existing row for an updateOnly write', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'rootstock-swap-id',
        paymentStatus: 'pending',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: JSON.stringify({ amount: 2500, direction: 'INCOMING' }),
      },
    ]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'rootstock-swap-id',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        updateOnly: true,
        details: { amount: 2500, direction: 'INCOMING' },
      },
    ]);

    const updateCall = findUpdateCall(mockDb);
    expect(updateCall).toBeDefined();
    expect(updateCall[1][0]).toBe('completed');
  });

  it('inserts as normal when updateOnly is not set', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'transfer-id',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: { amount: 2500, direction: 'INCOMING' },
      },
    ]);

    const insertCall = mockDb.runAsync.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO SPARK_TRANSACTIONS'),
    );
    expect(insertCall).toBeDefined();
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

  it('only overwrites an existing fee when the incoming fee is larger', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'liquid-swap',
        paymentStatus: 'pending',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: JSON.stringify({
          amount: 49254,
          fee: 250,
          direction: 'INCOMING',
        }),
      },
    ]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);

    await bulkUpdateSparkTransactions([
      {
        id: 'liquid-swap',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: {
          amount: 49254,
          fee: 0,
          direction: 'INCOMING',
        },
      },
    ]);

    let updateCall = findUpdateCall(mockDb);
    expect(JSON.parse(updateCall[1][3]).fee).toBe(250);

    mockDb.runAsync.mockClear();
    await bulkUpdateSparkTransactions([
      {
        id: 'liquid-swap',
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: 'identity-pubkey',
        details: {
          fee: 300,
        },
      },
    ]);

    updateCall = findUpdateCall(mockDb);
    expect(JSON.parse(updateCall[1][3]).fee).toBe(300);
  });

  it('runs SAR correlation before BEGIN and preserves its description on update', async () => {
    const callOrder = [];
    const mockDb = createMockDb();
    mockDb.execAsync.mockImplementation(async sql => {
      if (sql === 'BEGIN TRANSACTION') callOrder.push('begin');
    });
    mockDb.getAllAsync.mockResolvedValue([
      {
        sparkID: 'incoming-sar',
        paymentStatus: 'pending',
        paymentType: 'spark',
        accountId: 'identity-pubkey',
        details: JSON.stringify({
          amount: 2500,
          direction: 'INCOMING',
          description: 'received',
        }),
      },
    ]);
    const { bulkUpdateSparkTransactions } = loadTransactionsModule(mockDb);
    mockLabelSpendAndReplaceIncoming.mockImplementation(async transactions => {
      callOrder.push('label');
      transactions[0].paymentStatus = 'completed';
      transactions[0].details.description = 'spend and replace incoming';
    });

    await bulkUpdateSparkTransactions([
      {
        id: 'incoming-sar',
        paymentStatus: 'pending',
        paymentType: 'spark',
        accountId: 'identity-pubkey',
        details: {
          amount: 2500,
          direction: 'INCOMING',
        },
      },
    ]);

    expect(callOrder).toEqual(['label', 'begin']);
    expect(mockLabelSpendAndReplaceIncoming).toHaveBeenCalledWith(
      expect.any(Array),
      mockDb,
    );

    const updateCall = findUpdateCall(mockDb);
    expect(updateCall).toBeDefined();
    const values = updateCall[1];
    expect(values[0]).toBe('completed');
    expect(JSON.parse(values[3])).toMatchObject({
      amount: 2500,
      direction: 'INCOMING',
      description: 'spend and replace incoming',
    });
  });
});

describe('hasPaidSparkLightningInvoice', () => {
  it('asks SQLite for a single matching lightning invoice instead of loading transactions', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([{ found: 1 }]);
    const { hasPaidSparkLightningInvoice } = loadTransactionsModule(mockDb);

    const result = await hasPaidSparkLightningInvoice('  lnbc123  ');

    expect(result).toBe(true);
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);

    const [sql, params] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).toContain('SELECT 1 as found');
    expect(sql).toContain("paymentType = 'lightning'");
    expect(sql).toContain("TRIM(json_extract(details, '$.address')) = ?");
    expect(sql).toContain('LIMIT 1');
    expect(sql).not.toContain('SELECT *');
    expect(params).toEqual(['lnbc123']);
  });

  it('returns false without opening the database for empty invoice addresses', async () => {
    const mockDb = createMockDb();
    const { hasPaidSparkLightningInvoice } = loadTransactionsModule(mockDb);

    await expect(hasPaidSparkLightningInvoice('   ')).resolves.toBe(false);

    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });
});

describe('getSparkTransactionBySparkId', () => {
  it('returns the raw row for a single sparkID/accountId lookup', async () => {
    const mockDb = createMockDb();
    const row = {
      sparkID: 'btc-txid',
      accountId: 'identity-pubkey',
      paymentStatus: 'pending',
      paymentType: 'bitcoin',
      details: JSON.stringify({ amount: 2500 }),
    };
    mockDb.getAllAsync.mockResolvedValue([row]);
    const { getSparkTransactionBySparkId } = loadTransactionsModule(mockDb);

    const result = await getSparkTransactionBySparkId(
      ' btc-txid ',
      'identity-pubkey',
    );

    expect(result).toBe(row);
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);

    const [sql, params] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).toContain('SELECT *');
    expect(sql).toContain('WHERE sparkID = ? AND accountId = ?');
    expect(sql).toContain('LIMIT 1');
    expect(params).toEqual(['btc-txid', 'identity-pubkey']);
  });

  it('returns null without opening the database for missing lookup input', async () => {
    const mockDb = createMockDb();
    const { getSparkTransactionBySparkId } = loadTransactionsModule(mockDb);

    await expect(
      getSparkTransactionBySparkId('', 'identity-pubkey'),
    ).resolves.toBe(null);
    await expect(getSparkTransactionBySparkId('btc-txid')).resolves.toBe(null);

    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });
});

describe('getLatestSavedLRC20TransactionId', () => {
  it('returns the latest saved token transaction id from SQLite', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([{ sparkID: 'token-tx-hash' }]);
    const { getLatestSavedLRC20TransactionId } =
      loadTransactionsModule(mockDb);

    const result = await getLatestSavedLRC20TransactionId('identity-pubkey');

    expect(result).toBe('token-tx-hash');
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);

    const [sql, params] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).toContain('SELECT sparkID');
    expect(sql).toContain('accountId = ?');
    expect(sql).toContain("paymentType = 'spark'");
    expect(sql).toContain('LENGTH(sparkID) >= 40');
    expect(sql).toContain("ORDER BY json_extract(details, '$.time') DESC");
    expect(sql).toContain('LIMIT 1');
    expect(params).toEqual(['identity-pubkey']);
  });

  it('returns null without opening the database for a missing account id', async () => {
    const mockDb = createMockDb();
    const { getLatestSavedLRC20TransactionId } =
      loadTransactionsModule(mockDb);

    await expect(getLatestSavedLRC20TransactionId()).resolves.toBe(null);

    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });
});
