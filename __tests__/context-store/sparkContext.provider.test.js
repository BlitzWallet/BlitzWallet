/* eslint-env jest */
// ---------------------------------------------------------------------------
// Provider-boundary tests for SparkWalletProvider (Breez backend).
//
// The provider runs for real (with the real initWallet, balance engine and
// timeout helpers). Everything it talks to is faked here:
//   - the Breez wallet handle from walletRuntime (an `on(cb)` event feed; the
//     events carry no balance, they only trigger a getSparkBalance read),
//   - a balance model (`leaves.available`) behind getSparkBalance,
//   - an in-memory transaction table that emits SPARK_TX_UPDATE the way
//     handleEventEmitterPost does (queued while inactive / unsubscribed),
//   - app status, navigation route and AppState.
// Time is fake; `advance(ms)` flushes promises between timers.
//
// The send-convergence matrix at the bottom asserts: after any send the
// displayed balance ends at the wallet's settled `available` within a bounded
// time.
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
  const wait = ms => new Promise(res => setTimeout(res, ms));
  return {
    __esModule: true,
    clearMnemonicCache: () => {},
    initializeSparkWallet: async () => {
      await wait(mockWorld.initDelay);
      if (mockWorld.initFails) {
        return { isConnected: false, error: 'init failed' };
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
      const plan = mockWorld.readPlan.shift() || {};
      // The balance is the wallet state when the request starts, however
      // late the response arrives.
      const snapshot = plan.result
        ? plan.result()
        : {
            didWork: true,
            balance: BigInt(mockWorld.leaves.available + mockWorld.staleHigh),
            tokensObj: { ...mockWorld.tokens },
          };
      await wait(plan.delay ?? mockWorld.readDelay);
      return snapshot;
    },
  };
});

jest.mock('../../app/functions/spark/walletRuntime', () => ({
  __esModule: true,
  acquire: async () => {
    mockWorld.bridgeCalls.push('addListeners');
    return {
      on: cb => {
        mockWorld.breezListener = cb;
        return () => {
          if (mockWorld.breezListener === cb) mockWorld.breezListener = null;
        };
      },
    };
  },
  disposeIdentity: async () => {},
}));

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
const txStore = require('../../app/functions/spark/transactions');
const {
  SparkWalletProvider,
  useSparkWallet,
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
} = require('../../context-store/sparkContext');

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

// Breez events carry no balance: a sync / payment event only triggers a read.
function emitBalance(type = 'synced') {
  act(() => {
    mockWorld.breezListener?.({ type });
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


// ── login and listeners ─────────────────────────────────────────────────────
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

  test('a sync event reaches the display (increase)', async () => {
    await login({ startBalance: 5000 });
    setLeaves({ available: 6000 });
    emitBalance();
    await advance(11000);
    expect(balance()).toBe(6000);
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

describe('balance holds', () => {
  test('a cross-device spend lands', async () => {
    await login({ startBalance: 5000 });
    setLeaves({ available: 3000 });
    emitBalance();
    await advance(15000);
    expect(balance()).toBe(3000);
  });

  test('a sending flag that is never cleared does not hold funds forever', async () => {
    await login({ startBalance: 5000 });
    // A send path that emits true and misses its false (e.g. a failed main
    // send screen payment before identityPubKey loaded).
    setSending(true);
    setLeaves({ available: 3000 });
    emitBalance();
    await advance(60000);
    expect(balance()).toBe(5000);
    await advance(180000);
    expect(balance()).toBe(3000);
  });
});

// ── logout (auth epoch) guards ───────────────────────────────────────────────
describe('reads and lifecycle', () => {
  test('#6: a read in flight at logout never writes the old balance', async () => {
    await login({ startBalance: 5000 });
    mockWorld.readPlan.push({ delay: 5000 });
    emitBalance(); // starts a 5 s read
    await advance(400);
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
});

// ── send-convergence matrix ─────────────────────────────────────────────────
// Every cell: 5000 sats, send 50. The wallet dips while the send is in flight
// (events are held), the send lands 4950, the app writes the tx (with the
// route's update type) and clears the sending flag. Pass = the displayed
// balance equals the wallet's settled `available` 60 s after the send.
const ROUTES = {
  spark: { screen: 'ConfirmPaymentScreen', flag: true, write: 'paymentWrapperTx' },
  lightning: { screen: 'ConfirmPaymentScreen', flag: true, write: 'paymentWrapperTx' },
  onchain: { screen: 'ConfirmPaymentScreen', flag: true, write: 'paymentWrapperTx' },
  token: { screen: 'StablecoinSendScreen', flag: true, write: 'fullUpdate' },
  split: { screen: 'ConfirmSplitPayment', flag: true, write: 'paymentWrapperTx' },
  savingsDeposit: { screen: 'CustomHalfModal', flag: true, write: 'paymentWrapperTx' },
  swap: { screen: 'CustomHalfModal', flag: false, write: 'fullUpdate' },
  giftCreate: { screen: 'CreateGift', flag: true, write: 'paymentWrapperTx' },
  // A flagged send whose tx write never happens: only the send-end edge is
  // left to converge it.
  flagNoWrite: { screen: 'ConfirmPaymentScreen', flag: true, write: null },
};

describe('send-convergence matrix', () => {
  test.each(Object.keys(ROUTES))('%s converges', async routeName => {
    const route = ROUTES[routeName];
    await login({ startBalance: 5000 });
    expect(balance()).toBe(5000);

    mockWorld.route = route.screen;
    if (route.flag) setSending(true);

    // Mid-send dip: the event is held while the flag is set.
    setLeaves({ available: 0 });
    emitBalance('paymentPending');
    await advance(1500);
    expect(balance()).toBe(5000);

    // Send op returns with the change leaf available.
    setLeaves({ available: 4950 });
    emitBalance('paymentSucceeded');
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
    if (route.flag) setSending(false);
    mockWorld.route = 'ConfirmTxPage';

    await advance(60000);
    expect(balance()).toBe(mockWorld.leaves.available);
  });
});
