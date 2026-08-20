const mockGetQuote = jest.fn();
const mockClaim = jest.fn();
const mockGetSingleTxDetails = jest.fn();
const mockBulkUpdate = jest.fn();
const mockGetUtxos = jest.fn();

// Stub the native SDK/storage bundles so the real getSparkPaymentStatus
// mapping (imported via requireActual) can run under Jest.
jest.mock('@buildonspark/spark-sdk', () => ({ SparkWallet: {}, Network: {} }));
jest.mock('@buildonspark/spark-sdk/types', () => ({
  LightningSendRequestStatus: {
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    PREIMAGE_PROVIDED: 'PREIMAGE_PROVIDED',
    LIGHTNING_PAYMENT_SUCCEEDED: 'LIGHTNING_PAYMENT_SUCCEEDED',
    USER_SWAP_RETURNED: 'USER_SWAP_RETURNED',
    LIGHTNING_PAYMENT_FAILED: 'LIGHTNING_PAYMENT_FAILED',
    TRANSFER_FAILED: 'TRANSFER_FAILED',
    USER_TRANSFER_VALIDATION_FAILED: 'USER_TRANSFER_VALIDATION_FAILED',
    PREIMAGE_PROVIDING_FAILED: 'PREIMAGE_PROVIDING_FAILED',
    USER_SWAP_RETURN_FAILED: 'USER_SWAP_RETURN_FAILED',
  },
  SparkCoopExitRequestStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
  },
  LightningReceiveRequestStatus: {
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    LIGHTNING_PAYMENT_RECEIVED: 'LIGHTNING_PAYMENT_RECEIVED',
    TRANSFER_FAILED: 'TRANSFER_FAILED',
    PAYMENT_PREIMAGE_RECOVERING_FAILED: 'PAYMENT_PREIMAGE_RECOVERING_FAILED',
    REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED:
      'REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED',
    REFUND_SIGNING_FAILED: 'REFUND_SIGNING_FAILED',
    TRANSFER_CREATION_FAILED: 'TRANSFER_CREATION_FAILED',
  },
  SparkLeavesSwapRequestStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
  },
  SparkUserRequestStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELED: 'CANCELED',
  },
  ClaimStaticDepositStatus: {
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    SPEND_TX_BROADCAST: 'SPEND_TX_BROADCAST',
    TRANSFER_CREATION_FAILED: 'TRANSFER_CREATION_FAILED',
    REFUND_SIGNING_FAILED: 'REFUND_SIGNING_FAILED',
    UTXO_SWAPPING_FAILED: 'UTXO_SWAPPING_FAILED',
    REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED:
      'REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED',
  },
}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: {},
  sendWebViewRequestGlobal: jest.fn(),
  getHandshakeComplete: jest.fn(),
  getIsNativeRuntime: jest.fn(() => false),
  setForceReactNative: jest.fn(),
}));

jest.mock('../../../app/functions/spark', () => {
  const actual = jest.requireActual('../../../app/functions/spark');
  return {
    ...actual,
    getSparkStaticBitcoinL1AddressQuote: (...args) => mockGetQuote(...args),
    claimnSparkStaticDepositAddress: (...args) => mockClaim(...args),
    getSingleTxDetails: (...args) => mockGetSingleTxDetails(...args),
    getUtxosForDepositAddress: (...args) => mockGetUtxos(...args),
  };
});
jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: (...args) => mockBulkUpdate(...args),
}));

const {
  claimDepositUtxo,
  fetchAllDepositUtxos,
} = require('../../../app/functions/spark/depositClaim');

const BASE = {
  txid: 'onchain-txid-1',
  vout: 1,
  address: 'bc1deposit',
  mnemonic: 'seed words here',
  identityPubKey: 'identity-pubkey',
  exploraTx: { amount: 1000, isConfirmed: true },
  savedTxDetails: null,
  hasAlreadySaved: true,
};

const QUOTE = {
  transactionId: 'onchain-txid-1',
  outputIndex: 1,
  creditAmountSats: 1000,
  signature: 'ssp-sig',
};

const completeTransfer = {
  id: 'transfer-1',
  status: 'TRANSFER_STATUS_COMPLETED',
  totalValue: 980,
};

describe('claimDepositUtxo — quote phase', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetQuote.mockReset();
    mockClaim.mockReset();
    mockGetSingleTxDetails.mockReset();
    mockBulkUpdate.mockReset();
    mockGetUtxos.mockReset();
    mockBulkUpdate.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('quote failure: never claims, never persists, error surfaced', async () => {
    mockGetQuote.mockResolvedValue({
      didWork: false,
      error: 'electrs unreachable',
    });

    const result = await claimDepositUtxo(BASE);

    expect(result.didClaim).toBe(false);
    expect(result.error).toBe('electrs unreachable');
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });

  test('quote failure still surfaces a pending row when one does not exist', async () => {
    mockGetQuote.mockResolvedValue({ didWork: false, error: 'boom' });

    const result = await claimDepositUtxo({
      ...BASE,
      hasAlreadySaved: false,
    });

    expect(result.didClaim).toBe(false);
    expect(result.pendingTx).toBeTruthy();
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'onchain-txid-1',
          paymentStatus: 'pending',
          details: expect.objectContaining({ amount: 1000 }),
        }),
      ],
      'transactions',
    );
    expect(mockClaim).not.toHaveBeenCalled();
  });

  test('quote bound to a different output is fail-closed: never claims', async () => {
    mockGetQuote.mockResolvedValue({
      didWork: true,
      quote: { ...QUOTE, outputIndex: 0 },
    });

    const result = await claimDepositUtxo(BASE);

    expect(result.didClaim).toBe(false);
    expect(result.error).toMatch(/outputIndex/);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });

  test('mismatched quote with no saved row surfaces a pending row with the real explorer amount', async () => {
    mockGetQuote.mockResolvedValue({
      didWork: true,
      quote: { ...QUOTE, outputIndex: 0, creditAmountSats: 99999 },
    });

    const result = await claimDepositUtxo({
      ...BASE,
      hasAlreadySaved: false,
      exploraTx: { amount: 1000, isConfirmed: true },
    });

    expect(result.didClaim).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'onchain-txid-1',
          paymentStatus: 'pending',
          details: expect.objectContaining({ amount: 1000 }),
        }),
      ],
      'transactions',
    );
  });

  test('matching quote: claims with the quote fields, UTXO vout and deposit address', async () => {
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({
      didWork: true,
      response: { transferId: 'transfer-1' },
    });
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(mockClaim).toHaveBeenCalledWith({
      transactionId: 'onchain-txid-1',
      creditAmountSats: 1000,
      sspSignature: 'ssp-sig',
      outputIndex: 1,
      mnemonic: 'seed words here',
      depositAddress: 'bc1deposit',
    });
    expect(result.didClaim).toBe(true);
  });
});

describe('claimDepositUtxo — claim phase', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetQuote.mockReset();
    mockClaim.mockReset();
    mockGetSingleTxDetails.mockReset();
    mockBulkUpdate.mockReset();
    mockGetUtxos.mockReset();
    mockBulkUpdate.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('claim failure: didClaim false, pending row inserted when missing', async () => {
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({ didWork: false, error: 'SSP rejected' });

    const result = await claimDepositUtxo({ ...BASE, hasAlreadySaved: false });

    expect(result.didClaim).toBe(false);
    expect(result.error).toBe('SSP rejected');
    expect(result.pendingTx).toBeTruthy();
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'onchain-txid-1',
          paymentStatus: 'pending',
        }),
      ],
      'transactions',
    );
  });

  test('claim response without transferId is treated as failure: nothing persisted', async () => {
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({ didWork: true, response: {} });

    const result = await claimDepositUtxo(BASE);

    expect(result.didClaim).toBe(false);
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });

  test('repeated claim attempt after the UTXO is already claimed does not duplicate work', async () => {
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({
      didWork: false,
      error: 'UTXO is already claimed by the current user.',
    });

    const first = await claimDepositUtxo(BASE);
    const second = await claimDepositUtxo(BASE);

    expect(first.didClaim).toBe(false);
    expect(second.didClaim).toBe(false);
    expect(mockClaim).toHaveBeenCalledTimes(2);
    // No transfer was returned, so no finalization write was attempted.
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });
});

describe('claimDepositUtxo — settle + persist phase', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetQuote.mockReset();
    mockClaim.mockReset();
    mockGetSingleTxDetails.mockReset();
    mockBulkUpdate.mockReset();
    mockBulkUpdate.mockResolvedValue(true);
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({
      didWork: true,
      response: { transferId: 'transfer-1' },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('transfer not settled within the window: pending row keyed by transferId', async () => {
    mockGetSingleTxDetails.mockResolvedValue(undefined);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.didClaim).toBe(true);
    expect(result.persisted).toBe(true);
    expect(result.updatedTx).toEqual(
      expect.objectContaining({
        useTempId: true,
        id: 'transfer-1',
        tempId: 'onchain-txid-1',
        paymentStatus: 'pending',
      }),
    );
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'transfer-1', paymentStatus: 'pending' })],
      'fullUpdate-waitBalance',
    );
  });

  test('transfer still sender-initiated: stays pending, never fabricated completed', async () => {
    mockGetSingleTxDetails.mockResolvedValue({
      id: 'transfer-1',
      status: 'TRANSFER_STATUS_SENDER_INITIATED',
      totalValue: 980,
    });

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.updatedTx.paymentStatus).toBe('pending');
  });

  test('completed transfer: writes completed with amount and fee from explora', async () => {
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.updatedTx.paymentStatus).toBe('completed');
    expect(result.updatedTx.details).toEqual(
      expect.objectContaining({
        amount: 980,
        fee: 20,
        totalFee: 20,
        supportFee: 0,
      }),
    );
  });

  test('fee falls back to the saved pending row details when explora is missing', async () => {
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);

    const promise = claimDepositUtxo({
      ...BASE,
      exploraTx: null,
      savedTxDetails: { amount: 1000 },
    });
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.updatedTx.details.fee).toBe(20);
  });

  test('failed persist is retried once and recovers', async () => {
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);
    mockBulkUpdate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(mockBulkUpdate).toHaveBeenCalledTimes(2);
    expect(result.persisted).toBe(true);
  });

  test('persist failure after retry reports persisted false (event path stays enabled)', async () => {
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);
    mockBulkUpdate.mockResolvedValue(false);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(mockBulkUpdate).toHaveBeenCalledTimes(2);
    expect(result.didClaim).toBe(true);
    expect(result.persisted).toBe(false);
  });
});

describe('fetchAllDepositUtxos — pagination', () => {
  const ADDRESS = 'bc1deposit';
  const MNEMONIC = 'seed words here';

  beforeEach(() => {
    mockGetUtxos.mockReset();
  });

  test('single page: returns the utxos and stops early', async () => {
    mockGetUtxos.mockResolvedValue({
      didWork: true,
      utxos: [{ txid: 'a', vout: 0 }],
    });

    const result = await fetchAllDepositUtxos(ADDRESS, MNEMONIC, true);

    expect(result).toEqual({ didWork: true, utxos: [{ txid: 'a', vout: 0 }] });
    expect(mockGetUtxos).toHaveBeenCalledTimes(1);
    expect(mockGetUtxos).toHaveBeenCalledWith({
      depositAddress: ADDRESS,
      mnemonic: MNEMONIC,
      limit: 100,
      offset: 0,
      excludeClaimed: true,
    });
  });

  test('walks pages beyond 100 unclaimed utxos', async () => {
    const pageA = Array.from({ length: 100 }, (_, i) => ({
      txid: `tx-${i}`,
      vout: i,
    }));
    const pageB = [{ txid: 'tx-100', vout: 0 }];
    mockGetUtxos
      .mockResolvedValueOnce({ didWork: true, utxos: pageA })
      .mockResolvedValueOnce({ didWork: true, utxos: pageB });

    const result = await fetchAllDepositUtxos(ADDRESS, MNEMONIC, false);

    expect(result.didWork).toBe(true);
    expect(result.utxos).toHaveLength(101);
    expect(mockGetUtxos).toHaveBeenCalledTimes(2);
    expect(mockGetUtxos).toHaveBeenLastCalledWith({
      depositAddress: ADDRESS,
      mnemonic: MNEMONIC,
      limit: 100,
      offset: 100,
      excludeClaimed: false,
    });
  });

  test('page failure: didWork false, never claims from a partial set', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      txid: `tx-${i}`,
      vout: i,
    }));
    mockGetUtxos
      .mockResolvedValueOnce({ didWork: true, utxos: fullPage })
      .mockResolvedValueOnce({ didWork: false, error: 'sdk down' });

    const result = await fetchAllDepositUtxos(ADDRESS, MNEMONIC, true);

    expect(result.didWork).toBe(false);
    expect(result.error).toBe('sdk down');
    expect(result.utxos).toEqual(fullPage);
  });
});
