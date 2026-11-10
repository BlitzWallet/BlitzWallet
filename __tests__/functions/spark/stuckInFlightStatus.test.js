// The 72h SENDER_INITIATED stuck-detector exists for wedged OUTGOING sends
// (server dropped the swap / app killed after dispatch). It must never flip
// INCOMING rows: SENDER_INITIATED is also the initial state of an inbound
// transfer waiting to be claimed, so a receiver offline >72h would otherwise
// see received money marked 'failed' — and the poller only revisits pending
// rows, so a lost claim event would leave it that way permanently.

const mockGetAllPendingSparkPayments = jest.fn();
const mockBulkUpdateSparkTransactions = jest.fn();

jest.mock('../../../app/functions/spark', () => ({
  querySparkHodlLightningPayments: jest.fn(),
}));

// Breez has not resolved any of the pending rows (no payment found, empty
// sweep), so only the 16-day wedged-send rule can change a row.
jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  acquire: jest.fn(async () => ({
    getPayment: jest.fn().mockResolvedValue(undefined),
    listPayments: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../../app/functions/spark/paymentIngest', () => ({
  ...jest.requireActual('../../../app/functions/spark/paymentIngest'),
  projectBreezPayments: jest.fn().mockResolvedValue({ records: [] }),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: (...a) => mockBulkUpdateSparkTransactions(...a),
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getAllPendingSparkPayments: (...a) => mockGetAllPendingSparkPayments(...a),
  getAllUnpaidSparkLightningInvoices: jest.fn().mockResolvedValue([]),
  getAllUnpaidHoldInvoicesFromTxs: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../db/handleBackend', () => ({
  __esModule: true,
  default: jest.fn(),
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
  });

  test('INCOMING row older than 72h stays pending (claim can still arrive)', async () => {
    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingSparkTx('INCOMING', PAST_STUCK_WINDOW_MS)],
    });

    const res = await updateSparkTxStatus('mnemonic', 'acct-1');

    expect(res.updated.map(r => r.paymentStatus)).not.toContain('failed');
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
    expect(res.updated.map(r => r.paymentStatus)).not.toContain('failed');
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

    // Integration: an unresolved outgoing lightning row past 16 days is written failed
    mockGetAllPendingSparkPayments.mockResolvedValue({
      didWork: true,
      response: [pendingLightningTx('OUTGOING', PAST_STUCK_WINDOW_MS)],
    });
    const res = await updateSparkTxStatus('mnemonic', 'acct-1');
    expect(res.updated.map(r => r.paymentStatus)).toEqual(['failed']);
    expect(mockBulkUpdateSparkTransactions).toHaveBeenCalled();
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
    expect(res.updated.map(r => r.paymentStatus)).not.toContain('failed');
  });
});
