/* eslint-env jest */
// lazySpark — core lazy guarantee and single-flight / withReset
// Covers gaps: WebView healthy never loads SDK, single-flight across N callers,
// withReset retries after failure.

const mockSend = jest.fn();
let mockGetIsNativeRuntimeImpl = () => false;

jest.mock('@buildonspark/spark-sdk', () => ({
  SparkWallet: {
    initialize: jest.fn(async () => ({ wallet: { transfer: jest.fn(async () => ({ id: 'tx-1' })), getBalance: jest.fn(async () => ({ balance: 1000, tokenBalances: new Map() })) } })),
  },
  Network: { MAINNET: 'MAINNET' },
  isValidSparkAddress: jest.fn(() => true),
  getNetworkFromSparkAddress: jest.fn(() => 'MAINNET'),
  decodeSparkAddress: jest.fn(() => ({ identityPublicKey: 'abc' })),
}));
jest.mock('@buildonspark/spark-sdk/types', () => ({}));
jest.mock('@buildonspark/spark-sdk/proto/spark', () => ({ TreeNode: {} }));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const mockStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
};
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);

jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: {
    initWallet: 'initializeSparkWallet',
    getBalance: 'getSparkBalance',
    sendSparkPayment: 'sendSparkPayment',
    getTransactions: 'getSparkTransactions',
  },
  sendWebViewRequestGlobal: (...args) => mockSend(...args),
  getHandshakeComplete: jest.fn(() => false),
  getIsNativeRuntime: () => mockGetIsNativeRuntimeImpl(),
  setForceReactNative: jest.fn(),
}));

describe('lazySpark — lazy guarantee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIsNativeRuntimeImpl = () => false;
  });

  test('WebView healthy → drive a representative op → loader not invoked', async () => {
    const { __resetLazySparkForTest } = require('../../../app/functions/spark/lazySpark');
    __resetLazySparkForTest();

    let loadCount = 0;
    const lazyMod = require('../../../app/functions/spark/lazySpark');
    const originalLoad = lazyMod.loadSparkSdk;
    const spy = jest.spyOn(lazyMod, 'loadSparkSdk').mockImplementation(() => {
      loadCount += 1;
      return originalLoad();
    });

    mockGetIsNativeRuntimeImpl = () => false;
    mockSend.mockResolvedValue({ didWork: true, balance: '1000', tokensObject: {} });

    const spark = require('../../../app/functions/spark');
    spark.clearMnemonicCache();

    const res = await spark.getSparkBalance('test mnemonic words webview');
    expect(res.didWork).toBe(true);
    expect(loadCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  test('enterNative → op → loader invoked once across N concurrent callers (single-flight)', async () => {
    jest.resetModules();
    let initializeCalls = 0;
    const mockWallet = { transfer: jest.fn(async () => ({ id: 'tx-1' })) };
    jest.doMock('@buildonspark/spark-sdk', () => ({
      SparkWallet: {
        initialize: jest.fn(async () => {
          initializeCalls += 1;
          await new Promise(r => setTimeout(r, 20));
          return { wallet: mockWallet };
        }),
      },
      Network: { MAINNET: 'MAINNET' },
    }));
    jest.doMock('@buildonspark/spark-sdk/types', () => ({}));
    jest.doMock('@buildonspark/spark-sdk/proto/spark', () => ({ TreeNode: {} }));
    jest.doMock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
    jest.doMock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
    jest.doMock('@react-native-async-storage/async-storage', () => mockStorage);
    jest.doMock('../../../context-store/webViewContext', () => ({
      OPERATION_TYPES: { sendSparkPayment: 'sendSparkPayment' },
      sendWebViewRequestGlobal: (...a) => mockSend(...a),
      getHandshakeComplete: () => false,
      getIsNativeRuntime: () => true,
      setForceReactNative: jest.fn(),
    }));

    const lazy = require('../../../app/functions/spark/lazySpark');
    lazy.__resetLazySparkForTest();

    const promises = Array.from({ length: 5 }, () => lazy.loadSparkSdk());
    const results = await Promise.all(promises);
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    const second = await lazy.loadSparkSdk();
    expect(second).toBe(results[0]);

    const spark = require('../../../app/functions/spark');
    spark.clearMnemonicCache();
    const mnemonic = 'concurrent mnemonic words';
    const walletPromises = Array.from({ length: 5 }, () => spark.getWallet(mnemonic));
    const wallets = await Promise.all(walletPromises);
    expect(wallets[0]).toBe(wallets[1]);
    expect(initializeCalls).toBe(1);
  });

  test('Loader rejects once → withReset nulls the slot → next call retries and succeeds', async () => {
    const lazy = require('../../../app/functions/spark/lazySpark');
    lazy.__resetLazySparkForTest();

    // Simulate first load failure via raw rejected promise + withReset
    const failing = Promise.reject(new Error('transient load failure'));
    // Silence unhandled rejection warning for the raw promise
    failing.catch(() => {});
    const wrapped = lazy.__testWithResetForTest(failing, 'sdk');
    lazy.__setRawLazySparkForTest({ sdk: wrapped });
    await expect(wrapped).rejects.toThrow('transient load failure');
    // withReset should have nulled the slot
    expect(lazy.__getLazySparkStateForTest().sdkPromise).toBeNull();

    // Next call retries and succeeds — mock a successful require for second attempt
    jest.resetModules();
    jest.doMock('@buildonspark/spark-sdk', () => ({
      SparkWallet: { initialize: jest.fn(async () => ({ wallet: {} })) },
      Network: { MAINNET: 'MAINNET' },
    }));
    jest.doMock('@buildonspark/spark-sdk/types', () => ({}));
    jest.doMock('@buildonspark/spark-sdk/proto/spark', () => ({ TreeNode: {} }));
    jest.doMock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
    jest.doMock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
    jest.doMock('@react-native-async-storage/async-storage', () => mockStorage);
    jest.doMock('../../../context-store/webViewContext', () => ({
      OPERATION_TYPES: {},
      sendWebViewRequestGlobal: jest.fn(),
      getHandshakeComplete: () => false,
      getIsNativeRuntime: () => true,
      setForceReactNative: jest.fn(),
    }));
    const lazy2 = require('../../../app/functions/spark/lazySpark');
    lazy2.__resetLazySparkForTest();
    const mod = await lazy2.loadSparkSdk();
    expect(mod.SparkWallet).toBeDefined();

    // types slot independently — same withReset path
    const lazy3 = require('../../../app/functions/spark/lazySpark');
    lazy3.__resetLazySparkForTest();
    const failingTypes = Promise.reject(new Error('types fail'));
    failingTypes.catch(() => {});
    const wrappedTypes = lazy3.__testWithResetForTest(failingTypes, 'types');
    lazy3.__setRawLazySparkForTest({ types: wrappedTypes });
    await expect(wrappedTypes).rejects.toThrow('types fail');
    expect(lazy3.__getLazySparkStateForTest().typesPromise).toBeNull();
    // Next load succeeds
    const typesMod = await lazy3.loadSparkTypes();
    expect(typesMod).toBeDefined();
  });

  test(
    'the promise actually cached by a loader is cleared after its source rejects',
    async () => {
      const lazy = require('../../../app/functions/spark/lazySpark');
      lazy.__resetLazySparkForTest();

      // This mirrors loadSparkSdk(): withReset receives `source`, while the
      // module slot stores the chained promise returned by withReset.
      const source = Promise.reject(new Error('transient load failure'));
      source.catch(() => {});
      const cached = lazy.__testWithResetForTest(source, 'sdk');
      lazy.__setRawLazySparkForTest({ sdk: cached });

      await expect(cached).rejects.toThrow('transient load failure');
      expect(lazy.__getLazySparkStateForTest().sdkPromise).toBeNull();
    },
  );
});
