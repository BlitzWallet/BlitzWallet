/* eslint-env jest */
// ---------------------------------------------------------------------------
// First test harness for context-store/webViewContext.js (P0 Fix 1 — zombie
// request hangs). The provider's interesting logic lives in refs/useCallbacks
// (invisible to renders), so we render the provider, walk the WebView state
// machine to LOADED, drive app-state / connectivity transitions, and assert that
// every in-flight request promise SETTLES and its pendingRequests id is removed —
// i.e. no request is left hanging forever.
//
// Observability: pendingRequests is a component ref, so the SUT exposes a
// read-only test seam __getPendingRequestIdsForTest (mirrors the existing
// setForceReactNative / getHandshakeComplete module exports).
//
// Module-level state (forceReactNativeUse / handshakeComplete / webviewFailureCount)
// persists in the module, so each test does jest.resetModules() + a fresh require
// (React / react-test-renderer / SUT together, so there is a single React copy).
// ---------------------------------------------------------------------------

// Controllable mock state — lives in this test module, survives resetModules.
const mockAppStatus = {
  appState: 'active',
  isConnectedToTheInternet: true,
  didGetToHomepage: true,
};
const mockActive = { currentWalletMnemoinc: null };
const mockAuth = { authResetkey: 0 };
// Default: never resolve, so the handshake effect stalls before sending
// handshake:init. That keeps handshakeComplete false and isolates the
// pre-handshake request lifecycle under test. Case 4 overrides this to resolve
// null so a real handshake:init actually goes in flight.
const mockLocal = { get: () => new Promise(() => {}) };
const mockWv = { props: null, onMessage: null, postMessage: null };

jest.mock('react-native-webview', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props, ref) => {
      mockWv.props = props;
      mockWv.onMessage = props.onMessage;
      R.useImperativeHandle(ref, () => ({
        postMessage: (...a) => mockWv.postMessage(...a),
      }));
      return null;
    }),
  };
});

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
  verifyAndPrepareWebView: jest.fn(async () => ({
    htmlPath: 'file:///verified.html',
    nonceHex: 'abcdef',
    hashHex: 'h',
  })),
}));

jest.mock('../../navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: { getRootState: () => ({ routes: [{ name: 'Home' }] }) },
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {},
  getModel: () => 'TestModel',
  getSystemVersion: () => '17.0',
}));

jest.mock('../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: (...a) => mockLocal.get(...a),
  setLocalStorageItem: jest.fn(async () => {}),
}));

// spark-web-context resolves to dist/index.html (an asset). It is require()'d on
// the iOS path; verifyAndPrepareWebView is mocked so the value is irrelevant —
// this just keeps the require from choking on HTML.
jest.mock('spark-web-context', () => 'file:///spark.html');

let React;
let RTR;
let act;
let AppState;
let SUT;
let renderer;

function providerEl() {
  return React.createElement(SUT.WebViewProvider, null, null);
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

  await act(async () => {
    renderer = RTR.create(providerEl());
  });
  await flush();
  await flush();
}

async function mountAndReady() {
  await mountOnly();
  // Walk the state machine UNLOADED -> LOADING -> LOADED (sets isWebViewReady).
  act(() => {
    mockWv.props.onLoadStart();
  });
  act(() => {
    mockWv.props.onLoadProgress({ nativeEvent: { progress: 1 } });
  });
  await flush();
}

function rerender() {
  act(() => {
    renderer.update(providerEl());
  });
}

function driveToLoaded() {
  act(() => {
    mockWv.props.onLoadStart();
  });
  act(() => {
    mockWv.props.onLoadProgress({ nativeEvent: { progress: 1 } });
  });
}

function postedId(action) {
  const calls = mockWv.postMessage.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const p = JSON.parse(calls[i][0]);
    if (p.action === action) return p.id;
  }
  return null;
}

// "WebView side" of the bridge: answers handshake:init with a real ECDH reply
// (same HKDF/AES-GCM scheme as the SUT) so post-handshake flows — encrypted
// sends, wallet init, queue drains — can be exercised end to end.
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
    answerHandshake() {
      const payloadId = postedId('handshake:init');
      const calls = mockWv.postMessage.mock.calls;
      let payload = null;
      for (let i = calls.length - 1; i >= 0; i--) {
        const p = JSON.parse(calls[i][0]);
        if (p.action === 'handshake:init' && p.id === payloadId) {
          payload = p;
          break;
        }
      }
      const privW = nodeCrypto.randomBytes(32);
      const pubW = secp.getPublicKey(privW, true);
      const shared = secp.getSharedSecret(
        privW,
        Buffer.from(payload.args.pubN, 'hex'),
        true,
      );
      const sharedX = shared.slice(1, 33);
      // Must mirror deriveAesKeyFromSharedX: info = 'ecdh-aes-key:' + nonceHex,
      // where nonceHex comes from the mocked verifyAndPrepareWebView ('abcdef').
      this.aesKey = Buffer.from(
        hkdf(
          sha256,
          sharedX,
          new Uint8Array(0),
          new TextEncoder().encode('ecdh-aes-key:abcdef'),
          32,
        ),
      );
      act(() => {
        mockWv.onMessage({
          nativeEvent: {
            data: JSON.stringify({
              type: 'handshake:reply',
              id: payload.id,
              pubW: Buffer.from(pubW).toString('hex'),
              runtimeNonce: this.encrypt('abcdef'),
            }),
          },
        });
      });
    },
    // Newest-first search through posted secure:msg payloads; messages from a
    // previous session key fail to decrypt and are skipped.
    lastEncryptedPayload(action) {
      const calls = mockWv.postMessage.mock.calls;
      for (let i = calls.length - 1; i >= 0; i--) {
        const p = JSON.parse(calls[i][0]);
        if (p.type !== 'secure:msg') continue;
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
      act(() => {
        mockWv.onMessage({
          nativeEvent: {
            data: JSON.stringify({
              encrypted: this.encrypt(JSON.stringify(content)),
            }),
          },
        });
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

beforeEach(() => {
  jest.useFakeTimers();
  mockAppStatus.appState = 'active';
  mockAppStatus.isConnectedToTheInternet = true;
  mockAppStatus.didGetToHomepage = true;
  mockActive.currentWalletMnemoinc = null;
  mockAuth.authResetkey = 0;
  mockLocal.get = () => new Promise(() => {});
  mockWv.props = null;
  mockWv.onMessage = null;
  mockWv.postMessage = jest.fn();
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

describe('webViewContext — zombie request hangs (P0 Fix 1)', () => {
  test('case 1: request in flight settles when connectivity is lost while active', async () => {
    await mountAndReady();

    const st = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    await flush();
    const id = postedId('testPing');
    expect(id).toBeTruthy();
    expect(SUT.__getPendingRequestIdsForTest()).toContain(id);

    // Connectivity lost while the app stays active -> app-state effect fires with
    // isConnectedToTheInternet false and returns early. The request must not hang.
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    expect(st.settled).toBe(false); // re-armed, still in flight

    // Re-armed timer fires while active -> the request settles.
    await advance(10001);
    expect(st.settled).toBe(true);
    expect(SUT.__getPendingRequestIdsForTest()).not.toContain(id);
  });

  test('case 2: orphaned request (bookkeeping wiped on background) is swept on foreground', async () => {
    await mountAndReady();

    // didGetToHomepage false so the foreground effect does NOT take the
    // blockAndResetWebview branch (which would clear pending itself) — this
    // isolates the orphan sweep as the only thing that can settle the request.
    mockAppStatus.didGetToHomepage = false;
    rerender();
    await flush();

    const st = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    await flush();
    const id = postedId('testPing');
    expect(SUT.__getPendingRequestIdsForTest()).toContain(id);

    // Background wipes activeTimeoutsRef but leaves pendingRequests -> orphan.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    expect(st.settled).toBe(false);

    // Foreground -> rearmOrSweep sweeps the orphan (no bookkeeping) synchronously.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    expect(st.settled).toBe(true);
    expect(st.rejected).toBe(false);
    expect(st.value).toEqual({
      error: 'Request interrupted by app state change',
    });
    expect(SUT.__getPendingRequestIdsForTest()).not.toContain(id);
  });

  test('case 3: timeout firing while inactive is re-armed and settles when active', async () => {
    await mountAndReady();

    const st = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    await flush();
    const id = postedId('testPing');
    expect(SUT.__getPendingRequestIdsForTest()).toContain(id);

    // Timer fires while app is inactive -> handleTimeout must re-arm, not die.
    AppState.currentState = 'inactive';
    await advance(10001);
    expect(st.settled).toBe(false);
    expect(SUT.__getPendingRequestIdsForTest()).toContain(id);

    // Re-armed timer fires while active -> request settles.
    AppState.currentState = 'active';
    await advance(10001);
    expect(st.settled).toBe(true);
    expect(SUT.__getPendingRequestIdsForTest()).not.toContain(id);
  });

  test('case 4: resetWebViewState(shouldClearPending=false) sweeps a leftover handshake:init', async () => {
    // Let the handshake actually send handshake:init so a non-requeueable leftover
    // (handshake:init is excluded from the re-queue loop) exists when
    // resetWebViewState runs with shouldClearPending=false.
    mockLocal.get = async () => null;
    await mountAndReady();

    // Auth reset -> blockAndResetWebview() -> resetWebViewState sets isResetting=true
    // (only processQueuedRequests clears it, which never runs here).
    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    // The reset re-verifies + remounts the WebView; walk it back to LOADED.
    driveToLoaded();
    await flush();

    // Fire the handshake debounce -> handshake:init goes in flight (never answered).
    await advance(300);
    const hid = postedId('handshake:init');
    expect(hid).toBeTruthy();
    expect(SUT.__getPendingRequestIdsForTest()).toContain(hid);

    // Drop then restore connectivity while isResetting is still true. The restore
    // path takes blockAndResetWebview(false) -> resetWebViewState(false), whose
    // leftover sweep (part D) must settle the handshake:init entry.
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();

    expect(SUT.__getPendingRequestIdsForTest()).not.toContain(hid);
    // Sweeping a handshake:init RESOLVES its await with {error} (no throw), so
    // initHandshake's catch (forceNativeMode) never ran.
    expect(SUT.getHandshakeComplete()).toBe(false);
  });

  test('case 5: duplicate interrupted request settles instead of being silently dropped', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = 'test mnemonic words';
    await mountAndReady();
    const wv = makeWebviewCrypto();

    // Complete the handshake, then the automatic wallet re-init that the
    // post-handshake queue drain performs (mnemonic is set).
    await advance(300);
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg).toBeTruthy();
    wv.respond(initMsg.id, { isConnected: true });
    await flush();

    // Two identical requests in flight (pending duplicates are allowed — only
    // the queue is deduped).
    const a = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    const b = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(SUT.__getPendingRequestIdsForTest()).toHaveLength(2);

    // Connectivity restored while nonceVerified -> blockAndResetWebview(false)
    // -> re-queue loop. First request is re-queued; the second is a queue
    // duplicate and must coalesce onto the same entry — never be silently
    // deleted (the original zombie) nor failed.
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();

    expect(a.settled).toBe(false); // re-queued, still alive
    expect(b.settled).toBe(false); // coalesced, still alive
    expect(SUT.__getPendingRequestIdsForTest()).toHaveLength(0);

    // Drive the reload through handshake #2 + wallet re-init so the re-queued
    // request drains and settles BOTH callers — nothing may be left hanging.
    driveToLoaded();
    await flush();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    const initMsg2 = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg2).toBeTruthy();
    wv.respond(initMsg2.id, { isConnected: true });
    await flush();
    const drained = wv.lastEncryptedPayload('getSparkBalance');
    expect(drained).toBeTruthy();
    wv.respond(drained.id, { balance: 21 });
    await flush();
    expect(a.settled).toBe(true);
    expect(a.value).toEqual({ balance: 21 });
    expect(b.settled).toBe(true);
    expect(b.value).toEqual({ balance: 21 });
  });
});

describe('webViewContext — queue coalescing, cap and TTL (P1 Fixes 8+9)', () => {
  test('fix 8: duplicate queued request coalesces — one message, both callers resolve', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = 'test mnemonic words';
    await mountAndReady();
    const wv = makeWebviewCrypto();

    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg).toBeTruthy();

    // Wallet init still in flight -> both take the "initialization in
    // progress" queue path; the second must coalesce, not reject.
    const a = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    const b = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(a.settled).toBe(false);
    expect(b.settled).toBe(false);

    wv.respond(initMsg.id, { isConnected: true });
    await flush();

    // Exactly one message drained for the coalesced pair.
    const sent = mockWv.postMessage.mock.calls
      .map(c => JSON.parse(c[0]))
      .filter(p => p.type === 'secure:msg')
      .map(p => JSON.parse(wv.decrypt(p.encrypted)))
      .filter(p => p.action === 'getSparkBalance');
    expect(sent).toHaveLength(1);

    wv.respond(sent[0].id, { balance: 7 });
    await flush();
    expect(a.value).toEqual({ balance: 7 });
    expect(b.value).toEqual({ balance: 7 });
  });

  test('fix 9: queue cap rejects overflow instead of growing unbounded', async () => {
    // WebView never becomes ready -> every request takes the not-ready queue
    // path. Distinct args defeat dedupe so the queue actually fills.
    await mountOnly();

    const tracked = [];
    for (let i = 0; i < 50; i++) {
      tracked.push(track(SUT.sendWebViewRequestGlobal('bulkAction', { i })));
    }
    await flush();
    expect(tracked.some(t => t.settled)).toBe(false);

    const overflow = track(
      SUT.sendWebViewRequestGlobal('bulkAction', { i: 50 }),
    );
    await flush();
    expect(overflow.settled).toBe(true);
    expect(overflow.rejected).toBe(true);
    expect(String(overflow.value.message || overflow.value)).toMatch(
      /queue full/i,
    );
  });

  test('fix 9: queued requests expire after the TTL instead of waiting forever', async () => {
    await mountOnly();

    const stale = track(SUT.sendWebViewRequestGlobal('staleAction', { i: 1 }));
    await flush();
    expect(stale.settled).toBe(false);

    // Past the TTL, the next queue interaction evicts the stale entry.
    await advance(5 * 60 * 1000 + 1);
    const fresh = track(SUT.sendWebViewRequestGlobal('freshAction', { i: 2 }));
    await flush();

    expect(stale.settled).toBe(true);
    expect(stale.rejected).toBe(false);
    expect(stale.value).toEqual({ error: 'Request expired while queued' });
    expect(fresh.settled).toBe(false); // newly queued, still alive
  });
});

describe('webViewContext — single-hash mnemonic invariant (P0 Fix 2)', () => {
  const nodeCrypto = require('node:crypto');
  const hashOf = s =>
    nodeCrypto.createHash('sha256').update(s).digest().toString('hex');
  const MNEMONIC = 'test mnemonic words';

  async function handshakeAndInitWallet(wv) {
    await advance(300);
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg).toBeTruthy();
    wv.respond(initMsg.id, { isConnected: true });
    await flush();
    return initMsg;
  }

  test('re-queued interrupted request replays with a single-hashed mnemonic', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountAndReady();
    const wv = makeWebviewCrypto();
    await handshakeAndInitWallet(wv);

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkTransactions', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkTransactions');
    expect(sent.args.mnemonic).toBe(hashOf(MNEMONIC)); // outgoing is hashed once

    // Interrupt -> connectivity restore path re-queues via originalRequest, the
    // reload's queue drain replays it through sendWebViewRequestInternal.
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();
    driveToLoaded();
    await flush();
    await handshakeAndInitWallet(wv);

    const replayed = wv.lastEncryptedPayload('getSparkTransactions');
    expect(replayed).toBeTruthy();
    // Pre-fix: originalRequest holds the SAME mutated args object, so the replay
    // hashes the already-hashed value -> hashOf(hashOf(MNEMONIC)).
    expect(replayed.args.mnemonic).toBe(hashOf(MNEMONIC));

    wv.respond(replayed.id, { transfers: [] });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ transfers: [] });
  });

  test('request queued during wallet init drains with a single-hashed mnemonic', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountAndReady();
    const wv = makeWebviewCrypto();

    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg).toBeTruthy();

    // Wallet init still in flight -> this request takes the
    // "initialization in progress" queue path.
    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkTransactions', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(wv.lastEncryptedPayload('getSparkTransactions')).toBeNull();

    wv.respond(initMsg.id, { isConnected: true });
    await flush();

    const drained = wv.lastEncryptedPayload('getSparkTransactions');
    expect(drained).toBeTruthy();
    // Pre-fix: args were hashed in place BEFORE this queue push, so the drain
    // replay hashes them again.
    expect(drained.args.mnemonic).toBe(hashOf(MNEMONIC));

    wv.respond(drained.id, { transfers: [] });
    await flush();
    expect(st.settled).toBe(true);
  });
});

describe('webViewContext — per-message errors must not tear down the bridge (P0 Fix 3)', () => {
  function post(content) {
    act(() => {
      mockWv.onMessage({ nativeEvent: { data: JSON.stringify(content) } });
    });
  }

  test('content.error with a matching id settles that request only', async () => {
    await mountAndReady();

    const a = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    const b = track(SUT.sendWebViewRequestGlobal('otherAction', {}, false));
    await flush();
    const aId = postedId('testPing');
    const bId = postedId('otherAction');

    post({ error: 'wallet not found', id: aId });
    await flush();

    expect(a.settled).toBe(true);
    expect(a.rejected).toBe(false);
    expect(a.value).toEqual({ error: 'wallet not found' });
    // Pre-fix the throw reaches resetWebViewState(true, true), which wipes b too.
    expect(b.settled).toBe(false);

    // A stale error (id already settled) is dropped, not thrown — a late error
    // after a timeout must not kill the bridge either.
    post({ error: 'late duplicate', id: aId });
    await flush();
    expect(b.settled).toBe(false);

    post({ isResponse: true, id: bId, result: JSON.stringify({ ok: 1 }) });
    await flush();
    expect(b.settled).toBe(true);
    expect(b.value).toEqual({ ok: 1 });
  });

  test('stale-message security error is dropped without teardown', async () => {
    await mountAndReady();

    const st = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    await flush();
    const id = postedId('testPing');

    // The webview reports late-delivered messages as an id-less error with this
    // prefix (routine after backgrounding). The outer-catch whitelist must match
    // the REAL message shape — teardown here would burn a failure strike on a
    // normal lifecycle event.
    post({ error: 'SECURITY: Rejected stale message: 5000ms old' });
    await flush();
    expect(st.settled).toBe(false); // bridge survived

    post({ isResponse: true, id, result: JSON.stringify({ ok: true }) });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ ok: true });
  });

  test('id-less non-whitelisted error keeps the existing teardown path', async () => {
    await mountAndReady();

    const st = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    await flush();

    post({ error: 'something exploded' });
    await flush();

    // Teardown swept the in-flight request — existing reset behavior preserved.
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({
      error: 'Unable to finish action, request got cleaned up.',
    });
  });

  test('malformed push event is dropped without killing in-flight requests', async () => {
    await mountAndReady();

    const st = track(SUT.sendWebViewRequestGlobal('testPing', {}, false));
    await flush();
    const id = postedId('testPing');

    // One malformed event per push type; each parse failure must be contained.
    post({ balanceUpdate: true, result: 'not-json{' });
    post({ incomingPayment: true, result: 'not-json{' });
    post({ tokenBalanceUpdate: true, result: 'not-json{' });
    await flush();

    expect(st.settled).toBe(false); // bridge survived, request still in flight

    // A valid event after the malformed ones still reaches its emitter.
    const seen = [];
    SUT.sparkBalanceUpdateEmitter.once(SUT.BALANCE_UPDATE_EVENT_NAME, d =>
      seen.push(d),
    );
    post({ balanceUpdate: true, result: JSON.stringify({ balance: 5 }) });
    await flush();
    expect(seen).toEqual([{ balance: 5 }]);

    post({ isResponse: true, id, result: JSON.stringify({ ok: true }) });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ ok: true });
  });
});

describe('webViewContext — encryption hardening (P1 Fixes 4+5)', () => {
  function post(content) {
    act(() => {
      mockWv.onMessage({ nativeEvent: { data: JSON.stringify(content) } });
    });
  }

  test('fix 4: send with encrypt requested but no AES key rejects instead of posting plaintext', async () => {
    await mountAndReady();

    // Pre-handshake there is no AES key; encrypt=true must fail closed rather
    // than silently downgrade the payload to plaintext.
    const st = track(SUT.sendWebViewRequestGlobal('leakyAction', {}, true));
    await flush();

    expect(st.settled).toBe(true);
    expect(st.rejected).toBe(true);
    expect(String(st.value.message || st.value)).toMatch(/Encryption required/);
    expect(postedId('leakyAction')).toBeNull(); // nothing left the device
    expect(SUT.__getPendingRequestIdsForTest()).toHaveLength(0);
  });

  test('fix 5: plaintext inbound is dropped post-handshake (no spoofable resolutions)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = 'test mnemonic words';
    await mountAndReady();
    const wv = makeWebviewCrypto();

    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    wv.respond(initMsg.id, { isConnected: true });
    await flush();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    // A plaintext (unauthenticated) response for a real pending id must be
    // ignored — accepting it would bypass GCM authentication entirely.
    post({
      isResponse: true,
      id: sent.id,
      result: JSON.stringify({ balance: 0 }),
    });
    await flush();
    expect(st.settled).toBe(false);

    // Plaintext id-less error post-handshake is dropped too (no teardown).
    post({ error: 'spoofed failure' });
    await flush();
    expect(st.settled).toBe(false);

    // The authenticated response still lands.
    wv.respond(sent.id, { balance: 42 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 42 });
  });
});

describe('webViewContext — provider value stability (P1 Fix 7)', () => {
  test('context consumers do not re-render on app-state/connectivity flaps', async () => {
    await mountAndReady();

    let renders = 0;
    function Consumer() {
      SUT.useWebView();
      renders++;
      return null;
    }
    // The child element must be referentially stable across provider re-renders
    // (as `children` is in the real app): then React only re-renders it when the
    // context VALUE changes.
    const consumerEl = React.createElement(Consumer, null);
    const update = () => {
      act(() => {
        renderer.update(
          React.createElement(SUT.WebViewProvider, null, consumerEl),
        );
      });
    };
    // didGetToHomepage=false keeps the connectivity-restore path from calling
    // blockAndResetWebview, whose changeSparkConnectionState bump is a
    // legitimate (contractual) consumer re-render. The flaps below must then
    // cause zero re-renders.
    mockAppStatus.didGetToHomepage = false;
    update();
    await flush();
    const before = renders;

    // Connectivity flaps: sendWebViewRequestInternal must not list these as
    // deps, so providerValues (and every consumer) stays untouched.
    mockAppStatus.isConnectedToTheInternet = false;
    update();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    update();
    await flush();

    expect(renders).toBe(before);
  });
});

describe('webViewContext — TTL enforced at drain time (review finding)', () => {
  test('a stale queued request is settled with an expiry error, never executed', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = 'test mnemonic words';
    await mountAndReady();
    const wv = makeWebviewCrypto();

    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    wv.respond(initMsg.id, { isConnected: true });
    await flush();

    // Queue a request via the offline path…
    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    const st = track(
      SUT.sendWebViewRequestGlobal('staleQueuedAction', { i: 1 }),
    );
    await flush();
    expect(st.settled).toBe(false);

    // …let it expire with NO intervening queue pushes…
    await advance(5 * 60 * 1000 + 1);

    // …then restore connectivity and drive the reload/handshake so the queue
    // drains. The drain must EVICT the stale entry, not execute it — a stale
    // send (e.g. a payment) must never fire minutes later.
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();
    driveToLoaded();
    await flush();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);

    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ error: 'Request expired while queued' });
    expect(wv.lastEncryptedPayload('staleQueuedAction')).toBeNull();
    expect(postedId('staleQueuedAction')).toBeNull();
  });
});
