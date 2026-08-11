/* eslint-env jest */
// ---------------------------------------------------------------------------
// Test harness for the rebuilt WebView bridge (docs/webview-bridge-rebuild-plan-2026-08.md).
//
// The provider's interesting logic lives in refs/useCallbacks (invisible to
// renders), so tests render the provider with an INJECTED TRANSPORT
// ({send, onMessage, destroy} — plan Phase 0 seam) and drive the bridge by
// capturing outbound messages and posting inbound ones through the registered
// handler. No react-native-webview mock is needed for transport-mode tests.
//
// Module-level state (fallbackState / handshakeComplete / intentStore) persists
// in the module, so each test does jest.resetModules() + a fresh require.
// ---------------------------------------------------------------------------

// Controllable mock state — lives in this test module, survives resetModules.
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

// The provider imports the WebView component and the bundle asset even in
// transport mode; both are inert under test.
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
  // Drain the microtask queue so async effect chains settle. Fake timers do not
  // affect promise microtasks, so this works with useFakeTimers().
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

// Mount, let verification + the 250ms handshake debounce run, then complete the
// ECDH handshake. Returns the webview crypto helper.
async function mountAndHandshake() {
  await mountOnly();
  await advance(300);
  const wv = makeWebviewCrypto();
  wv.answerHandshake();
  await flush();
  expect(SUT.getHandshakeComplete()).toBe(true);
  return wv;
}

// After a handshake with a mnemonic set, the provider auto-dispatches
// initializeSparkWallet; complete it so held requests can drain.
async function completeWalletInit(wv) {
  await advance(150);
  const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
  expect(initMsg).toBeTruthy();
  wv.respond(initMsg.id, { isConnected: true });
  await flush();
  await advance(200);
}

function rerender() {
  act(() => {
    renderer.update(providerEl());
  });
}

// "WebView side" of the bridge: answers handshake:init with a real ECDH reply
// (same HKDF/AES-GCM scheme as the SUT) so post-handshake flows — encrypted
// sends, wallet init, buffer drains — can be exercised end to end.
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
      // Must mirror deriveAesKeyFromSharedX: info = 'ecdh-aes-key:' + nonceHex.
      this.aesKey = Buffer.from(
        hkdf(
          sha256,
          sharedX,
          new Uint8Array(0),
          new TextEncoder().encode('ecdh-aes-key:' + nonceHex),
          32,
        ),
      );
      act(() => {
        postInbound({
          type: 'handshake:reply',
          id: payload.id,
          pubW: Buffer.from(pubW).toString('hex'),
          runtimeNonce: this.encrypt(nonceHex),
        });
      });
    },
    // Newest-first search through posted encrypted payloads; messages from a
    // previous session key fail to decrypt and are skipped.
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
      const content = {
        isResponse: true,
        id,
        result: JSON.stringify(resultObj),
      };
      postInbound({
        encrypted: this.encrypt(JSON.stringify(content)),
      });
    },
    postError(id, error) {
      const content = { error, ...(id ? { id } : {}) };
      postInbound({
        encrypted: this.encrypt(JSON.stringify(content)),
      });
    },
  };
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

function postInbound(content) {
  act(() => {
    mockTransport.onMessageHandler({
      nativeEvent: { data: JSON.stringify(content) },
    });
  });
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
  const calls = mockTransport.send.mock.calls;
  for (const c of calls) {
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

const MNEMONIC = 'test mnemonic words';

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
// TDD §1 — transport / handshake (security core kept)
// ---------------------------------------------------------------------------
describe('webViewContext — transport & handshake (TDD §1)', () => {
  test('bundle verification failure fails closed: no handshake, no postMessage, native persisted', async () => {
    // A signature-invalid failure is TAMPER → persists the kill-switch (S-5).
    mockVerify.mockRejectedValue(
      Object.assign(new Error('signature invalid'), { isTamper: true }),
    );
    await mountOnly();
    await advance(400);

    expect(SUT.getHandshakeComplete()).toBe(false);
    expect(mockTransport.send).not.toHaveBeenCalled();
    expect(SUT.__getFallbackStateForTest()).toBe('native');
    // Hard-fail class persists the latch (D-9), stamped with the app version (S-5).
    const { setLocalStorageItem } = require('../../app/functions');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      '1.0.0-test',
    );
  });

  test('transient IO verification failure goes native for the session but does NOT persist (S-5)', async () => {
    // A disk/read hiccup (no isTamper tag) must not permanently downgrade the
    // install: fall native for this session, but never persist the kill-switch.
    mockVerify.mockRejectedValue(new Error('disk read failed'));
    await mountOnly();
    await advance(400);

    expect(SUT.__getFallbackStateForTest()).toBe('native');
    const { setLocalStorageItem } = require('../../app/functions');
    expect(setLocalStorageItem).not.toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      '1.0.0-test',
    );
  });

  test('didRunHandshakeRef stays false until the handshake actually completes (auth-reset native-wallet regression)', async () => {
    // The loading screen gates its post-auth-reset reconnect on
    // didRunHandshakeRef.current: true means "bridge ready, route through
    // webview". If the ref goes true when the handshake merely STARTS (not
    // completes), the reconnect runs while handshakeComplete is still false,
    // selectSparkRuntime falls back to 'native', and getWallet creates a
    // native wallet ("Creating native wallet because none exists").
    mockLocal.get = async () => null;
    await mountOnly();

    // Attach a probe consumer to read the ref off the provider value.
    let handshakeRef;
    act(() => {
      renderer.update(
        React.createElement(
          SUT.WebViewProvider,
          { transport: mockTransport },
          React.createElement(function Probe() {
            handshakeRef = SUT.useWebView().didRunHandshakeRef;
            return null;
          }),
        ),
      );
    });
    await flush();

    // Verification + the 250ms handshake debounce have run: handshake:init is
    // posted but the webview side has NOT answered yet.
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();
    expect(SUT.getHandshakeComplete()).toBe(false);
    expect(handshakeRef.current).toBe(false);

    // Once the handshake actually completes, the ref may flip true.
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(handshakeRef.current).toBe(true);
  });

  test('runtimeNonce mismatch yields no session key: bridge never completes handshake', async () => {
    mockLocal.get = async () => null;
    await mountOnly();
    await advance(300);
    const wv = makeWebviewCrypto();
    // Reply echoes a WRONG nonce.
    wv.answerHandshake('deadbeef');
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(false);

    // The 4s handshake watchdog settles the attempt and the bridge enters
    // fallback-pending (never native on a single failure).
    await advance(4000);
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
    expect(SUT.getHandshakeComplete()).toBe(false);
  });

  test('pre-handshake requests are held, never posted plaintext, and dispatch encrypted after handshake', async () => {
    mockActive.currentWalletMnemoinc = MNEMONIC;
    mockLocal.get = async () => null;
    await mountOnly();

    // Request arrives during the ready-window (verification → handshake).
    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(st.settled).toBe(false);
    // Nothing left the device pre-key (fail-closed encryption).
    expect(mockTransport.send).not.toHaveBeenCalled();

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    // The held request drained and posted ENCRYPTED (decryptable).
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv.respond(sent.id, { balance: 21 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 21 });
  });

  test('a new epoch invalidates old-key messages: stale-session traffic is dropped, bridge survives', async () => {
    mockActive.currentWalletMnemoinc = MNEMONIC;
    mockLocal.get = async () => null;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();

    // Auth reset bumps the epoch and wipes the session key.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();

    // A response encrypted with the OLD key arrives from the stale instance:
    // decrypt fails → contained (no teardown), request already settled unknown
    // by the reset, so nothing hangs.
    postInbound({
      encrypted: wv.encrypt(
        JSON.stringify({ isResponse: true, id: sent.id, result: '{}' }),
      ),
    });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');
    expect(SUT.getHandshakeComplete()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TDD §2 — idempotent send (intent store; postMessage exactly once)
// ---------------------------------------------------------------------------
describe('webViewContext — idempotent send (TDD §2)', () => {
  async function setupFundsReady() {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);
    return wv;
  }

  test('intent is recorded BEFORE postMessage and success removes the entry', async () => {
    const wv = await setupFundsReady();

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();

    const store = SUT.__getIntentStoreForTest();
    expect(store.size).toBe(1);
    const [entry] = [...store.values()];
    expect(entry.state).toBe('in-flight');
    expect(entry.requestId).toBe(sent.id);

    wv.respond(sent.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ didWork: true, response: { id: 'tx-1' } });
    // Success removes the pending entry — a later identical send is a new intent.
    expect(store.size).toBe(0);
  });

  test('retry of a lost-response send re-dispatches as a NEW payment (guard contract); the resume path never re-executes', async () => {
    const wv = await setupFundsReady();

    const first = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();

    // Response lost → the first watchdog does NOT fabricate a failure: it
    // resume-by-id re-posts the SAME id (never a re-execution) and waits for
    // the real outcome.
    await advance(90001);
    expect(first.settled).toBe(false);
    const reposted = wv.lastEncryptedPayload('sendSparkPayment');
    expect(reposted.id).toBe(sent.id);

    // Still no real outcome → the bounded final deadline settles as unknown
    // (last-resort backstop, KEEP-GUARD kind).
    await advance(30001);
    expect(first.settled).toBe(true);
    expect(first.value.kind).toBe('unknown');
    expect(SUT.__getIntentStoreForTest().size).toBe(1);

    // User retries with identical args: per the guard contract (2026-08) this
    // is a deliberate NEW payment — it dispatches immediately with a fresh id
    // and the caller waits on the new attempt (restore/balance handlers
    // surface whether the earlier attempt actually sent).
    const second = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(postedCount(wv, 'sendSparkPayment')).toBe(3);
    expect(second.settled).toBe(false);
    const retrySent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(retrySent.id).not.toBe(sent.id);

    // No auto-retry of either attempt: the new attempt's watchdog re-posts the
    // SAME id (never a re-execution) — no third id ever appears.
    await advance(90001);
    expect(second.settled).toBe(false);
    const resume = wv.lastEncryptedPayload('sendSparkPayment');
    expect(resume.id).toBe(retrySent.id);
    expect(second.value).toBeUndefined();
  });

  test('in-flight duplicate coalesces onto the first dispatch — one post, both callers settle', async () => {
    const wv = await setupFundsReady();

    const a = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const b = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();

    expect(postedCount(wv, 'sendSparkPayment')).toBe(1);
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    wv.respond(sent.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(a.settled).toBe(true);
    expect(b.settled).toBe(true);
    expect(a.value).toEqual({ didWork: true, response: { id: 'tx-1' } });
    expect(b.value).toEqual(a.value);
  });

  test('distinct key for different receiver/amount — both dispatch', async () => {
    const wv = await setupFundsReady();

    const a = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    const b = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 2000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(postedCount(wv, 'sendSparkPayment')).toBe(2);
    expect(a.settled).toBe(false);
    expect(b.settled).toBe(false);
  });

  test('connection restore with keep-alive in flight defers the reload — resume-by-id, no epoch bump', async () => {
    const wv = await setupFundsReady();

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();
    const epochBefore = SUT.__getEpochForTest();
    expect(SUT.__getIntentStoreForTest().size).toBe(1);

    // Connection flap: the page is still alive, so the restore path must NOT
    // reload (that would wipe the backend id→outcome cache mid-send) — it
    // re-posts the same id instead.
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();

    expect(st.settled).toBe(false);
    expect(SUT.__getEpochForTest()).toBe(epochBefore);
    expect(SUT.__getIntentStoreForTest().size).toBe(1);
    const reposted = wv.lastEncryptedPayload('sendSparkPayment');
    expect(reposted.id).toBe(sent.id);

    // The backend cache reply resolves the original caller with the real
    // outcome.
    wv.respond(sent.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ didWork: true, response: { id: 'tx-1' } });
    expect(SUT.__getIntentStoreForTest().size).toBe(0);
  });

  test('lightning payment is NOT intent-guarded (SAFE-VIA-IDEMPOTENCY) — a retry re-dispatches', async () => {
    const wv = await setupFundsReady();

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkLightningPayment', {
        invoice: 'lnbc1abc',
        amountSat: 500,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkLightningPayment');
    expect(sent).toBeTruthy();
    expect(SUT.__getIntentStoreForTest().size).toBe(0);

    wv.respond(sent.id, { didWork: true, paymentResponse: { id: 'ln-1' } });
    await flush();
    expect(st.settled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TDD §3 — foreground reconcile
// ---------------------------------------------------------------------------
describe('webViewContext — foreground reconcile (TDD §3)', () => {
  async function setupUnknownIntent(op = 'sendSparkPayment', args = {}) {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal(op, {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
        ...args,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload(op);
    expect(sent).toBeTruthy();
    // Simulate a lost response: the keep-alive watchdog never fabricates a
    // settle — first window resume-by-id re-posts the same id, then the
    // bounded final deadline settles the entry → unknown (last resort).
    await advance(90001);
    expect(st.settled).toBe(false);
    const reposted = wv.lastEncryptedPayload(op);
    expect(reposted.id).toBe(sent.id);
    await advance(30001);
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');
    return { wv, st, sent };
  }

  test('unknown intent settles via injected history query on foreground (hit → executed)', async () => {
    const { wv, sent } = await setupUnknownIntent();
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);

    SUT.__setReconcileQueryForTest(entry => ({
      action: 'getSparkTransactions',
      args: { mnemonic: MNEMONIC },
      matcher: (entry, result) =>
        result.transfers.some(
          t =>
            t.id === 'tx-hit' &&
            Number(t.totalValue) === Number(entry.args.amountSats),
        ),
      result: {
        transfers: [{ id: 'tx-hit', totalValue: 1000, createdTime: Date.now() }],
      },
    }));

    // Background then foreground — the foreground triggers reconcile.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    expect(SUT.__getReconcileQueryCountForTest()).toBe(1);
    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('done');
    expect(entry.result).toEqual({
      didWork: true,
      status: 'executed',
      txid: undefined, // injected query matcher carries no extractor
    });
    expect(sent.id).toBeTruthy();

    // A retry after reconcile-confirmed execution is a NEW payment (F-3): the
    // done record is spent, exactly like the normal-success path, so the
    // retry re-dispatches instead of resolving the stored executed result.
    // The only earlier posts are the original dispatch + the keep-alive
    // watchdog's same-id resume.
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const retried = wv.lastEncryptedPayload('sendSparkPayment');
    expect(retried).toBeTruthy();
    expect(retried.id).not.toBe(sent.id); // fresh dispatch, not a replay
    expect(retry.settled).toBe(false); // not resolved from the stale done entry
    expect(postedCount(wv, 'sendSparkPayment')).toBe(3);

    // The fresh dispatch completes with its own outcome.
    wv.respond(retried.id, { didWork: true, response: { id: 'tx-2' } });
    await flush();
    expect(retry.value).toEqual({ didWork: true, response: { id: 'tx-2' } });
  });

  test('reconcile miss leaves the intent unknown', async () => {
    await setupUnknownIntent();
    SUT.__setReconcileQueryForTest(entry => ({
      action: 'getSparkTransactions',
      args: { mnemonic: MNEMONIC },
      matcher: () => false,
      result: { transfers: [] },
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
    expect(entry.state).toBe('unknown');
    // No double-query within the same foreground.
    expect(SUT.__getReconcileQueryCountForTest()).toBe(1);

    // A NEW foreground allows one more reconcile attempt.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    expect(SUT.__getReconcileQueryCountForTest()).toBe(2);
  });

  test('zero queries when there are no unknown intents', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
  });

  test('reconcile runs for every active wallet, not just the current account (multi-wallet)', async () => {
    const { sent } = await setupUnknownIntent();

    // A different wallet becomes the active custody account, but the original
    // wallet is still initialized/in use (pool/savings/child wallets run
    // concurrently). Its unknown intent must STILL reconcile — against its own
    // seed — not be skipped just because the UI's active account changed.
    mockActive.currentWalletMnemoinc = 'other mnemonic words';
    rerender();
    await flush();

    SUT.__setReconcileQueryForTest(() => ({
      result: {
        transfers: [{ id: 'tx-hit', totalValue: 1000, createdTime: Date.now() }],
      },
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

    // The intent reconciles even though it is not the current account.
    expect(SUT.__getReconcileQueryCountForTest()).toBe(1);
    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('done');
    expect(sent.id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TDD §4 — consumer contract conformance (surviving invariants of the 18 tests)
// ---------------------------------------------------------------------------
describe('webViewContext — no zombie promises (TDD §4)', () => {
  test('in-flight request settles on background as unknown (no re-arm)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(st.settled).toBe(false);

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();

    expect(st.settled).toBe(true);
    expect(st.rejected).toBe(false);
    expect(st.value.kind).toBe('unknown');
    expect(SUT.getHandshakeComplete()).toBe(true);
  });

  test('keep-alive op stays live across background and resolves from the real response on resume', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();
    expect(st.settled).toBe(false);

    // Background must NOT fabricate a settle for a send: the promise stays
    // live and the intent stays in-flight.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    expect(st.settled).toBe(false);
    expect([...SUT.__getIntentStoreForTest().values()][0].state).toBe(
      'in-flight',
    );

    // Foreground, same epoch, page alive → resume-by-id re-posts the SAME id
    // (the backend cache returns the real outcome; never a re-execution).
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    expect(st.settled).toBe(false);
    const reposted = wv.lastEncryptedPayload('sendSparkPayment');
    expect(reposted).toBeTruthy();
    expect(reposted.id).toBe(sent.id);
    expect(postedCount(wv, 'sendSparkPayment')).toBe(2);

    // The backend cache reply resolves the original caller.
    wv.respond(sent.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.rejected).toBe(false);
    expect(st.value).toEqual({ didWork: true, response: { id: 'tx-1' } });
    expect(SUT.__getIntentStoreForTest().size).toBe(0);
  });

  test('lightning send is keep-alive too: stays live across background and resumes by id', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkLightningPayment', {
        invoice: 'lnbc1abc',
        amountSat: 500,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkLightningPayment');
    expect(sent).toBeTruthy();
    expect(st.settled).toBe(false);

    // Background: no fabricated failure for the lightning send either.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    expect(st.settled).toBe(false);

    // Foreground resume-by-id: same id re-posted; the backend cache reply
    // resolves the caller with the real outcome.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    const reposted = wv.lastEncryptedPayload('sendSparkLightningPayment');
    expect(reposted.id).toBe(sent.id);
    wv.respond(sent.id, { didWork: true, paymentResponse: { id: 'ln-1' } });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ didWork: true, paymentResponse: { id: 'ln-1' } });
  });

  test('epoch-changed foreground → NO re-post; reconcile settles (double-pay guard)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();
    expect(st.settled).toBe(false);

    // Inject a history hit so the reloaded session's reconcile can settle the
    // intent from the network (the backend id→outcome cache is gone).
    SUT.__setReconcileQueryForTest(entry => ({
      action: 'getSparkTransactions',
      args: { mnemonic: MNEMONIC },
      matcher: (entry, result) =>
        result.transfers.some(t => t.id === 'tx-hit'),
      result: {
        transfers: [
          { id: 'tx-hit', totalValue: 1000, createdTime: Date.now() },
        ],
      },
    }));

    // Auth reset reloads the page (epoch bump, backend cache wiped). The
    // keep-alive caller must NOT be fabricated-settled by the reset.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    expect(st.settled).toBe(false);

    // New handshake completes → the new session reconciles from history and
    // settles the original caller with the executed result.
    await advance(300);
    const wv2 = makeWebviewCrypto();
    wv2.answerHandshake();
    await flush();
    await advance(200);
    expect(st.settled).toBe(true);
    expect(st.rejected).toBe(false);
    expect(st.value).toEqual({
      didWork: true,
      status: 'executed',
      txid: undefined,
    });

    // Double-pay guard: the reloaded page never received a re-send of the id.
    expect(postedCount(wv, 'sendSparkPayment')).toBe(1);
  });

  test('backgrounded send whose page then dies is DROPPED, not reconciled (no false-match; instant resend)', async () => {
    // Repro: user sends, backgrounds the app before the payment gets a response,
    // Android OOM-kills the WebView renderer, and the recovery reset bumps the
    // epoch (page died). The interrupted send's outcome is truly unknowable, and
    // reconcile's amount/destination matcher could false-match a PRIOR identical
    // tx and wrongly settle it 'executed'. So the send must be dropped, the
    // caller settled 'unknown', and an identical resend allowed immediately —
    // a send that really executed is surfaced by transaction restore, not here.
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(wv.lastEncryptedPayload('sendSparkPayment')).toBeTruthy();
    expect(st.settled).toBe(false);

    // App backgrounds with the send in-flight (no response ever arrived).
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();

    // A prior identical payment sits in history: if reconcile ran, its matcher
    // (matcher:() => true here) would false-match and wrongly settle 'executed'.
    let reconcileRan = false;
    SUT.__setReconcileQueryForTest(() => {
      reconcileRan = true;
      return {
        action: 'getSparkTransactions',
        args: { mnemonic: MNEMONIC },
        matcher: () => true,
        result: {
          transfers: [{ id: 'tx-old', totalValue: 1000, createdTime: Date.now() }],
        },
      };
    });

    // Renderer OOM-killed while backgrounded → recovery reset bumps the epoch.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();

    // Intent dropped (not left 'unknown' for reconcile).
    expect(SUT.__getIntentStoreForTest().size).toBe(0);
    // Caller settled 'unknown' — never a fabricated 'executed'.
    expect(st.settled).toBe(true);
    expect(st.value.didWork).toBe(false);
    expect(st.value.kind).toBe('unknown');

    // Foreground + new handshake: reconcile has nothing to false-match.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(300);
    const wv2 = makeWebviewCrypto();
    wv2.answerHandshake();
    await flush();
    await advance(200);
    expect(reconcileRan).toBe(false);

    // Identical resend is allowed immediately: it dispatches as a NEW payment,
    // never blocked by a stale 'unknown' intent.
    SUT.__setReconcileQueryForTest(null);
    await completeWalletInit(wv2);
    const st2 = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(st2.value?.kind).not.toBe('unknown');
    expect(wv2.lastEncryptedPayload('sendSparkPayment')).toBeTruthy();
  });

  test('last-resort deadline settles a keep-alive op that never resolves', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();

    // First watchdog window: no fabricated failure — resume-by-id re-posts
    // the same id.
    await advance(90001);
    expect(st.settled).toBe(false);
    const reposted = wv.lastEncryptedPayload('sendSparkPayment');
    expect(reposted.id).toBe(sent.id);

    // Even the re-post never answers → the bounded final deadline settles a
    // real {didWork:false, kind:'unknown'} so the promise can never zombie.
    await advance(30001);
    expect(st.settled).toBe(true);
    expect(st.rejected).toBe(false);
    expect(st.value.kind).toBe('unknown');
    expect(String(st.value.error)).toMatch(/unresponsive/);
    expect([...SUT.__getIntentStoreForTest().values()][0].state).toBe(
      'unknown',
    );
  });

  test('reset does not settle keep-alive callers; non-keep-alive still settles (no zombie)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const send = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    const balance = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(send.settled).toBe(false);
    expect(balance.settled).toBe(false);

    mockAuth.authResetkey = 1;
    rerender();
    await flush();

    // Non-keep-alive settles (today's behavior); the send stays live for
    // reconcile / the final deadline.
    expect(balance.settled).toBe(true);
    expect(balance.value.kind).toBe('unknown');
    expect(send.settled).toBe(false);
    expect([...SUT.__getIntentStoreForTest().values()][0].state).toBe(
      'unknown',
    );
  });

  test('in-flight request settles on auth reset (no zombie)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(st.settled).toBe(false);

    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');
  });

  test('uniform watchdog settles non-funds ops as timeout', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    await advance(30001); // medium op: 30s
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('timeout');
    expect(String(st.value.error)).toMatch(/unresponsive/);
    expect(sent.id).toBeTruthy();
  });

  test('offline requests settle immediately with kind offline (no queue)', async () => {
    await mountOnly();
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('offline');
    expect(mockTransport.send).not.toHaveBeenCalled();
  });

  test('hold-buffer overflow settles the newcomer as not-ready', async () => {
    await mountOnly();
    await advance(300);
    // Handshake never answers → 4s ready-window holds requests.
    for (let i = 0; i < 50; i++) {
      track(SUT.sendWebViewRequestGlobal('bulkAction', { i }));
    }
    await flush();

    const overflow = track(SUT.sendWebViewRequestGlobal('bulkAction', { i: 50 }));
    await flush();
    expect(overflow.settled).toBe(true);
    expect(overflow.value.kind).toBe('not-ready');
    expect(String(overflow.value.error)).toMatch(/queue full/i);
  });

  test('single-hash mnemonic invariant: held → drained replay hashes exactly once', async () => {
    const nodeCrypto = require('node:crypto');
    const hashOf = s =>
      nodeCrypto.createHash('sha256').update(s).digest().toString('hex');
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();

    // Request during the ready-window (pre-handshake) → held.
    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkTransactions', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(mockTransport.send).not.toHaveBeenCalled();

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const sent = wv.lastEncryptedPayload('getSparkTransactions');
    expect(sent).toBeTruthy();
    expect(sent.args.mnemonic).toBe(hashOf(MNEMONIC)); // outgoing hashed once

    wv.respond(sent.id, { transfers: [] });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ transfers: [] });
  });
});

describe('webViewContext — request-scoped errors (TDD §4)', () => {
  async function ready() {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);
    return wv;
  }

  test('id-bearing error settles that request only; unknown-id errors are dropped', async () => {
    const wv = await ready();

    const a = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    const b = track(SUT.sendWebViewRequestGlobal('getSparkAddress', {}, true));
    await flush();
    const aSent = wv.lastEncryptedPayload('getSparkBalance');
    const bSent = wv.lastEncryptedPayload('getSparkAddress');

    wv.postError(aSent.id, 'wallet not found');
    await flush();
    expect(a.settled).toBe(true);
    expect(a.rejected).toBe(false);
    expect(a.value).toEqual({
      didWork: false,
      error: 'wallet not found',
      kind: 'bridge',
    });
    expect(b.settled).toBe(false);

    // Late duplicate of the same id (already settled) is dropped.
    wv.postError(aSent.id, 'late duplicate');
    await flush();
    expect(b.settled).toBe(false);

    wv.respond(bSent.id, { ok: 1 });
    await flush();
    expect(b.settled).toBe(true);
    expect(b.value).toEqual({ ok: 1 });
  });

  test('id-less bundle error is dropped (D-3/D-12) — no teardown, watchdog settles', async () => {
    const wv = await ready();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    wv.postError(null, 'SECURITY: something exploded');
    await flush();
    expect(st.settled).toBe(false); // bridge survived
    expect(SUT.getHandshakeComplete()).toBe(true);

    // The watchdog still settles the request.
    await advance(30001);
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('timeout');
    expect(sent.id).toBeTruthy();
  });

  test('malformed push event is dropped without killing in-flight requests', async () => {
    const wv = await ready();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    const push = content =>
      postInbound({ encrypted: wv.encrypt(JSON.stringify(content)) });
    push({ balanceUpdate: true, result: 'not-json{' });
    push({ incomingPayment: true, result: 'not-json{' });
    push({ tokenBalanceUpdate: true, result: 'not-json{' });
    await flush();
    expect(st.settled).toBe(false);

    const seen = [];
    SUT.sparkBalanceUpdateEmitter.once(SUT.BALANCE_UPDATE_EVENT_NAME, d =>
      seen.push(d),
    );
    push({ balanceUpdate: true, result: JSON.stringify({ balance: 5 }) });
    await flush();
    expect(seen).toEqual([{ balance: 5 }]);

    wv.respond(sent.id, { ok: true });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ ok: true });
  });

  test('plaintext inbound is dropped post-handshake (no spoofable resolutions)', async () => {
    const wv = await ready();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    postInbound({
      isResponse: true,
      id: sent.id,
      result: JSON.stringify({ balance: 0 }),
    });
    await flush();
    expect(st.settled).toBe(false);

    postInbound({ error: 'spoofed failure' });
    await flush();
    expect(st.settled).toBe(false);

    wv.respond(sent.id, { balance: 42 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 42 });
  });

  test('rate-limit trip warns and drops — no force-native, watchdog settles (D-7)', async () => {
    const wv = await ready();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    // 51 non-push messages in one window.
    for (let i = 0; i < 51; i++) {
      postInbound({ isResponse: true, id: `bogus-${i}`, result: '{}' });
    }
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(st.settled).toBe(false);

    wv.respond(sent.id, { balance: 7 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 7 });
  });
});

describe('webViewContext — provider value stability (TDD §4)', () => {
  test('context consumers do not re-render on app-state/connectivity flaps', async () => {
    mockLocal.get = async () => null;
    await mountOnly();
    await advance(300);

    let renders = 0;
    function Consumer() {
      SUT.useWebView();
      renders++;
      return null;
    }
    const consumerEl = React.createElement(Consumer, null);
    const update = () => {
      act(() => {
        renderer.update(
          React.createElement(SUT.WebViewProvider, { transport: mockTransport }, consumerEl),
        );
      });
    };

    mockAppStatus.didGetToHomepage = false;
    update();
    await flush();
    const before = renders;

    mockAppStatus.isConnectedToTheInternet = false;
    update();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    update();
    await flush();

    expect(renders).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — 3-state fallback machine (D-9)
// ---------------------------------------------------------------------------
describe('webViewContext — fallback machine (D-9)', () => {
  test('handshake timeout → fallback-pending; foreground recovery re-handshakes and succeeds', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    await advance(300);

    // First handshake never answered → 4s watchdog → fallback-pending.
    await advance(4000);
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
    expect(SUT.getHandshakeComplete()).toBe(false);

    // Recovery on the next session start (background → foreground).
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    // The recovery path reloads (re-verifies) and re-handshakes; answer it.
    await advance(400);
    const wv = makeWebviewCrypto();
    const handshakePosted = lastPosted('handshake:init');
    expect(handshakePosted).toBeTruthy();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('two consecutive failures escalate to native (no persist for soft failures)', async () => {
    mockLocal.get = async () => null;
    await mountOnly();
    await advance(300);

    // Failure 1 → fallback-pending.
    await advance(4000);
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');

    // Recovery attempt fails again → native.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(400);
    await advance(4000);
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('native');

    // Soft failures do NOT persist the latch.
    const { setLocalStorageItem } = require('../../app/functions');
    expect(setLocalStorageItem).not.toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      '1.0.0-test',
    );

    // Native latch settles all requests with a bridge-kind error.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('bridge');
  });

  test('WASM error response → native + persisted (hard-fail class)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    wv.respond(sent.id, { error: 'WASM failed' });
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('native');
    const { setLocalStorageItem } = require('../../app/functions');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      '1.0.0-test',
    );
    expect(st.settled).toBe(true);
  });

  test('setForceReactNative(true) → native; (false) → webview recovery', async () => {
    await mountOnly();

    SUT.setForceReactNative(true, 'test');
    expect(SUT.getHandshakeComplete()).toBe(false);
    expect(SUT.__getFallbackStateForTest()).toBe('native');

    SUT.setForceReactNative(false, 'test');
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('persisted FORCE_REACT_NATIVE flag skips handshake entirely', async () => {
    mockLocal.get = async () => '1.0.0-test'; // same-version stamp (S-5)
    await mountOnly();
    await advance(400);

    expect(mockTransport.send).not.toHaveBeenCalled();
    expect(SUT.__getFallbackStateForTest()).toBe('native');
    expect(SUT.getHandshakeComplete()).toBe(false);
  });
});

describe('webViewContext — CSP violation (security core)', () => {
  test('CSP violation → native + persisted, no handshake retry loop', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    postInbound({
      encrypted: wv.encrypt(
        JSON.stringify({ type: 'security:csp-violation', directive: 'script-src' }),
      ),
    });
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('native');
    const { setLocalStorageItem } = require('../../app/functions');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      '1.0.0-test',
    );
  });
});

// ---------------------------------------------------------------------------
// Provider contract (E1) — useWebView().sendWebViewRequest is the API 30+
// consumers destructure. It must be a real dispatcher (routes exactly like
// sendWebViewRequestGlobal), not undefined.
// ---------------------------------------------------------------------------
describe('webViewContext — useWebView() dispatch contract (E1)', () => {
  test('useWebView().sendWebViewRequest is exposed and dispatches encrypted like the global', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();

    let ctx;
    act(() => {
      renderer.update(
        React.createElement(
          SUT.WebViewProvider,
          { transport: mockTransport },
          React.createElement(function Probe() {
            ctx = SUT.useWebView();
            return null;
          }),
        ),
      );
    });
    await flush();

    // The contract itself: it exists and is callable.
    expect(typeof ctx.sendWebViewRequest).toBe('function');

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    // A request dispatched through the context value posts encrypted and
    // resolves its response — identical to the global path.
    const st = track(ctx.sendWebViewRequest('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv.respond(sent.id, { balance: 88 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 88 });
  });
});

// ---------------------------------------------------------------------------
// Funds-op error response → unknown (§4.2 last row). The id-bearing-error tests
// only exercise non-funds ops (intentState null). A funds op must land 'unknown'
// so the retry is guarded, never re-dispatched.
// ---------------------------------------------------------------------------
describe('webViewContext — funds-op error response settles unknown (§4.2)', () => {
  async function fundsReady() {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);
    return wv;
  }

  test('id-bearing error on a funds op → intent unknown; identical retry dispatches as a NEW payment (guard contract)', async () => {
    const wv = await fundsReady();

    const first = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(sent).toBeTruthy();

    // The bundle reports a request-scoped error (not a timeout).
    wv.postError(sent.id, 'network blip mid-send');
    await flush();
    expect(first.settled).toBe(true);
    expect(first.value).toEqual({
      didWork: false,
      error: 'network blip mid-send',
      kind: 'bridge',
    });

    // The intent is retained as unknown (reconcile may still confirm it).
    const store = SUT.__getIntentStoreForTest();
    expect(store.size).toBe(1);
    expect([...store.values()][0].state).toBe('unknown');

    // Identical retry: per the guard contract this is a NEW payment — it
    // dispatches immediately and the caller waits on the fresh attempt.
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(retry.settled).toBe(false);
    expect(postedCount(wv, 'sendSparkPayment')).toBe(2);
    const retrySent = wv.lastEncryptedPayload('sendSparkPayment');
    expect(retrySent.id).not.toBe(sent.id);
  });
});

// ---------------------------------------------------------------------------
// Handshake reply with an unknown id must not complete the handshake (§2.3) —
// a stale/spoofed reply cannot flip the bridge to READY.
// ---------------------------------------------------------------------------
describe('webViewContext — handshake reply with unknown id is dropped (§2.3)', () => {
  test('a reply whose id is not pending is ignored; the real reply still completes', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();

    // A reply carrying a bogus id (no matching pending entry) — dropped.
    postInbound({
      type: 'handshake:reply',
      id: 'not-a-real-id',
      pubW: '02' + '00'.repeat(32),
      runtimeNonce: 'whatever',
    });
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(false);

    // The genuine reply (correct id + real ECDH) still completes the handshake.
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tokenBalanceUpdate push success path (§4.6 / §10 #11) — only the malformed
// case is covered elsewhere; the success emit contract (tokensObject, walletId)
// was untested.
// ---------------------------------------------------------------------------
describe('webViewContext — tokenBalanceUpdate push success (§4.6)', () => {
  test('a valid tokenBalanceUpdate emits tokensObject + walletId', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountOnly();
    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const seen = [];
    SUT.sparkTokenBalanceUpdateEmitter.once(
      SUT.TOKEN_BALANCE_UPDATE_EVENT_NAME,
      (tokens, walletId) => seen.push([tokens, walletId]),
    );
    postInbound({
      encrypted: wv.encrypt(
        JSON.stringify({
          tokenBalanceUpdate: true,
          walletId: 'w1',
          result: JSON.stringify({ tokensObject: { tokA: '500' } }),
        }),
      ),
    });
    await flush();
    expect(seen).toEqual([[{ tokA: '500' }, 'w1']]);
    // Push traffic never disturbs the bridge.
    expect(SUT.getHandshakeComplete()).toBe(true);
  });
});
