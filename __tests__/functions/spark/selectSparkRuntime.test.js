const mockSend = jest.fn();
const mockSdkInitialize = jest.fn();

// spark/index.js pulls in the native SDK/storage bundles; stub them so this
// stays a plain unit test of the runtime-selection decision.
jest.mock('@buildonspark/spark-sdk', () => ({
  SparkWallet: { initialize: (...args) => mockSdkInitialize(...args) },
  Network: {},
}));
jest.mock('@buildonspark/spark-sdk/types', () => ({}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetHandshakeComplete = jest.fn();
const mockGetIsNativeRuntime = jest.fn();

jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: { addListeners: 'addWalletEventListener' },
  sendWebViewRequestGlobal: (...args) => mockSend(...args),
  getHandshakeComplete: (...args) => mockGetHandshakeComplete(...args),
  getIsNativeRuntime: (...args) => mockGetIsNativeRuntime(...args),
  setForceReactNative: jest.fn(),
}));

const {
  clearMnemonicCache,
  refundSparkStaticBitcoinL1AddressQuote,
  selectSparkRuntime,
} = require('../../../app/functions/spark');

describe('selectSparkRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMnemonicCache();
    mockGetHandshakeComplete.mockReset();
    mockGetIsNativeRuntime.mockReset();
    mockSdkInitialize.mockResolvedValue({
      wallet: { refundStaticDeposit: jest.fn(async () => ({ id: 'refund' })) },
    });
  });

  test('holds on the WebView during a reload (handshake incomplete, not committed to native)', async () => {
    // Auth-reset / reload window: the bridge has torn down the session key so
    // the handshake is transiently incomplete, but the fallback machine has NOT
    // committed to native — it is still WEBVIEW and the send path holds
    // requests. selectSparkRuntime must match: route to webview, create no
    // native wallet. (Regression: auth reset logged "Creating native wallet
    // because none exists".)
    mockGetHandshakeComplete.mockReturnValue(false);
    mockGetIsNativeRuntime.mockReturnValue(false);

    await expect(selectSparkRuntime('seed words here')).resolves.toBe('webview');
  });

  test('uses native only once the runtime has committed to native', async () => {
    mockGetHandshakeComplete.mockReturnValue(false);
    mockGetIsNativeRuntime.mockReturnValue(true);

    // createNativeWallet=false so the test never touches the native SDK.
    await expect(
      selectSparkRuntime('seed words here', false, undefined, false),
    ).resolves.toBe('native');
  });

  test('uses the WebView when the handshake is complete', async () => {
    mockGetHandshakeComplete.mockReturnValue(true);
    mockGetIsNativeRuntime.mockReturnValue(false);

    await expect(selectSparkRuntime('seed words here')).resolves.toBe('webview');
  });

  test.failing(
    'a WebView-selected refund path cannot initialize the native Spark SDK',
    async () => {
      mockGetHandshakeComplete.mockReturnValue(true);
      mockGetIsNativeRuntime.mockReturnValue(false);

      await refundSparkStaticBitcoinL1AddressQuote({
        depositTransactionId: 'txid',
        destinationAddress: 'bc1destination',
        fee: 100,
        mnemonic: 'seed words here',
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSdkInitialize).not.toHaveBeenCalled();
    },
  );
});
