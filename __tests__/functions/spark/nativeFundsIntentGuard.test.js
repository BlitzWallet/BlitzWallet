/* eslint-env jest */
// ---------------------------------------------------------------------------
// Guard contract (2026-08) — native runtime never blocks a user send.
//
// The double-pay guard exists ONLY to prevent the system from automatically
// re-dispatching an unresolved payment. A user-initiated identical send is a
// NEW payment and must always dispatch — on the WebView AND on the native
// runtime — because the restore/balance handlers surface whether an earlier
// attempt actually sent. The old native gate (hasUnknownFundsIntent) has been
// REMOVED from every wrapper.
//
// These tests run the REAL wrappers with the bridge mocked at the module
// boundary. The mock deliberately does NOT export `hasUnknownFundsIntent`: if
// any wrapper still imported it, the binding would be undefined and the call
// would throw — the positive assertions below (wallet/client invoked, guard
// message absent) would fail.
// ---------------------------------------------------------------------------

const mockSend = jest.fn();
const mockSdkInitialize = jest.fn();

const mockClient = {
  simulateSwap: jest.fn(),
  executeSwap: jest.fn(),
  clawback: jest.fn(),
  clawbackMultiple: jest.fn(),
};

jest.mock('@buildonspark/spark-sdk', () => ({
  SparkWallet: { initialize: (...a) => mockSdkInitialize(...a) },
  Network: { MAINNET: 'MAINNET' },
}));
jest.mock('@buildonspark/spark-sdk/types', () => ({}));
jest.mock('@flashnet/sdk', () => ({
  FlashnetClient: jest.fn(() => mockClient),
}));
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
}));

const MNEMONIC = 'seed words here';
const sha256Hash = require('../../../app/functions/hash').default;
const { BTC_ASSET_ADDRESS } = require('../../../app/functions/spark/swapAmountUtils');

let spark;
let flashnet;
let wallet;

beforeEach(() => {
  jest.clearAllMocks();
  wallet = {
    transfer: jest.fn(async () => ({ id: 'native-tx' })),
    transferTokens: jest.fn(async () => 'native-token-tx'),
    withdraw: jest.fn(async () => ({ id: 'native-exit' })),
    fulfillSparkInvoice: jest.fn(async () => ({ satsTransactionSuccess: [] })),
    batchTransferTokens: jest.fn(async () => 'native-batch-tx'),
    claimStaticDeposit: jest.fn(async () => ({ transferId: 'native-claim' })),
  };
  mockSdkInitialize.mockResolvedValue({ wallet }); // SDK returns { wallet }
  mockClient.simulateSwap.mockResolvedValue({ amountOut: 1000 });
  mockClient.executeSwap.mockResolvedValue({
    amountOut: '990',
    executionPrice: '1.1',
    feeAmount: '5',
    flashnetRequestId: 'fr-1',
    outboundTransferId: 'ot-1',
    poolId: 'pool1',
  });
  mockClient.clawback.mockResolvedValue({
    accepted: true,
    internalRequestId: 'ir-1',
  });
  mockClient.clawbackMultiple.mockResolvedValue([{ transferId: 't-1' }]);
  spark = require('../../../app/functions/spark');
  flashnet = require('../../../app/functions/spark/flashnet');
  spark.clearMnemonicCache();
  // Register the flashnet client for this mnemonic (getFlashnetClient keys on
  // sha256(mnemonic)); the old test expected the guard to block BEFORE the
  // client was touched — per the contract the native path must now run.
  spark.flashnetClients[sha256Hash(MNEMONIC)] = mockClient;
});

describe('native runtime never blocks a user send (guard contract)', () => {
  test('sendSparkPayment: executes on native even when a WebView attempt is unresolved', async () => {
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
    // The guard result (kind:'unknown' + 'check before retrying') must never
    // appear anywhere in the native path.
    expect(JSON.stringify(res)).not.toContain('check before retrying');
  });

  test('sendSparkTokens: executes on native while a WebView attempt is unresolved', async () => {
    const res = await spark.sendSparkTokens({
      tokenIdentifier: 'tokA',
      tokenAmount: 5,
      receiverSparkAddress: 'sp1def',
      mnemonic: MNEMONIC,
    });

    expect(wallet.transferTokens).toHaveBeenCalledWith({
      tokenIdentifier: 'tokA',
      tokenAmount: BigInt(5),
      receiverSparkAddress: 'sp1def',
    });
    expect(res).toEqual({ didWork: true, response: 'native-token-tx' });
  });

  test('sendSparkBitcoinPayment: executes on native while a WebView attempt is unresolved', async () => {
    const res = await spark.sendSparkBitcoinPayment({
      onchainAddress: 'bc1xyz',
      exitSpeed: 'FAST',
      amountSats: 5000,
      feeQuote: { id: 'q1' },
      mnemonic: MNEMONIC,
    });

    expect(wallet.withdraw).toHaveBeenCalledWith({
      onchainAddress: 'bc1xyz',
      amountSats: 5000,
      exitSpeed: 'FAST',
      feeQuoteId: 'q1',
      feeAmountSats: 0,
      deductFeeFromWithdrawalAmount: false,
    });
    expect(res).toEqual({ didWork: true, response: { id: 'native-exit' } });
  });

  test('claimnSparkStaticDepositAddress: executes on native while a WebView attempt is unresolved', async () => {
    const res = await spark.claimnSparkStaticDepositAddress({
      creditAmountSats: 1000,
      outputIndex: 0,
      sspSignature: 'sig',
      transactionId: 'txid-1',
      mnemonic: MNEMONIC,
      depositAddress: 'bc1abc',
    });

    expect(wallet.claimStaticDeposit).toHaveBeenCalledWith({
      creditAmountSats: 1000,
      sspSignature: 'sig',
      transactionId: 'txid-1',
      outputIndex: 0,
    });
    expect(res).toEqual({
      didWork: true,
      response: { transferId: 'native-claim' },
    });
  });

  test('fufillSparkInvoices: executes on native while a WebView attempt is unresolved', async () => {
    const invoices = [{ invoice: 'inv-1', amount: 500n }];
    const res = await spark.fufillSparkInvoices({
      mnemonic: MNEMONIC,
      invoices,
    });

    expect(wallet.fulfillSparkInvoice).toHaveBeenCalledWith(invoices);
    expect(res).toEqual({
      didWork: true,
      fulfillResult: { satsTransactionSuccess: [] },
    });
  });

  test('executeSwap (flashnet): touches the native client while a WebView attempt is unresolved', async () => {
    const res = await flashnet.executeSwap(MNEMONIC, {
      poolId: 'pool1',
      assetInAddress: 'btc',
      assetOutAddress: 'tokA',
      amountIn: 200,
    });

    expect(mockClient.simulateSwap).toHaveBeenCalledWith({
      poolId: 'pool1',
      assetInAddress: 'btc',
      assetOutAddress: 'tokA',
      amountIn: '200',
      integratorBps: 50,
    });
    expect(mockClient.executeSwap).toHaveBeenCalledWith({
      poolId: 'pool1',
      assetInAddress: 'btc',
      assetOutAddress: 'tokA',
      amountIn: '200',
      minAmountOut: '990', // 1000 with 100bps slippage
      maxSlippageBps: 100,
      integratorFeeRateBps: 50,
      integratorPublicKey: process.env.BLITZ_SPARK_PUBLICKEY,
    });
    expect(res.didWork).toBe(true);
    expect(res.swap.flashnetRequestId).toBe('fr-1');
  });

  test('swapBitcoinToToken: funnels to the native client while a WebView attempt is unresolved', async () => {
    const res = await flashnet.swapBitcoinToToken(MNEMONIC, {
      tokenAddress: 'tokA',
      amountSats: 100,
      poolId: 'pool1',
    });

    expect(mockClient.executeSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        poolId: 'pool1',
        assetInAddress: BTC_ASSET_ADDRESS,
        assetOutAddress: 'tokA',
        amountIn: '100',
      }),
    );
    expect(res.didWork).toBe(true);
  });

  test('swapTokenToBitcoin: funnels to the native client while a WebView attempt is unresolved', async () => {
    const res = await flashnet.swapTokenToBitcoin(MNEMONIC, {
      tokenAddress: 'tokA',
      tokenAmount: 100,
      poolId: 'pool1',
    });

    expect(mockClient.executeSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        poolId: 'pool1',
        assetInAddress: 'tokA',
        assetOutAddress: BTC_ASSET_ADDRESS,
        amountIn: '100',
      }),
    );
    expect(res.didWork).toBe(true);
  });

  test('requestManualClawback: executes on native while a WebView attempt is unresolved', async () => {
    const res = await flashnet.requestManualClawback(MNEMONIC, 't-1', 'pool1');

    expect(mockClient.clawback).toHaveBeenCalledWith({
      sparkTransferId: 't-1',
      lpIdentityPublicKey: 'pool1',
    });
    expect(res).toEqual({
      didWork: true,
      accepted: true,
      message: 'Clawback request accepted',
      internalRequestId: 'ir-1',
    });
  });

  test('requestBatchClawback: executes on native while a WebView attempt is unresolved', async () => {
    const res = await flashnet.requestBatchClawback(MNEMONIC, ['t-1'], 'pool1');

    expect(mockClient.clawbackMultiple).toHaveBeenCalledWith(
      ['t-1'],
      'pool1',
    );
    expect(res).toEqual({
      didWork: true,
      result: [{ transferId: 't-1' }],
    });
  });
});
