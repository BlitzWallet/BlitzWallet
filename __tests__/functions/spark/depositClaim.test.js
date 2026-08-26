const mockGetQuote = jest.fn();
const mockClaim = jest.fn();
const mockGetSingleTxDetails = jest.fn();
const mockBulkUpdate = jest.fn();
const mockGetUtxos = jest.fn();
const mockGetIdentityUtxos = jest.fn();
const mockGetSparkTxById = jest.fn();
const mockGetBitcoinByOnChainTxid = jest.fn();
const mockGetChainAmount = jest.fn();

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
    getUtxosForIdentity: (...args) => mockGetIdentityUtxos(...args),
  };
});
// claimDepositUtxo derives hasAlreadySaved / savedTxDetails from this lookup,
// so the mock must be present and faithful: getSparkTransactionBySparkId
// returns a raw SQLite row (details is a JSON string) or null when missing.
jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: (...args) => mockBulkUpdate(...args),
  getSparkTransactionBySparkId: (...args) => mockGetSparkTxById(...args),
  getBitcoinTransactionByOnChainTxid: (...args) =>
    mockGetBitcoinByOnChainTxid(...args),
}));
jest.mock('../../../app/functions/spark/getTxidFromChain', () => ({
  __esModule: true,
  default: (...args) => mockGetChainAmount(...args),
}));

const {
  claimDepositUtxo,
  fetchAllDepositUtxos,
  fetchAllIdentityDepositUtxos,
} = require('../../../app/functions/spark/depositClaim');

const BASE = {
  txid: 'onchain-txid-1',
  vout: 1,
  address: 'bc1deposit',
  mnemonic: 'seed words here',
  identityPubKey: 'identity-pubkey',
  isConfirmed: true,
};

// Mirrors the SQLite row returned by getSparkTransactionBySparkId: `details`
// is stored as a JSON string keyed by the on-chain txid.
const SAVED_PENDING_ROW = {
  sparkID: 'onchain-txid-1',
  paymentStatus: 'pending',
  paymentType: 'bitcoin',
  accountId: 'identity-pubkey',
  details: JSON.stringify({
    fee: 0,
    amount: 1000,
    address: 'bc1deposit',
    direction: 'INCOMING',
    onChainTxid: 'onchain-txid-1',
  }),
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

// Default: a pending deposit row already exists for BASE.txid (the common
// case after the unconfirmed sweep has saved it). Tests exercising the
// "no saved row" path override with mockGetSparkTxById.mockResolvedValue(null).
const setupClaimMocks = () => {
  jest.useFakeTimers();
  mockGetQuote.mockReset();
  mockClaim.mockReset();
  mockGetSingleTxDetails.mockReset();
  mockBulkUpdate.mockReset();
  mockGetUtxos.mockReset();
  mockGetSparkTxById.mockReset();
  mockGetBitcoinByOnChainTxid.mockReset();
  mockGetChainAmount.mockReset();
  mockBulkUpdate.mockResolvedValue(true);
  mockGetSparkTxById.mockResolvedValue(SAVED_PENDING_ROW);
  mockGetBitcoinByOnChainTxid.mockResolvedValue(null);
  mockGetChainAmount.mockResolvedValue({ didWork: true, value: 1000 });
};

const teardownClaimMocks = () => {
  jest.useRealTimers();
};

describe('claimDepositUtxo — quote phase', () => {
  beforeEach(setupClaimMocks);
  afterEach(teardownClaimMocks);

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
    mockGetSparkTxById.mockResolvedValue(null);

    const result = await claimDepositUtxo({
      ...BASE,
      exploraTx: { amount: 1000, isConfirmed: true },
    });

    expect(result.didClaim).toBe(false);
    expect(result.pendingTx).toBeTruthy();
    expect(mockGetChainAmount).toHaveBeenCalledWith(
      'onchain-txid-1',
      'bc1deposit',
      1,
    );
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'onchain-txid-1',
          paymentStatus: 'pending',
          details: expect.objectContaining({
            amount: 1000,
            direction: 'INCOMING',
            onChainTxid: 'onchain-txid-1',
          }),
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

  test('mismatched quote with no saved row surfaces a pending row with the real chain amount', async () => {
    mockGetQuote.mockResolvedValue({
      didWork: true,
      quote: { ...QUOTE, outputIndex: 0, creditAmountSats: 99999 },
    });
    mockGetSparkTxById.mockResolvedValue(null);

    const result = await claimDepositUtxo({
      ...BASE,
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

describe('claimDepositUtxo — unconfirmed deposits', () => {
  beforeEach(setupClaimMocks);
  afterEach(teardownClaimMocks);

  test('unconfirmed UTXO with an existing saved row is a no-op', async () => {
    const result = await claimDepositUtxo({ ...BASE, isConfirmed: false });

    expect(result.didClaim).toBe(false);
    expect(result.error).toBe('Does not have enough on-chain confirmations');
    expect(mockGetQuote).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });

  test('unconfirmed UTXO with no saved row inserts a pending row and never quotes', async () => {
    // Regression guard: getSparkTransactionBySparkId returns null when the row
    // is missing, so hasAlreadySaved must be false and the pending insert must
    // run (a truthy "{...null}" here would silently disable every insert).
    mockGetSparkTxById.mockResolvedValue(null);

    const result = await claimDepositUtxo({ ...BASE, isConfirmed: false });

    expect(result.didClaim).toBe(false);
    expect(result.error).toMatch(/confirmations/);
    expect(mockGetQuote).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockGetChainAmount).toHaveBeenCalledWith(
      'onchain-txid-1',
      'bc1deposit',
      1,
    );
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'onchain-txid-1',
          paymentStatus: 'pending',
          paymentType: 'bitcoin',
          details: expect.objectContaining({
            amount: 1000,
            direction: 'INCOMING',
            onChainTxid: 'onchain-txid-1',
          }),
        }),
      ],
      'transactions',
    );
  });

  test('unconfirmed UTXO never fabricates a row when the chain amount lookup fails', async () => {
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetChainAmount.mockResolvedValue({ didWork: false });

    const result = await claimDepositUtxo({ ...BASE, isConfirmed: false });

    expect(result.didClaim).toBe(false);
    expect(mockBulkUpdate).not.toHaveBeenCalled();
    expect(mockGetQuote).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
  });
});

describe('claimDepositUtxo — claim phase', () => {
  beforeEach(setupClaimMocks);
  afterEach(teardownClaimMocks);

  test('claim failure: didClaim false, pending row inserted when missing', async () => {
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({ didWork: false, error: 'SSP rejected' });
    mockGetSparkTxById.mockResolvedValue(null);

    const result = await claimDepositUtxo(BASE);

    expect(result.didClaim).toBe(false);
    expect(result.error).toBe('SSP rejected');
    expect(result.pendingTx).toBeTruthy();
    // The quote carries the amount, so no chain lookup is needed.
    expect(mockGetChainAmount).not.toHaveBeenCalled();
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
    setupClaimMocks();
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({
      didWork: true,
      response: { transferId: 'transfer-1' },
    });
  });
  afterEach(teardownClaimMocks);

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

  test('completed transfer: writes completed with amount and fee from the saved row details', async () => {
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
    // The saved row supplied the amount, so no chain lookup is needed.
    expect(mockGetChainAmount).not.toHaveBeenCalled();
  });

  test('fee falls back to the on-chain lookup (keyed by the quote transactionId) when no row is saved', async () => {
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    // Regression guard: the lookup must use quote.transactionId — quote.txid
    // is undefined on StaticDepositQuoteOutput and would fetch .../tx/undefined.
    expect(mockGetChainAmount).toHaveBeenCalledWith(
      'onchain-txid-1',
      'bc1deposit',
      1,
    );
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

describe('fetchAllIdentityDepositUtxos — cursor pagination', () => {
  const MNEMONIC = 'seed words here';

  beforeEach(() => {
    mockGetIdentityUtxos.mockReset();
  });

  test('single page: returns utxos, stops when hasNextPage is false', async () => {
    mockGetIdentityUtxos.mockResolvedValue({
      didWork: true,
      utxos: [{ address: 'bc1a', txid: 'a', vout: 0, isConfirmed: true }],
      pageResponse: { hasNextPage: false, nextCursor: '' },
    });

    const result = await fetchAllIdentityDepositUtxos(MNEMONIC, true);

    expect(result).toEqual({
      didWork: true,
      utxos: [{ address: 'bc1a', txid: 'a', vout: 0, isConfirmed: true }],
    });
    expect(mockGetIdentityUtxos).toHaveBeenCalledTimes(1);
    expect(mockGetIdentityUtxos).toHaveBeenCalledWith({
      mnemonic: MNEMONIC,
      pageSize: 100,
      cursor: '',
      excludeClaimed: true,
      includePending: true,
    });
  });

  test('follows the cursor across pages and concatenates', async () => {
    mockGetIdentityUtxos
      .mockResolvedValueOnce({
        didWork: true,
        utxos: [{ address: 'bc1a', txid: 'a', vout: 0 }],
        pageResponse: { hasNextPage: true, nextCursor: 'CURSOR2' },
      })
      .mockResolvedValueOnce({
        didWork: true,
        utxos: [{ address: 'bc1b', txid: 'b', vout: 1 }],
        pageResponse: { hasNextPage: false, nextCursor: '' },
      });

    const result = await fetchAllIdentityDepositUtxos(MNEMONIC, false);

    expect(result.didWork).toBe(true);
    expect(result.utxos).toHaveLength(2);
    expect(mockGetIdentityUtxos).toHaveBeenCalledTimes(2);
    expect(mockGetIdentityUtxos).toHaveBeenLastCalledWith({
      mnemonic: MNEMONIC,
      pageSize: 100,
      cursor: 'CURSOR2',
      excludeClaimed: false,
      includePending: true,
    });
  });

  test('page failure: didWork false, keeps the partial set', async () => {
    mockGetIdentityUtxos
      .mockResolvedValueOnce({
        didWork: true,
        utxos: [{ address: 'bc1a', txid: 'a', vout: 0 }],
        pageResponse: { hasNextPage: true, nextCursor: 'CURSOR2' },
      })
      .mockResolvedValueOnce({ didWork: false, error: 'sdk down' });

    const result = await fetchAllIdentityDepositUtxos(MNEMONIC, true);

    expect(result.didWork).toBe(false);
    expect(result.error).toBe('sdk down');
    expect(result.utxos).toEqual([{ address: 'bc1a', txid: 'a', vout: 0 }]);
  });
});

describe('claimDepositUtxo — ghost-row guard (onChainTxid scope)', () => {
  beforeEach(setupClaimMocks);
  afterEach(teardownClaimMocks);

  const RENAMED_ROW = {
    sparkID: 'transfer-1',
    paymentStatus: 'pending',
    paymentType: 'bitcoin',
    accountId: 'identity-pubkey',
    details: JSON.stringify({
      amount: 1000,
      address: 'bc1deposit',
      direction: 'INCOMING',
      onChainTxid: 'onchain-txid-1',
    }),
  };

  test('re-swept UTXO within 60s window does not insert ghost pending row on quote failure', async () => {
    // First claim renamed txid → transferId; sparkID lookup now misses.
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetBitcoinByOnChainTxid.mockResolvedValue(RENAMED_ROW);
    mockGetQuote.mockResolvedValue({ didWork: false, error: 'boom' });

    const result = await claimDepositUtxo(BASE);

    expect(result.didClaim).toBe(false);
    expect(mockBulkUpdate).not.toHaveBeenCalled();
    expect(mockGetChainAmount).not.toHaveBeenCalled();
  });

  test('re-swept UTXO does not insert ghost pending row on claim failure', async () => {
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetBitcoinByOnChainTxid.mockResolvedValue(RENAMED_ROW);
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({ didWork: false, error: 'SSP rejected' });

    const result = await claimDepositUtxo(BASE);

    expect(result.didClaim).toBe(false);
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });

  test('re-swept unconfirmed UTXO with renamed row is a no-op (no ghost)', async () => {
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetBitcoinByOnChainTxid.mockResolvedValue(RENAMED_ROW);

    const result = await claimDepositUtxo({ ...BASE, isConfirmed: false });

    expect(result.didClaim).toBe(false);
    expect(result.error).toBe('Does not have enough on-chain confirmations');
    expect(mockBulkUpdate).not.toHaveBeenCalled();
    expect(mockGetChainAmount).not.toHaveBeenCalled();
  });

  test('fee uses onChainTxid-renamed row when sparkID lookup misses', async () => {
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetBitcoinByOnChainTxid.mockResolvedValue(RENAMED_ROW);
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({
      didWork: true,
      response: { transferId: 'transfer-1' },
    });
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer);

    const promise = claimDepositUtxo(BASE);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    // Must use the renamed row's amount (1000) for fee, not fall back to chain lookup.
    expect(mockGetChainAmount).not.toHaveBeenCalled();
    expect(result.updatedTx.details.fee).toBe(20);
  });
});

describe('claimDepositUtxo — multi-output same-txid (F4)', () => {
  beforeEach(setupClaimMocks);
  afterEach(teardownClaimMocks);

  test('second vout of the same txid claims independently and scopes the onChainTxid lookup by vout', async () => {
    // The other output (vout 0) was already claimed and renamed, so neither the
    // sparkID lookup nor the vout-scoped onChainTxid lookup matches THIS vout (1).
    mockGetSparkTxById.mockResolvedValue(null);
    mockGetBitcoinByOnChainTxid.mockResolvedValue(null);
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({
      didWork: true,
      response: { transferId: 'transfer-1' },
    });
    mockGetSingleTxDetails.mockResolvedValue(completeTransfer); // net 980

    const promise = claimDepositUtxo(BASE); // vout: 1
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    // The onChainTxid lookup must be vout-scoped so a sibling vout can't collide.
    expect(mockGetBitcoinByOnChainTxid).toHaveBeenCalledWith(
      'onchain-txid-1',
      'identity-pubkey',
      1,
    );
    // Fee must come from THIS vout's on-chain gross (1000), not a sibling row.
    expect(mockGetChainAmount).toHaveBeenCalledWith(
      'onchain-txid-1',
      'bc1deposit',
      1,
    );
    expect(result.didClaim).toBe(true);
    expect(result.updatedTx.details.fee).toBe(20);
    expect(result.updatedTx.details.vout).toBe(1);
  });

  test('a saved row for a DIFFERENT vout of the same txid is not treated as already-saved', async () => {
    // A pending row exists for vout 0 of this txid; the claim is for vout 1. The
    // vout guard must reject the sparkID match so the vout-1 pending row is
    // inserted (with the old txid-only check it would be suppressed).
    mockGetSparkTxById.mockResolvedValue({
      sparkID: 'onchain-txid-1',
      paymentStatus: 'pending',
      paymentType: 'bitcoin',
      accountId: 'identity-pubkey',
      details: JSON.stringify({
        amount: 5000,
        onChainTxid: 'onchain-txid-1',
        vout: 0,
      }),
    });
    mockGetBitcoinByOnChainTxid.mockResolvedValue(null);
    mockGetQuote.mockResolvedValue({ didWork: true, quote: QUOTE });
    mockClaim.mockResolvedValue({ didWork: false, error: 'SSP rejected' });

    const result = await claimDepositUtxo(BASE); // vout: 1

    expect(result.didClaim).toBe(false);
    expect(mockBulkUpdate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'onchain-txid-1',
          paymentStatus: 'pending',
          details: expect.objectContaining({ vout: 1 }),
        }),
      ],
      'transactions',
    );
  });
});
