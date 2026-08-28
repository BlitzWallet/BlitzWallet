/* eslint-env jest */
// ---------------------------------------------------------------------------
// Adversarial review test suite (2026-08): covers the crash/lifecycle/load
// axis, rate limiter, intent-store hazards and fallback-machine edges that the
// TDD suite (webViewContext.test.js) left untested. Maps 1:1 to the findings
// in the adversarial review (N1–N13, D1–D4, E2/E3) — see the test names.
//
// Two harnesses live here:
//  - TRANSPORT mode: provider rendered with the injected {send,onMessage}
//    transport (same seam as the TDD suite) — used for handshake/intent/
//    reconcile/app-state tests.
//  - WEBVIEW-PROPS mode: provider rendered WITHOUT a transport so the real
//    <WebView> mounts; the react-native-webview mock captures the rendered
//    props and postMessage output so tests drive onLoadStart/onLoadEnd/
//    onMessage/onContentProcessDidTerminate/onRenderProcessGone directly.
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
const mockNav = { routes: ['Home'] };
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

// Captures the <WebView> props + postMessage output in WEBVIEW-PROPS mode.
const mockWebview = {
  props: null,
  posted: [],
};

// customUUID seam: sequential ids by default; `mockUuidState.fail` reproduces
// the fails-open-to-false path (N12).
const mockUuidState = { counter: 0, fail: false };

jest.mock('react-native-webview', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props, ref) => {
      R.useImperativeHandle(ref, () => ({
        postMessage: data => {
          mockWebview.posted.push(data);
        },
      }));
      mockWebview.props = props;
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
    getRootState: () => ({ routes: mockNav.routes }),
    addListener: jest.fn(() => () => {}),
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

jest.mock('../../app/functions/customUUID', () => ({
  __esModule: true,
  default: () => {
    if (mockUuidState.fail) return false;
    mockUuidState.counter += 1;
    return `uuid-${mockUuidState.counter}`;
  },
}));

let React;
let RTR;
let act;
let AppState;
let SUT;
let renderer;
let mode; // 'transport' | 'webview'

function providerEl(children = null) {
  return React.createElement(
    SUT.WebViewProvider,
    { transport: mockTransport },
    children,
  );
}

function webviewEl(children = null) {
  return React.createElement(SUT.WebViewProvider, null, children);
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

async function mountTransport(children = null) {
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
    renderer = RTR.create(providerEl(children));
  });
  await flush();
  await flush();
}

async function mountWebview(children = null) {
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
    renderer = RTR.create(webviewEl(children));
  });
  await flush();
  await flush();
}

function rerender(children = null) {
  act(() => {
    renderer.update(
      mode === 'transport' ? providerEl(children) : webviewEl(children),
    );
  });
}

// -- outbound helpers (mode-aware) ------------------------------------------
function outbound() {
  if (mode === 'transport') {
    return mockTransport.send.mock.calls.map(c => c[0]);
  }
  return mockWebview.posted;
}

function lastPosted(action) {
  const calls = outbound();
  for (let i = calls.length - 1; i >= 0; i--) {
    const p = JSON.parse(calls[i]);
    if (!action || p.action === action) return p;
  }
  return null;
}

function postedCount(action, wv) {
  let count = 0;
  for (const raw of outbound()) {
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

// -- inbound helpers (mode-aware) -------------------------------------------
function postInbound(content) {
  if (mode === 'transport') {
    act(() => {
      mockTransport.onMessageHandler({
        nativeEvent: { data: JSON.stringify(content) },
      });
    });
    return;
  }
  act(() => {
    mockWebview.props.onMessage({
      nativeEvent: { data: JSON.stringify(content) },
    });
  });
}

// WebView load-callback drivers (WEBVIEW-PROPS mode only).
function wvLoadStart() {
  act(() => {
    mockWebview.props.onLoadStart();
  });
}
function wvLoadEnd() {
  act(() => {
    mockWebview.props.onLoadEnd();
  });
}
function wvProgress() {
  act(() => {
    mockWebview.props.onLoadProgress({ nativeEvent: { progress: 1 } });
  });
}
function wvTerminate(renderGone = false) {
  act(() => {
    if (renderGone) {
      mockWebview.props.onRenderProcessGone({
        nativeEvent: { didCrash: true },
      });
    } else {
      mockWebview.props.onContentProcessDidTerminate();
    }
  });
}

// -- transport-mode handshake helpers ---------------------------------------
async function transportReadyFull() {
  mockLocal.get = async () => null;
  mockActive.currentWalletMnemoinc = MNEMONIC;
  await mountTransport();
  await advance(300);
  const wv = makeWebviewCrypto();
  wv.answerHandshake();
  await flush();
  await completeWalletInit(wv);
  return wv;
}

// -- webview-props-mode handshake helpers -----------------------------------
async function webviewReadyFull() {
  mockLocal.get = async () => null;
  mockActive.currentWalletMnemoinc = MNEMONIC;
  await mountWebview();
  wvLoadStart();
  wvLoadEnd();
  const wv = makeWebviewCrypto();
  await advance(300);
  wv.answerHandshake();
  await flush();
  await completeWalletInit(wv);
  return wv;
}

async function completeWalletInit(wv) {
  await advance(150);
  const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
  expect(initMsg).toBeTruthy();
  wv.respond(initMsg.id, { isConnected: true });
  await flush();
  await advance(200);
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
      const calls = outbound();
      for (let i = calls.length - 1; i >= 0; i--) {
        const p = JSON.parse(calls[i]);
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

const MNEMONIC = 'test mnemonic words';

beforeEach(() => {
  jest.useFakeTimers();
  mockAppStatus.appState = 'active';
  mockAppStatus.isConnectedToTheInternet = true;
  mockAppStatus.didGetToHomepage = true;
  mockActive.currentWalletMnemoinc = null;
  mockAuth.authResetkey = 0;
  mockNav.routes = ['Home'];
  mockLocal.get = () => new Promise(() => {});
  mockVerify.mockImplementation(async () => ({
    htmlPath: 'file:///verified.html',
    nonceHex: 'abcdef',
    hashHex: 'h',
  }));
  mockUuidState.counter = 0;
  mockUuidState.fail = false;
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
// N1 — FORCE_REACT_NATIVE persists within an app version (S-5): once a
// hard-fail class (WASM/CSP/verification) latches native, no in-session path
// — auth reset, bg/fg cycle, or new handshake — recovers the bridge. The latch
// is version-stamped, so an app UPDATE retries the bridge (a still-broken
// bundle re-persists on re-verification).
// ---------------------------------------------------------------------------
describe('adversarial — hard-fail persistence across sessions (N1)', () => {
  test('WASM hard-fail survives auth reset AND bg/fg: bridge stays native, only setForceReactNative(false) recovers', async () => {
    const wv = await transportReadyFull();

    // WASM failure → native + persisted.
    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    wv.respond(sent.id, { error: 'WebAssembly.Compile is disallowed' });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('native');

    // Auth reset: the PENDING-recovery block is skipped for NATIVE and
    // reloadWebViewSecurely early-returns on the native latch.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('native');
    expect(postedCount('handshake:init', wv)).toBe(1); // no re-handshake

    // bg/fg cycle: the app-state effect early-returns on NATIVE.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('native');
    expect(postedCount('handshake:init', wv)).toBe(1);

    // Requests settle via the native latch, never route to the webview.
    const after = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(after.settled).toBe(true);
    expect(after.value.kind).toBe('bridge');
    expect(SUT.getHandshakeComplete()).toBe(false);

    // In-session recovery is an explicit setForceReactNative(false); across
    // launches the version stamp is the recovery boundary (S-5).
    SUT.setForceReactNative(false, 'test');
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('reload-time verification failure (crash → re-verify → reject) persists native + emits connection state', async () => {
    const wv = await webviewReadyFull();
    const verifyCallsBefore = mockVerify.mock.calls.length;

    // Crash while active → blockAndResetWebview → re-verification fails with a
    // TAMPER error (signature invalid) → persists the kill-switch (S-5).
    mockVerify.mockRejectedValueOnce(
      Object.assign(new Error('signature invalid'), { isTamper: true }),
    );
    wvTerminate(true);
    await flush();

    expect(mockVerify.mock.calls.length).toBe(verifyCallsBefore + 1);
    expect(SUT.__getFallbackStateForTest()).toBe('native');
    const { setLocalStorageItem } = require('../../app/functions');
    // S-5: the kill-switch is stamped with the app version, not a bare boolean.
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      '1.0.0-test',
    );
    expect(SUT.getHandshakeComplete()).toBe(false);

    // Any request now settles via the native latch.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('bridge');
  });
});

// ---------------------------------------------------------------------------
// N2 + D3 — background WebView termination and the didGetToHomepage gate.
// The >8min background flip is tested in appStatus.test.js; here the bridge
// side: termination defers reload to foreground, and the reload is gated on
// didGetToHomepage. With the flag false the bridge stays dead (restart-only).
// ---------------------------------------------------------------------------
describe('adversarial — background crash & foreground recovery (N2/D3)', () => {
  test('background termination defers reload; foreground with didGetToHomepage reloads and re-handshakes', async () => {
    const wv1 = await webviewReadyFull();

    // Background: app-state effect settles in-flight traffic.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();

    // iOS process termination in background → keys zeroed, reload deferred.
    wvTerminate(false);
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true); // latch untouched
    expect(postedCount('handshake:init', wv1)).toBe(1); // no reload yet

    // A request in background settles immediately (D-5).
    const bgReq = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(bgReq.settled).toBe(true);
    expect(bgReq.value.kind).toBe('unknown');

    // Foreground with didGetToHomepage=true → blockAndResetWebview → new page.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(100);
    wvLoadStart();
    wvLoadEnd();

    // New session key: the old crypto object cannot decrypt the new traffic.
    const wv2 = makeWebviewCrypto();
    await advance(300);
    expect(postedCount('handshake:init', wv1)).toBe(2);
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);
    expect(SUT.getHandshakeComplete()).toBe(true);

    // Bridge fully functional again.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv2.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv2.respond(sent.id, { balance: 9 });
    await flush();
    expect(st.value).toEqual({ balance: 9 });
  });

  test('background termination + didGetToHomepage=false → ERROR WebView is reloaded on foreground and re-handshakes (N2/D3 recovery)', async () => {
    const wv1 = await webviewReadyFull();
    const verifyCallsBefore = mockVerify.mock.calls.length;

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    wvTerminate(false); // crash while backgrounded → nonceVerified=false
    await flush();

    // The 8+ min background flipped didGetToHomepage to false (appStatus).
    mockAppStatus.didGetToHomepage = false;
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    // Foreground sees !nonceVerified + wvState ERROR during boot → the bridge
    // reloads (re-verifies) instead of staying dead (C-11 ERROR branch).
    await advance(500);
    expect(mockVerify.mock.calls.length).toBeGreaterThan(verifyCallsBefore);

    // A request during the recovery window is held — and drains with the real
    // outcome once the remounted page completes, never a silent hang.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(false);

    // The remounted page completes: load + NEW handshake → READY again.
    wvLoadStart();
    wvLoadEnd();
    const wv2 = makeWebviewCrypto();
    await advance(300);
    expect(postedCount('handshake:init', wv1)).toBe(2);
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // The held request drained and settles with the REAL response.
    const sent = wv2.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv2.respond(sent.id, { balance: 7 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 7 });
  });

  test('active crash (iOS termination / Android renderer gone) reloads immediately and re-handshakes', async () => {
    const wv1 = await webviewReadyFull();
    const verifyCallsBefore = mockVerify.mock.calls.length;

    wvTerminate(true); // Android onRenderProcessGone while active
    await flush();
    expect(mockVerify.mock.calls.length).toBe(verifyCallsBefore + 1);

    // New page loads; new session key.
    await advance(100);
    wvLoadStart();
    wvLoadEnd();
    const wv2 = makeWebviewCrypto();
    await advance(300);
    expect(postedCount('handshake:init', wv1)).toBe(2);
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);
    expect(SUT.getHandshakeComplete()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D4 + N3 — the load-callback axis (LOADING has no timeout, no onError; a
// spontaneous reload from READY is dropped but re-arms the handshake).
// ---------------------------------------------------------------------------
describe('adversarial — load lifecycle (D4, N3)', () => {
  test('page never loads: the load watchdog recovers the bridge and held requests settle (D4, C-11)', async () => {
    await mountWebview();
    wvLoadStart(); // LOADING
    // No onLoadEnd / onLoadProgress ever fires. onError is now wired (C-11).
    expect(typeof mockWebview.props.onError).toBe('function');

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(false);
    expect(mockWebview.posted.length).toBe(0); // held, never posted

    // The 30s load watchdog treats the hung load as a failure and recovers:
    // re-verify + reload. The recovery reset settles the held request (it was
    // never dispatched → the settle is safe).
    const verifyCalls = mockVerify.mock.calls.length;
    await advance(30001);
    expect(mockVerify.mock.calls.length).toBeGreaterThan(verifyCalls);
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');
    expect(mockWebview.posted.length).toBe(0);
    expect(lastPosted('handshake:init')).toBeNull(); // handshake never ran
  });

  test('spontaneous reload from READY tears down the session and self-heals: new plaintext handshake, held requests, keep-alive ops reconcile (N3/DR-4)', async () => {
    const wv1 = await webviewReadyFull();
    expect(SUT.getHandshakeComplete()).toBe(true);

    // Spontaneous reload while READY: READY→LOADING is now a valid transition
    // (N3/DR-4), the session key is zeroed and the handshake is cleared.
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(SUT.getHandshakeComplete()).toBe(false);

    // A request dispatched during the reload window (handshake cleared) is
    // HELD, never posted into the still-dead page.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(postedCount('getSparkBalance', wv1)).toBe(0);

    // The reloaded page gets a NEW plaintext handshake (never encrypted under
    // the stale key — the old key was zeroed) and it completes.
    const wv2 = makeWebviewCrypto();
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);
    expect(SUT.getHandshakeComplete()).toBe(true);

    // The held request drains after the new handshake + wallet init, is
    // dispatched and answered normally.
    await flush();
    expect(postedCount('getSparkBalance', wv2)).toBe(1);
    const bal = wv2.lastEncryptedPayload('getSparkBalance');
    wv2.respond(bal.id, { balanceSats: 42 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.balanceSats).toBe(42);
  });

  test('crash-reset clears the handshake (E2: resetWebViewState second arg defaults to true); requests during the reload window are held, never dispatched', async () => {
    const wv1 = await webviewReadyFull();

    // Crash while active → reset + reload. blockAndResetWebview calls
    // resetWebViewState(false) — the second (clearHandshake) arg DEFAULTS to
    // true, so the handshake IS cleared (E2: the in-code comment claims it is
    // kept). The ready-window hold then engages for the reload window.
    wvTerminate(true);
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(false);

    // During the reload window (before the new page's handshake) requests must
    // not dispatch — they are held.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(false);
    expect(postedCount('getSparkBalance', wv1)).toBe(0);

    // New page: load + handshake + wallet re-init → buffer drains.
    await advance(100);
    wvLoadStart();
    wvLoadEnd();
    const wv2 = makeWebviewCrypto();
    await advance(300);
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);

    const sent = wv2.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv2.respond(sent.id, { balance: 3 });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({ balance: 3 });
  });
});

// ---------------------------------------------------------------------------
// N4 + N8 — a reset/background that lands while a handshake is in flight. N4
// (auth reset) is an interruption, not a failure: the epoch moved on, so no
// fallback state is consumed (F-7). N8 (background settle, same epoch) keeps
// its pending transition — the foreground PENDING-recovery drives the reload
// there.
// ---------------------------------------------------------------------------
describe('adversarial — in-flight handshake interrupted (N4, N8)', () => {
  test('auth reset during in-flight handshake: the interruption consumes no fallback state (N4, F-7)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    mockNav.routes = ['SendToContactPage']; // non-startup route

    let connState;
    function Probe() {
      connState = SUT.useWebView().changeSparkConnectionState;
      return null;
    }
    await mountTransport(React.createElement(Probe, null));
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy(); // handshake #1 in flight

    // Auth reset mid-handshake: the reset settles the first handshake as
    // kind 'unknown' under a NEW epoch — an interruption, not a bridge failure.
    // No fallback-pending, no spurious reconnect emit; the reset's own reload
    // owns recovery (F-7).
    mockAuth.authResetkey = 1;
    rerender(React.createElement(Probe, null));
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(connState).toEqual({ state: false, count: 1 }); // the reset emit only

    // The reset's reload re-arms a second handshake; completing it brings the
    // bridge up.
    await advance(300);
    expect(postedCount('handshake:init', null)).toBe(2);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('backgrounding during in-flight handshake defers it: no fallback-pending, foreground re-arms and completes (N8)', async () => {
    mockLocal.get = async () => null;
    await mountTransport();
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();

    // Backgrounding is not a bridge failure: the handshake is DEFERRED (kind
    // 'deferred') — no fallback-pending, no fallback budget consumed.
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(SUT.getHandshakeComplete()).toBe(false);

    // Foreground re-arms the handshake (didRunInit was reset) — a NEW
    // handshake:init posts and completes without any reset/bg-fg churn.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(300);
    expect(postedCount('handshake:init', null)).toBe(2);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('handshake deferred while offline: no fallback transition, no reconnect emit, recovery on connection restore', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    mockAppStatus.isConnectedToTheInternet = false;

    let connState;
    function Probe() {
      connState = SUT.useWebView().changeSparkConnectionState;
      return null;
    }
    await mountTransport(React.createElement(Probe, null));

    // Offline requests settle immediately with kind 'offline' (D-8) — nothing
    // is held or posted.
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('offline');

    // The offline gate settles the handshake attempt before it ever posts:
    // no handshake:init leaves the device, no fallback transition, no
    // reconnect emit, buffer untouched.
    await advance(300);
    expect(lastPosted('handshake:init')).toBeNull();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(SUT.getHandshakeComplete()).toBe(false);
    expect(connState.state).toBeNull();
    expect(connState.count).toBe(0);

    // Connection restore → reload + re-handshake (now it actually posts).
    mockAppStatus.isConnectedToTheInternet = true;
    rerender(React.createElement(Probe, null));
    await flush();
    await advance(400);
    const wv = makeWebviewCrypto();
    expect(postedCount('handshake:init', null)).toBe(1);
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);
    expect(SUT.getHandshakeComplete()).toBe(true);

    // Bridge functional again.
    const st2 = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv.respond(sent.id, { balance: 11 });
    await flush();
    expect(st2.value).toEqual({ balance: 11 });
  });
});

// ---------------------------------------------------------------------------
// Intent-store hazards: mutated-args retry re-dispatch (N6), null reconcile
// for sendBitcoinPayment/clawbacks (D1), unbounded retention (N7).
// ---------------------------------------------------------------------------
describe('adversarial — intent-store hazards (N6, D1, N7)', () => {
  test('mutated-args retry re-dispatches: changed amount → new stableKey → double-dispatch risk (N6)', async () => {
    const wv = await transportReadyFull();

    const first = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(postedCount('sendSparkPayment', wv)).toBe(1);

    // Lost response → keep-alive watchdog does NOT fabricate a settle: first
    // window resume-by-id re-posts the same id, final deadline → unknown.
    await advance(90001);
    expect(first.settled).toBe(false);
    await advance(30001);
    expect(first.value.kind).toBe('unknown');

    // Retry with a different amount → distinct stableKey → re-dispatch.
    // (Posts so far: original dispatch + the resume re-post.)
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 2000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(postedCount('sendSparkPayment', wv)).toBe(3);
    expect(retry.settled).toBe(false);
    const store = SUT.__getIntentStoreForTest();
    expect(store.size).toBe(2);
    expect([...store.values()].some(e => e.args.amountSats === 2000)).toBe(
      true,
    );
  });

  test('sendBitcoinPayment/clawback intents: no reconcile query (null) → unknown blocks re-dispatch, then the Case-B TTL lifts it past the reconcile window (D1/N7)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    for (const [op, args] of [
      // OPERATION_TYPES values: sendBitcoinPayment === 'sendSparkBitcoinPayment'.
      [
        'sendSparkBitcoinPayment',
        { paymentRequest: 'lnbc1abc', mnemonic: MNEMONIC },
      ],
      ['requestClawback', { transferId: 't-1', mnemonic: MNEMONIC }],
    ]) {
      const st = track(SUT.sendWebViewRequestGlobal(op, args));
      await flush();
      expect(postedCount(op, wv)).toBe(1);
      // Keep-alive watchdog: first window resume-by-id, final deadline settles.
      await advance(90001);
      expect(st.settled).toBe(false);
      await advance(30001);
      expect(st.value.kind).toBe('unknown');
    }
    expect(SUT.__getIntentStoreForTest().size).toBe(2);

    // Two foreground cycles: reconcile has no query for these ops → zero
    // queries, entries stay unknown forever.
    for (let i = 0; i < 2; i++) {
      mockAppStatus.appState = 'background';
      AppState.currentState = 'background';
      rerender();
      await flush();
      mockAppStatus.appState = 'active';
      AppState.currentState = 'active';
      rerender();
      await flush();
    }
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
    for (const entry of SUT.__getIntentStoreForTest().values()) {
      expect(entry.state).toBe('unknown');
    }

    // These ops have no reconcile query, so the block can only ever be lifted
    // by the Case-B TTL. The two watchdog cycles above already pushed elapsed
    // time past the 3-min reconcile window, so an identical retry is treated as
    // never-executed and dispatches fresh (an identical send is never
    // permanently blocked — see funds-identical-resend-principle).
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkBitcoinPayment', {
        paymentRequest: 'lnbc1abc',
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    // Re-dispatched, not immediately settled from the store.
    expect(retry.settled).toBe(false);
    // Original dispatch + keep-alive resume re-post + the fresh retry.
    expect(postedCount('sendSparkBitcoinPayment', wv)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Guard contract (2026-08): the intent guard exists ONLY to prevent automatic
// re-dispatch of an unresolved payment. It never blocks a user-initiated
// identical send — that is a NEW payment, and the restore/balance handlers
// surface whether the earlier attempt actually sent. Under a committed native
// fallback reconcileUnknownIntents() early-returns (fallbackState !== WEBVIEW),
// so no reconcile query runs on the native runtime.
// ---------------------------------------------------------------------------
describe('adversarial — native fallback: reconcile disabled, user sends never blocked', () => {
  test('under native, reconcile runs zero queries and an identical user send dispatches immediately (contract)', async () => {
    const wv = await transportReadyFull();
    const sendArgs = {
      receiverSparkAddress: 'sp1abc',
      amountSats: 1000,
      mnemonic: MNEMONIC,
    };

    // Dispatch a send, then let the keep-alive watchdog + final deadline settle
    // it 'unknown' without ever receiving a backend response.
    track(SUT.sendWebViewRequestGlobal('sendSparkPayment', sendArgs));
    await flush();
    await advance(90001); // watchdog → resume-by-id re-post + arm final deadline
    await advance(30001); // final deadline → settle unknown

    // Within the reconcile window, an identical user-initiated send is NEVER
    // blocked: it dispatches as a new payment immediately (contract — DR-5).
    const postedBefore = postedCount('sendSparkPayment', wv);
    const retry = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', sendArgs),
    );
    await flush();
    expect(postedCount('sendSparkPayment', wv)).toBe(postedBefore + 1);
    expect(retry.settled).toBe(false);

    // Commit to native (e.g. a WASM error / verification tamper elsewhere).
    SUT.setForceReactNative(true, 'test');
    expect(SUT.__getFallbackStateForTest()).toBe('native');

    const queriesBefore = SUT.__getReconcileQueryCountForTest();

    // Foreground cycle under native: the app-state effect early-returns, so no
    // reconcile pass is scheduled — the intent can never be confirmed 'done'.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    // Push total elapsed past the 3-min reconcile window (120s already burned).
    await advance(70000);

    // Native runs no reconcile query...
    expect(SUT.__getReconcileQueryCountForTest()).toBe(queriesBefore);
  });
});

// ---------------------------------------------------------------------------
// Real reconcile path: production buildReconcileQuery/buildReconcileMatcher/
// extractReconcileTxid (no override seam), including the null-query ops.
// ---------------------------------------------------------------------------
describe('adversarial — production reconcile queries & matchers', () => {
  const fixtures = [
    {
      op: 'claimnSparkStaticDepositAddress', // OPERATION_TYPES.claimStaticDepositAddress
      args: {
        transactionId: 'txid-1',
        outputIndex: 0,
        depositAddress: 'bc1abc',
        mnemonic: MNEMONIC,
      },
      queryAction: 'getUtxosForDepositAddress',
      respond: () => ({ utxos: [] }), // deposit consumed → matcher hit
      hit: true,
      txid: 'txid-1',
    },
    {
      op: 'fufillSparkInvoices',
      args: {
        invoices: [
          { invoice: 'inv-1', tokenIdentifier: 'tokA', tokenAmount: '500' },
        ],
        mnemonic: MNEMONIC,
      },
      queryAction: 'querySparkInvoices',
      respond: () => ({ invoiceStatuses: [{ invoice: 'inv-1', status: 2 }] }),
      hit: true,
      txid: undefined, // extractReconcileTxid has no case for fufillSparkInvoices
    },
  ];

  const missFixtures = [
    {
      op: 'claimnSparkStaticDepositAddress',
      args: {
        transactionId: 'txid-1',
        outputIndex: 0,
        depositAddress: 'bc1abc',
        mnemonic: MNEMONIC,
      },
      queryAction: 'getUtxosForDepositAddress',
      respond: () => ({ utxos: [{ txid: 'txid-1', vout: 0 }] }), // still unclaimed
    },
    {
      op: 'fufillSparkInvoices',
      args: {
        invoices: [
          { invoice: 'inv-1', tokenIdentifier: 'tokA', tokenAmount: '500' },
        ],
        mnemonic: MNEMONIC,
      },
      queryAction: 'querySparkInvoices',
      respond: () => ({ invoiceStatuses: [{ invoice: 'inv-1', status: 1 }] }),
    },
  ];

  const noHeuristicReconcileFixtures = [
    {
      op: 'sendSparkPayment',
      args: {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      },
      forbiddenQuery: 'getSparkTransactions',
    },
    {
      op: 'executeSwap',
      args: {
        poolId: 'pool1',
        assetInAddress: 'btc-asset',
        assetOutAddress: 'usdb-token',
        amountIn: '200',
        mnemonic: MNEMONIC,
      },
      forbiddenQuery: 'getUserSwapHistory',
    },
    {
      op: 'swapBitcoinToToken',
      args: {
        poolId: 'pool1',
        tokenAddress: 'usdb-token',
        amountSats: '200',
        mnemonic: MNEMONIC,
      },
      forbiddenQuery: 'getUserSwapHistory',
    },
    {
      op: 'swapTokenToBitcoin',
      args: {
        poolId: 'pool1',
        tokenAddress: 'usdb-token',
        tokenAmount: '200',
        mnemonic: MNEMONIC,
      },
      forbiddenQuery: 'getUserSwapHistory',
    },
  ];

  async function setupUnknown(op, args) {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);

    const st = track(SUT.sendWebViewRequestGlobal(op, args));
    await flush();
    expect(postedCount(op, wv)).toBe(1);
    // Keep-alive watchdog: first window resume-by-id, final deadline settles.
    // Claim is a medium op (30s first window); other keep-alive ops are 90s.
    await advance(op === 'claimnSparkStaticDepositAddress' ? 30001 : 90001);
    expect(st.settled).toBe(false);
    await advance(30001);
    expect(st.value.kind).toBe('unknown');
    return wv;
  }

  async function foreground() {
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
  }

  for (const fx of fixtures) {
    test(`${fx.op}: deterministic reconcile query ${fx.queryAction} hits → done + txid extracted`, async () => {
      const wv = await setupUnknown(fx.op, fx.args);
      await foreground();

      // The production query actually posted (no override seam).
      const query = wv.lastEncryptedPayload(fx.queryAction);
      expect(query).toBeTruthy();
      expect(SUT.__getReconcileQueryCountForTest()).toBe(1);

      wv.respond(query.id, fx.respond());
      await flush();

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('done');
      expect(entry.result).toEqual({
        didWork: true,
        status: 'executed',
        txid: fx.txid,
        response: { id: fx.txid },
      });
      // N7: reconcile-confirmed entries are retained for the double-pay guard.
      expect(SUT.__getIntentStoreForTest().size).toBe(1);
    });
  }

  for (const fx of missFixtures) {
    test(`${fx.op}: real reconcile query misses → stays unknown, no re-query same foreground`, async () => {
      const wv = await setupUnknown(fx.op, fx.args);
      await foreground();

      const query = wv.lastEncryptedPayload(fx.queryAction);
      expect(query).toBeTruthy();
      wv.respond(query.id, fx.respond());
      await flush();

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('unknown');

      // A second foreground is needed for another attempt.
      await foreground();
      expect(SUT.__getReconcileQueryCountForTest()).toBe(2);
    });
  }

  for (const fx of noHeuristicReconcileFixtures) {
    test(`${fx.op}: history cannot prove execution and a new user request still dispatches`, async () => {
      const wv = await setupUnknown(fx.op, fx.args);
      await foreground();

      expect(wv.lastEncryptedPayload(fx.forbiddenQuery)).toBeNull();
      expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('unknown');
      expect(entry.args.mnemonic).toBeUndefined();

      const postsBefore = postedCount(fx.op, wv);
      const retry = track(SUT.sendWebViewRequestGlobal(fx.op, fx.args));
      await flush();

      expect(postedCount(fx.op, wv)).toBe(postsBefore + 1);
      expect(retry.settled).toBe(false);
    });
  }

  test('production reconcile query hashes the mnemonic exactly once', async () => {
    const nodeCrypto = require('node:crypto');
    const hashOf = s =>
      nodeCrypto.createHash('sha256').update(s).digest().toString('hex');
    const wv = await setupUnknown('claimnSparkStaticDepositAddress', {
      transactionId: 'txid-1',
      outputIndex: 0,
      depositAddress: 'bc1abc',
      mnemonic: MNEMONIC,
    });
    await foreground();

    const query = wv.lastEncryptedPayload('getUtxosForDepositAddress');
    expect(query.args.mnemonic).toBe(hashOf(MNEMONIC));
  });
});

// ---------------------------------------------------------------------------
// Wallet init & drain paths: initWallet failure response, drain auto-init
// timeout (N9), null-mnemonic drain (D2b), concurrent initWallet (N5).
// ---------------------------------------------------------------------------
describe('adversarial — init & drain (N5, N9, D2b)', () => {
  test('initWallet failure response → fallback-pending + buffer settled as not-ready', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(st.settled).toBe(false);

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);

    const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(initMsg).toBeTruthy();
    wv.respond(initMsg.id, { isConnected: false, error: 'no funds' });
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({
      didWork: false,
      error: 'Wallet initialization failed, using React Native',
      kind: 'not-ready',
    });
  });

  test('drain auto-init timeout settles the whole buffer with a misleading error (N9)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(150);
    expect(wv.lastEncryptedPayload('initializeSparkWallet')).toBeTruthy();

    // The auto-init never answers → 90s watchdog → the whole buffer is
    // settled as a wallet-init failure even though init only TIMED OUT.
    await advance(90001);
    expect(st.settled).toBe(true);
    expect(st.value).toEqual({
      didWork: false,
      error: 'Wallet initialization failed, using React Native',
      kind: 'not-ready',
    });
    expect(postedCount('getSparkBalance', wv)).toBe(0);
  });

  test('null mnemonic: drain re-holds the buffer — held requests never dispatch until an initWallet flow (D2b stuck state)', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = null;
    await mountTransport();

    const st = track(
      SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
    );
    await flush();
    expect(st.settled).toBe(false);

    const wv = makeWebviewCrypto();
    await advance(300);
    wv.answerHandshake();
    await flush();
    await advance(200);

    // No mnemonic → no wallet init possible. Every drained request re-enters
    // sendWebViewRequestInternal and is re-held by the ready-window gate —
    // nothing is ever dispatched (until the app runs an initWallet).
    expect(postedCount('initializeSparkWallet', wv)).toBe(0);
    expect(postedCount('getSparkBalance', wv)).toBe(0);
    expect(st.settled).toBe(false);
    // The re-held request no longer hangs forever: the bounded hold TTL settles
    // it not-ready (C-6). Still nothing is dispatched.
    await advance(120001);
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('not-ready');
    expect(postedCount('getSparkBalance', wv)).toBe(0);
  });

  test('two concurrent initWallet dispatches are not deduped (N5); the drain auto-init adds a third', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();

    // initWallet is exempt from the hold AND not intent-guarded → two
    // concurrent calls produce two independent posts.
    const a = track(
      SUT.sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic: MNEMONIC,
      }),
    );
    const b = track(
      SUT.sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(postedCount('initializeSparkWallet', wv)).toBe(2);

    // Neither wallet-init completed, so the drain auto-init posts a third.
    await advance(200);
    expect(postedCount('initializeSparkWallet', wv)).toBe(3);
    expect(SUT.__getIntentStoreForTest().size).toBe(0); // no intent guard
    expect(a.settled).toBe(false);
    expect(b.settled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Message handling: real rate-limiter trip (E3), pre-handshake garbage count
// (N10), webviewFailureCount escalation (N13), streamStatus push events.
// ---------------------------------------------------------------------------
describe('adversarial — message handling (E3, N10, N13, streamStatus)', () => {
  test('rate limiter actually trips on ENCRYPTED traffic — a legit 51st response is dropped (E3 fix)', async () => {
    const wv = await transportReadyFull();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');

    // 50 encrypted non-push messages pass the plaintext guard and count.
    for (let i = 0; i < 50; i++) {
      wv.respond(`bogus-${i}`, { ok: i });
    }
    await flush();

    // The 51st message — the REAL response — is dropped by the limiter.
    wv.respond(sent.id, { balance: 7 });
    await flush();
    expect(st.settled).toBe(false);
    await advance(30001); // watchdog settles it instead
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('timeout');

    // Control: with the real response as the 50th message it passes.
    const st2 = track(SUT.sendWebViewRequestGlobal('getSparkAddress', {}, true));
    await flush();
    const sent2 = wv.lastEncryptedPayload('getSparkAddress');
    for (let i = 0; i < 49; i++) {
      wv.respond(`bogus2-${i}`, { ok: i });
    }
    wv.respond(sent2.id, { address: 'bc1x' });
    await flush();
    expect(st2.settled).toBe(true);
    expect(st2.value).toEqual({ address: 'bc1x' });
  });

  test('pre-handshake encrypted garbage counts against the rate limiter (N10)', async () => {
    await mountTransport();
    await advance(300); // no handshake answer → no session key

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (let i = 0; i < 51; i++) {
      postInbound({ encrypted: 'garbage' });
    }
    await flush();
    expect(
      errSpy.mock.calls.some(([msg]) =>
        String(msg).includes('Rate limit exceeded'),
      ),
    ).toBe(true);
    errSpy.mockRestore();
  });

  test('two consecutive decrypt failures trip fallback-pending (N13); a successful handshake resets the counter', async () => {
    let wv = await transportReadyFull();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // One failure → contained, no transition.
    postInbound({ encrypted: 'garbage' });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // Second consecutive failure → webviewFailureCount >= 2 → pending.
    postInbound({ encrypted: 'garbage' });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');

    // Recovery: bg/fg → reload → successful handshake resets the counter.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(400);
    wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // The reset counter tolerates a single bad message again.
    postInbound({ encrypted: 'garbage' });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    postInbound({ encrypted: 'garbage' });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
  });

  test('streamStatus push events emit; malformed ones are contained', async () => {
    const wv = await transportReadyFull();

    const seen = [];
    SUT.sparkStreamStatusEmitter.once(SUT.STREAM_STATUS_EVENT_NAME, (s, w) =>
      seen.push([s, w]),
    );
    postInbound({
      encrypted: wv.encrypt(
        JSON.stringify({ streamStatus: 'CONNECTED', walletId: 'w1' }),
      ),
    });
    await flush();
    expect(seen).toEqual([['CONNECTED', 'w1']]);

    // A throwing/malformed streamStatus must not tear the bridge down.
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    postInbound({
      encrypted: wv.encrypt(JSON.stringify({ streamStatus: 42 })),
    });
    await flush();
    errSpy.mockRestore();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });
});

// ---------------------------------------------------------------------------
// N12 — customUUID fails open to false: every request shares
// pendingRequests['false'], orphaning earlier resolvers (zombie promise).
// ---------------------------------------------------------------------------
describe('adversarial — customUUID id collision (N12)', () => {
  test('colliding id=false: the falsy-id response is dropped, and the first resolver is orphaned — only the second settles, via its own watchdog', async () => {
    const wv = await transportReadyFull();
    mockUuidState.fail = true;

    const first = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const second = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp2abc',
        amountSats: 2000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(postedCount('sendSparkPayment', wv)).toBe(2);

    // The response carries id=false — falsy — so the `isResponse && content.id`
    // branch never processes it: neither caller settles.
    wv.respond(false, { didWork: true, response: { id: 'tx-2' } });
    await flush();
    expect(second.settled).toBe(false);
    expect(first.settled).toBe(false);

    // The second request's entry overwrote the first's in both
    // pendingRequests['false'] and activeTimeoutsRef['false']: when the
    // keep-alive watchdog fires (first window re-posts, final deadline
    // settles) it settles the SECOND caller only — the first never settles
    // (zombie promise), and its intent stays 'in-flight' forever.
    await advance(90001);
    expect(second.settled).toBe(false); // keep-alive: no fabricated settle
    await advance(30001);
    expect(second.settled).toBe(true);
    expect(second.value.kind).toBe('unknown');
    expect(first.settled).toBe(false);
    await advance(90001);
    expect(first.settled).toBe(false);
    expect(
      [...SUT.__getIntentStoreForTest().values()].some(
        e => e.state === 'in-flight',
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Foreground/connectivity reconcile edges (§3.4, §3.9) — the appState effect
// must NOT reconcile or reload while offline, and on a boot-phase connection
// restore it reconciles WITHOUT reloading the page.
// ---------------------------------------------------------------------------
describe('adversarial — foreground reconcile gating (§3.4, §3.9)', () => {
  async function unknownIntentReady() {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300);
    const wv = makeWebviewCrypto();
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
    // Keep-alive watchdog: first window resume-by-id, final deadline settles.
    await advance(90001);
    expect(st.settled).toBe(false);
    await advance(30001);
    expect(st.value.kind).toBe('unknown');
    return wv;
  }

  test('offline foreground does NOT reconcile or reload (§3.4)', async () => {
    const wv = await unknownIntentReady();
    const handshakesBefore = postedCount('handshake:init', wv);
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);

    // Background, then return to foreground while offline.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.isConnectedToTheInternet = false;
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();

    // Offline gate returns before reconcile and before any reload: the intent
    // is left untouched (recovery is driven by a later connectivity-restore
    // event, exercised by the §3.9 boot-phase test below and the reload paths).
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
    expect(postedCount('handshake:init', wv)).toBe(handshakesBefore);
    expect(SUT.__getIntentStoreForTest().size).toBe(1);
    expect([...SUT.__getIntentStoreForTest().values()][0].state).toBe('unknown');
  });

  test('boot-phase connection restore does not reload or heuristically reconcile a send (§3.9)', async () => {
    const wv = await unknownIntentReady();
    const handshakesBefore = postedCount('handshake:init', wv);

    // Still verified (nonceVerified true) but the user has not reached the
    // homepage yet: a connection restore must reconcile, not reload.
    mockAppStatus.didGetToHomepage = false;
    rerender();
    await flush();

    mockAppStatus.isConnectedToTheInternet = false;
    rerender();
    await flush();
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();

    // No reload, and no history query that could attribute another payment to
    // this unknown attempt. Transaction/balance refresh owns eventual truth.
    expect(SUT.__getReconcileQueryCountForTest()).toBe(0);
    expect(postedCount('handshake:init', wv)).toBe(handshakesBefore);
    const query = wv.lastEncryptedPayload('getSparkTransactions');
    expect(query).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fallback-pending request flow: requests are held (not rejected) while
// PENDING, and recover on the next bg/fg cycle.
// ---------------------------------------------------------------------------
describe('adversarial — requests held while fallback-pending', () => {
  test('mid-session handshake failure → requests held while pending; the next background settles them (bounded), foreground recovery re-handshakes', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300);
    await advance(4000); // first handshake times out
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');

    // While pending, requests are held (not rejected, not posted).
    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(false);
    expect(postedCount('getSparkBalance', null)).toBe(0);

    // The next background settles the held buffer as unknown (bounded, D-6) —
    // held requests do not leak across the recovery.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');

    // Foreground recovery: reload + re-handshake.
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(400);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    await completeWalletInit(wv);
    expect(SUT.getHandshakeComplete()).toBe(true);

    // Bridge fully functional again.
    const st2 = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy();
    wv.respond(sent.id, { balance: 22 });
    await flush();
    expect(st2.value).toEqual({ balance: 22 });
  });
});

// ---------------------------------------------------------------------------
// 2026-08-09 review additions — NEW findings not covered by N1-N13/D1-D4/E1-E3
// ---------------------------------------------------------------------------

// F-1 — Boot-time offline deadlock: the handshake is deferred once while
// offline (didRunInit latched), and the connection-restore path refuses to
// reload before the user reaches the homepage. Nothing ever re-arms the
// handshake, so the bridge is dead for the rest of the session (restart only).
describe('adversarial — boot-offline deadlock (F-1)', () => {
  test('offline boot → connection restored before homepage → handshake never re-armed, bridge dead for the session', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    mockAppStatus.isConnectedToTheInternet = false;
    mockAppStatus.didGetToHomepage = false; // still on the loading screen

    await mountTransport();

    // The handshake effect fires, but the offline gate settles it as
    // 'offline' and initHandshake defers — didRunInit stays latched.
    await advance(300);
    expect(lastPosted('handshake:init')).toBeNull();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(SUT.getHandshakeComplete()).toBe(false);

    // Connection restored while the user is still on the loading screen.
    mockAppStatus.isConnectedToTheInternet = true;
    rerender();
    await flush();
    await advance(400);

    // A correct bridge re-arms the handshake here (the page is loaded and
    // verified; only the deferred handshake stands between the app and a
    // working bridge). The current implementation posts NOTHING: the
    // connection-restore branch skips the reload because
    // didGetToHomepage is false, and didRunInit blocks the handshake effect.
    expect(lastPosted('handshake:init')).toBeTruthy(); // FAILS today: no re-arm

    // initWallet issued by the loading screen is held forever instead of
    // dispatching after a handshake.
    const st = track(
      SUT.sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    expect(st.settled).toBe(false);
    expect(postedCount('initializeSparkWallet', null)).toBe(0);

    // Even a bg/fg cycle cannot recover: startHandshake still returns on the
    // didRunInit latch.
    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(400);
    expect(lastPosted('handshake:init')).toBeTruthy(); // FAILS today
  });
});

// ---------------------------------------------------------------------------
// Payment and swap history does not carry a bridge-attempt identifier. Even a
// single identical row can belong to an earlier or later user-authorized
// operation, so it must not settle an unknown attempt.
// ---------------------------------------------------------------------------
describe('adversarial — history cannot settle an unknown payment attempt', () => {
  test('identical history cannot be attributed and an identical new payment dispatches', async () => {
    const wv = await transportReadyFull();
    const args = {
      receiverSparkAddress: 'sp1abc',
      amountSats: 1000,
      mnemonic: MNEMONIC,
    };
    track(SUT.sendWebViewRequestGlobal('sendSparkPayment', args));
    await flush();
    await advance(90001);
    await advance(30001);

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
    expect([...SUT.__getIntentStoreForTest().values()][0].state).toBe('unknown');

    const postsBefore = postedCount('sendSparkPayment', wv);
    const nextPayment = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', args),
    );
    await flush();

    expect(postedCount('sendSparkPayment', wv)).toBe(postsBefore + 1);
    expect(nextPayment.settled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S1 — pre-handshake (unauthenticated) messages must never drive a privileged
// path. The verified bundle emits all content encrypted, post-handshake; only
// handshake:reply is legitimate before the session key exists.
// ---------------------------------------------------------------------------
describe('adversarial — pre-handshake messages cannot drive privileged paths (S1)', () => {
  test('a plaintext CSP violation before handshake does NOT trigger the persisted native kill-switch', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300); // handshake:init sent, never answered → nonceVerified=false

    const { setLocalStorageItem } = require('../../app/functions');
    setLocalStorageItem.mockClear();

    postInbound({ type: 'security:csp-violation', directive: 'script-src' });
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(setLocalStorageItem).not.toHaveBeenCalledWith(
      'FORCE_REACT_NATIVE',
      expect.anything(),
    );
  });

  test('a plaintext push event before handshake does NOT emit to app listeners', async () => {
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = MNEMONIC;
    await mountTransport();
    await advance(300); // no handshake answer → nonceVerified=false

    const heard = jest.fn();
    SUT.sparkBalanceUpdateEmitter.on(SUT.BALANCE_UPDATE_EVENT_NAME, heard);
    postInbound({
      balanceUpdate: true,
      result: JSON.stringify({ balance: 999999 }),
      walletId: 'attacker',
    });
    await flush();
    SUT.sparkBalanceUpdateEmitter.off(SUT.BALANCE_UPDATE_EVENT_NAME, heard);

    expect(heard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// C4 — a hard-fail native transition (CSP / WASM) must UNMOUNT the compromised
// page, not leave it running as an orphan.
// ---------------------------------------------------------------------------
describe('adversarial — hard-fail native transition unmounts the WebView (C4)', () => {
  test('CSP violation unmounts the WebView', async () => {
    const wv = await webviewReadyFull();
    const WebViewComp = require('react-native-webview').default;
    expect(renderer.root.findAllByType(WebViewComp).length).toBe(1);

    postInbound({
      encrypted: wv.encrypt(
        JSON.stringify({ type: 'security:csp-violation', directive: 'script-src' }),
      ),
    });
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('native');
    expect(renderer.root.findAllByType(WebViewComp).length).toBe(0);
  });

  test('WASM error response unmounts the WebView', async () => {
    const wv = await webviewReadyFull();
    const WebViewComp = require('react-native-webview').default;
    expect(renderer.root.findAllByType(WebViewComp).length).toBe(1);

    // Dispatch a request, then answer it with a WASM error result.
    track(SUT.sendWebViewRequestGlobal('getSparkBalance', { mnemonic: MNEMONIC }));
    await flush();
    const req = wv.lastEncryptedPayload('getSparkBalance');
    wv.respond(req.id, { error: 'WebAssembly.Compile is disallowed on the main thread' });
    await flush();

    expect(SUT.__getFallbackStateForTest()).toBe('native');
    expect(renderer.root.findAllByType(WebViewComp).length).toBe(0);
  });
});
