/* eslint-env jest */
// ---------------------------------------------------------------------------
// 2026-08-09 adversarial review — second-pass findings (R-1…R-6).
//
// These tests lock in the behavior reviewed in the second adversarial pass
// over the rebuilt bridge. Where the current behavior is a CONFIRMED BUG the
// assertion encodes the CURRENT (buggy) behavior with a `BUG R-n` comment
// describing the correct behavior — a fix must intentionally flip the
// assertion (same convention as the N-series in
// webViewContext.adversarial.test.js).
//
// Harness: TRANSPORT mode (identical seam to the other two suites).
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

const mockTransport = {
  send: null,
  onMessage: null,
  onMessageHandler: null,
  destroy: null,
};

jest.mock('react-native-webview', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props, ref) => {
      R.useImperativeHandle(ref, () => ({ postMessage: () => {} }));
      return null;
    }),
  };
});

jest.mock('spark-web-context', () => 'file:///spark.html');

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
  getVersion: () => '1.0.0-test',
}));

// F-8: the sendSparkPayment reconcile matcher decodes the receiver spark
// address to an identity public key; the mock maps address → 'pk:<address>'.
const mockDecodeSparkAddress = jest.fn(address => ({
  identityPublicKey: `pk:${address}`,
}));
jest.mock('@buildonspark/spark-sdk', () => ({
  __esModule: true,
  decodeSparkAddress: (...a) => mockDecodeSparkAddress(...a),
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

function providerEl() {
  return React.createElement(
    SUT.WebViewProvider,
    { transport: mockTransport },
    null,
  );
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

  mockTransport.send = jest.fn();
  mockTransport.onMessage = jest.fn(fn => {
    mockTransport.onMessageHandler = fn;
  });
  mockTransport.destroy = jest.fn();

  await act(async () => {
    renderer = RTR.create(providerEl());
  });
  await flush();
  await flush();
}

function rerender() {
  act(() => {
    renderer.update(providerEl());
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
          JSON.stringify({ isResponse: true, id, result: JSON.stringify(resultObj) }),
        ),
      });
    },
  };
}

function lastPosted(action) {
  const calls = mockTransport.send.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const p = JSON.parse(calls[i][0]);
    if (!action || p.action === action) return p;
  }
  return null;
}

function postedCount(wv, action) {
  let count = 0;
  for (const c of mockTransport.send.mock.calls) {
    try {
      const p = JSON.parse(c[0]);
      if (p.action === action) {
        count += 1;
        continue;
      }
      if (p.encrypted) {
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
const WALLET_B = 'second wallet seed words here';
const SEND_ARGS_B = {
  receiverSparkAddress: 'sp1def',
  amountSats: 2000,
  mnemonic: WALLET_B,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockAppStatus.appState = 'active';
  mockAppStatus.isConnectedToTheInternet = true;
  mockAppStatus.didGetToHomepage = true;
  mockActive.currentWalletMnemoinc = null;
  mockAuth.authResetkey = 0;
  mockLocal.get = () => new Promise(() => {});
  mockVerify.mockImplementation(async () => ({
    htmlPath: 'file:///verified.html',
    nonceHex: 'abcdef',
    hashHex: 'h',
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

// ---------------------------------------------------------------------------
// R-1 — Payment history cannot bind a row to a bridge attempt. After an auth
// reset, an interrupted send remains unknown and no history-derived success is
// fabricated. A later user submission is a new payment and still dispatches.
// ---------------------------------------------------------------------------
describe('review — R-1 payment history cannot settle a caller', () => {
  test('auth reset posts no payment-history query and a new payment dispatches', async () => {
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

    const st = track(SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS));
    await flush();
    expect(wv.lastEncryptedPayload('sendSparkPayment')).toBeTruthy();

    // Auth reset reloads the page (epoch bump) and initializes a fresh session.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    await advance(300);
    const wv2 = makeWebviewCrypto();
    wv2.answerHandshake();
    await flush();

    // The reset cleared walletInitialized, so the new session auto-inits the
    // wallet; the reconcile query is held until that completes.
    await advance(200);
    const initMsg2 = wv2.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg2).toBeTruthy();
    wv2.respond(initMsg2.id, { isConnected: true });
    await flush();
    await advance(200);

    const query = wv2.lastEncryptedPayload('getSparkTransactions');
    expect(query).toBeNull();
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('unknown');

    const postsBefore = postedCount(wv2, 'sendSparkPayment');
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS),
    );
    await flush();

    expect(postedCount(wv2, 'sendSparkPayment')).toBe(postsBefore + 1);
    expect(retry.settled).toBe(false);
    expect(st.value?.didWork).not.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R-2 — claimStaticDepositAddress reconcile: a FAILED query is indistinguishable
// from "deposit consumed". The matcher is the only inverted one: absence of the
// utxo ⇒ "executed". A query that fails (offline flap, bridge error, service
// error) resolves to an error object with no `utxos` — `result?.utxos || []`
// collapses that to an empty list and the matcher returns true. The failed
// query therefore marks a possibly-never-executed claim 'done'.
// ---------------------------------------------------------------------------
describe('review — R-2 claim reconcile false-positive on query failure', () => {
  test('error-shaped reconcile result marks the claim done (absence ≠ execution)', async () => {
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

    const st = track(
      SUT.sendWebViewRequestGlobal('claimnSparkStaticDepositAddress', {
        transactionId: 'txid-1',
        outputIndex: 0,
        depositAddress: 'bc1abc',
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(wv.lastEncryptedPayload('claimnSparkStaticDepositAddress')).toBeTruthy();

    // Keep-alive watchdog: claim is a medium op (30s first window), then the
    // 30s final deadline → unknown.
    await advance(30001);
    expect(st.settled).toBe(false);
    await advance(30001);
    expect(st.value.kind).toBe('unknown');

    // Foreground → reconcile posts the utxo query.
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

    // The query FAILS (any bridge/service error): no `utxos` field at all.
    wv.respond(query.id, { didWork: false, error: 'service unavailable' });
    await flush();

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    // A non-array/absent utxos list (didWork:false) is a MISS: nothing is known
    // about the claim, so the intent must stay 'unknown' — never marked done.
    expect(entry.state).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// R-3 — Hold-buffer duplicates are NOT coalesced, and the drain is sequential,
// so the intent guard's in-flight coalescing can never engage: two identical
// sends held during the same ready-window dispatch as TWO real payments.
// The pre-rewrite queue coalesced identical queued requests
// (queueRequest: same action + JSON args → one dispatch, both callers settle).
// Regression: duplicate-submission protection at the bridge layer is gone;
// only per-screen UI guards (isSendingPayment refs) stand in front of it.
// ---------------------------------------------------------------------------
describe('review — R-3 held duplicate funds ops double-dispatch on drain', () => {
  test('two identical sends held in the ready window both execute', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();

    // Both requests arrive before the handshake → both held (no dedupe).
    const a = track(SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS));
    const b = track(SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS));
    await flush();
    expect(mockTransport.send).not.toHaveBeenCalledWith(
      expect.stringContaining('sendSparkPayment'),
    );

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    wv.respond(initMsg.id, { isConnected: true });
    await flush();
    await advance(200); // drain starts

    // First held send dispatched; intent recorded in-flight.
    const first = wv.lastEncryptedPayload('sendSparkPayment');
    expect(first).toBeTruthy();
    expect(postedCount(wv, 'sendSparkPayment')).toBe(1);

    // Identical held requests coalesce at hold time: only ONE dispatch, and
    // both callers settle with that single outcome (old-queue semantics).
    wv.respond(first.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    await advance(0);

    expect(postedCount(wv, 'sendSparkPayment')).toBe(1);
    expect(a.settled).toBe(true);
    expect(a.value).toEqual({ didWork: true, response: { id: 'tx-1' } });
    expect(b.settled).toBe(true);
    expect(b.value).toEqual({ didWork: true, response: { id: 'tx-1' } });
  });
});

// ---------------------------------------------------------------------------
// R-5 — The hold buffer has no TTL and no watchdog. The pre-rewrite queue
// evicted entries after QUEUED_REQUEST_TTL_MS (5 min). If the ready window
// never completes (bundle verification hangs, page never loads, null mnemonic
// — see D4/D2b), held promises are zombies forever: a payment screen awaiting
// one spins until the user kills the app.
// ---------------------------------------------------------------------------
describe('review — R-5 hold buffer has no expiry', () => {
  test('a request held through a stuck ready-window settles AND the bridge auto-recovers (verify watchdog + bounded fallback)', async () => {
    // Verification never resolves → verifiedPath never set → ready-window
    // never ends. The hold TTL bounds the caller, but the verify watchdog now
    // also drives bridge recovery: 30s watchdog → reload attempt → second
    // failure → fallback-pending → in-session auto-retry → final escalation
    // to the native fallback. Every step is bounded; no state waits forever.
    mockVerify.mockImplementation(() => new Promise(() => {}));
    await mountOnly();
    await advance(1000);

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(false);

    // The first verify-watchdog recovery settles the held request (reset).
    await advance(30001);
    expect(st.settled).toBe(true);
    expect(['not-ready', 'unknown']).toContain(st.value.kind);

    // The watchdog drove recovery attempts (re-verification) instead of a
    // silent wait; repeated hangs escalate to the usable native fallback.
    await advance(120001);
    expect(SUT.getIsNativeRuntime()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R-6 — After the drain's auto-init TIMES OUT, the bridge is handshake-complete
// but wallet-uninitialized. It must NOT sit wedged: a bounded retry re-attempts
// the init/drain so the wallet self-heals without needing a full auth reset.
// ---------------------------------------------------------------------------
describe('review — R-6 failed auto-init schedules a bounded re-init', () => {
  test('a timed-out auto-init is retried and, once it connects, held requests drain', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();

    const first = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    expect(wv.lastEncryptedPayload('initializeSparkWallet')).toBeTruthy();
    expect(postedCount(wv, 'initializeSparkWallet')).toBe(1);

    // The auto-init never answers → 90s watchdog → buffer settled 'not-ready',
    // but the bridge stays WEBVIEW and walletInitialized stays false.
    await advance(90001);
    expect(first.settled).toBe(true);
    expect(first.value.kind).toBe('not-ready');
    expect(SUT.getHandshakeComplete()).toBe(true);

    // A new request arrives while still uninitialized: held.
    const second = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(second.settled).toBe(false);

    // The failed init schedules a bounded retry: init is re-posted.
    await advance(5000);
    expect(postedCount(wv, 'initializeSparkWallet')).toBe(2);

    // This time init connects → walletInitialized true → the held request drains.
    const init2 = wv.lastEncryptedPayload('initializeSparkWallet');
    wv.respond(init2.id, { isConnected: true });
    await flush();
    await advance(200);
    const balQuery = wv.lastEncryptedPayload('getSparkBalance');
    expect(balQuery).toBeTruthy();
    wv.respond(balQuery.id, { didWork: true, balance: 5 });
    await flush();
    expect(second.settled).toBe(true);
    expect(second.value).toEqual({ didWork: true, balance: 5 });
  });
});

// ---------------------------------------------------------------------------
// Multi-wallet safety — an unknown send from a secondary wallet must not retain
// that wallet's seed or query transaction history. Balance/transaction refresh
// for each wallet owns the eventual result independently of the intent store.
// ---------------------------------------------------------------------------
describe('review — multi-wallet unknown-send isolation', () => {
  test('a secondary wallet unknown send stores no seed and posts no history query', async () => {
    mockLocal.get = async () => null;
    // Active custody account is wallet A; the send is from wallet B.
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

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', SEND_ARGS_B),
    );
    await flush();
    expect(wv.lastEncryptedPayload('sendSparkPayment')).toBeTruthy();

    // Lost response → unknown.
    await advance(90001);
    await advance(30001);
    expect(st.value.kind).toBe('unknown');

    // Foreground recovery does not attempt heuristic payment reconciliation.
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
    expect(entry.args.mnemonic).toBeUndefined();
  });
});
