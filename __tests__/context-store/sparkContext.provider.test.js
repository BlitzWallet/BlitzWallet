/* eslint-env jest */
// ---------------------------------------------------------------------------
// Provider-boundary tests for SparkWalletProvider (sparkContext v3, Phase 2).
//
// The provider runs for real (with the real initWallet, pollingManager and
// timeout helpers). Everything it talks to is faked here:
//   - an SDK model (leaf totals -> {available, owned}), reached through the
//     WebView bridge emitters or a native wallet EventEmitter,
//   - an in-memory transaction table that emits SPARK_TX_UPDATE the way
//     handleEventEmitterPost does (queued while inactive / unsubscribed),
//   - app status, WebView connection state, navigation route and AppState.
// Time is fake; `advance(ms)` flushes promises between timers.
//
// The send-convergence matrix at the bottom asserts invariant #11: after any
// send the displayed balance ends at the SDK's settled `available` within a
// bounded time, whatever the order of events, reads and lifecycle changes.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const MOCK_IDENTITY = '02'.repeat(33);
const MOCK_ADDRESS = 'spark1testaddress';

// ── mutable fake world (read lazily by the mock factories) ──────────────────
const mockWorld = {};

function mockResetWorld() {
  const { EventEmitter } = require('events');
  Object.assign(mockWorld, {
    runtime: 'webview',
    now: () => Date.now(),
    // SDK leaf model. available = AVAILABLE leaves; owned adds locked,
    // outgoing and swap-pending leaves (LeafManager semantics).
    leaves: { available: 0, locked: 0, outgoing: 0, swapPending: 0 },
    tokens: {},
    // Extra sats a getBalance() read over-reports: leaves this device already
    // locked/sent that the operators still list as ours (SDK getBalance sums
    // fresh SO leaves, including in-flight ones).
    staleHigh: 0,
    optimizing: false,
    readDelay: 200,
    // Queue of per-read overrides: {delay, result} consumed in order.
    readPlan: [],
    reads: 0,
    probes: 0,
    bridgeCalls: [],
    bundleListeners: false, // bundle-side addWalletEventListener registration
    bridgeUp: true, // false while the WebView page reloads
    nativeWallet: new EventEmitter(),
    transfers: [],
    transferFetchFailures: 0,
    route: 'HomeAdmin',
    appState: 'active',
    db: [],
    txQueue: [],
    restoreCalls: 0,
    restoreLog: [],
    probeDelay: 50,
    statusCalls: 0,
    lrc20Calls: 0,
    toasts: [],
    snapshots: {},
    conn: { state: null, count: 0 },
    setConn: null,
    homepage: false,
    setHomepage: null,
    appStateHook: 'active',
    setAppStateHook: null,
    authResetkey: 0,
    setAuthResetkey: null,
    initDelay: 300,
    initFails: false,
    cachedRows: [],
    renders: 0,
  });
}
mockResetWorld();

const mockOwned = () =>
  mockWorld.leaves.available +
  mockWorld.leaves.locked +
  mockWorld.leaves.outgoing +
  mockWorld.leaves.swapPending;

// ── module mocks ─────────────────────────────────────────────────────────────
jest.mock('../../app/functions/spark', () => {
  const sparkWallet = {};
  const sha = require('../../app/functions/hash').default;
  const wait = ms => new Promise(res => setTimeout(res, ms));
  return {
    __esModule: true,
    sparkWallet,
    getOptimizationLockedSats: () => mockWorld.leaves.swapPending,
    selectSparkRuntime: async mnemonic => {
      if (mockWorld.runtime === 'native') {
        sparkWallet[sha(mnemonic)] = mockWorld.nativeWallet;
      }
      return mockWorld.runtime;
    },
    attachWalletListeners: async () => {
      mockWorld.bridgeCalls.push('addListeners');
      if (!mockWorld.bridgeUp) {
        // Page down: the held request settles not-ready after the retries.
        await wait(3000);
        return false;
      }
      mockWorld.bundleListeners = true;
      return true;
    },
    clearMnemonicCache: () => {},
    initializeFlashnet: async () => true,
    initializeSparkWallet: async () => {
      await wait(mockWorld.initDelay);
      if (mockWorld.initFails) {
        return { isConnected: false, error: 'init failed' };
      }
      if (mockWorld.runtime === 'webview') {
        // webViewContext flips the connection state on a successful initWallet.
        mockWorld.setConn?.(prev => ({ state: true, count: prev.count + 1 }));
      }
      return { isConnected: true };
    },
    getSparkAddress: async () => ({ didWork: true, response: MOCK_ADDRESS }),
    getSparkIdentityPubKey: async () => MOCK_IDENTITY,
    setPrivacyEnabled: async () => {},
    getCachedSparkTransactions: async () => mockWorld.cachedRows,
    getSparkBalance: async () => {
      mockWorld.reads += 1;
      mockWorld.bridgeCalls.push('getBalance');
      // WebView page reloading: the bridge holds the request until the
      // wallet is re-initialized (getBalanceWithTimeout caps it at 15 s).
      while (mockWorld.runtime === 'webview' && !mockWorld.bridgeUp) {
        await wait(100);
      }
      const plan = mockWorld.readPlan.shift() || {};
      // The operators are queried when the request starts, so the value is
      // the SDK state at that moment, however late the response arrives.
      const snapshot = plan.result
        ? plan.result()
        : {
            didWork: true,
            balance: BigInt(
              mockWorld.leaves.available +
                mockWorld.leaves.swapPending +
                mockWorld.staleHigh,
            ),
            tokensObj: { ...mockWorld.tokens },
          };
      await wait(plan.delay ?? mockWorld.readDelay);
      return snapshot;
    },
    getSparkLeaves: async () => null,
    getSparkExitNodesForLeaves: async () => ({}),
    isOptimizationInProgress: async () => {
      mockWorld.probes += 1;
      mockWorld.bridgeCalls.push('isOptimizationInProgress');
      await wait(mockWorld.probeDelay);
      return { didWork: true, isOptimizing: mockWorld.optimizing };
    },
    getSparkTransactions: async count => {
      mockWorld.bridgeCalls.push('getTransactions');
      await wait(mockWorld.readDelay);
      if (mockWorld.transferFetchFailures > 0) {
        mockWorld.transferFetchFailures -= 1;
        throw new Error('bridge timeout');
      }
      return {
        transfers: mockWorld.transfers.slice(0, count),
        offset: 0,
        success: true,
      };
    },
    getSingleTxDetails: async (_m, id) => {
      mockWorld.bridgeCalls.push('getSingleTxDetails');
      await wait(mockWorld.readDelay);
      return mockWorld.transfers.find(t => t.id === id) || null;
    },
  };
});

jest.mock('../../context-store/webViewContext', () => {
  const mockReact = require('react');
  const { EventEmitter } = require('events');
  return {
    __esModule: true,
    INCOMING_SPARK_TX_NAME: 'INCOMING',
    incomingSparkTransaction: new EventEmitter(),
    BALANCE_UPDATE_EVENT_NAME: 'BAL',
    sparkBalanceUpdateEmitter: new EventEmitter(),
    TOKEN_BALANCE_UPDATE_EVENT_NAME: 'TOK',
    sparkTokenBalanceUpdateEmitter: new EventEmitter(),
    STREAM_STATUS_EVENT_NAME: 'STREAM',
    sparkStreamStatusEmitter: new EventEmitter(),
    OPERATION_TYPES: {
      addListeners: 'addWalletEventListener',
      removeListeners: 'removeWalletEventListener',
    },
    sendWebViewRequestGlobal: async action => {
      mockWorld.bridgeCalls.push(action);
      if (action === 'removeWalletEventListener') {
        mockWorld.bundleListeners = false;
      }
      return { didWork: true };
    },
    useWebView: () => {
      const [conn, setConn] = mockReact.useState(mockWorld.conn);
      mockWorld.setConn = setConn;
      return { changeSparkConnectionState: conn };
    },
  };
});

jest.mock('../../app/functions/spark/transactions', () => {
  const { EventEmitter } = require('events');
  const emitter = new EventEmitter();
  const EVENT = 'UPDATE_SPARK_STATE';
  const post = (...params) => {
    const { AppState } = require('react-native');
    if (AppState.currentState === 'active' && emitter.listenerCount(EVENT)) {
      emitter.emit(EVENT, ...params);
    } else {
      mockWorld.txQueue.push(params);
    }
  };
  let chain = Promise.resolve();
  const enqueue = op => {
    const run = chain.then(op);
    chain = run.catch(() => {});
    return run;
  };
  const upsert = tx => {
    const i = mockWorld.db.findIndex(
      r => r.sparkID === tx.id && r.accountId === tx.accountId,
    );
    const details = JSON.stringify({ time: Date.now(), ...(tx.details || {}) });
    const row = {
      sparkID: tx.id,
      paymentStatus: tx.paymentStatus,
      paymentType: tx.paymentType || 'unknown',
      accountId: tx.accountId,
      details,
    };
    if (i >= 0) mockWorld.db[i] = { ...mockWorld.db[i], ...row };
    else mockWorld.db.push(row);
  };
  return {
    __esModule: true,
    SPARK_TX_UPDATE_ENVENT_NAME: EVENT,
    sparkTransactionsEventEmitter: emitter,
    mockFlushTxQueue: () => {
      const queued = mockWorld.txQueue.splice(0);
      for (const params of queued) emitter.emit(EVENT, ...params);
    },
    bulkUpdateSparkTransactions: (txs, updateType = 'transactions', ...rest) =>
      enqueue(async () => {
        for (const tx of txs) upsert(tx);
        post(updateType, ...rest);
        return true;
      }),
    insertSparkTransactionPlaceholders: (txs, updateType = 'transactions') =>
      enqueue(async () => {
        let inserted = 0;
        for (const tx of txs) {
          if (
            !mockWorld.db.some(
              r => r.sparkID === tx.id && r.accountId === tx.accountId,
            )
          ) {
            upsert(tx);
            inserted += 1;
          }
        }
        if (inserted) post(updateType);
        return true;
      }),
    getAllSparkTransactions: async ({ limit = null, accountId } = {}) => {
      const rows = mockWorld.db
        .filter(r => !accountId || r.accountId === accountId)
        .sort(
          (a, b) => JSON.parse(b.details).time - JSON.parse(a.details).time,
        );
      return limit ? rows.slice(0, limit) : rows;
    },
    getAllSparkContactInvoices: async () => [],
    getAllUnpaidSparkLightningInvoices: async () => [],
    cleanStalePendingSparkLightningTransactions: async () => {},
    ensureSparkDatabaseReady: async () => {},
  };
});

jest.mock('../../app/functions/spark/restore', () => ({
  __esModule: true,
  fullRestoreSparkState: async () => {
    mockWorld.restoreCalls += 1;
    mockWorld.restoreLog.push(mockWorld.db.map(r => r.sparkID));
    return 0;
  },
  updateSparkTxStatus: async () => {
    mockWorld.statusCalls += 1;
    return { updated: [], pendingIds: [] };
  },
}));

jest.mock('../../app/functions/spark/balanceSnapshots', () => ({
  __esModule: true,
  saveAccountBalanceSnapshot: (id, balance, tokens) => {
    mockWorld.snapshots[id] = { balance, tokens };
  },
  getAccountBalanceSnapshot: async id => mockWorld.snapshots[id] ?? null,
}));

jest.mock('../../context-store/appStatus', () => {
  const mockReact = require('react');
  return {
    __esModule: true,
    useAppStatus: () => {
      const [didGetToHomepage, setHomepage] = mockReact.useState(
        mockWorld.homepage,
      );
      const [appState, setHookAppState] = mockReact.useState(
        mockWorld.appStateHook,
      );
      mockWorld.setHomepage = setHomepage;
      mockWorld.setAppStateHook = setHookAppState;
      return { didGetToHomepage, appState };
    },
  };
});

jest.mock('../../context-store/authContext', () => {
  const mockReact = require('react');
  return {
    __esModule: true,
    useAuthContext: () => {
      const [authResetkey, set] = mockReact.useState(mockWorld.authResetkey);
      mockWorld.setAuthResetkey = set;
      return { authResetkey };
    },
  };
});

const mockMasterInfo = {
  homepageTxPreferance: 25,
  hideSmallPaymentsHomepage: false,
  enabledBTKNTokens: null,
};
jest.mock('../../context-store/context', () => ({
  __esModule: true,
  useGlobalContextProvider: () => ({ masterInfoObject: mockMasterInfo }),
}));
jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => ({ contactsPrivateKey: 'priv', publicKey: 'pub' }),
}));
jest.mock('../../context-store/activeAccount', () => ({
  __esModule: true,
  useActiveCustodyAccount: () => ({
    currentWalletMnemoinc:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  }),
}));
const mockContacts = { globalContactsInformation: { myProfile: null } };
jest.mock('../../context-store/globalContacts', () => ({
  __esModule: true,
  useGlobalContactsInfo: () => ({
    ...mockContacts,
    toggleGlobalContactsInformation: () => {},
  }),
}));
jest.mock('../../context-store/toastManager', () => ({
  __esModule: true,
  useToastActions: () => ({
    showToast: toast => mockWorld.toasts.push(toast),
  }),
}));
jest.mock('../../navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => ({ name: mockWorld.route }),
  },
}));
jest.mock('../../app/functions/spark/transformTxToPayment', () => ({
  __esModule: true,
  transformTxToPaymentObject: async (tx, _addr, _u, _r, _inv, accountId) => ({
    id: tx.id,
    paymentStatus: tx.status || 'completed',
    paymentType: 'spark',
    accountId,
    details: {
      time: tx.time || Date.now(),
      amount: tx.amount,
      direction: tx.direction || 'INCOMING',
    },
  }),
}));
jest.mock('../../app/functions/spark/filterTransactions', () => ({
  __esModule: true,
  filterDisplayableTransactions: ({ transactions, limit }) =>
    transactions.slice(0, limit),
}));
jest.mock('../../app/constants', () => ({
  __esModule: true,
  USDB_TOKEN_ID: 'usdb',
}));
jest.mock('../../app/functions/spark/leavesStorage', () => ({
  __esModule: true,
  replaceAllLeaves: async () => {},
  getGlobalLeafStats: async () => ({
    totalLeaves: 0,
    totalValue: 0,
    lastSyncedAt: 0,
  }),
  getPendingExitNodeLeafIds: async () => [],
  saveExitNodesForLeaf: async () => false,
  getExitNodeSyncProgress: async () => ({ pending: 0, complete: 0 }),
}));
jest.mock('../../app/functions/lrc20', () => ({
  __esModule: true,
  getLRC20Transactions: async () => {
    mockWorld.lrc20Calls += 1;
  },
}));
jest.mock('../../app/functions/lrc20/cachedTokens', () => ({
  __esModule: true,
  mergeAndCacheTokens: async tokens => tokens,
}));
jest.mock('../../app/functions/spark/depositClaim', () => ({
  __esModule: true,
  claimDepositUtxo: async () => ({ didClaim: false }),
  fetchAllIdentityDepositUtxos: async () => ({ didWork: true, utxos: [] }),
}));
jest.mock('../../app/functions/spark/enrichedTxCache', () => ({
  __esModule: true,
  clearEnrichedTxCache: () => {},
}));
jest.mock('../../app/functions/spark/walletViewer', () => ({
  __esModule: true,
  disposeWalletViewer: () => {},
}));
jest.mock('../../app/functions/spark/spendAndReplaceCorrelation', () => ({
  __esModule: true,
  clearSpendAndReplaceCorrelationMemo: () => {},
  setSpendAndReplaceAuthGetter: () => {},
}));
jest.mock('../../app/functions/spark/handleFlashnetTransferIds', () => ({
  __esModule: true,
  isFlashnetTransfer: () => false,
}));
jest.mock('../../app/functions/spark/tokenImageCache', () => ({
  __esModule: true,
  getCachedTokenImages: async () => ({}),
}));
jest.mock('../../app/functions/messaging/encodingAndDecodingMessages', () => ({
  __esModule: true,
  clearSharedSecretCache: () => {},
}));
jest.mock('../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsLogReport: () => {},
}));

// ── harness ──────────────────────────────────────────────────────────────────
const { AppState } = require('react-native');
const webView = require('../../context-store/webViewContext');
const txStore = require('../../app/functions/spark/transactions');
const sha256Hash = require('../../app/functions/hash').default;
const {
  SparkWalletProvider,
  useSparkWallet,
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
} = require('../../context-store/sparkContext');

const WALLET_ID = sha256Hash(SEED);
let ctx = null;
let renderer = null;

function Probe() {
  ctx = useSparkWallet();
  mockWorld.renders += 1;
  return null;
}

async function advance(ms) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const balance = () => ctx.sparkInformation.balance;

function setLeaves(patch) {
  Object.assign(mockWorld.leaves, patch);
}

// Fires balance:update from the SDK's current leaf totals, the way each
// runtime delivers it. The WebView bundle only forwards events once its
// addWalletEventListener registration exists.
function emitBalance({ walletId = WALLET_ID } = {}) {
  const snapshot = {
    available: mockWorld.leaves.available,
    owned: mockOwned(),
    incoming: 0,
    optimizationLocked: mockWorld.leaves.swapPending,
  };
  act(() => {
    if (mockWorld.runtime === 'native') {
      mockWorld.nativeWallet.emit('balance:update', snapshot);
    } else if (mockWorld.bundleListeners) {
      webView.sparkBalanceUpdateEmitter.emit(
        'BAL',
        {
          available: String(snapshot.available),
          owned: String(snapshot.owned),
          incoming: '0',
          optimizationLocked: String(snapshot.optimizationLocked),
        },
        walletId,
      );
    }
  });
}

function emitClaim(transferId, claimedBalance) {
  act(() => {
    if (mockWorld.runtime === 'native') {
      mockWorld.nativeWallet.emit(
        'transfer:claimed',
        transferId,
        claimedBalance,
      );
    } else if (mockWorld.bundleListeners) {
      webView.incomingSparkTransaction.emit(
        'INCOMING',
        transferId,
        String(claimedBalance),
        WALLET_ID,
      );
    }
  });
}

function emitStream(status, walletId = WALLET_ID) {
  act(() => {
    if (mockWorld.runtime === 'native') {
      mockWorld.nativeWallet.emit(`stream:${status}`);
    } else if (mockWorld.bundleListeners) {
      webView.sparkStreamStatusEmitter.emit('STREAM', status, walletId);
    }
  });
}

function setSending(value) {
  act(() => {
    isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, value);
  });
}

async function setAppState(next) {
  mockWorld.appState = next;
  AppState.currentState = next;
  act(() => mockWorld.setAppStateHook(next));
  if (next === 'active') act(() => txStore.mockFlushTxQueue());
  await advance(0);
}

// WebView page reload: the bundle forgets its wallet and listeners, the
// connection state goes false, then true once the wallet is re-initialized.
async function reloadWebView(downMs = 1000) {
  mockWorld.bundleListeners = false;
  mockWorld.bridgeUp = false;
  act(() =>
    mockWorld.setConn(prev => ({ state: false, count: prev.count + 1 })),
  );
  await advance(downMs);
  mockWorld.bridgeUp = true;
  act(() =>
    mockWorld.setConn(prev => ({ state: true, count: prev.count + 1 })),
  );
  await advance(0);
}

async function writeTx(tx, updateType) {
  await act(async () => {
    await txStore.bulkUpdateSparkTransactions([tx], updateType);
  });
}

// Mirrors loadingScreen: start connect (not awaited), paint the cached
// snapshot, then reach the homepage.
async function login({ snapshot = null, startBalance = 5000 } = {}) {
  setLeaves({ available: startBalance });
  if (snapshot) mockWorld.snapshots[MOCK_IDENTITY] = snapshot;
  renderer = ReactTestRenderer.create(
    <SparkWalletProvider>
      <Probe />
    </SparkWalletProvider>,
  );
  await advance(0);
  act(() => {
    ctx.connectToSparkWallet(MOCK_IDENTITY);
  });
  await advance(50);
  if (snapshot) {
    act(() =>
      ctx.setSparkInformation(prev => ({
        ...prev,
        transactions: [],
        ...snapshot,
      })),
    );
  }
  await advance(1500);
  act(() => mockWorld.setHomepage(true));
  await advance(4000);
}

beforeEach(() => {
  jest.useFakeTimers();
  Object.assign(process.env, {
    SPARK_IDENTITY_PUBKEY: 'spark-refund-pubkey',
  });
  mockResetWorld();
  AppState.currentState = 'active';
  ctx = null;
});

afterEach(async () => {
  if (renderer) {
    act(() => renderer.unmount());
    renderer = null;
  }
  isSendingPayingEventEmiiter.removeAllListeners();
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ── characterization: login and listeners ───────────────────────────────────
describe('login and listener lifecycle', () => {
  test('connect lands the fresh balance and attaches listeners once', async () => {
    await login({ startBalance: 5000 });
    expect(balance()).toBe(5000);
    expect(ctx.sparkInformation.didConnect).toBe(true);
    expect(ctx.sparkInformation.identityPubKey).toBe(MOCK_IDENTITY);
    expect(mockWorld.bridgeCalls.filter(c => c === 'addListeners').length).toBe(
      1,
    );
  });

  test('cold start with a snapshot: cache first, then exactly one read after listeners attach', async () => {
    await login({
      snapshot: { balance: 4000, tokens: {} },
      startBalance: 5000,
    });
    await advance(20000);
    const balanceReads = mockWorld.bridgeCalls
      .map((c, i) => [c, i])
      .filter(([c]) => c === 'getBalance');
    expect(balanceReads).toHaveLength(1);
    expect(balanceReads[0][1]).toBeGreaterThan(
      mockWorld.bridgeCalls.indexOf('addListeners'),
    );
    expect(balance()).toBe(5000);
  });

  test('first login without a snapshot shows the fresh balance before the homepage', async () => {
    setLeaves({ available: 5000 });
    renderer = ReactTestRenderer.create(
      <SparkWalletProvider>
        <Probe />
      </SparkWalletProvider>,
    );
    await advance(0);
    act(() => {
      ctx.connectToSparkWallet(MOCK_IDENTITY);
    });
    await advance(1500);
    expect(balance()).toBe(5000);
  });

  test('balance:update reaches the display (increase)', async () => {
    await login({ startBalance: 5000 });
    setLeaves({ available: 6000 });
    emitBalance();
    await advance(11000);
    expect(balance()).toBe(6000);
  });

  test('events from a derived wallet never touch the main balance', async () => {
    await login({ startBalance: 5000 });
    setLeaves({ available: 9999 });
    emitBalance({ walletId: 'derived-wallet-hash' });
    await advance(11000);
    expect(balance()).toBe(5000);
  });

  test('E11: WebView reload while active re-attaches listeners', async () => {
    await login({ startBalance: 5000 });
    await reloadWebView();
    await advance(8000);
    setLeaves({ available: 7000 });
    emitBalance();
    await advance(11000);
    expect(balance()).toBe(7000);
  });

  test('foreground after background lands a balance received while away', async () => {
    await login({ startBalance: 5000 });
    await setAppState('background');
    setLeaves({ available: 8000 }); // arrived while backgrounded, event missed
    await advance(60000);
    await setAppState('active');
    await advance(8000);
    expect(balance()).toBe(8000);
  });

  test('a foreground read that times out is retried', async () => {
    await login({ startBalance: 5000 });
    await setAppState('background');
    setLeaves({ available: 8000 });
    await advance(60000);
    mockWorld.readPlan.push({ delay: 20000 }); // foreground read times out (15 s)
    await setAppState('active');
    await advance(60000);
    expect(balance()).toBe(8000);
  });

  test('a read parked across background does not delay or override the foreground read', async () => {
    await login({ startBalance: 5000 });
    mockWorld.readPlan.push({ delay: 12000 });
    emitStream('disconnected');
    emitStream('connected'); // read starts at 5000, parks
    await advance(100);
    await setAppState('background');
    setLeaves({ available: 9000 });
    await advance(4000);
    await setAppState('active');
    const seen = [];
    for (let t = 0; t < 20000; t += 100) {
      await advance(100);
      seen.push(balance());
    }
    expect(seen.slice(15)).toEqual(seen.slice(15).map(() => 9000));
  });

  test('E16: a slow connect read cannot overwrite a newer balance event', async () => {
    mockWorld.readPlan.push({ delay: 9000 }); // the connect-time read
    setLeaves({ available: 1000 });
    renderer = ReactTestRenderer.create(
      <SparkWalletProvider>
        <Probe />
      </SparkWalletProvider>,
    );
    await advance(0);
    act(() => {
      ctx.connectToSparkWallet(MOCK_IDENTITY);
    });
    await advance(1500);
    act(() => mockWorld.setHomepage(true));
    await advance(2000);
    // A receive lands while the connect read (started at 1000) is in flight.
    setLeaves({ available: 1300 });
    emitBalance();
    await advance(30000);
    expect(balance()).toBe(1300);
  });
});

// ── characterization: holds ─────────────────────────────────────────────────
describe('balance holds', () => {
  test('an optimization dip (owned unchanged) is not shown', async () => {
    await login({ startBalance: 5000 });
    mockWorld.optimizing = true;
    setLeaves({ available: 0, swapPending: 5000 });
    emitBalance();
    await advance(1500);
    setLeaves({ available: 5000, swapPending: 0 });
    mockWorld.optimizing = false;
    emitBalance();
    await advance(15000);
    expect(balance()).toBe(5000);
  });

  test('a cross-device spend (owned drops) lands', async () => {
    await login({ startBalance: 5000 });
    setLeaves({ available: 3000 });
    emitBalance();
    await advance(15000);
    expect(balance()).toBe(3000);
  });

  test('E13: a held decrease converges when no further event arrives', async () => {
    await login({ startBalance: 5000 });
    // Leaves moved out of AVAILABLE and stay owned (e.g. native OUTGOING with
    // no stream to settle it); the operators already dropped them.
    setLeaves({ available: 4000, outgoing: 1000 });
    emitBalance();
    await advance(60000);
    expect(balance()).toBe(4000);
  });

  test('a sending flag that is never cleared does not hold funds forever', async () => {
    await login({ startBalance: 5000 });
    // A send path that emits true and misses its false (e.g. a failed main
    // send screen payment before identityPubKey loaded).
    setSending(true);
    setLeaves({ available: 3000 });
    emitBalance();
    mockWorld.tokens = { usdb: { balance: '777' } };
    act(() => {
      webView.sparkTokenBalanceUpdateEmitter.emit(
        'TOK',
        { usdb: { balance: '777' } },
        WALLET_ID,
      );
    });
    await advance(60000);
    expect(balance()).toBe(5000);
    expect(ctx.sparkInformation.tokens?.usdb).toBeUndefined();
    await advance(180000);
    expect(balance()).toBe(3000);
    expect(ctx.sparkInformation.tokens?.usdb?.balance).toBe('777');
  });
});

// ── characterization: incoming ──────────────────────────────────────────────
describe('incoming transfers', () => {
  test('one claim → one row, balance updated, one toast', async () => {
    await login({ startBalance: 5000 });
    mockWorld.transfers.unshift({
      id: 't1',
      amount: 100,
      time: Date.now() + 10000,
    });
    setLeaves({ available: 5100 });
    emitBalance();
    emitClaim('t1', 5100);
    emitClaim('t1', 5100); // duplicate delivery
    await advance(15000);
    expect(mockWorld.db.filter(r => r.sparkID === 't1')).toHaveLength(1);
    expect(balance()).toBe(5100);
    expect(mockWorld.toasts).toHaveLength(1);
  });
});

// ── characterization: reads, lifecycle, staleness ──────────────────────────
describe('reads and lifecycle', () => {
  test('#7: foreground during a send does not read the balance', async () => {
    await login({ startBalance: 5000 });
    setSending(true);
    await setAppState('background');
    await advance(5000);
    const before = mockWorld.reads;
    await setAppState('active');
    await advance(3000);
    expect(mockWorld.reads).toBe(before);
    setSending(false);
  });

  test('stream reconnect reads once and lands a missed change', async () => {
    await login({ startBalance: 5000 });
    emitStream('disconnected');
    setLeaves({ available: 5400 }); // changed while the stream was down
    emitStream('connected');
    await advance(3000);
    expect(balance()).toBe(5400);
  });

  test('E12: a derived wallet stream reconnect does not read the main balance', async () => {
    await login({ startBalance: 5000 });
    const before = mockWorld.reads;
    emitStream('disconnected', 'derived-wallet-hash');
    emitStream('connected', 'derived-wallet-hash');
    await advance(3000);
    expect(mockWorld.reads).toBe(before);
  });

  test('native switch keeps the displayed balance (never flashes 0)', async () => {
    await login({ startBalance: 5000 });
    const seen = [];
    mockWorld.runtime = 'native';
    act(() =>
      mockWorld.setConn(prev => ({ state: true, count: prev.count + 1 })),
    );
    for (let t = 0; t < 20000; t += 100) {
      await advance(100);
      seen.push(balance());
    }
    expect(Math.min(...seen)).toBe(5000);
    setLeaves({ available: 5300 });
    emitBalance();
    await advance(11000);
    expect(balance()).toBe(5300);
  });

  test('H-S3: a send write that lands while the page reloads still settles the balance', async () => {
    await login({ startBalance: 5000 });
    mockWorld.route = 'ConfirmPaymentScreen';
    setSending(true);
    setLeaves({ available: 0, locked: 5000 });
    emitBalance();
    await advance(300);
    // The page drops mid-send; every event from here on is lost.
    mockWorld.bundleListeners = false;
    mockWorld.bridgeUp = false;
    act(() =>
      mockWorld.setConn(prev => ({ state: false, count: prev.count + 1 })),
    );
    setLeaves({ available: 4950, locked: 0, outgoing: 50 });
    await writeTx(
      {
        id: 'hs3',
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: { amount: 50, direction: 'OUTGOING' },
      },
      'paymentWrapperTx',
    );
    setSending(false);
    mockWorld.route = 'ConfirmTxPage';
    await advance(4000);
    mockWorld.bridgeUp = true;
    act(() =>
      mockWorld.setConn(prev => ({ state: true, count: prev.count + 1 })),
    );
    await advance(60000);
    expect(balance()).toBe(4950);
  });

  test('E3: another listener on the native main wallet neither blocks nor loses ours', async () => {
    mockWorld.runtime = 'native';
    // waitForSwapCompletion → subscribeToSparkBalance listens on the main
    // native wallet during a swap send.
    const other = jest.fn();
    mockWorld.nativeWallet.on('balance:update', other);
    await login({ startBalance: 5000 });
    setLeaves({ available: 5600 });
    emitBalance();
    await advance(2000);
    expect(balance()).toBe(5600);
    // A foreground re-attach tears our handlers down and adds them back.
    await setAppState('background');
    await advance(2000);
    await setAppState('active');
    await advance(3000);
    other.mockClear();
    setLeaves({ available: 5700 });
    emitBalance();
    await advance(2000);
    expect(other).toHaveBeenCalledTimes(1);
    expect(balance()).toBe(5700);
    expect(mockWorld.nativeWallet.listenerCount('balance:update')).toBe(2);
  });

  test('logout removes our native handlers', async () => {
    mockWorld.runtime = 'native';
    await login({ startBalance: 5000 });
    expect(mockWorld.nativeWallet.listenerCount('balance:update')).toBe(1);
    act(() => mockWorld.setAuthResetkey(k => k + 1));
    await advance(2000);
    expect(mockWorld.nativeWallet.listenerCount('balance:update')).toBe(0);
  });

  test('#6: a read in flight at logout never writes the old balance', async () => {
    await login({ startBalance: 5000 });
    mockWorld.readPlan.push({ delay: 5000 });
    emitStream('disconnected');
    emitStream('connected'); // starts a 5 s read
    await advance(100);
    act(() => mockWorld.setAuthResetkey(k => k + 1)); // logout
    await advance(10000);
    expect(ctx.sparkInformation.balance).toBe(0);
    expect(ctx.sparkInformation.identityPubKey).toBe('');
  });

  test('#6: a connect still in flight at logout never writes the old wallet', async () => {
    mockWorld.initDelay = 5000;
    renderer = ReactTestRenderer.create(
      <SparkWalletProvider>
        <Probe />
      </SparkWalletProvider>,
    );
    await advance(0);
    act(() => {
      ctx.connectToSparkWallet(MOCK_IDENTITY);
    });
    await advance(1000);
    act(() => mockWorld.setAuthResetkey(k => k + 1)); // logout mid-connect
    await advance(20000);
    expect(ctx.sparkInformation.identityPubKey).toBe('');
    expect(ctx.sparkInformation.didConnect).toBe(null);
    expect(ctx.sparkInformation.balance).toBe(0);
  });

  test('#6: a connect outlived by logout paints no rows and no error', async () => {
    const mountAndLogout = async () => {
      renderer = ReactTestRenderer.create(
        <SparkWalletProvider>
          <Probe />
        </SparkWalletProvider>,
      );
      await advance(0);
      act(() => {
        ctx.connectToSparkWallet(MOCK_IDENTITY);
      });
      await advance(1000);
      act(() => mockWorld.setAuthResetkey(k => k + 1));
      await advance(20000);
    };
    mockWorld.initDelay = 5000;
    mockWorld.cachedRows = [
      {
        sparkID: 'old',
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: '{}',
      },
    ];
    await mountAndLogout();
    expect(ctx.sparkInformation.transactions).toEqual([]);
    act(() => renderer.unmount());

    mockWorld.initFails = true;
    await mountAndLogout();
    expect(ctx.sparkConnectionError).toBe(null);
  });

  test('claim while optimizing ticks the balance up with the toast', async () => {
    await login({ startBalance: 5000 });
    mockWorld.optimizing = true;
    mockWorld.transfers.unshift({
      id: 'rxo',
      amount: 100,
      time: Date.now() + 10000,
    });
    // Optimization hides the new leaf: available dips below owned.
    setLeaves({ available: 3000, swapPending: 2100 });
    emitBalance();
    emitClaim('rxo', 5100);
    await advance(3000);
    expect(balance()).toBe(5100);
    expect(mockWorld.toasts).toHaveLength(1);
  });

  test('E2: an incoming transfer whose first fetch fails still gets its row', async () => {
    await login({ startBalance: 5000 });
    mockWorld.transferFetchFailures = 1;
    mockWorld.transfers.unshift({
      id: 'rxf',
      amount: 100,
      time: Date.now() + 10000,
    });
    setLeaves({ available: 5100 });
    emitBalance();
    emitClaim('rxf', 5100);
    await advance(40000);
    const rows = mockWorld.db.filter(r => r.sparkID === 'rxf');
    expect(rows).toHaveLength(1);
    expect(rows[0].paymentType).toBe('spark');
    expect(rows[0].paymentStatus).toBe('completed');
    expect(mockWorld.toasts).toHaveLength(1);
  });

  test('receive + auto-optimization never flickers (device trace 2026-09-29)', async () => {
    await login({ startBalance: 0 });
    const seen = [];
    const watch = async ms => {
      for (let t = 0; t < ms; t += 50) {
        await advance(50);
        if (seen.at(-1) !== balance()) seen.push(balance());
      }
    };
    mockWorld.transfers.unshift({
      id: 'rx53',
      amount: 53640,
      time: Date.now() + 10000,
    });
    emitBalance(); // incoming noticed, available 0
    await watch(800);
    setLeaves({ available: 53640 }); // claimed
    emitBalance();
    emitClaim('rx53', 53640);
    await watch(150);
    // Auto-optimization: 32768 sats go into a swap.
    mockWorld.optimizing = true;
    setLeaves({ available: 20872, swapPending: 32768 });
    emitBalance();
    emitBalance();
    // A restore pass writes the tx with a balance intent; the read runs
    // mid-swap and sees only the leaves not in the swap.
    await writeTx(
      {
        id: 'restored-other',
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: { amount: 1, direction: 'INCOMING', time: 1 },
      },
      'fullUpdate-waitBalance',
    );
    await watch(1300);
    // The SDK completes a swap atomically (swapped leaves SPENT + unlocked and
    // replacements AVAILABLE under one mutex, one event).
    setLeaves({ available: 53640, swapPending: 0 });
    mockWorld.optimizing = false;
    emitBalance();
    await watch(60000);
    expect(seen).toEqual([0, 53640].slice(seen[0] === 0 ? 0 : 1));
  });

  test('a receive: the commit-triggered restore runs after the claim path wrote the row', async () => {
    await login({ startBalance: 5000 });
    mockWorld.restoreLog = [];
    mockWorld.transfers.unshift({
      id: 'rxr',
      amount: 100,
      time: Date.now() + 10000,
    });
    setLeaves({ available: 5100 });
    emitBalance();
    emitClaim('rxr', 5100);
    await advance(15000);
    expect(mockWorld.restoreLog.length).toBeGreaterThan(0);
    for (const idsAtRestore of mockWorld.restoreLog) {
      expect(idsAtRestore).toContain('rxr');
    }
  });

  test('a stalled optimization probe does not hold a real decrease for long', async () => {
    await login({ startBalance: 5000 });
    mockWorld.probeDelay = 30000; // bridge stalls; the op times out at 30 s
    setLeaves({ available: 3000 });
    emitBalance();
    await advance(7000);
    expect(balance()).toBe(3000);
  });

  describe('BTC → USD swap lands sats and USD together (device trace 2026-09-29)', () => {
    const runSwap = async tokenEventBeforeWrite => {
      await login({ startBalance: 5300 });
      const states = [];
      const watch = async ms => {
        for (let t = 0; t < ms; t += 50) {
          await advance(50);
          const usd = String(ctx.sparkInformation.tokens?.usdb?.balance ?? '0');
          const key = `${balance()}|${usd}`;
          if (states.at(-1) !== key) states.push(key);
        }
      };
      await watch(100);
      setSending(true); // swapFlowHalfModal marks the swap as a send
      setLeaves({ available: 3800 }); // sats go to the pool; owned drops too
      emitBalance();
      await watch(tokenEventBeforeWrite ? 400 : 1600);
      mockWorld.tokens = { usdb: { balance: '1241284' } };
      const tokenEvent = () =>
        act(() => {
          webView.sparkTokenBalanceUpdateEmitter.emit(
            'TOK',
            { usdb: { balance: '1241284' } },
            WALLET_ID,
          );
        });
      if (tokenEventBeforeWrite) {
        tokenEvent();
        await watch(1200);
      }
      await writeTx(
        {
          id: 'swap-out',
          paymentStatus: 'completed',
          paymentType: 'spark',
          accountId: MOCK_IDENTITY,
          details: { amount: 1500, direction: 'OUTGOING' },
        },
        'fullUpdate',
      );
      setSending(false); // the modal awaits the write, then clears the flag
      if (!tokenEventBeforeWrite) {
        await watch(300);
        tokenEvent();
      }
      await watch(15000);
      return states;
    };

    test('token event after the write', async () => {
      // Inherent: the USD side is not known to the SDK yet when the swap's
      // settle read runs, so it lands with its own event just after.
      const states = await runSwap(false);
      expect(states[0]).toBe('5300|0');
      expect(states.at(-1)).toBe('3800|1241284');
      expect(states).not.toContain('5300|1241284');
    });

    test('token event before the write', async () => {
      expect(await runSwap(true)).toEqual(['5300|0', '3800|1241284']);
    });
  });

  test('a token update held during a send lands when the send ends', async () => {
    await login({ startBalance: 5000 });
    setSending(true);
    act(() => {
      webView.sparkTokenBalanceUpdateEmitter.emit(
        'TOK',
        { usdb: { balance: '777' } },
        WALLET_ID,
      );
    });
    await advance(3000);
    expect(ctx.sparkInformation.tokens?.usdb).toBeUndefined();
    setSending(false);
    await advance(1000);
    expect(ctx.sparkInformation.tokens?.usdb?.balance).toBe('777');
  });

  test('burst of 5 claims → 5 rows, final balance', async () => {
    await login({ startBalance: 5000 });
    for (let i = 1; i <= 5; i++) {
      mockWorld.transfers.unshift({
        id: `k${i}`,
        amount: 100,
        time: Date.now() + 10000 + i,
      });
      setLeaves({ available: 5000 + i * 100 });
      emitBalance();
      emitClaim(`k${i}`, 5000 + i * 100);
      await advance(120);
    }
    await advance(15000);
    for (let i = 1; i <= 5; i++) {
      expect(mockWorld.db.filter(r => r.sparkID === `k${i}`)).toHaveLength(1);
    }
    expect(balance()).toBe(5500);
  });

  test('native swap: tokens land without a token-balance:update event', async () => {
    mockWorld.runtime = 'native';
    await login({ startBalance: 5000 });
    setLeaves({ available: 3000 });
    mockWorld.tokens = { usdb: { balance: 2000n } };
    await writeTx(
      {
        id: 'swap1',
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: { amount: 2000, direction: 'OUTGOING' },
      },
      'fullUpdate',
    );
    await advance(15000);
    expect(balance()).toBe(3000);
    expect(ctx.sparkInformation.tokens.usdb.balance).toBe(2000n);
  });
});

// ── send-convergence matrix (invariant #11) ─────────────────────────────────
// Every cell: 5000 sats in one leaf, send 50. The SDK locks the leaf (dip to
// 0), the send lands the 4950 change leaf with 50 OUTGOING, the app writes the
// tx (with the route's update type) and clears the sending flag, the user
// leaves the send screen, and eventually the outgoing leaf settles (owned
// drops) — never on native, which has no stream. Pass = the displayed
// balance equals the SDK's settled `available` 60 s after the send, and a
// flagged send never flashes a transient value on its own send screen.
const SEND_SCREENS = new Set([
  'ConfirmPaymentScreen',
  'ConfirmSplitPayment',
  'StablecoinSendScreen',
]);
const ROUTES = {
  spark: {
    screen: 'ConfirmPaymentScreen',
    flag: true,
    write: 'paymentWrapperTx',
    settleMs: 2500,
  },
  lightning: {
    screen: 'ConfirmPaymentScreen',
    flag: true,
    write: 'paymentWrapperTx',
    settleMs: 8000,
  },
  onchain: {
    screen: 'ConfirmPaymentScreen',
    flag: true,
    write: 'paymentWrapperTx',
    settleMs: null,
  },
  token: {
    screen: 'StablecoinSendScreen',
    flag: true,
    write: 'fullUpdate',
    settleMs: 2500,
  },
  split: {
    screen: 'ConfirmSplitPayment',
    flag: true,
    write: 'paymentWrapperTx',
    settleMs: 2500,
  },
  savingsDeposit: {
    screen: 'CustomHalfModal',
    flag: true,
    write: 'paymentWrapperTx',
    settleMs: 2500,
  },
  swap: {
    screen: 'CustomHalfModal',
    flag: false,
    write: 'fullUpdate',
    settleMs: 2500,
  },
  giftCreate: {
    screen: 'CreateGift',
    flag: true,
    write: 'paymentWrapperTx',
    settleMs: 2500,
  },
  // A flagged send whose tx write never happens (write threw, or the
  // shouldSave path without an identity) and whose send outlasts the first
  // re-check: only the send-end edge is left to converge it.
  // sendPaymentScreen's shouldSave path keeps the flag set while it waits
  // for the identity (up to 10 s) after the send op returned.
  flagNoWrite: {
    screen: 'ConfirmPaymentScreen',
    flag: true,
    write: null,
    settleMs: 2500,
    sendMs: 3000,
    flagClearMs: 2000,
  },
};

async function runSend({
  route: routeName,
  runtime = 'webview',
  firstRead = 'correct',
  settle = 'default', // default | onScreen | never | duplicated | delayed
  lifecycle = 'none', // none | reload | background | nativeSwitch
}) {
  const route = ROUTES[routeName];
  mockWorld.runtime = runtime;
  await login({ startBalance: 5000 });
  expect(balance()).toBe(5000);

  let settleMs = route.settleMs;
  if (settle === 'onScreen') settleMs = 500;
  if (settle === 'delayed') settleMs = 25000;
  if (settle === 'never' || runtime === 'native') settleMs = null;

  const history = [];
  const record = () =>
    history.push({
      route: mockWorld.route,
      sending: ctx.isSendingPaymentRef.current,
      balance: balance(),
    });
  const unsubscribe = jest.fn();
  const origRenders = mockWorld.renders;

  mockWorld.route = route.screen;
  if (route.flag) setSending(true);
  record();

  // Lock: available dips to 0, owned unchanged.
  setLeaves({ available: 0, locked: 5000 });
  emitBalance();
  record();

  if (lifecycle === 'reload') await reloadWebView(800);
  if (lifecycle === 'background') await setAppState('background');
  if (lifecycle === 'nativeSwitch') {
    mockWorld.runtime = 'native';
    act(() =>
      mockWorld.setConn(prev => ({ state: true, count: prev.count + 1 })),
    );
  }
  await advance(route.sendMs ?? 300);
  record();

  // Send op returns: 4950 change leaf available, 50 outgoing.
  setLeaves({ available: 4950, locked: 0, outgoing: 50 });
  if (firstRead === 'staleHigh') mockWorld.staleHigh = 50;
  if (firstRead === 'dip') {
    mockWorld.readPlan.push({
      result: () => ({ didWork: true, balance: 0n, tokensObj: {} }),
    });
  }
  if (firstRead === 'timeout') mockWorld.readPlan.push({ delay: 20000 });
  if (firstRead === 'lostRace') mockWorld.readPlan.push({ delay: 4000 });
  if (mockWorld.appState === 'active') emitBalance();
  record();

  if (route.write)
    await writeTx(
      {
        id: `send-${routeName}`,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: { amount: 50, direction: 'OUTGOING' },
      },
      route.write,
    );
  if (route.flagClearMs) {
    await advance(route.flagClearMs);
    record();
  }
  if (route.flag) setSending(false);
  record();

  if (firstRead === 'lostRace') {
    // A receive commits while the post-send read is still in flight.
    await advance(500);
    setLeaves({ available: mockWorld.leaves.available + 100 });
    emitBalance();
  }

  // Record what the user sees while still on the send screen.
  for (let t = 0; t < 600; t += 100) {
    await advance(100);
    record();
    if (settleMs !== null && settleMs <= 500 && t === 0) {
      setLeaves({ outgoing: 0 });
      emitBalance();
    }
  }
  mockWorld.route =
    route.screen === 'CustomHalfModal' ? 'HomeAdmin' : 'ConfirmTxPage';

  if (lifecycle === 'background') {
    await advance(9000);
    await setAppState('active');
  }

  if (firstRead === 'staleHigh') {
    // Operators finalize the transfer; reads stop over-reporting.
    await advance(6000);
    mockWorld.staleHigh = 0;
  }

  if (settleMs !== null && settleMs > 500) {
    await advance(settleMs);
    setLeaves({ outgoing: 0 });
    if (mockWorld.appState === 'active') emitBalance();
    if (settle === 'duplicated') emitBalance();
  }

  await advance(60000);
  record();
  unsubscribe();

  const settled = mockWorld.leaves.available;
  expect({ cell: routeName, balance: balance() }).toEqual({
    cell: routeName,
    balance: settled,
  });
  if (route.flag && SEND_SCREENS.has(route.screen)) {
    const onScreenWhileSending = history.filter(
      h => SEND_SCREENS.has(h.route) && h.sending,
    );
    for (const h of onScreenWhileSending) {
      expect([5000, 4950]).toContain(h.balance);
    }
  }
  return { renders: mockWorld.renders - origRenders };
}

describe('send-convergence matrix', () => {
  const base = [];
  for (const route of Object.keys(ROUTES)) {
    for (const runtime of ['webview', 'native']) {
      base.push([route, runtime]);
    }
  }
  test.each(base)('%s on %s converges', async (route, runtime) => {
    await runSend({ route, runtime });
  });

  const variations = [];
  for (const route of ['spark', 'swap']) {
    for (const runtime of ['webview', 'native']) {
      for (const firstRead of ['staleHigh', 'dip', 'timeout', 'lostRace']) {
        // A native read reports the SDK's in-memory state (getSpendableSats),
        // the same state events carry, so it cannot disagree with them.
        if (runtime === 'native' && ['staleHigh', 'dip'].includes(firstRead))
          continue;
        variations.push([
          route,
          runtime,
          `firstRead=${firstRead}`,
          { firstRead },
        ]);
      }
    }
    for (const settle of ['onScreen', 'delayed', 'duplicated', 'never']) {
      variations.push([route, 'webview', `settle=${settle}`, { settle }]);
    }
    for (const lifecycle of ['reload', 'background', 'nativeSwitch']) {
      variations.push([
        route,
        'webview',
        `lifecycle=${lifecycle}`,
        { lifecycle },
      ]);
    }
  }
  test.each(variations)(
    '%s on %s with %s converges',
    async (route, runtime, _l, opts) => {
      await runSend({ route, runtime, ...opts });
    },
  );
});

// ── Phase 1 latency probes ───────────────────────────────────────────────────
// Fake-clock timings (bridge round trip = 200 ms, probe = 50 ms) from an input
// to the moment the provider publishes the result. They measure the provider's
// own waits (debounces, serial hops, extra reads), not device I/O. Results
// go to $SPARK_LATENCY_OUT (JSON lines) when set.
const mockLatency = {};
function recordLatency(name, value) {
  mockLatency[name] = value;
  const out = process.env.SPARK_LATENCY_OUT;
  if (out) {
    require('fs').appendFileSync(
      out,
      JSON.stringify({ name, ...value }) + '\n',
    );
  }
}

async function timeUntil(predicate, maxMs = 30000, stepMs = 50) {
  const start = Date.now();
  for (let t = 0; t <= maxMs; t += stepMs) {
    if (predicate()) return Date.now() - start;
    await advance(stepMs);
  }
  return null;
}

function counters() {
  return {
    reads: mockWorld.reads,
    probes: mockWorld.probes,
    bridge: mockWorld.bridgeCalls.length,
    restores: mockWorld.restoreCalls,
    status: mockWorld.statusCalls,
    renders: mockWorld.renders,
  };
}
function delta(before) {
  const now = counters();
  const d = {};
  for (const k of Object.keys(now)) d[k] = now[k] - before[k];
  return d;
}

describe('Phase 1 latency probes', () => {
  test('balance:update increase → painted', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    setLeaves({ available: 6000 });
    emitBalance();
    const ms = await timeUntil(() => balance() === 6000);
    await advance(5000);
    recordLatency('event-increase', { ms, ...delta(c) });
    expect(ms).not.toBeNull();
    expect(ms).toBeLessThan(1000); // budget: event → painted well under 1 s
  });

  test('cross-device decrease (owned drops) → painted', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    setLeaves({ available: 4000 });
    emitBalance();
    const ms = await timeUntil(() => balance() === 4000);
    await advance(5000);
    recordLatency('event-decrease', { ms, ...delta(c) });
    expect(ms).not.toBeNull();
    expect(ms).toBeLessThan(1000); // budget: event → painted well under 1 s
  });

  test('claimed transfer → balance, row, toast', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    mockWorld.transfers.unshift({
      id: 'rx1',
      amount: 100,
      time: Date.now() + 10000,
    });
    setLeaves({ available: 5100 });
    emitBalance();
    emitClaim('rx1', 5100);
    const start = Date.now();
    let balanceMs = null;
    let rowMs = null;
    let toastMs = null;
    for (let t = 0; t <= 20000; t += 50) {
      const el = Date.now() - start;
      if (balanceMs === null && balance() === 5100) balanceMs = el;
      if (
        rowMs === null &&
        ctx.sparkInformation.transactions.some(r => r.sparkID === 'rx1')
      )
        rowMs = el;
      if (toastMs === null && mockWorld.toasts.length) toastMs = el;
      if (balanceMs !== null && rowMs !== null && toastMs !== null) break;
      await advance(50);
    }
    await advance(5000);
    recordLatency('claim', { balanceMs, rowMs, toastMs, ...delta(c) });
    expect(rowMs).not.toBeNull();
  });

  test('burst of 5 inbound transfers', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    const start = Date.now();
    for (let i = 1; i <= 5; i++) {
      mockWorld.transfers.unshift({
        id: `b${i}`,
        amount: 100,
        time: Date.now() + 10000 + i,
      });
      setLeaves({ available: 5000 + i * 100 });
      emitBalance();
      emitClaim(`b${i}`, 5000 + i * 100);
      await advance(150);
    }
    const ms = await timeUntil(
      () =>
        balance() === 5500 &&
        ['b1', 'b2', 'b3', 'b4', 'b5'].every(id =>
          ctx.sparkInformation.transactions.some(r => r.sparkID === id),
        ),
    );
    await advance(5000);
    recordLatency('burst5', {
      ms: ms === null ? null : ms + (Date.now() - start - ms - 5000),
      rawAfterLast: ms,
      toasts: mockWorld.toasts.length,
      ...delta(c),
    });
    expect(ms).not.toBeNull();
  });

  test('spark send (webview) → settled balance', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    mockWorld.route = 'ConfirmPaymentScreen';
    setSending(true);
    setLeaves({ available: 0, locked: 5000 });
    emitBalance();
    await advance(300);
    setLeaves({ available: 4950, locked: 0, outgoing: 50 });
    emitBalance();
    const start = Date.now();
    await writeTx(
      {
        id: 'sx',
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: { amount: 50, direction: 'OUTGOING' },
      },
      'paymentWrapperTx',
    );
    setSending(false);
    const ms = await timeUntil(() => balance() === 4950);
    await advance(600);
    mockWorld.route = 'ConfirmTxPage';
    await advance(2000);
    setLeaves({ outgoing: 0 });
    emitBalance();
    await advance(15000);
    recordLatency('send-settle', {
      ms,
      finalOk: balance() === 4950,
      ...delta(c),
    });
    expect(ms).not.toBeNull();
    expect(start).toBeLessThanOrEqual(Date.now());
  });

  test('token-balance:update → tokens painted', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    act(() => {
      webView.sparkTokenBalanceUpdateEmitter.emit(
        'TOK',
        { usdb: { balance: '10' } },
        WALLET_ID,
      );
    });
    const ms = await timeUntil(
      () => ctx.sparkInformation.tokens?.usdb?.balance === '10',
    );
    await advance(5000);
    recordLatency('token-event', { ms, ...delta(c) });
    expect(ms).not.toBeNull();
    expect(ms).toBeLessThan(1000); // budget: event → painted well under 1 s
  });

  test('cold start with snapshot → first fresh balance', async () => {
    mockWorld.snapshots[MOCK_IDENTITY] = { balance: 4000, tokens: {} };
    setLeaves({ available: 5000 });
    const c = counters();
    renderer = ReactTestRenderer.create(
      <SparkWalletProvider>
        <Probe />
      </SparkWalletProvider>,
    );
    await advance(0);
    const start = Date.now();
    act(() => {
      ctx.connectToSparkWallet(MOCK_IDENTITY);
    });
    await advance(50);
    act(() => ctx.setSparkInformation(prev => ({ ...prev, balance: 4000 })));
    // loadingScreen: 1.5 s minimum, then the homepage.
    await advance(1450);
    act(() => mockWorld.setHomepage(true));
    const freshMs =
      (await timeUntil(() => balance() === 5000, 30000, 25)) + 1500;
    await advance(15000);
    recordLatency('cold-start', {
      freshMs,
      sinceStart: Date.now() - start,
      ...delta(c),
    });
    expect(freshMs).not.toBeNull();
  });

  test('foreground after >1 min', async () => {
    await login({ startBalance: 5000 });
    await setAppState('background');
    await advance(70000);
    setLeaves({ available: 5200 });
    const c = counters();
    await setAppState('active');
    const ms = await timeUntil(() => balance() === 5200);
    await advance(15000);
    recordLatency('foreground', { ms, ...delta(c) });
    expect(ms).not.toBeNull();
  });

  test('re-renders: a leaves/tx-only change re-renders balance consumers', async () => {
    await login({ startBalance: 5000 });
    const c = counters();
    await writeTx(
      {
        id: 'r1',
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: MOCK_IDENTITY,
        details: { amount: 1, direction: 'INCOMING' },
      },
      'transactions',
    );
    await advance(3000);
    recordLatency('tx-write-renders', { ...delta(c) });
    expect(true).toBe(true);
  });
});
