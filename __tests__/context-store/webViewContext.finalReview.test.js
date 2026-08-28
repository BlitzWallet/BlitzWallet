/* eslint-env jest */
// ---------------------------------------------------------------------------
// 2026-08-09 FINAL adversarial review — third-pass findings (F-1…F-8, S-5, C-11).
//
// Every test here encodes the CORRECT behavior against a real-life scenario
// and FAILS on the pre-fix implementation. The fix turns them green.
//
// Harness: TRANSPORT mode for bridge logic; WEBVIEW-PROPS mode (real mocked
// WebView element) for the load-lifecycle tests — same seams as the other two
// suites.
// ---------------------------------------------------------------------------

const mockAppStatus = {
  appState: 'active',
  isConnectedToTheInternet: true,
  didGetToHomepage: true,
};
const mockActive = { currentWalletMnemoinc: null };
const mockAuth = { authResetkey: 0 };
const mockLocal = { get: () => new Promise(() => {}) };
const mockVerify = jest.fn(async () => ({
  htmlPath: 'file:///verified.html',
  nonceHex: 'abcdef',
  hashHex: 'h',
}));
// S-5: the persisted kill-switch is stamped with the app version.
const TEST_APP_VERSION = '1.0.0-test';
// F-8: the production sendSparkPayment matcher decodes the receiver's spark
// address to an identity public key. The mock maps address → 'pk:<address>' so
// fixtures can state the receiver identity declaratively.
const mockDecodeSparkAddress = jest.fn(address => ({
  identityPublicKey: `pk:${address}`,
}));

const mockTransport = {
  send: null,
  onMessage: null,
  onMessageHandler: null,
  destroy: null,
};
const mockWebview = { props: null, posted: [] };

jest.mock('react-native-webview', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props, ref) => {
      mockWebview.props = props;
      R.useImperativeHandle(ref, () => ({
        postMessage: data => mockWebview.posted.push(data),
      }));
      return null;
    }),
  };
});

jest.mock('spark-web-context', () => 'file:///spark.html');

jest.mock('@buildonspark/spark-sdk', () => ({
  __esModule: true,
  decodeSparkAddress: (...a) => mockDecodeSparkAddress(...a),
}));

jest.mock('../../context-store/appStatus', () => ({
  __esModule: true,
  useAppStatus: () => ({
    appState: mockAppStatus.appState,
    isConnectedToTheInternet: mockAppStatus.isConnectedToTheInternet,
    didGetToHomepage: mockAppStatus.didGetToHomepage,
  }),
}));

jest.mock('../../context-store/activeAccount', () => ({
  __esModule: true,
  useActiveCustodyAccount: () => ({
    currentWalletMnemoinc: mockActive.currentWalletMnemoinc,
  }),
}));

jest.mock('../../context-store/authContext', () => ({
  __esModule: true,
  useAuthContext: () => ({ authResetkey: mockAuth.authResetkey }),
}));

jest.mock('../../app/functions/webview/bundleVerification', () => ({
  __esModule: true,
  verifyAndPrepareWebView: (...a) => mockVerify(...a),
}));

jest.mock('../../navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: {
    isReady: () => true,
    getRootState: () => ({ routes: [{ name: 'Home' }] }),
  },
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {},
  getModel: () => 'TestModel',
  getSystemVersion: () => '17.0',
  getVersion: () => TEST_APP_VERSION,
}));

jest.mock('../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: (...a) => mockLocal.get(...a),
  setLocalStorageItem: jest.fn(async () => {}),
}));

let React;
let RTR;
let act;
let AppState;
let SUT;
let renderer;
let mode;

function providerEl() {
  return React.createElement(
    SUT.WebViewProvider,
    { transport: mockTransport },
    null,
  );
}
function webviewEl() {
  return React.createElement(SUT.WebViewProvider, {}, null);
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
  await flush();
}

async function mountOnly() {
  jest.resetModules();
  React = require('react');
  RTR = require('react-test-renderer');
  act = RTR.act;
  AppState = require('react-native').AppState;
  AppState.currentState = 'active';
  SUT = require('../../context-store/webViewContext');
  mode = 'transport';

  mockTransport.send = jest.fn();
  mockTransport.onMessage = jest.fn(fn => {
    mockTransport.onMessageHandler = fn;
  });
  mockTransport.destroy = jest.fn();
  mockWebview.props = null;
  mockWebview.posted = [];

  await act(async () => {
    renderer = RTR.create(providerEl());
  });
  await flush();
  await flush();
}

async function mountWebview() {
  jest.resetModules();
  React = require('react');
  RTR = require('react-test-renderer');
  act = RTR.act;
  AppState = require('react-native').AppState;
  AppState.currentState = 'active';
  SUT = require('../../context-store/webViewContext');
  mode = 'webview';

  mockTransport.send = jest.fn();
  mockTransport.onMessage = jest.fn();
  mockTransport.destroy = jest.fn();
  mockWebview.props = null;
  mockWebview.posted = [];

  await act(async () => {
    renderer = RTR.create(webviewEl());
  });
  await flush();
  await flush();
}

function rerender() {
  act(() => {
    renderer.update(mode === 'transport' ? providerEl() : webviewEl());
  });
}

function postInbound(content) {
  act(() => {
    mockTransport.onMessageHandler({
      nativeEvent: { data: JSON.stringify(content) },
    });
  });
}

function makeWebviewCrypto() {
  const secp = require('@noble/secp256k1');
  const { hkdf } = require('@noble/hashes/hkdf');
  const { sha256 } = require('@noble/hashes/sha2');
  const nodeCrypto = require('node:crypto');
  return {
    aesKey: null,
    encrypt(plaintext) {
      const iv = nodeCrypto.randomBytes(12);
      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', this.aesKey, iv);
      let enc = cipher.update(plaintext, 'utf8', 'base64');
      enc += cipher.final('base64');
      const tag = cipher.getAuthTag().toString('base64');
      return `${enc}?iv=${iv.toString('base64')}&tag=${tag}`;
    },
    decrypt(encText) {
      const [ciphertext, params] = encText.split('?iv=');
      const [ivB64, tagB64] = params.split('&tag=');
      const decipher = nodeCrypto.createDecipheriv(
        'aes-256-gcm',
        this.aesKey,
        Buffer.from(ivB64, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      let dec = decipher.update(ciphertext, 'base64', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    },
    answerHandshake(nonceHex = 'abcdef') {
      const payload = lastPosted('handshake:init');
      const privW = nodeCrypto.randomBytes(32);
      const pubW = secp.getPublicKey(privW, true);
      const shared = secp.getSharedSecret(
        privW,
        Buffer.from(payload.args.pubN, 'hex'),
        true,
      );
      const sharedX = shared.slice(1, 33);
      this.aesKey = Buffer.from(
        hkdf(
          sha256,
          sharedX,
          new Uint8Array(0),
          new TextEncoder().encode('ecdh-aes-key:' + nonceHex),
          32,
        ),
      );
      postInbound({
        type: 'handshake:reply',
        id: payload.id,
        pubW: Buffer.from(pubW).toString('hex'),
        runtimeNonce: this.encrypt(nonceHex),
      });
    },
    lastEncryptedPayload(action) {
      const calls = mockTransport.send.mock.calls;
      for (let i = calls.length - 1; i >= 0; i--) {
        const p = JSON.parse(calls[i][0]);
        if (!p.encrypted) continue;
        let inner;
        try {
          inner = JSON.parse(this.decrypt(p.encrypted));
        } catch (e) {
          continue;
        }
        if (!action || inner.action === action) return inner;
      }
      return null;
    },
    respond(id, resultObj) {
      postInbound({
        encrypted: this.encrypt(
          JSON.stringify({
            isResponse: true,
            id,
            result: JSON.stringify(resultObj),
          }),
        ),
      });
    },
  };
}

function lastPosted(action) {
  const calls =
    mode === 'transport'
      ? mockTransport.send.mock.calls.map(c => c[0])
      : mockWebview.posted;
  for (let i = calls.length - 1; i >= 0; i--) {
    const p = JSON.parse(calls[i]);
    if (!action || p.action === action) return p;
  }
  return null;
}

function postedCount(wv, action) {
  let count = 0;
  const calls =
    mode === 'transport'
      ? mockTransport.send.mock.calls.map(c => c[0])
      : mockWebview.posted;
  for (const raw of calls) {
    try {
      const p = JSON.parse(raw);
      if (p.action === action) {
        count += 1;
        continue;
      }
      if (p.encrypted && wv) {
        const inner = JSON.parse(wv.decrypt(p.encrypted));
        if (inner.action === action) count += 1;
      }
    } catch (e) {
      // old-session ciphertext etc.
    }
  }
  return count;
}

function track(promise) {
  const state = { settled: false, rejected: false, value: undefined };
  promise.then(
    v => {
      state.settled = true;
      state.value = v;
    },
    e => {
      state.settled = true;
      state.rejected = true;
      state.value = e;
    },
  );
  return state;
}

const MNEMONIC = 'test mnemonic words';
const SEND_ARGS = {
  receiverSparkAddress: 'sp1abc',
  amountSats: 1000,
  mnemonic: MNEMONIC,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockAppStatus.appState = 'active';
  mockAppStatus.isConnectedToTheInternet = true;
  mockAppStatus.didGetToHomepage = true;
  mockActive.currentWalletMnemoinc = null;
  mockAuth.authResetkey = 0;
  mockLocal.get = () => new Promise(() => {});
  mockVerify.mockClear();
  mockVerify.mockImplementation(async () => ({
    htmlPath: 'file:///verified.html',
    nonceHex: 'abcdef',
    hashHex: 'h',
  }));
  mockDecodeSparkAddress.mockClear();
  mockDecodeSparkAddress.mockImplementation(address => ({
    identityPublicKey: `pk:${address}`,
  }));
});

afterEach(() => {
  if (renderer) {
    act(() => {
      renderer.unmount();
    });
    renderer = null;
  }
  jest.clearAllTimers();
  jest.useRealTimers();
});

// -- shared scenario helpers -------------------------------------------------

// Mount, handshake, auto-init the wallet: the bridge is fully ready.
async function setupFundsReady() {
  mockLocal.get = async () => null;
  mockActive.currentWalletMnemoinc = MNEMONIC;
  await mountOnly();
  const wv = makeWebviewCrypto();
  await advance(300);
  wv.answerHandshake();
  await flush();
  await advance(150);
  const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
  wv.respond(initMsg.id, { isConnected: true });
  await flush();
  await advance(200);
  return wv;
}

// Dispatch a funds op and let its response die: keep-alive resume re-posts the
// same id, then the final deadline settles the caller unknown.
async function dispatchThenLoseResponse(wv, op, args) {
  const st = track(SUT.sendWebViewRequestGlobal(op, args));
  await flush();
  expect(wv.lastEncryptedPayload(op)).toBeTruthy();
  // Claim is a medium op (30s first window); other keep-alive ops are 90s.
  await advance(op === 'claimnSparkStaticDepositAddress' ? 30001 : 90001);
  expect(st.settled).toBe(false);
  await advance(30001);
  expect(st.settled).toBe(true);
  expect(st.value.kind).toBe('unknown');
  return st;
}

// Auth reset keeps a keep-alive caller live; the new session handshakes,
// re-inits the wallet and runs the foreground reconcile query for the op.
async function resetAndGetReconcileQuery(wv1, queryAction) {
  mockAuth.authResetkey += 1;
  rerender();
  await flush();
  await advance(300);
  const wv2 = makeWebviewCrypto();
  wv2.answerHandshake();
  await flush();
  await advance(200);
  const initMsg = wv2.lastEncryptedPayload('initializeSparkWallet');
  expect(initMsg).toBeTruthy();
  wv2.respond(initMsg.id, { isConnected: true });
  await flush();
  await advance(200);
  const query = wv2.lastEncryptedPayload(queryAction);
  expect(query).toBeTruthy();
  return { wv2, query };
}

// ---------------------------------------------------------------------------
// Only operations whose query uniquely identifies the original attempt may be
// reconciled. Invoice IDs provide that identity; payment and swap history does
// not, so those operations deliberately remain unknown.
// ---------------------------------------------------------------------------
describe('final — deterministic invoice reconciliation', () => {
  test('fufillSparkInvoices: intent done, live caller settles unknown (consumer reads satsTransactionSuccess)', async () => {
    const wv = await setupFundsReady();
    const st = track(
      SUT.sendWebViewRequestGlobal('fufillSparkInvoices', {
        mnemonic: MNEMONIC,
        invoices: [{ invoice: 'inv-1', amount: '500' }],
      }),
    );
    await flush();
    expect(wv.lastEncryptedPayload('fufillSparkInvoices')).toBeTruthy();

    const { wv2, query } = await resetAndGetReconcileQuery(
      wv,
      'querySparkInvoices',
    );
    wv2.respond(query.id, {
      invoiceStatuses: [{ invoice: 'inv-1', status: 2 }],
    });
    await flush();

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('done');
    expect(entry.result).toMatchObject({ didWork: true, status: 'executed' });
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');
    expect(st.value.didWork).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// F-3 — After a native fallback the webview intent guard no longer wraps sends:
// a retry of a webview-unknown op would go straight to the native SDK and
// double-execute. The bridge must expose the unknown state so native wrappers
// can refuse.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Guard contract (2026-08) — an 'unknown' intent never blocks a user-initiated
// identical send: that send is a NEW payment and dispatches immediately, both
// within and past the reconcile window. Expired intents are pruned from the
// store (DR-12) so the seed is not retained past the window.
// ---------------------------------------------------------------------------
describe('final — guard contract: identical user sends dispatch immediately', () => {
  test('within the reconcile window an identical send dispatches as a new payment (never blocked)', async () => {
    const wv = await setupFundsReady();
    await dispatchThenLoseResponse(wv, 'sendSparkPayment', SEND_ARGS);

    const posted = postedCount(wv, 'sendSparkPayment');
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS),
    );
    await flush();
    // Fresh dispatch, not an instant unknown-block.
    expect(retry.settled).toBe(false);
    expect(postedCount(wv, 'sendSparkPayment')).toBe(posted + 1);
  });

  test('past the reconcile window the expired unknown intent is pruned and the identical send dispatches', async () => {
    const wv = await setupFundsReady();
    await dispatchThenLoseResponse(wv, 'sendSparkPayment', SEND_ARGS);

    // dispatchThenLoseResponse burned ~120s; push total past the 3-min window,
    // then trigger the lazy prune with a dispatch.
    await advance(120000);
    expect([...SUT.__getIntentStoreForTest().values()].length).toBe(1);

    const posted = postedCount(wv, 'sendSparkPayment');
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS),
    );
    await flush();
    expect(retry.settled).toBe(false);
    expect(postedCount(wv, 'sendSparkPayment')).toBe(posted + 1);
    // The expired unknown intent was pruned by the dispatch's lazy sweep; the
    // retry created a fresh in-flight entry.
    const entries = [...SUT.__getIntentStoreForTest().values()];
    expect(entries.length).toBe(1);
    expect(entries[0].state).toBe('in-flight');
  });
});

// ---------------------------------------------------------------------------
// F-4 / S-4 — Intent-store secret hygiene. Ops with NO reconcile query
// (sendBitcoinPayment, clawbacks) can never be reconciled: retaining their raw
// mnemonic in module memory for the process lifetime buys nothing. And a
// reconcile-confirmed done intent is never queried again — drop its seed too.
// ---------------------------------------------------------------------------
describe('final — F-4/S-4 intent-store mnemonic hygiene', () => {
  test('a no-reconcile-query intent stores scrubbed args, and an identical user send dispatches immediately (contract)', async () => {
    const wv = await setupFundsReady();
    const args = {
      paymentRequest: 'lnbc1abc',
      amountSats: 100,
      mnemonic: MNEMONIC,
    };
    await dispatchThenLoseResponse(wv, 'sendSparkBitcoinPayment', args);

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('unknown');
    expect(entry.args.mnemonic).toBeUndefined();

    // Guard contract: an identical user-initiated send is a NEW payment and
    // dispatches immediately — the scrubbed store entry never blocks it.
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkBitcoinPayment', args),
    );
    await flush();
    expect(retry.settled).toBe(false);
    // original + keep-alive resume re-post + the fresh retry dispatch.
    expect(postedCount(wv, 'sendSparkBitcoinPayment')).toBe(3);
  });

  test('a reconcile-confirmed done intent scrubs its mnemonic', async () => {
    const wv = await setupFundsReady();
    await dispatchThenLoseResponse(wv, 'sendSparkPayment', SEND_ARGS);

    SUT.__setReconcileQueryForTest(() => ({
      result: { transfers: [{ id: 'tx-1' }] },
      matcher: () => true,
    }));
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('done');
    expect(entry.args.mnemonic).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// F-5 — A failed init latches fallback-pending; a later successful init proves
// the bridge healthy. The machine must recover to WEBVIEW and restore the
// session retry budget — otherwise the bridge sits in a limbo where the wallet
// works but the machine disagrees, and the next failure fast-tracks to native.
// ---------------------------------------------------------------------------
describe('final — F-5 init success recovers fallback-pending', () => {
  test('PENDING → init success → WEBVIEW with a restored retry budget', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);

    // Auto-init FAILS → fallback-pending (retry budget: 1 consumed).
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    wv.respond(initMsg.id, { isConnected: false, error: 'no funds' });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');

    // The caller-layer retry (login flow) re-attempts the init — SUCCESS.
    const retryInit = track(
      SUT.sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const initMsg2 = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg2.id).not.toBe(initMsg.id);
    wv.respond(initMsg2.id, { isConnected: true });
    await flush();
    expect(retryInit.settled).toBe(true);

    // The machine recovers: a working bridge is no longer pending.
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // …and the retry budget was restored: ONE more init failure is PENDING
    // again, not an immediate session-native escalation.
    const retryInit2 = track(
      SUT.sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const initMsg3 = wv.lastEncryptedPayload('initializeSparkWallet');
    wv.respond(initMsg3.id, { isConnected: false, error: 'no funds' });
    await flush();
    expect(retryInit2.settled).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
  });
});

// ---------------------------------------------------------------------------
// F-7 — An auth-reset-INTERRUPTED handshake is not a bridge failure: the reset
// settles it with kind 'unknown' and the new session owns recovery. Consuming
// a fallback retry for it means two unlucky resets wedge the session native.
// ---------------------------------------------------------------------------
describe('final — F-7 reset-interrupted handshake consumes no fallback state', () => {
  test('auth reset mid-handshake leaves the machine in WEBVIEW and the bridge recovers', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();

    // Auth reset BEFORE the handshake reply: the reset settles the in-flight
    // handshake as kind 'unknown' — an interruption, not a failure.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // The reloaded session handshakes normally and the bridge comes up.
    await advance(300);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });
});

// ---------------------------------------------------------------------------
// F-8 — Reconcile precision.
// (a) Payment history is never used to settle an attempt because it has no
//     bridge-attempt identifier.
// (b) A FULL first page of unclaimed utxos may be truncated — absence of the
//     deposit utxo is then unproven and must not mark the claim executed.
// ---------------------------------------------------------------------------
describe('final — F-8 reconcile precision', () => {
  test('payment history is not queried to prove execution', async () => {
    const wv = await setupFundsReady();
    await dispatchThenLoseResponse(wv, 'sendSparkPayment', SEND_ARGS);

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    const query = wv.lastEncryptedPayload('getSparkTransactions');
    expect(query).toBeNull();
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('unknown');
  });

  test('a full utxo page cannot prove a claim executed (truncation risk)', async () => {
    const wv = await setupFundsReady();
    await dispatchThenLoseResponse(wv, 'claimnSparkStaticDepositAddress', {
      transactionId: 'txid-1',
      outputIndex: 0,
      depositAddress: 'bc1abc',
      mnemonic: MNEMONIC,
    });

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    const query = wv.lastEncryptedPayload('getUtxosForDepositAddress');
    expect(query).toBeTruthy();
    // 100 unclaimed utxos = a FULL page (the query limit) — the target utxo may
    // sit on page 2; its absence here proves nothing.
    wv.respond(query.id, {
      didWork: true,
      utxos: Array.from({ length: 100 }, (_, i) => ({
        txid: `other-${i}`,
        vout: 0,
      })),
    });
    await flush();

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('unknown');
  });

  test(
    'one identical transfer from before dispatch cannot prove the current send executed',
    async () => {
      const wv = await setupFundsReady();
      await dispatchThenLoseResponse(wv, 'sendSparkPayment', SEND_ARGS);
      const entry = [...SUT.__getIntentStoreForTest().values()][0];

      mockAppStatus.appState = 'background';
      AppState.currentState = 'background';
      rerender();
      await flush();
      mockAppStatus.appState = 'active';
      AppState.currentState = 'active';
      rerender();
      await flush();

      const query = wv.lastEncryptedPayload('getSparkTransactions');
      expect(query).toBeNull();
      expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
      expect(entry.state).toBe('unknown');
    },
  );
});

// ---------------------------------------------------------------------------
// S-5 — The persisted kill-switch must not be a permanent, un-inspectable
// boolean: it is stamped with the app version. Same version → still latched.
// A different version (app update — including legacy 'true' installs) → the
// bridge is retried; a still-broken bundle simply re-persists on re-verify.
// ---------------------------------------------------------------------------
describe('final — S-5 version-stamped kill-switch', () => {
  test('tamper persists the current app version, not a bare boolean', async () => {
    mockVerify.mockRejectedValue(
      Object.assign(new Error('signature invalid'), { isTamper: true }),
    );
    await mountOnly();
    await advance(400);

    const { setLocalStorageItem } = require('../../app/functions');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      TEST_APP_VERSION,
    );
    expect(SUT.__getFallbackStateForTest()).toBe('native');
  });

  test('a same-version flag still latches native (handshake skipped)', async () => {
    mockLocal.get = async () => TEST_APP_VERSION;
    await mountOnly();
    await advance(400);

    expect(SUT.__getFallbackStateForTest()).toBe('native');
    expect(lastPosted('handshake:init')).toBeNull();
  });

  test('a legacy boolean flag is treated as stale: the bridge is retried', async () => {
    mockLocal.get = async () => 'true'; // pre-version-stamp install
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    await advance(400);

    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(lastPosted('handshake:init')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// C-11 — Load lifecycle hardening: a failed or hung load must not wedge the
// bridge while foregrounded. onError drives the same recover-or-escalate path
// as a crash; a 30s load watchdog covers the no-events hang.
// ---------------------------------------------------------------------------
describe('final — C-11 load failure & watchdog recovery', () => {
  test('a WebView load error re-verifies and reloads instead of wedging', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountWebview();
    await advance(400);
    expect(mockWebview.props).toBeTruthy();
    expect(typeof mockWebview.props.onError).toBe('function');

    const verifyCalls = mockVerify.mock.calls.length;
    act(() => {
      mockWebview.props.onLoadStart();
    });
    act(() => {
      mockWebview.props.onError({
        nativeEvent: { description: 'load failed' },
      });
    });
    await flush();

    // Recovery reloads → the bundle is re-verified.
    expect(mockVerify.mock.calls.length).toBeGreaterThan(verifyCalls);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('repeated load failures escalate to fallback-pending (bounded)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountWebview();
    await advance(400);

    // First failure → recover.
    act(() => {
      mockWebview.props.onLoadStart();
    });
    act(() => {
      mockWebview.props.onError({ nativeEvent: { description: 'boom 1' } });
    });
    await flush();
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // The reloaded page fails again → pending (second consecutive failure).
    act(() => {
      mockWebview.props.onLoadStart();
    });
    act(() => {
      mockWebview.props.onError({ nativeEvent: { description: 'boom 2' } });
    });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
  });

  test('a hung load (no events) is recovered by the load watchdog', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountWebview();
    await advance(400);

    const verifyCalls = mockVerify.mock.calls.length;
    act(() => {
      mockWebview.props.onLoadStart();
    });
    // No onLoadEnd / onLoadProgress ever fires.
    await advance(30001);
    expect(mockVerify.mock.calls.length).toBeGreaterThan(verifyCalls);
  });

  test('a background-suspended load is not a failure: the watchdog re-arms and the load completes on foreground', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountWebview();
    await advance(400);

    const verifyCalls = mockVerify.mock.calls.length;
    act(() => {
      mockWebview.props.onLoadStart();
    });
    // The page load is suspended while backgrounded: no onLoadEnd fires.
    AppState.currentState = 'background';
    // Several watchdog windows pass — none may declare failure (no reload,
    // no fallback escalation).
    await advance(30001);
    await advance(30001);
    expect(mockVerify.mock.calls.length).toBe(verifyCalls);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // Foreground: the suspended load completes normally and the handshake runs.
    AppState.currentState = 'active';
    act(() => {
      mockWebview.props.onLoadEnd();
    });
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();
  });

  test('a WebView left in ERROR during boot is reloaded on foreground (before homepage)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    mockAppStatus.didGetToHomepage = false;
    await mountWebview();
    await advance(400);

    const verifyCalls = mockVerify.mock.calls.length;
    act(() => {
      mockWebview.props.onLoadStart();
    });
    // Load fails while backgrounded: ERROR is latched, recovery deferred.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    act(() => {
      mockWebview.props.onError({
        nativeEvent: { description: 'bg load failed' },
      });
    });
    await flush();
    expect(mockVerify.mock.calls.length).toBe(verifyCalls);

    // Foreground during boot (no homepage yet): the ERROR WebView never
    // self-recovers, so it must be reloaded to re-arm verification + handshake.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    expect(mockVerify.mock.calls.length).toBeGreaterThan(verifyCalls);
  });
});
