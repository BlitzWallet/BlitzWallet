// Migration cutoff (audit M-2): a receive that settled after the last row the
// 0.7.16 app wrote, but before the first Breez connect, must reach history.
// Everything the old app already saw (older than its newest row), matched by
// invoice / payment hash / txid, or outgoing, must stay skipped.

const mockStorage = {};
let mockRows = [];

jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(async k => mockStorage[k] ?? null),
  setLocalStorageItem: jest.fn(async (k, v) => {
    mockStorage[k] = v;
  }),
}));

jest.mock('../../../app/functions/spark/handleFlashnetTransferIds', () => ({
  isFlashnetTransfer: () => false,
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(async () => true),
  deleteSparkContactTransaction: jest.fn(),
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getAllPendingSparkPayments: jest.fn(async () => ({ response: [] })),
  getAllSparkContactInvoices: jest.fn(async () => []),
  getAllSparkTransactions: jest.fn(async ({ limit } = {}) =>
    limit ? mockRows.slice(0, limit) : mockRows,
  ),
  getAllUnpaidSparkLightningInvoices: jest.fn(async () => []),
  getBulkPaymentGroupTransferIds: jest.fn(async () => new Set()),
  getBulkSparkTransactions: jest.fn(async ids => {
    const map = new Map();
    for (const r of mockRows) if (ids.includes(r.sparkID)) map.set(r.sparkID, r);
    return map;
  }),
  SPARK_TX_UPDATE_ENVENT_NAME: 'x',
  sparkTransactionsEventEmitter: { emit: jest.fn() },
  updateSparkTransactionDetails: jest.fn(),
}));

const {
  projectBreezPayments,
  clearMigrationMarkerCache,
} = require('../../../app/functions/spark/paymentIngest');
const {
  bulkUpdateSparkTransactions,
} = require('../../../app/functions/spark/transactions');

const ACCOUNT = '02abc';
const NOW = 1_800_000_000_000;
const HOUR = 3600 * 1000;
const NEWEST_LEGACY = NOW - 48 * HOUR;

const row = (sparkID, details) => ({
  sparkID,
  accountId: ACCOUNT,
  paymentStatus: 'completed',
  paymentType: details.paymentType || 'spark',
  details: JSON.stringify({ direction: 'INCOMING', ...details }),
});

const payment = (id, { at, type = 'receive', details } = {}) => ({
  id,
  paymentType: type,
  status: 'completed',
  amount: 1000n,
  fees: 0n,
  timestamp: Math.floor(at / 1000),
  method: details?.type === 'lightning' ? 'lightning' : 'spark',
  details: details || { type: 'spark' },
});

const writtenIds = () =>
  bulkUpdateSparkTransactions.mock.calls.flatMap(([records]) =>
    records.map(r => r.id),
  );

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  clearMigrationMarkerCache();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockRows = [
    row('legacy-newest', { time: NEWEST_LEGACY, address: 'lnbc-old' }),
    row('legacy-older', { time: NEWEST_LEGACY - 10 * HOUR }),
  ];
});

afterEach(() => jest.restoreAllMocks());

test('receive after the newest legacy row with no match is imported (the gap)', async () => {
  await projectBreezPayments([payment('missed-rx', { at: NOW - 24 * HOUR })], {
    accountId: ACCOUNT,
  });
  expect(writtenIds()).toEqual(['missed-rx']);
});

test('receive older than the newest legacy row stays skipped', async () => {
  await projectBreezPayments(
    [payment('old-rx', { at: NEWEST_LEGACY - 5 * HOUR })],
    { accountId: ACCOUNT },
  );
  expect(writtenIds()).toEqual([]);
});

test('newer receive matching a legacy row by invoice is skipped (no duplicate)', async () => {
  await projectBreezPayments(
    [
      payment('breez-id-for-old-ln', {
        at: NEWEST_LEGACY + 60 * 1000,
        details: { type: 'lightning', invoice: 'lnbc-old' },
      }),
    ],
    { accountId: ACCOUNT },
  );
  expect(writtenIds()).toEqual([]);
});

test('newer receive matching a legacy row by payment hash or txid is skipped', async () => {
  mockRows.unshift(
    row('legacy-hash', { time: NEWEST_LEGACY, paymentHash: 'h1' }),
    row('legacy-dep', { time: NEWEST_LEGACY, onChainTxid: 'tx1' }),
  );
  await projectBreezPayments(
    [
      payment('p-hash', {
        at: NOW - HOUR * 20,
        details: { type: 'lightning', htlcDetails: { paymentHash: 'h1' } },
      }),
      payment('p-dep', {
        at: NOW - HOUR * 20,
        details: { type: 'deposit', txId: 'tx1', vout: 0 },
      }),
    ],
    { accountId: ACCOUNT },
  );
  expect(writtenIds()).toEqual([]);
});

test('pre-cutoff sends stay skipped even when newer than the newest row', async () => {
  await projectBreezPayments(
    [payment('fee-leg', { at: NOW - 24 * HOUR, type: 'send' })],
    { accountId: ACCOUNT },
  );
  expect(writtenIds()).toEqual([]);
});

test('a marker written by an earlier build (no newestRowAt) keeps the old cutoff', async () => {
  mockStorage[`breezMigrationV1:${ACCOUNT}`] = JSON.stringify({
    startedAt: NOW - 5 * 60 * 1000,
    hadRows: true,
    fullPassDone: false,
  });
  await projectBreezPayments([payment('missed-rx', { at: NOW - 24 * HOUR })], {
    accountId: ACCOUNT,
  });
  expect(writtenIds()).toEqual([]);
});

test('fresh install (no rows) imports everything', async () => {
  mockRows = [];
  await projectBreezPayments(
    [
      payment('a', { at: NOW - 400 * HOUR }),
      payment('b', { at: NOW - 400 * HOUR, type: 'send' }),
    ],
    { accountId: ACCOUNT },
  );
  expect(writtenIds().sort()).toEqual(['a', 'b']);
});

test('post-cutoff payments are imported as before', async () => {
  await projectBreezPayments([payment('new', { at: NOW + 1000 })], {
    accountId: ACCOUNT,
  });
  expect(writtenIds()).toEqual(['new']);
});
