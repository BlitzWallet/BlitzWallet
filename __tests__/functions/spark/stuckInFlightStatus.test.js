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

const {
  updateSparkTxStatus,
  stuckInFlightStatus,
} = require('../../../app/functions/spark/restore');

const PAST_STUCK_WINDOW_MS = 17 * 24 * 60 * 60 * 1000; // 17days — beyond the 16day gate
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

function pendingLightningTx(direction, ageMs) {
  return {
    sparkID: 'spark-lightning-1',
    paymentType: 'lightning',
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

  test('OUTGOING spark row older than 72h stays pending (receiver may claim late — no double-pay)', async () => {
    // Direct unit: spark must never be auto-failed by the 72h gate
    expect(
      stuckInFlightStatus(
        'TRANSFER_STATUS_SENDER_INITIATED',
        { time: Date.now() - PAST_STUCK_WINDOW_MS },
        'OUTGOING',
        'spark',
      ),
    ).toBe(null);

    // Integration: spark pending row stays pending even after the window
    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingSparkTx('OUTGOING', PAST_STUCK_WINDOW_MS)],
    });
    const res = await updateSparkTxStatus('mnemonic', 'acct-1');
    expect(res.updated[0].paymentStatus).toBe('pending');
  });

  test('OUTGOING lightning row older than 16 days flips to failed so it can be retried', async () => {
    expect(
      stuckInFlightStatus(
        'TRANSFER_STATUS_SENDER_INITIATED',
        { time: Date.now() - PAST_STUCK_WINDOW_MS },
        'OUTGOING',
        'lightning',
      ),
    ).toBe('failed');
  });

  test('OUTGOING row inside the 72h window stays pending', async () => {
    expect(
      stuckInFlightStatus(
        'TRANSFER_STATUS_SENDER_INITIATED',
        { time: Date.now() - INSIDE_STUCK_WINDOW_MS },
        'OUTGOING',
        'lightning',
      ),
    ).toBe(null);

    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingSparkTx('OUTGOING', INSIDE_STUCK_WINDOW_MS)],
    });
    const res = await updateSparkTxStatus('mnemonic', 'acct-1');
    // Spark stays pending regardless of window; lightning inside window also stays pending (no update)
    // For spark, the status remains pending so an update is still emitted (paymentStatus pending)
    expect(res.updated[0].paymentStatus).toBe('pending');
  });
});
