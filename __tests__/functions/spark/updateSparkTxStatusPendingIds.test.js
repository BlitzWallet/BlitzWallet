// updateSparkTxStatus must report which sparkIDs the DB currently lists as
// pending so the reconciler backstop (hasPendingTxDrift) can detect a stale
// in-memory "pending" row after a lost SPARK_TX_UPDATE event. Without this the
// zero-pending case — DB has no pending rows but memory still shows one — is
// invisible and the send stays stuck until an app restart.

const mockGetAllPendingSparkPayments = jest.fn();

jest.mock('../../../app/functions/spark', () => ({
  getSingleTxDetails: jest.fn(),
  getSparkBitcoinPaymentRequest: jest.fn(),
  getSparkLightningPaymentStatus: jest.fn(),
  getSparkLightningSendRequest: jest.fn(),
  getSparkBalance: jest.fn(),
  getSparkPaymentStatus: jest.fn(),
  getSparkTransactions: jest.fn().mockResolvedValue({ transfers: [] }),
  querySparkHodlLightningPayments: jest.fn(),
  sparkPaymentType: jest.fn(),
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

jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn().mockResolvedValue(null),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
  deleteSparkTransaction: jest.fn(),
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getAllPendingSparkPayments: (...a) => mockGetAllPendingSparkPayments(...a),
  getAllSparkTransactions: jest.fn().mockResolvedValue([]),
  getAllSparkContactInvoices: jest.fn().mockResolvedValue([]),
  getAllUnpaidSparkLightningInvoices: jest.fn().mockResolvedValue([]),
  getAllUnpaidHoldInvoicesFromTxs: jest.fn().mockResolvedValue([]),
  getBulkPaymentGroupTransferIds: jest.fn().mockResolvedValue(new Set()),
}));

jest.mock('../../../app/functions/spark/transformTxToPayment', () => ({
  transformTxToPaymentObject: jest.fn(),
}));

jest.mock('../../../app/functions/hash', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../db/handleBackend', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../app/functions/spark/timeoutHelpers', () => ({
  getBalanceWithTimeout: jest.fn(),
}));

const { updateSparkTxStatus } = require('../../../app/functions/spark/restore');

describe('updateSparkTxStatus pendingIds contract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns pendingIds: [] when the DB has no pending rows', async () => {
    mockGetAllPendingSparkPayments.mockResolvedValue([]);

    const res = await updateSparkTxStatus('mnemonic', 'accountId');

    expect(res.shouldCheck).toBe(true);
    expect(res.pendingIds).toEqual(undefined);
  });
});
