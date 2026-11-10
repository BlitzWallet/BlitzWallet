/* eslint-env jest */
// E1 (sparkContext v3 ledger): fullRestoreSparkState dropped any call made
// while a restore was running. A balance commit that lands during the
// startup/foreground restore (e.g. a spend from another device) lost its pass,
// so that transfer's row stayed missing until an unrelated later trigger.
// A call made while one runs must lead to exactly one more pass once it ends.
// HEAD was worse than "dropped": the dropped call's early return ran the
// finally block, clearing the flag, so the NEXT request ran a second restore
// in parallel with the first.

const mockListPayments = jest.fn();

jest.mock('../../../app/functions/spark', () => ({
  querySparkHodlLightningPayments: jest.fn(),
}));

jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  acquire: jest.fn(async () => ({
    sync: jest.fn().mockResolvedValue(undefined),
    listPayments: (...a) => mockListPayments(...a),
  })),
}));

jest.mock('../../../app/functions/spark/paymentIngest', () => ({
  isStuckPendingLightning: jest.fn(),
  getMigrationMarker: jest.fn().mockResolvedValue({ fullPassDone: false }),
  markFullPassDone: jest.fn(),
  projectBreezPayments: jest.fn().mockResolvedValue({ written: 0, records: [] }),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getAllPendingSparkPayments: jest.fn().mockResolvedValue({ response: [] }),
  getAllUnpaidSparkLightningInvoices: jest.fn().mockResolvedValue([]),
  getAllUnpaidHoldInvoicesFromTxs: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../db/handleBackend', () => jest.fn());
jest.mock('i18next', () => ({ t: k => k }));

const {
  fullRestoreSparkState,
} = require('../../../app/functions/spark/restore');

const ARGS = {
  sparkAddress: 'sp1',
  mnemonic: 'm',
  identityPubKey: 'acc-1',
  isSendingPayment: false,
};

const deferred = () => {
  let resolve;
  const promise = new Promise(res => (resolve = res));
  return { promise, resolve };
};
const flush = () => new Promise(res => setImmediate(res));

beforeEach(() => {
  mockListPayments.mockReset();
});

test('a restore requested while one runs gets one more pass afterwards', async () => {
  const first = deferred();
  mockListPayments
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue([]);

  const running = fullRestoreSparkState(ARGS);
  await flush();
  expect(mockListPayments).toHaveBeenCalledTimes(1);

  // Two more requests while the first pass is still fetching.
  await expect(fullRestoreSparkState(ARGS)).resolves.toBeUndefined();
  await expect(fullRestoreSparkState(ARGS)).resolves.toBeUndefined();
  await flush();
  // Never a second restore in parallel with the running one.
  expect(mockListPayments).toHaveBeenCalledTimes(1);

  first.resolve([]);
  await running;
  for (let i = 0; i < 10; i++) await flush();

  // Exactly one coalesced rerun, not one per request.
  expect(mockListPayments).toHaveBeenCalledTimes(2);
});

test('no request while running → no extra pass', async () => {
  mockListPayments.mockResolvedValue([]);
  await fullRestoreSparkState(ARGS);
  for (let i = 0; i < 10; i++) await flush();
  expect(mockListPayments).toHaveBeenCalledTimes(1);
});
