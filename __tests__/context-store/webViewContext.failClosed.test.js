/* eslint-env jest */
// ---------------------------------------------------------------------------
// Fail-closed lifecycle suite (R-1..R-6 / N8): proves there is NO terminal
// hang in the WebView state machine. Every wedge discovered in the adversarial
// review has a deterministic, bounded recovery path, and every test asserts
// BOTH that the failure occurs AND that the system reaches a safe/recoverable
// state (never just "ERROR was reached").
//
//  R-1  VERIFYING has no watchdog: a hung verification (or a WebView that
//       mounts but emits no load events) parked the bridge forever.
//  R-2  Silent reloads did not invalidate the old page's callbacks: a stale
//       handshake timeout/reply could flip a healthy re-handshake to
//       fallback-pending, and a stale onLoadEnd could mark the new load done.
//  R-3  A stale verification failure could latch native after a newer
//       verification succeeded.
//  R-4  Fallback-pending had no in-session recovery: the bridge stayed dead
//       until a bg/fg cycle or auth reset.
//  R-5  An explicit initWallet timeout left the bridge handshake-complete but
//       wallet-uninitialized with no re-init trigger.
//  R-6  A wedged hard-fail-latch read could park the handshake start forever.
//  N8   Backgrounding during an in-flight handshake consumed the fallback
//       budget (spurious fallback-pending).
// ---------------------------------------------------------------------------
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
const mockWebview = { props: null, posted: [] };
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
jest.mock('@buildonspark/spark-sdk', () => ({
  __esModule: true,
  decodeSparkAddress: address => ({ identityPublicKey: `pk:${address}` }),
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
let mode;

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
async function mountTransport() {
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
function outbound() {
  return mode === 'transport'
    ? mockTransport.send.mock.calls.map(c => c[0])
    : mockWebview.posted;
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
    } catch (e) {}
  }
  return count;
}
function postInbound(content) {
  act(() => {
    (
      mode === 'transport'
        ? mockTransport.onMessageHandler
        : mockWebview.props.onMessage
    )({ nativeEvent: { data: JSON.stringify(content) } });
  });
}
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
function track(promise) {
  const state = { settled: false, value: undefined };
  promise.then(v => {
    state.settled = true;
    state.value = v;
  });
  return state;
}
const MNEMONIC = 'test mnemonic words';
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
    lastEncryptedPayload(action) {
      const calls = outbound();
      for (let i = calls.length - 1; i >= 0; i--) {
        const p = JSON.parse(calls[i]);
        if (!p.encrypted) continue;
        try {
          const inner = JSON.parse(this.decrypt(p.encrypted));
          if (!action || inner.action === action) return inner;
        } catch (e) {}
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
  };
}
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
  await advance(150);
  const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
  expect(initMsg).toBeTruthy();
  postInbound({
    encrypted: wv.encrypt(
      JSON.stringify({
        isResponse: true,
        id: initMsg.id,
        result: JSON.stringify({ isConnected: true }),
      }),
    ),
  });
  await flush();
  await advance(200);
  return wv;
}
async function transportReadyFull() {
  mockLocal.get = async () => null;
  mockActive.currentWalletMnemoinc = MNEMONIC;
  await mountTransport();
  await advance(300);
  const wv = makeWebviewCrypto();
  wv.answerHandshake();
  await flush();
  await advance(150);
  const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
  expect(initMsg).toBeTruthy();
  postInbound({
    encrypted: wv.encrypt(
      JSON.stringify({
        isResponse: true,
        id: initMsg.id,
        result: JSON.stringify({ isConnected: true }),
      }),
    ),
  });
  await flush();
  await advance(200);
  return wv;
}

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

describe('fail-closed — R-1 VERIFYING watchdog (hung verification / no load events)', () => {
  test('a verification that never resolves recovers via the verify watchdog and escalates to the native fallback; callers settle bounded', async () => {
    mockVerify.mockReturnValue(new Promise(() => {}));
    await mountWebview();
    await advance(1000);

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(st.settled).toBe(false); // held in the ready window

    // First watchdog window: verification never resolved → load failure →
    // re-verification attempt; the reset settles the held caller.
    await advance(30001);
    expect(st.settled).toBe(true);
    expect(['not-ready', 'unknown']).toContain(st.value.kind);

    // Repeated hangs escalate: fallback-pending → in-session auto-retry →
    // native (the designed terminal fallback). No state waits forever.
    await advance(120001);
    expect(SUT.getIsNativeRuntime()).toBe(true);
  });

  test('a WebView that mounts but emits NO load events is recovered by the verify watchdog', async () => {
    await mountWebview();
    await advance(300); // verification resolves, WebView mounts
    expect(mockWebview.props).toBeTruthy();
    const verifyCalls = mockVerify.mock.calls.length;

    // onLoadStart/onLoadEnd/onLoadProgress NEVER fire.
    await advance(30001);
    expect(mockVerify.mock.calls.length).toBeGreaterThan(verifyCalls);
    expect(SUT.__getFallbackStateForTest()).toBe('webview'); // first failure only
  });
});

describe('fail-closed — R-2 silent reload invalidates the old page session', () => {
  test('a stale handshake timeout after a successful re-handshake cannot flip the bridge to fallback-pending', async () => {
    mockLocal.get = async () => null;
    await mountWebview();
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(postedCount('handshake:init')).toBe(1); // handshake #1 in flight

    // Silent reload mid-handshake (no native reset).
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(postedCount('handshake:init')).toBe(2); // handshake #2 posted

    // The NEW handshake completes before the OLD 4s timeout.
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);

    // The old timeout must be recognized as stale: no fallback-pending, no
    // reconnect emit, the healthy session survives untouched.
    await advance(4001);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(SUT.getHandshakeComplete()).toBe(true);
  });

  test('a load event from a page session the bridge has already reset away from is dropped', async () => {
    const wv1 = await webviewReadyFull();
    const oldLoadEnd = mockWebview.props.onLoadEnd;
    const handshakesBefore = postedCount('handshake:init', wv1);

    // A reset (auth reset here) advances the session epoch without starting a
    // new page session: the old page's late onLoadEnd must not mark the torn
    // down session loaded, and must not start a handshake on it.
    mockAuth.authResetkey = 1;
    await act(async () => {
      renderer.update(webviewEl());
    });
    await flush();
    act(() => {
      oldLoadEnd();
    });
    await advance(300);
    expect(postedCount('handshake:init', wv1)).toBe(handshakesBefore);

    // Only the reloaded page's own load events re-arm the handshake.
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(postedCount('handshake:init', wv1)).toBe(handshakesBefore + 1);
  });

  test('stale handshake replies from the previous page are dropped without tripping the failure budget', async () => {
    const wv1 = await webviewReadyFull();
    const oldOnMessage = mockWebview.props.onMessage; // pre-reload closure

    wvLoadStart(); // silent reload → new epoch
    wvLoadEnd();

    // Two late "handshake:reply" messages from the old page arrive. Under the
    // old code each hit the decrypt path (GCM failure) and counted toward the
    // two-strike fallback escalation.
    for (let i = 0; i < 2; i++) {
      act(() => {
        oldOnMessage({
          nativeEvent: {
            data: JSON.stringify({
              type: 'handshake:reply',
              id: 'uuid-1',
              pubW: '00',
              runtimeNonce: 'garbage',
            }),
          },
        });
      });
    }
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // The new session still handshakes normally.
    const wv2 = makeWebviewCrypto();
    await advance(300);
    wv2.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test.failing(
    'a renderer-termination callback from the replaced page cannot reset the new READY session',
    async () => {
      await webviewReadyFull();
      const staleTermination = mockWebview.props.onRenderProcessGone;

      // Replace the page and bring the replacement all the way to READY.
      wvLoadStart();
      wvLoadEnd();
      await advance(300);
      const wv2 = makeWebviewCrypto();
      wv2.answerHandshake();
      await flush();
      await advance(150);
      const initMsg = wv2.lastEncryptedPayload('initializeSparkWallet');
      wv2.respond(initMsg.id, { isConnected: true });
      await flush();
      await advance(200);

      const epochBefore = SUT.__getEpochForTest();
      expect(SUT.getHandshakeComplete()).toBe(true);

      // Native may deliver the old instance's terminal callback late. It must
      // be guarded by that instance's epoch, just like onMessage is.
      act(() => {
        staleTermination({ nativeEvent: { didCrash: true } });
      });
      await flush();

      expect(SUT.__getEpochForTest()).toBe(epochBefore);
      expect(SUT.getHandshakeComplete()).toBe(true);
    },
  );

  test.failing(
    'a stale onLoadEnd cannot advance the replacement page from LOADING',
    async () => {
      const wv1 = await webviewReadyFull();
      const staleLoadEnd = mockWebview.props.onLoadEnd;
      const handshakesBefore = postedCount('handshake:init', wv1);

      // The replacement has started, but has not emitted its own terminal load
      // event. A late terminal event from the old instance must be ignored.
      wvLoadStart();
      act(() => {
        staleLoadEnd();
      });
      await advance(300);

      expect(postedCount('handshake:init', wv1)).toBe(handshakesBefore);
    },
  );

  test.failing(
    'an authenticated funds response cannot settle a different operation by reusing its request id',
    async () => {
      const wv = await webviewReadyFull();
      const sparkSend = track(
        SUT.sendWebViewRequestGlobal('sendSparkPayment', {
          receiverSparkAddress: 'sp1spark',
          amountSats: 1000,
          mnemonic: MNEMONIC,
        }),
      );
      const tokenSend = track(
        SUT.sendWebViewRequestGlobal('sendTokenPayment', {
          receiverSparkAddress: 'sp1token',
          tokenAmount: '25',
          tokenIdentifier: 'token-id',
          mnemonic: MNEMONIC,
        }),
      );
      await flush();

      const tokenRequest = wv.lastEncryptedPayload('sendTokenPayment');
      expect(tokenRequest).toBeTruthy();

      // This payload is a sendSparkPayment-shaped success, but carries the live
      // sendTokenPayment id. Authentication proves the current page sent it; it
      // does not prove which operation it answers.
      wv.respond(tokenRequest.id, {
        didWork: true,
        response: { id: 'spark-transfer-id' },
      });
      await flush();

      expect(tokenSend.settled).toBe(false);
      expect(sparkSend.settled).toBe(false);
    },
  );

  test.failing(
    'fallback-pending blocks new requests until its bounded recovery starts',
    async () => {
      const wv = await webviewReadyFull();

      postInbound({ encrypted: 'garbage-1' });
      postInbound({ encrypted: 'garbage-2' });
      await flush();
      expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');

      const postedBefore = postedCount('getSparkBalance', wv);
      const balance = track(
        SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
      );
      await flush();

      expect(postedCount('getSparkBalance', wv)).toBe(postedBefore);
      expect(balance.settled).toBe(false);
    },
  );

  test.failing(
    'provider teardown clears the module-level dispatcher',
    async () => {
      await webviewReadyFull();
      act(() => {
        renderer.unmount();
      });
      renderer = null;

      await expect(
        SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
      ).rejects.toThrow('WebView not initialized');
    },
  );
});

describe('fail-closed — R-3 stale verification results are dropped', () => {
  test('a stale verification failure cannot latch native after a newer verification succeeded', async () => {
    mockVerify.mockClear();
    mockLocal.get = async () => null;
    const deferred = [];
    mockVerify.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          deferred.push({ resolve, reject });
        }),
    );
    await mountWebview(); // verification call #1 (deferred)
    expect(mockVerify.mock.calls.length).toBe(1);

    // Resolve the initial verification normally.
    act(() => {
      deferred[0].resolve({
        htmlPath: 'file:///verified.html',
        nonceHex: 'abcdef',
      });
    });
    await flush();
    await advance(100);
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(postedCount('handshake:init')).toBe(1);

    // Two overlapping recovery reloads (auth resets): verification #2 (B) and
    // #3 (C) are both in flight.
    mockAuth.authResetkey = 1;
    rerender();
    await flush();
    mockAuth.authResetkey = 2;
    rerender();
    await flush();
    expect(mockVerify.mock.calls.length).toBe(3);

    // The NEWER verification (C) succeeds first.
    act(() => {
      deferred[2].resolve({
        htmlPath: 'file:///verified.html',
        nonceHex: 'cdefab',
      });
    });
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    // The STALE verification (B) then fails — it must NOT latch native.
    act(() => {
      deferred[1].reject(new Error('tamper'));
    });
    await flush();
    expect(SUT.getIsNativeRuntime()).toBe(false);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });
});

describe('fail-closed — R-4 in-session fallback-pending recovery', () => {
  test('a mid-session handshake failure auto-recovers while active; a second consecutive failure commits native (bounded)', async () => {
    mockLocal.get = async () => null;
    await mountTransport();
    await advance(300);
    expect(postedCount('handshake:init')).toBe(1);

    await advance(4001); // handshake #1 times out → fallback-pending
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');

    // No bg/fg needed: the in-session recovery re-arms the bridge.
    await advance(5000);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    await advance(1000);
    expect(postedCount('handshake:init')).toBe(2);

    // The retry also fails → the bounded budget commits the native fallback.
    await advance(4001);
    expect(SUT.getIsNativeRuntime()).toBe(true);
  });
});

describe('fail-closed — R-5 explicit initWallet timeout triggers bounded re-init', () => {
  test('a timed-out explicit initWallet schedules the auto-init recovery; a successful retry restores the wallet', async () => {
    // The wallet must be UNINITIALIZED (handshake complete, no wallet yet) for
    // the R-5 dead-end to exist: mount with no mnemonic so the post-handshake
    // auto-init is skipped, then provide the mnemonic and dispatch the explicit
    // init that times out.
    mockLocal.get = async () => null;
    mockActive.currentWalletMnemoinc = null;
    await mountTransport();
    await advance(300);
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    await advance(200);
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(postedCount('initializeSparkWallet', wv)).toBe(0); // no auto-init

    mockActive.currentWalletMnemoinc = MNEMONIC;
    rerender();
    await flush();

    const initCount = () => postedCount('initializeSparkWallet', wv);

    // Explicit initWallet that never responds.
    const st = track(
      SUT.sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic: MNEMONIC,
      }, true),
    );
    await flush();
    expect(initCount()).toBe(1); // the explicit init
    await advance(90001);
    expect(st.settled).toBe(true); // watchdog settles the caller (bounded)

    // The recovery timer re-runs the auto-init path (single retry attempt).
    await advance(5001);
    expect(initCount()).toBe(2);
    const retry = wv.lastEncryptedPayload('initializeSparkWallet');
    expect(retry).toBeTruthy();

    // The retry succeeds → the wallet is initialized and the bridge usable.
    postInbound({
      encrypted: wv.encrypt(
        JSON.stringify({
          isResponse: true,
          id: retry.id,
          result: JSON.stringify({ isConnected: true }),
        }),
      ),
    });
    await flush();
    await advance(200);

    const bal = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const sent = wv.lastEncryptedPayload('getSparkBalance');
    expect(sent).toBeTruthy(); // dispatched, not held
    wv.respond(sent.id, { balance: 5 });
    await flush();
    expect(bal.settled).toBe(true);
    expect(bal.value).toEqual({ balance: 5 });
  });
});

describe('fail-closed — N8 backgrounded handshake is deferred, not failed', () => {
  test('backgrounding mid-handshake consumes no fallback budget; foreground re-arms and completes', async () => {
    mockLocal.get = async () => null;
    await mountTransport();
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();

    mockAppStatus.appState = 'background';
    AppState.currentState = 'background';
    rerender();
    await flush();
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(SUT.getHandshakeComplete()).toBe(false);

    mockAppStatus.appState = 'active';
    AppState.currentState = 'active';
    rerender();
    await flush();
    await advance(300);
    expect(postedCount('handshake:init')).toBe(2);

    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });
});

describe('fail-closed — R-6 wedged hard-fail-latch read cannot park the handshake start', () => {
  test('a never-resolving AsyncStorage read times out and the handshake still starts', async () => {
    mockLocal.get = () => new Promise(() => {}); // wedged native read
    await mountTransport();
    await advance(6000); // 250ms debounce + 5s bounded latch read
    expect(postedCount('handshake:init')).toBe(1);
    // The bridge remains fully functional once the handshake is answered.
    const wv = makeWebviewCrypto();
    wv.answerHandshake();
    await flush();
    expect(SUT.getHandshakeComplete()).toBe(true);
  });
});

function rerender() {
  act(() => {
    renderer.update(mode === 'transport' ? providerEl() : webviewEl());
  });
}

// ---------------------------------------------------------------------------
// Second adversarial pass (W-1..W-3): the remaining fail-OPEN paths — places
// where liveness depended on React commit ordering or on an AppState effect
// firing, rather than on a timer the request itself owns.
// ---------------------------------------------------------------------------

describe('fail-closed — W-1 load events batched with onLoadStart are not dropped', () => {
  test('onLoadStart + onLoadEnd delivered in ONE native event batch still reaches LOADED and starts the handshake', async () => {
    mockLocal.get = async () => null;
    await mountWebview();

    // RN delivers queued native events in a single JS batch (busy JS thread at
    // boot, fast file:// load). React commits the epoch bump from onLoadStart
    // only AFTER both handlers have run, so a render-state epoch guard drops
    // the page's own terminal load event.
    act(() => {
      mockWebview.props.onLoadStart();
      mockWebview.props.onLoadEnd();
    });
    await advance(300);

    expect(lastPosted('handshake:init')).toBeTruthy();
  });

  test('onLoadProgress=1 batched with onLoadStart still marks the page loaded', async () => {
    mockLocal.get = async () => null;
    await mountWebview();

    act(() => {
      mockWebview.props.onLoadStart();
      mockWebview.props.onLoadProgress({ nativeEvent: { progress: 1 } });
    });
    await advance(300);

    expect(lastPosted('handshake:init')).toBeTruthy();
  });

  test('onError batched with onLoadStart recovers immediately instead of waiting out the 30s load watchdog', async () => {
    mockLocal.get = async () => null;
    await mountWebview();
    const verifiesBefore = mockVerify.mock.calls.length;

    act(() => {
      mockWebview.props.onLoadStart();
      mockWebview.props.onError({ nativeEvent: { description: 'boom' } });
    });
    await flush();

    // Re-verification is the recovery: it must happen on the error, not 30s later.
    expect(mockVerify.mock.calls.length).toBe(verifiesBefore + 1);
  });
});

describe('fail-closed — W-2 a backgrounded watchdog re-arms instead of orphaning the request', () => {
  test('a keep-alive timeout that fires while backgrounded still settles once the app is active', async () => {
    await webviewReadyFull();
    const st = track(
      SUT.sendWebViewRequestGlobal(
        SUT.OPERATION_TYPES.sendSparkPayment,
        {
          mnemonic: MNEMONIC,
          amountSats: 1,
          receiverSparkAddress: 'sp1qsend',
        },
        true,
      ),
    );
    await flush();
    expect(st.settled).toBe(false);

    // OS backgrounded the app; React never commits the appState change (rapid
    // flap), so the foreground AppState effect never runs the resume branch.
    AppState.currentState = 'background';
    await advance(90001);
    expect(st.settled).toBe(false);

    AppState.currentState = 'active';
    await advance(10000); // re-armed check → resume-by-id + final deadline
    await advance(30001); // final deadline
    expect(st.settled).toBe(true);
    expect(st.value.kind).toBe('unknown');
  });

  test('a handshake timeout that fires while backgrounded re-arms and still escalates once active', async () => {
    mockLocal.get = async () => null;
    await mountWebview();
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(lastPosted('handshake:init')).toBeTruthy();

    AppState.currentState = 'background';
    await advance(4001);
    // Backgrounding is not a bridge failure — no budget consumed.
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    AppState.currentState = 'active';
    await advance(6000); // re-armed check → real timeout → bounded escalation
    expect(SUT.__getFallbackStateForTest()).toBe('fallback-pending');
  });
});

describe('fail-closed — W-3 backgrounding before the handshake dispatches is deferred', () => {
  test('consumes no fallback budget and the handshake re-arms on foreground (boot phase, no reload path)', async () => {
    mockLocal.get = async () => null;
    // Pre-homepage: the foreground AppState effect deliberately does not reload
    // during boot, so the handshake start latch is the ONLY thing that can
    // re-arm the bridge. Latched, this was a permanent boot wedge.
    mockAppStatus.didGetToHomepage = false;
    await mountWebview();
    wvLoadStart();
    wvLoadEnd();

    // OS backgrounded during the 250ms debounce / latch read: the effect guard
    // still sees the (lagging) React appState as active, so the dispatch-time
    // guard is the one that catches it.
    AppState.currentState = 'background';
    await advance(300);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
    expect(postedCount('handshake:init')).toBe(0);

    AppState.currentState = 'active';
    mockAppStatus.appState = 'background';
    await act(async () => {
      renderer.update(webviewEl());
    });
    mockAppStatus.appState = 'active';
    await act(async () => {
      renderer.update(webviewEl());
    });
    await advance(300);

    expect(postedCount('handshake:init')).toBe(1);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });
});
