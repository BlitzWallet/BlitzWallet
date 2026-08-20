const mockSend = jest.fn();
const mockGetIsNativeRuntime = jest.fn();
const mockInitialize = jest.fn();

// spark/index.js pulls in the native SDK/storage bundles; stub them so this
// stays a plain unit test of the quote request plumbing.
jest.mock('@buildonspark/spark-sdk', () => ({
  SparkWallet: { initialize: (...args) => mockInitialize(...args) },
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
jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: {
    getL1AddressQuote: 'getSparkStaticBitcoinL1AddressQuote',
  },
  sendWebViewRequestGlobal: (...args) => mockSend(...args),
  getHandshakeComplete: jest.fn(),
  getIsNativeRuntime: (...args) => mockGetIsNativeRuntime(...args),
  setForceReactNative: jest.fn(),
}));

const {
  getSparkStaticBitcoinL1AddressQuote,
} = require('../../../app/functions/spark');

const MNEMONIC = 'seed words here';
const TXID = 'onchain-txid-1';

describe('getSparkStaticBitcoinL1AddressQuote', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockGetIsNativeRuntime.mockReset();
    mockInitialize.mockReset();
  });

  test('webview runtime: forwards the UTXO outputIndex in the request args', async () => {
    mockGetIsNativeRuntime.mockReturnValue(false);
    mockSend.mockResolvedValue({
      didWork: true,
      quote: { transactionId: TXID, outputIndex: 2 },
    });

    const result = await getSparkStaticBitcoinL1AddressQuote(TXID, 2, MNEMONIC);

    expect(mockSend).toHaveBeenCalledWith(
      'getSparkStaticBitcoinL1AddressQuote',
      {
        mnemonic: MNEMONIC,
        txid: TXID,
        outputIndex: 2,
      },
    );
    expect(result.didWork).toBe(true);
  });

  test('native runtime: passes outputIndex to the SDK quote call', async () => {
    mockGetIsNativeRuntime.mockReturnValue(true);
    const mockWallet = {
      getClaimStaticDepositQuote: jest.fn().mockResolvedValue({
        transactionId: TXID,
        outputIndex: 3,
      }),
    };
    mockInitialize.mockResolvedValue({ wallet: mockWallet });

    const result = await getSparkStaticBitcoinL1AddressQuote(TXID, 3, MNEMONIC);

    expect(mockWallet.getClaimStaticDepositQuote).toHaveBeenCalledWith(TXID, 3);
    expect(result).toEqual({
      didWork: true,
      quote: { transactionId: TXID, outputIndex: 3 },
    });
  });

  test('webview error response is surfaced as didWork false', async () => {
    mockGetIsNativeRuntime.mockReturnValue(false);
    mockSend.mockResolvedValue({ didWork: false, error: 'quote failed' });

    const result = await getSparkStaticBitcoinL1AddressQuote(TXID, 0, MNEMONIC);

    expect(result).toEqual({ didWork: false, error: 'quote failed' });
  });
});
