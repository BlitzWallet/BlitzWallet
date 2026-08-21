// The 72h SENDER_INITIATED stuck-detector exists for wedged OUTGOING sends
// (server dropped the swap / app killed after dispatch). It must never flip
// INCOMING rows: SENDER_INITIATED is also the initial state of an inbound
// transfer waiting to be claimed, so a receiver offline >72h would otherwise
// see received money marked 'failed' — and the poller only revisits pending
// rows, so a lost claim event would leave it that way permanently.

const mockGetAllPendingSparkPayments = jest.fn();
const mockGetSingleTxDetails = jest.fn();
const mockGetSparkPaymentStatus = jest.fn();
const mockBulkUpdateSparkTransactions = jest.fn();

jest.mock('../../../app/functions/spark', () => ({
  getSingleTxDetails: (...a) => mockGetSingleTxDetails(...a),
  getSparkBitcoinPaymentRequest: jest.fn(),
  getSparkLightningPaymentStatus: jest.fn(),
  getSparkLightningSendRequest: jest.fn(),
  getSparkBalance: jest.fn(),
  getSparkPaymentStatus: (...a) => mockGetSparkPaymentStatus(...a),
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
  bulkUpdateSparkTransactions: (...a) => mockBulkUpdateSparkTransactions(...a),
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

const PAST_STUCK_WINDOW_MS = 73 * 60 * 60 * 1000; // 73h — beyond the 72h gate
const INSIDE_STUCK_WINDOW_MS = 60 * 60 * 1000; // 1h

function pendingSparkTx(direction, ageMs) {
  return {
    sparkID: 'spark-stuck-1',
    paymentType: 'spark',
    paymentStatus: 'pending',
    accountId: 'acct-1',
    details: JSON.stringify({
      direction,
      time: Date.now() - ageMs,
      amount: 1000,
    }),
  };
}

describe('stuckInFlightStatus direction gate (via updateSparkTxStatus)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Transfer is still in its initial in-flight state; the normal classifier
    // maps that to 'pending', so any 'failed' below came from the detector.
    mockGetSingleTxDetails.mockResolvedValue({
      id: 'spark-stuck-1',
      status: 'TRANSFER_STATUS_SENDER_INITIATED',
    });
    mockGetSparkPaymentStatus.mockReturnValue('pending');
  });

  test('INCOMING row older than 72h stays pending (claim can still arrive)', async () => {
    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingSparkTx('INCOMING', PAST_STUCK_WINDOW_MS)],
    });

    const res = await updateSparkTxStatus('mnemonic', 'acct-1');

    expect(res.updated[0].paymentStatus).toBe('pending');
  });

  test('OUTGOING row older than 72h flips to failed so it can be retried', async () => {
    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingSparkTx('OUTGOING', PAST_STUCK_WINDOW_MS)],
    });

    const res = await updateSparkTxStatus('mnemonic', 'acct-1');

    expect(res.updated[0].paymentStatus).toBe('failed');
  });

  test('OUTGOING row inside the 72h window stays pending', async () => {
    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingSparkTx('OUTGOING', INSIDE_STUCK_WINDOW_MS)],
    });

    const res = await updateSparkTxStatus('mnemonic', 'acct-1');

    expect(res.updated[0].paymentStatus).toBe('pending');
  });
});
