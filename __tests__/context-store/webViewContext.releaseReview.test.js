/* eslint-env jest */
// ---------------------------------------------------------------------------
// P0 release-review regressions (2026-08):
//
//  B1  A handshake:reply must be bound to the pending 'handshake:init'
//      request it answers. A reply whose id belongs to ANY other pending
//      request (a page bug or id mix-up) must be dropped — it must never
//      settle a funds request with {didComplete:true}, must never drive the
//      state machine to READY, and must never orphan the real handshake.
//
//  B2  A renderer that dies WITHOUT any native event (no onRenderProcessGone,
//      no onLoadStart — the silent-death wedge) must still settle every
//      caller bounded, must not reload the bridge, and must never re-dispatch
//      a funds op under a NEW id (double-pay guard).
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
const mockWebview = { props: null, posted: [] };
const mockNav = { routes: [{ name: 'Home' }] };

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

let React;
let RTR;
let act;
let AppState;
let SUT;
let renderer;

function providerElTransport(children = null) {
  return React.createElement(
    SUT.WebViewProvider,
    { transport: mockTransport },
    children,
  );
}
function providerElWebview(children = null) {
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
  mockTransport.send = jest.fn();
  mockTransport.onMessage = jest.fn(fn => {
    mockTransport.onMessageHandler = fn;
  });
  mockTransport.destroy = jest.fn();
  mockWebview.props = null;
  mockWebview.posted = [];
  await act(async () => {
    renderer = RTR.create(providerElTransport());
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
  mockTransport.send = jest.fn();
  mockTransport.onMessage = jest.fn();
  mockTransport.destroy = jest.fn();
  mockWebview.props = null;
  mockWebview.posted = [];
  await act(async () => {
    renderer = RTR.create(providerElWebview());
  });
  await flush();
  await flush();
}
function outbound() {
  return mockTransport.send?.mock.calls.length
    ? mockTransport.send.mock.calls.map(c => c[0])
    : mockWebview.posted;
}
function postInbound(content) {
  act(() => {
    const handler =
      mockTransport.onMessageHandler || mockWebview.props.onMessage;
    handler({ nativeEvent: { data: JSON.stringify(content) } });
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
    lastPosted(action) {
      const calls = outbound();
      for (let i = calls.length - 1; i >= 0; i--) {
        const p = JSON.parse(calls[i]);
        if (!p.encrypted && p.action === action) return p;
      }
      return null;
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
    answerHandshake(nonceHex = 'abcdef', idOverride = null) {
      const payload = this.lastPosted('handshake:init');
      if (!payload) throw new Error('no handshake:init found');
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
        id: idOverride || payload.id,
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
  wv.respond(initMsg.id, { isConnected: true });
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
// B1 — handshake:reply request binding
// ---------------------------------------------------------------------------
describe('release review — a handshake:reply only settles the handshake request (B1)', () => {
  test('a handshake:reply carrying a funds request id is dropped: the funds caller stays pending and the real handshake completes', async () => {
    const wv = await webviewReadyFull();

    // Dispatch a funds op while READY: it gets a real request id.
    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        mnemonic: MNEMONIC,
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
      }),
    );
    await flush();
    const fundsMsg = wv.lastEncryptedPayload('sendSparkPayment');
    expect(fundsMsg).toBeTruthy();
    expect(st.settled).toBe(false);
    // Snapshot the session key that encrypted the original dispatch; after the
    // reload + re-handshake below the page-side key rotates, so the original
    // post can only be counted with the key that produced it.
    const firstSessionKey = Buffer.from(wv.aesKey);

    // The page silently reloads (new epoch, new session key, new handshake).
    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    expect(wv.lastPosted('handshake:init')).toBeTruthy();

    // The page answers the new handshake but MISROUTES the reply: it echoes the
    // funds request id instead of the handshake id. The nonce proof is valid
    // (the page genuinely knows the runtime nonce) — this is a page bug, not a
    // forgery, so the native side must still refuse to let a handshake reply
    // settle a non-handshake request.
    wv.answerHandshake('abcdef', fundsMsg.id);
    await flush();

    // The funds caller must NOT have been settled by the misrouted reply.
    expect(st.settled).toBe(false);

    // The bridge must still be able to complete the real handshake: answer it
    // with the correct id and the funds op must still be pending for its own
    // outcome path (never re-dispatched under a new id).
    const handshakeMsg = wv.lastPosted('handshake:init');
    expect(handshakeMsg).toBeTruthy();
    wv.answerHandshake('abcdef', handshakeMsg.id);
    await flush();
    await advance(150);

    // Answer the drain's auto wallet re-init so the bridge stays healthy
    // while the funds request runs out its own outcome path.
    const initMsg2 = wv.lastEncryptedPayload('initializeSparkWallet');
    if (initMsg2) {
      wv.respond(initMsg2.id, { isConnected: true });
      await flush();
      await advance(200);
    }

    const posts = outbound();
    let fundsPosts = 0;
    for (const raw of posts) {
      const p = JSON.parse(raw);
      if (p.encrypted) {
        try {
          let inner;
          try {
            inner = JSON.parse(wv.decrypt(p.encrypted));
          } catch (e) {
            const parts = p.encrypted.split('?iv=');
            const [ct, params] = parts;
            if (parts.length !== 2) continue;
            const [ivB64, tagB64] = params.split('&tag=');
            const decipher = require('node:crypto').createDecipheriv(
              'aes-256-gcm',
              firstSessionKey,
              Buffer.from(ivB64, 'base64'),
            );
            decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
            const dec = decipher.update(ct, 'base64', 'utf8');
            inner = JSON.parse(dec + decipher.final('utf8'));
          }
          if (inner.action === 'sendSparkPayment') fundsPosts += 1;
        } catch (e) {}
      }
    }
    // Original dispatch only — no automatic re-dispatch under a new id.
    expect(fundsPosts).toBe(1);
    expect(st.settled).toBe(false);

    // The request's own outcome path still owns the settle: final deadline.
    await advance(90000 + 30000);
    expect(st.settled).toBe(true);
    expect(st.value.didWork).toBe(false);
    expect(st.value.kind).toBe('unknown');
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });

  test('a misrouted handshake:reply cannot flip the bridge to READY or orphan the real handshake', async () => {
    const wv = await webviewReadyFull();

    const st = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const balanceMsg = wv.lastEncryptedPayload('getSparkBalance');
    expect(balanceMsg).toBeTruthy();

    wvLoadStart();
    wvLoadEnd();
    await advance(300);
    wv.answerHandshake('abcdef', balanceMsg.id);
    await flush();

    // The misrouted reply must not have completed the handshake: the real
    // handshake request is still outstanding and the real reply still lands.
    const handshakeMsg = wv.lastPosted('handshake:init');
    expect(handshakeMsg).toBeTruthy();
    wv.answerHandshake('abcdef', handshakeMsg.id);
    await flush();
    await advance(150);

    // Answer the drain's auto wallet re-init (the reload cleared the page's
    // wallet state) so the post-handshake request dispatches instead of hold.
    const initMsg2 = wv.lastEncryptedPayload('initializeSparkWallet');
    if (initMsg2) {
      wv.respond(initMsg2.id, { isConnected: true });
      await flush();
      await advance(200);
    }

    // A normal post-handshake request works: the bridge is READY, not stuck.
    const st2 = track(SUT.sendWebViewRequestGlobal('getBalance', {}, true));
    await flush();
    const bal2 = wv.lastEncryptedPayload('getBalance');
    expect(bal2).toBeTruthy();
    wv.respond(bal2.id, { didWork: true, balance: '42' });
    await flush();
    expect(st2.settled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B2 — silent renderer death (no native event at all)
// ---------------------------------------------------------------------------
describe('release review — silent renderer death settles bounded, never re-dispatches (B2)', () => {
  test('a funds op posted into a silently-dead page settles unknown at the final deadline; no reload, no new id', async () => {
    const wv = await webviewReadyFull();
    const epochBefore = SUT.__getEpochForTest();

    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        mnemonic: MNEMONIC,
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
      }),
    );
    await flush();
    const fundsMsg = wv.lastEncryptedPayload('sendSparkPayment');
    expect(fundsMsg).toBeTruthy();

    // NO load/crash/message events ever arrive (silent renderer death).
    await advance(90000); // original watchdog timeout
    // Resume-by-id re-posts the SAME id (the native side cannot know the page
    // died): that re-post is idempotent by contract, never a new execution.
    await advance(30000); // keep-alive final deadline
    await flush();

    expect(st.settled).toBe(true);
    expect(st.value.didWork).toBe(false);
    expect(st.value.kind).toBe('unknown');
    // No epoch bump: the bridge did NOT reload mid-request (no interrupt of
    // other in-flight ops, no fabricated failure while the page might be fine).
    expect(SUT.__getEpochForTest()).toBe(epochBefore);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');

    const posts = outbound();
    let fundsPosts = 0;
    for (const raw of posts) {
      const p = JSON.parse(raw);
      if (p.encrypted) {
        try {
          const inner = JSON.parse(wv.decrypt(p.encrypted));
          if (inner.action === 'sendSparkPayment') {
            fundsPosts += 1;
            expect(inner.id).toBe(fundsMsg.id); // same id or nothing
          }
        } catch (e) {}
      }
    }
    expect(fundsPosts).toBe(2); // original dispatch + one same-id resume
  });

  test('a non-funds read posted into a silently-dead page settles at its own watchdog with kind timeout', async () => {
    const wv = await webviewReadyFull();
    const st = track(SUT.sendWebViewRequestGlobal('getBalance', {}, true));
    await flush();
    const msg = wv.lastEncryptedPayload('getBalance');
    expect(msg).toBeTruthy();

    await advance(30000);
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.didWork).toBe(false);
    expect(st.value.kind).toBe('timeout');
  });
});
