const mockFetchQuote = jest.fn();

// spark/index.js pulls in the Breez runtime and storage bundles; stub the
// runtime boundary so this stays a plain unit test of the quote plumbing.
jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  acquire: jest.fn(async () => ({
    fetchClaimDepositQuote: (...args) => mockFetchQuote(...args),
  })),
  release: jest.fn(),
  disposeIdentity: jest.fn(),
  identityFor: jest.fn(),
  peek: jest.fn(),
}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const {
  getSparkStaticBitcoinL1AddressQuote,
} = require('../../../app/functions/spark');

const MNEMONIC = 'seed words here';
const TXID = 'onchain-txid-1';

describe('getSparkStaticBitcoinL1AddressQuote', () => {
  beforeEach(() => {
    mockFetchQuote.mockReset();
  });

  test('passes the UTXO outputIndex to the runtime quote call', async () => {
    mockFetchQuote.mockResolvedValue({
      mature: { creditAmountSats: 900, feeSats: 100, isEstimate: false },
    });

    const result = await getSparkStaticBitcoinL1AddressQuote(TXID, 3, MNEMONIC);

    expect(mockFetchQuote).toHaveBeenCalledWith(TXID, 3);
    expect(result).toEqual({
      didWork: true,
      quote: {
        transactionId: TXID,
        outputIndex: 3,
        creditAmountSats: 900,
        signature: '',
        feeSats: 100,
        isEstimate: false,
      },
    });
  });

  test('quote failure is surfaced as didWork false', async () => {
    mockFetchQuote.mockRejectedValue(new Error('quote failed'));

    const result = await getSparkStaticBitcoinL1AddressQuote(TXID, 0, MNEMONIC);

    expect(result.didWork).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
