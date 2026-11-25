const mockOpenDatabaseAsync = jest.fn();
const mockHandleEventEmitterPost = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: mockHandleEventEmitterPost,
}));

jest.mock('../../../app/functions/spark/spendAndReplaceCorrelation', () => ({
  labelSpendAndReplaceIncoming: jest.fn(async () => undefined),
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

const NOW = 1_700_000_000_000;
const ACCOUNT = 'identity-pubkey';
const RATE = {
  coin: 'USD',
  value: 50000,
  fetchedAt: NOW - 60 * 1000,
  status: 'ready',
};

const row = (sparkID, details) => ({
  sparkID,
  details: JSON.stringify(details),
});

describe('backfillSnapshotFiatValues', () => {
  it('snapshots rows missing a fiat value inside the window', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      row('tx-1', { amount: 100000, time: NOW - 60 * 1000 }),
    ]);
    const { backfillSnapshotFiatValues } = loadTransactionsModule(mockDb);

    const updated = await backfillSnapshotFiatValues({
      accountId: ACCOUNT,
      rate: RATE,
      now: NOW,
    });

    expect(updated).toBe(1);
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.runAsync.mock.calls[0];
    expect(sql).toContain('UPDATE SPARK_TRANSACTIONS');
    expect(params[1]).toBe('tx-1');
    expect(params[2]).toBe(ACCOUNT);
    expect(JSON.parse(params[0])).toEqual({
      amount: 100000,
      time: NOW - 60 * 1000,
      fiatValue: {
        currency: 'USD',
        rate: 50000,
        source: 'snapshot',
        at: NOW,
      },
    });
    expect(mockHandleEventEmitterPost).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the rate is stale', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      row('tx-1', { amount: 100000, time: NOW - 60 * 1000 }),
    ]);
    const { backfillSnapshotFiatValues } = loadTransactionsModule(mockDb);

    const updated = await backfillSnapshotFiatValues({
      accountId: ACCOUNT,
      rate: { ...RATE, fetchedAt: NOW - 2 * 60 * 60 * 1000 },
      now: NOW,
    });

    expect(updated).toBe(0);
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(mockHandleEventEmitterPost).not.toHaveBeenCalled();
  });

  it('leaves rows that already have a fiat value, tokens and unparseable rows alone', async () => {
    const mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([
      row('tx-has-fiat', {
        amount: 100000,
        time: NOW - 60 * 1000,
        fiatValue: { currency: 'USD', rate: 1, source: 'entered', at: NOW },
      }),
      row('tx-token', {
        amount: 100000,
        time: NOW - 60 * 1000,
        isLRC20Payment: true,
      }),
      { sparkID: 'tx-broken', details: 'not json' },
      row('tx-ok', { amount: 5000, time: NOW - 60 * 1000 }),
    ]);
    const { backfillSnapshotFiatValues } = loadTransactionsModule(mockDb);

    const updated = await backfillSnapshotFiatValues({
      accountId: ACCOUNT,
      rate: RATE,
      now: NOW,
    });

    expect(updated).toBe(1);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.runAsync.mock.calls[0][1][1]).toBe('tx-ok');
  });

  it('does nothing without an account id', async () => {
    const mockDb = createMockDb();
    const { backfillSnapshotFiatValues } = loadTransactionsModule(mockDb);

    const updated = await backfillSnapshotFiatValues({
      accountId: '',
      rate: RATE,
      now: NOW,
    });

    expect(updated).toBe(0);
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });
});
