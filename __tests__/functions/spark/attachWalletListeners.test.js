const mockSend = jest.fn();

// spark/index.js pulls in the native SDK/storage bundles; stub them so this
// stays a plain unit test of the retry loop.
jest.mock('@buildonspark/spark-sdk', () => ({ SparkWallet: {}, Network: {} }));
jest.mock('@buildonspark/spark-sdk/types', () => ({}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: { addListeners: 'addWalletEventListener' },
  sendWebViewRequestGlobal: (...args) => mockSend(...args),
  getHandshakeComplete: jest.fn(),
  setForceReactNative: jest.fn(),
}));

const { AppState } = require('react-native');
const { attachWalletListeners } = require('../../../app/functions/spark');

describe('attachWalletListeners', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSend.mockReset();
    AppState.currentState = 'active';
  });
  afterEach(() => jest.useRealTimers());

  // Retries sleep 3s/6s — drive them with fake timers.
  const settle = async promise => {
    const result = promise;
    await jest.advanceTimersByTimeAsync(20000);
    return result;
  };

  it('returns true on first success without retrying', async () => {
    mockSend.mockResolvedValue({ didWork: true });
    await expect(settle(attachWalletListeners('seed'))).resolves.toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on the third attempt', async () => {
    mockSend
      .mockResolvedValueOnce({ didWork: false, error: 'not initialized' })
      .mockResolvedValueOnce({ error: 'forced native' })
      .mockResolvedValueOnce({ didWork: true });
    await expect(settle(attachWalletListeners('seed'))).resolves.toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('returns false after all three attempts fail', async () => {
    mockSend.mockResolvedValue({ didWork: false });
    await expect(settle(attachWalletListeners('seed'))).resolves.toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('bails immediately when stale', async () => {
    mockSend.mockResolvedValue({ didWork: true });
    await expect(
      settle(attachWalletListeners('seed', () => true)),
    ).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('bails when the app is backgrounded', async () => {
    AppState.currentState = 'background';
    mockSend.mockResolvedValue({ didWork: true });
    await expect(settle(attachWalletListeners('seed'))).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
