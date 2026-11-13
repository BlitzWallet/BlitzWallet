// Regression tests for the restore "blank balance + empty history" bug.
//
// A failed history fetch must be distinguishable from a genuinely empty
// wallet: the full-pass marker is only persisted after a SUCCESSFUL
// listPayments pass that reaches the end of history, so a transient failure
// can never leave history permanently empty. (The old in-run retry loop and
// balance sanity check no longer exist: Breez history is a local store read.)

const mockListPayments = jest.fn();
const mockMarkFullPassDone = jest.fn();

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
  markFullPassDone: (...a) => mockMarkFullPassDone(...a),
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

const ACCOUNT_ID = 'acc-1';

function runRestore() {
  return fullRestoreSparkState({
    sparkAddress: 'sparkAddr',
    isSendingPayment: false,
    mnemonic: 'seed words',
    identityPubKey: ACCOUNT_ID,
    isInitialRestore: true,
  });
}

describe('fullRestoreSparkState — restore-complete gating', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT mark restore complete when the history fetch fails', async () => {
    mockListPayments.mockRejectedValue(new Error('fetch failed'));

    await runRestore();

    expect(mockMarkFullPassDone).not.toHaveBeenCalled();
  });

  it('marks complete on a successful empty batch', async () => {
    mockListPayments.mockResolvedValue([]);

    await runRestore();

    expect(mockMarkFullPassDone).toHaveBeenCalledWith(ACCOUNT_ID, {
      count: 0,
      newestTs: 0,
    });
  });
});
