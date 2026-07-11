// Regression tests for the restore "blank balance + empty history" bug.
//
// Root cause: getSparkTransactions swallowed every error into { transfers: [] },
// which was indistinguishable from a genuinely empty wallet. An empty FIRST
// batch called markRestoreComplete(), persisting isFullyRestored:true so the
// restore poller never re-scanned. A single transient fetch failure therefore
// left BOTH balance and history permanently empty for the session.
//
// The fix: getSparkTransactions now returns a `success` flag. restore only marks
// the account complete on a SUCCESSFUL empty batch, and additionally refuses to
// mark complete when it found zero transactions but the wallet reports a
// positive balance (you cannot hold a balance with no transactions).

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
  getAllPendingSparkPayments: jest.fn().mockResolvedValue([]),
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

const { fullRestoreSparkState } = require('../../../app/functions/spark/restore');

const ACCOUNT_ID = 'acc-1';
const RESTORE_KEY = `spark_tx_restore_state_${ACCOUNT_ID}`;

// Did restore persist isFullyRestored:true for our account?
function markedComplete() {
  return mockSetLocalStorageItem.mock.calls.some(([key, value]) => {
    if (key !== RESTORE_KEY) return false;
    try {
      return JSON.parse(value).isFullyRestored === true;
    } catch {
      return false;
    }
  });
}

function runRestore() {
  return fullRestoreSparkState({
    sparkAddress: 'sparkAddr',
    isSendingPayment: false,
    mnemonic: 'seed words',
    identityPubKey: ACCOUNT_ID,
    sendWebViewRequest: jest.fn(),
    isInitialRestore: true,
  });
}

describe('fullRestoreSparkState — restore-complete gating', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT mark restore complete when the transaction fetch fails', async () => {
    mockGetSparkTransactions.mockResolvedValue({
      transfers: [],
      success: false,
    });

    await runRestore();

    expect(markedComplete()).toBe(false);
    // A failed fetch must not even reach the balance sanity check.
    expect(mockGetSparkBalance).not.toHaveBeenCalled();
  });

  it('DOES mark restore complete on a successful empty batch for a zero-balance wallet', async () => {
    mockGetSparkTransactions.mockResolvedValue({
      transfers: [],
      success: true,
    });
    mockGetSparkBalance.mockResolvedValue({ didWork: true, balance: 0n });

    await runRestore();

    expect(markedComplete()).toBe(true);
  });

  it('does NOT mark restore complete when zero txs are returned but the wallet has a balance', async () => {
    mockGetSparkTransactions.mockResolvedValue({
      transfers: [],
      success: true,
    });
    mockGetSparkBalance.mockResolvedValue({ didWork: true, balance: 5000n });

    await runRestore();

    expect(markedComplete()).toBe(false);
  });

  it('marks complete on an empty batch when the balance is unknown (didWork:false), staying conservative', async () => {
    mockGetSparkTransactions.mockResolvedValue({
      transfers: [],
      success: true,
    });
    mockGetSparkBalance.mockResolvedValue({ didWork: false });

    await runRestore();

    expect(markedComplete()).toBe(true);
  });
});
