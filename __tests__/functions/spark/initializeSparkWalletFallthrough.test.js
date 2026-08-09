/* eslint-env jest */
// ---------------------------------------------------------------------------
// R-4 (2026-08-09 review) — initializeSparkWallet falls through to a NATIVE
// wallet on ANY webview error result, including a plain service timeout.
//
// Old bridge: a request timeout REJECTED the promise → attemptInitialization's
// catch ran the bounded retry loop (up to 8 webview retries, 15s apart) and
// NEVER created a native wallet on a webview timeout.
//
// New bridge: sendWebViewRequestInternal always RESOLVES with
// {didWork:false, error, kind}. The caller only checks response.isConnected /
// the authenticate-endpoint error string, so a timeout result FALLS THROUGH to
// the native branch: a native SDK wallet is created and
// setForceReactNative(true) latches the whole app to the native runtime for
// the session — after ONE slow (>90s) webview init. This is exactly the
// "orphan native wallet" the fallback machine was built to avoid
// (selectSparkRuntime docblock), and it bypasses the machine's pending→native
// escalation. Worse: the page-side wallet may actually have initialized (slow
// WASM), leaving two live wallets for the same mnemonic, both streaming
// events into the same emitters.
// ---------------------------------------------------------------------------

const mockSend = jest.fn();
const mockSdkInitialize = jest.fn();
const mockSetForceReactNative = jest.fn();
const mockGetIsNativeRuntime = jest.fn();

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
  OPERATION_TYPES: { initWallet: 'initializeSparkWallet' },
  sendWebViewRequestGlobal: (...args) => mockSend(...args),
  getHandshakeComplete: () => false,
  getIsNativeRuntime: () => mockGetIsNativeRuntime(),
  setForceReactNative: (...a) => mockSetForceReactNative(...a),
}));

const { initializeSparkWallet } = require('../../../app/functions/spark');

describe('initializeSparkWallet — webview runtime never falls through to native (R-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIsNativeRuntime.mockReturnValue(false); // bridge committed to webview
    mockSdkInitialize.mockResolvedValue({ id: 'native-wallet' });
  });

  test('a single webview init timeout does NOT create a native wallet', async () => {
    // The bridge's keep-alive/timeout machinery resolves — never rejects —
    // with a service-timeout result.
    mockSend.mockResolvedValue({
      didWork: false,
      error: 'Call unresponsive (timeout after 90000ms)',
      kind: 'timeout',
    });

    const result = await initializeSparkWallet('seed words here', true, {
      enableRetry: false,
    });

    // WebView is the selected runtime: a transient init failure must retry the
    // WebView, never spawn an orphan native wallet or latch force-native.
    expect(mockSdkInitialize).not.toHaveBeenCalled();
    expect(result).toEqual({
      isConnected: false,
      error: 'Call unresponsive (timeout after 90000ms)',
    });
    expect(mockSetForceReactNative).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('a background-deferred webview init (kind: unknown) does NOT fall through to native', async () => {
    mockSend.mockResolvedValue({
      didWork: false,
      error: 'Request interrupted by app state change',
      kind: 'unknown',
    });

    const result = await initializeSparkWallet('seed words here', true, {
      enableRetry: false,
    });

    expect(mockSdkInitialize).not.toHaveBeenCalled();
    expect(result).toEqual({
      isConnected: false,
      error: 'Request interrupted by app state change',
    });
    expect(mockSetForceReactNative).not.toHaveBeenCalled();
  });
});
