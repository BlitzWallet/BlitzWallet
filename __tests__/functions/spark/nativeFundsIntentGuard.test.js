/* eslint-env jest */
// ---------------------------------------------------------------------------
// F-3 (2026-08-09 final review) — cross-runtime double-pay guard.
//
// Real-life scenario: a funds op dispatched through the WebView loses its
// response and settles 'unknown' (it may have executed). The bridge then
// hard-fails to the NATIVE runtime. The intent guard lives in the WebView send
// path, so a retry on the native runtime would go straight to the SDK and
// double-execute. The native branch of every funds wrapper must first consult
// the bridge's intent store and refuse while the outcome is unknown.
//
// These tests run the REAL wrappers with the bridge mocked at the module
// boundary; `hasUnknownFundsIntent` is the seam the fix adds.
// ---------------------------------------------------------------------------

const mockSend = jest.fn();
const mockHasUnknown = jest.fn(() => false);
const mockSdkInitialize = jest.fn();

jest.mock('@buildonspark/spark-sdk', () => ({
  SparkWallet: { initialize: (...a) => mockSdkInitialize(...a) },
  Network: { MAINNET: 'MAINNET' },
}));
jest.mock('@buildonspark/spark-sdk/types', () => ({}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: {
    initWallet: 'initializeSparkWallet',
    sendSparkPayment: 'sendSparkPayment',
    sendTokenPayment: 'sendSparkTokens',
    sendBitcoinPayment: 'sendSparkBitcoinPayment',
    claimStaticDepositAddress: 'claimnSparkStaticDepositAddress',
    fufillSparkInvoices: 'fufillSparkInvoices',
    batchTransferTokens: 'batchTransferTokens',
    executeSwap: 'executeSwap',
    swapBitcoinToToken: 'swapBitcoinToToken',
    swapTokenToBitcoin: 'swapTokenToBitcoin',
    requestClawback: 'requestClawback',
    requestBatchClawback: 'requestBatchClawback',
  },
  sendWebViewRequestGlobal: (...args) => mockSend(...args),
  getHandshakeComplete: () => false,
  getIsNativeRuntime: () => true, // native runtime committed
  setForceReactNative: jest.fn(),
  hasUnknownFundsIntent: (...a) => mockHasUnknown(...a),
}));

const MNEMONIC = 'seed words here';

let spark;
let flashnet;
let wallet;

beforeEach(() => {
  jest.clearAllMocks();
  mockHasUnknown.mockReturnValue(false);
  wallet = {
    transfer: jest.fn(async () => ({ id: 'native-tx' })),
    transferTokens: jest.fn(async () => 'native-token-tx'),
    withdraw: jest.fn(async () => ({ id: 'native-exit' })),
    fulfillSparkInvoice: jest.fn(async () => ({ satsTransactionSuccess: [] })),
    batchTransferTokens: jest.fn(async () => 'native-batch-tx'),
    claimStaticDeposit: jest.fn(async () => ({ transferId: 'native-claim' })),
  };
  mockSdkInitialize.mockResolvedValue({ wallet }); // SDK returns { wallet }
  spark = require('../../../app/functions/spark');
  flashnet = require('../../../app/functions/spark/flashnet');
  spark.clearMnemonicCache();
});

describe('native runtime honors unknown WebView funds intents (F-3)', () => {
  test('sendSparkPayment: an unknown webview intent blocks the native retry', async () => {
    mockHasUnknown.mockReturnValue(true);

    const res = await spark.sendSparkPayment({
      receiverSparkAddress: 'sp1ABC',
      amountSats: 1000,
      mnemonic: MNEMONIC,
    });

    expect(res).toEqual({
      didWork: false,
      error: 'Request status unknown — check before retrying',
      kind: 'unknown',
    });
    expect(wallet.transfer).not.toHaveBeenCalled();
    // Keyed on the same canonical args the webview dispatch used.
    expect(mockHasUnknown).toHaveBeenCalledWith('sendSparkPayment', {
      mnemonic: MNEMONIC,
      receiverSparkAddress: 'sp1ABC',
      amountSats: 1000,
    });
  });

  test('sendSparkPayment: no unknown intent → native executes normally', async () => {
    const res = await spark.sendSparkPayment({
      receiverSparkAddress: 'sp1ABC',
      amountSats: 1000,
      mnemonic: MNEMONIC,
    });

    expect(wallet.transfer).toHaveBeenCalledWith({
      receiverSparkAddress: 'sp1abc',
      amountSats: 1000,
    });
    expect(res).toEqual({ didWork: true, response: { id: 'native-tx' } });
  });

  test('sendSparkTokens: blocked while unknown', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await spark.sendSparkTokens({
      tokenIdentifier: 'tokA',
      tokenAmount: 5,
      receiverSparkAddress: 'sp1def',
      mnemonic: MNEMONIC,
    });
    expect(res.kind).toBe('unknown');
    expect(wallet.transferTokens).not.toHaveBeenCalled();
  });

  test('sendSparkBitcoinPayment: blocked while unknown', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await spark.sendSparkBitcoinPayment({
      onchainAddress: 'bc1xyz',
      exitSpeed: 'FAST',
      amountSats: 5000,
      feeQuote: { id: 'q1' },
      mnemonic: MNEMONIC,
    });
    expect(res.kind).toBe('unknown');
    expect(wallet.withdraw).not.toHaveBeenCalled();
  });

  test('claimnSparkStaticDepositAddress: blocked while unknown', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await spark.claimnSparkStaticDepositAddress({
      creditAmountSats: 1000,
      outputIndex: 0,
      sspSignature: 'sig',
      transactionId: 'txid-1',
      mnemonic: MNEMONIC,
      depositAddress: 'bc1abc',
    });
    expect(res.kind).toBe('unknown');
    expect(wallet.claimStaticDeposit).not.toHaveBeenCalled();
  });

  test('fufillSparkInvoices: blocked while unknown, keyed on the serialized invoices', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await spark.fufillSparkInvoices({
      mnemonic: MNEMONIC,
      invoices: [{ invoice: 'inv-1', amount: 500n }],
    });
    expect(res.kind).toBe('unknown');
    expect(wallet.fulfillSparkInvoice).not.toHaveBeenCalled();
    expect(mockHasUnknown).toHaveBeenCalledWith(
      'fufillSparkInvoices',
      expect.objectContaining({
        mnemonic: MNEMONIC,
        invoices: [{ invoice: 'inv-1', amount: '500' }],
      }),
    );
  });

  test('executeSwap (flashnet): blocked before the native client is touched', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await flashnet.executeSwap(MNEMONIC, {
      poolId: 'pool1',
      assetInAddress: 'btc',
      assetOutAddress: 'tokA',
      amountIn: 200,
    });
    // Without the guard this path throws 'Flashnet client not initialized'.
    expect(res.kind).toBe('unknown');
    expect(mockHasUnknown).toHaveBeenCalledWith(
      'executeSwap',
      expect.objectContaining({ mnemonic: MNEMONIC, poolId: 'pool1' }),
    );
  });

  test('swapBitcoinToToken: blocked while unknown (its own op key, not executeSwap)', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await flashnet.swapBitcoinToToken(MNEMONIC, {
      tokenAddress: 'tokA',
      amountSats: 100,
    });
    expect(res.kind).toBe('unknown');
    expect(mockHasUnknown).toHaveBeenCalledWith(
      'swapBitcoinToToken',
      expect.objectContaining({
        mnemonic: MNEMONIC,
        tokenAddress: 'tokA',
        amountSats: 100,
      }),
    );
  });

  test('swapTokenToBitcoin: blocked while unknown (its own op key)', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await flashnet.swapTokenToBitcoin(MNEMONIC, {
      tokenAddress: 'tokA',
      tokenAmount: 100,
    });
    expect(res.kind).toBe('unknown');
    expect(mockHasUnknown).toHaveBeenCalledWith(
      'swapTokenToBitcoin',
      expect.objectContaining({
        mnemonic: MNEMONIC,
        tokenAddress: 'tokA',
        tokenAmount: 100,
      }),
    );
  });

  test('requestManualClawback: blocked while unknown', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await flashnet.requestManualClawback(MNEMONIC, 't-1', 'pool1');
    expect(res.kind).toBe('unknown');
  });

  test('requestBatchClawback: blocked while unknown', async () => {
    mockHasUnknown.mockReturnValue(true);
    const res = await flashnet.requestBatchClawback(MNEMONIC, ['t-1'], 'pool1');
    expect(res.kind).toBe('unknown');
  });
});
