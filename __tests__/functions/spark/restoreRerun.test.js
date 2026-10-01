/* eslint-env jest */
// E1 (sparkContext v3 ledger): fullRestoreSparkState dropped any call made
// while a restore was running. A balance commit that lands during the
// startup/foreground restore (e.g. a spend from another device) lost its pass,
// so that transfer's row stayed missing until an unrelated later trigger.
// A call made while one runs must lead to exactly one more pass once it ends.
// HEAD was worse than "dropped": the dropped call's early return ran the
// finally block, clearing the flag, so the NEXT request ran a second restore
// in parallel with the first.

const mockGetSparkTransactions = jest.fn();
const mockGetSparkBalance = jest.fn();

jest.mock('../../../app/functions/spark', () => ({
  getSparkTransactions: (...a) => mockGetSparkTransactions(...a),
  getSparkBalance: (...a) => mockGetSparkBalance(...a),
  sparkPaymentType: jest.fn(),
  getSingleTxDetails: jest.fn(),
  getSparkBitcoinPaymentRequest: jest.fn(),
  getSparkLightningPaymentStatus: jest.fn(),
  getSparkLightningSendRequest: jest.fn(),
  getSparkPaymentStatus: jest.fn(),
  querySparkHodlLightningPayments: jest.fn(),
}));

jest.mock('@buildonspark/spark-sdk/types', () => ({
  LightningSendRequestStatus: {},
  SparkCoopExitRequestStatus: {},
}));

jest.mock('../../../app/constants', () => ({
  IS_BITCOIN_REQUEST_ID: /^btc/,
  IS_SPARK_ID: /^spark/,
  IS_SPARK_REQUEST_ID: /^sprt/,
}));

const mockSetLocalStorageItem = jest.fn();
jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn().mockResolvedValue(null),
  setLocalStorageItem: (...a) => mockSetLocalStorageItem(...a),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
  deleteSparkTransaction: jest.fn(),
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getAllPendingSparkPayments: jest.fn().mockResolvedValue({ response: [] }),
  getAllSparkTransactions: jest.fn().mockResolvedValue([]),
  getAllSparkContactInvoices: jest.fn().mockResolvedValue([]),
  getAllUnpaidSparkLightningInvoices: jest.fn().mockResolvedValue([]),
  getAllUnpaidHoldInvoicesFromTxs: jest.fn().mockResolvedValue([]),
  getBulkPaymentGroupTransferIds: jest.fn().mockResolvedValue(new Set()),
}));

jest.mock('../../../app/functions/spark/transformTxToPayment', () => ({
  transformTxToPaymentObject: jest.fn(),
}));

jest.mock('../../../app/functions/hash', () => jest.fn(() => 'hash'));
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
  mockGetSparkTransactions.mockReset();
});

test('a restore requested while one runs gets one more pass afterwards', async () => {
  const first = deferred();
  mockGetSparkTransactions
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue({ transfers: [], success: true });

  const running = fullRestoreSparkState(ARGS);
  await flush();
  expect(mockGetSparkTransactions).toHaveBeenCalledTimes(1);

  // Two more requests while the first pass is still fetching.
  await expect(fullRestoreSparkState(ARGS)).resolves.toBeUndefined();
  await expect(fullRestoreSparkState(ARGS)).resolves.toBeUndefined();
  await flush();
  // Never a second restore in parallel with the running one.
  expect(mockGetSparkTransactions).toHaveBeenCalledTimes(1);

  first.resolve({ transfers: [], success: true });
  await running;
  for (let i = 0; i < 10; i++) await flush();

  // Exactly one coalesced rerun, not one per request.
  expect(mockGetSparkTransactions).toHaveBeenCalledTimes(2);
});

test('no request while running → no extra pass', async () => {
  mockGetSparkTransactions.mockResolvedValue({ transfers: [], success: true });
  await fullRestoreSparkState(ARGS);
  for (let i = 0; i < 10; i++) await flush();
  expect(mockGetSparkTransactions).toHaveBeenCalledTimes(1);
});
