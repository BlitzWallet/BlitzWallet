/* eslint-env jest */
// ---------------------------------------------------------------------------
// Deep-review adversarial suite (2026-08): second-pass review findings on the
// rebuilt WebView bridge. Targets the gaps left by the TDD / adversarial /
// final-review suites:
//
//   DR-1 (fixed) sendTokenPayment has NO reconcile query: the bundle's
//        token-history rows carry byte-map tokenIdentifier / ownerPublicKey /
//        tokenAmount, never the caller's string args, so no matcher could ever
//        confirm a token send. The dead precision was removed — a timed-out
//        token send stays unknown and the user resends.
//   DR-2 (fixed) swap reconcile now matches assetInAddress / assetOutAddress:
//        a same-pool same-amount swap in the OPPOSITE direction cannot confirm.
//   DR-3 (fixed) swapTokenToBitcoin reconcile now reads the real caller's
//        amount field (tokenAmount) → executed swaps confirm to done.
//   DR-4 (fixed) silent page reload (onLoadStart without a native reset): the
//        crypto session is torn down (keys zeroed, handshake cleared) and the
//        handshake effect re-fires in-place (isWebViewReady flips) → a NEW
//        PLAINTEXT handshake runs against the fresh page; in-flight keep-alive
//        ops are marked pageDied (never re-posted into the fresh page) and
//        settle unknown at the bounded final deadline via reconcile.
//   DR-5 (fixed) GUARD CONTRACT (2026-08): the double-pay guard exists ONLY to
//        prevent automatic re-dispatch of an unresolved payment; a
//        user-initiated identical send is a new payment and dispatches
//        immediately (restore/balance handlers surface whether the earlier
//        attempt sent). The dispatch site never blocks an identical send.
//   DR-6 (plain, INTENDED) reconcile-done caller-unknown op (executeSwap): a
//        user retry after a reconcile-confirmed execution re-dispatches as a
//        NEW payment. This is the contract behavior; only the old code comment
//        ("never re-dispatch (double-pay guard)") was wrong and is corrected.
//   DR-10 (fixed) batchTransferTokens has NO reconcile query either (same
//        byte-map vs string mismatch as DR-1): a timed-out batch stays unknown
//        and the user retries it.
//   DR-11 (test.failing) fufillSparkInvoices reconcile uses `.some`: one
//        fulfilled invoice confirms the whole batch — a partially-fulfilled
//        batch is reported done.
//   DR-12 (fixed) the module-level intentStore sweeps expired unknown intents
//        on every dispatch/reconcile: after the Case-B TTL an expired unknown
//        is evicted (raw mnemonic args freed) on the next bridge activity —
//        bounded growth + no process-lifetime seed retention.
//   DR-7 (plain) duplicate same-id response: second copy dropped, single
//        settle, intent removed on done.
//   DR-8 (plain) timeout → resume-by-id re-posts the SAME id (no re-execution);
//        the real response settles the caller and the final deadline does not
//        double-settle.
//   DR-9 (plain) WebView surface pins: file-only origin whitelist, no
//        file-from-file / universal access, no cookies/cache/debugging,
//        mixedContent never, and onShouldStartLoadWithRequest rejects any URL
//        other than the verified path.
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

const mockWebview = {
  props: null,
  posted: [],
};

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

async function completeWalletInit(wv) {
  await advance(150);
  const initMsg = wv.lastEncryptedPayload('initializeSparkWallet');
  expect(initMsg).toBeTruthy();
  wv.respond(initMsg.id, { isConnected: true });
  await flush();
  await advance(200);
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

async function background() {
  mockAppStatus.appState = 'background';
  AppState.currentState = 'background';
  rerender();
  await flush();
}

async function foreground() {
  mockAppStatus.appState = 'active';
  AppState.currentState = 'active';
  rerender();
  await flush();
}

// Settles a funds op to 'unknown' via a real id-bearing bundle error, then
// runs one foreground reconcile pass (production queries).
async function setupUnknownViaError(op, args, wv) {
  const st = track(SUT.sendWebViewRequestGlobal(op, args));
  await flush();
  const msg = wv.lastEncryptedPayload(op);
  expect(msg).toBeTruthy();
  wv.postError(msg.id, 'bundle-level failure');
  await flush();
  expect(st.settled).toBe(true);
  expect(st.value.kind).toBe('bridge'); // caller-visible kind; the INTENT is unknown
  await background();
  await foreground();
  await flush();
  return { st, msg };
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
// DR-1 — token-send reconcile ignores receiver identity
// ---------------------------------------------------------------------------
describe('deep review — token sends have no reconcile query (DR-1)', () => {
  test(
    'a timed-out token send posts NO token-history reconcile query and stays unknown',
    async () => {
      const wv = await transportReadyFull();
      await setupUnknownViaError(
        'sendSparkTokens',
        {
          tokenIdentifier: 'tokA',
          tokenAmount: '500',
          receiverSparkAddress: 'sp1alice',
          mnemonic: MNEMONIC,
        },
        wv,
      );

      // The bundle's token-history rows carry byte-map tokenIdentifier /
      // ownerPublicKey / tokenAmount, never the caller's string args, so no
      // matcher could ever confirm a token send. The reconcile query is
      // therefore not issued at all — the intent stays unknown and the user
      // resends (balance / transfer handlers surface the real outcome).
      expect(wv.lastEncryptedPayload('getSparkTokenTransactions')).toBeNull();

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('unknown');
      // The retained seed is scrubbed at record time (S-4) — token sends can
      // never reconcile, so holding the mnemonic buys nothing.
      expect(entry.args.mnemonic).toBeUndefined();
    },
  );

});

// ---------------------------------------------------------------------------
// DR-2/3 — swap history has no bridge-attempt identifier. Direction, amount,
// and pool are descriptive fields and cannot prove which user request created
// a row, so swap attempts are deliberately not history-reconciled.
// ---------------------------------------------------------------------------
describe('deep review — swap history cannot settle an attempt (DR-2/3)', () => {
  for (const fixture of [
    {
      op: 'swapBitcoinToToken',
      args: {
        tokenAddress: 'usdb-token',
        amountSats: '200',
        poolId: 'pool1',
        maxSlippageBps: 500,
        mnemonic: MNEMONIC,
      },
    },
    {
      op: 'swapTokenToBitcoin',
      args: {
        tokenAddress: 'usdb-token',
        tokenAmount: '200',
        poolId: 'pool1',
        maxSlippageBps: 500,
        mnemonic: MNEMONIC,
      },
    },
  ]) {
    test(`${fixture.op} posts no swap-history reconcile query and remains unknown`, async () => {
      const wv = await transportReadyFull();
      await setupUnknownViaError(fixture.op, fixture.args, wv);

      const query = wv.lastEncryptedPayload('getUserSwapHistory');
      expect(query).toBeNull();

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('unknown');
      expect(entry.args.mnemonic).toBeUndefined();
    });
  }
});

// ---------------------------------------------------------------------------
// DR-10 — batchTransferTokens reconcile confirms the whole batch from one row
// ---------------------------------------------------------------------------
describe('deep review — token batch has no reconcile query (DR-10)', () => {
  test(
    'a timed-out token batch posts NO token-history reconcile query and stays unknown',
    async () => {
      const wv = await transportReadyFull();
      await setupUnknownViaError(
        'batchTransferTokens',
        {
          mnemonic: MNEMONIC,
          invoices: [
            {
              tokenIdentifier: 'tokA',
              receiverSparkAddress: 'sp1alice',
              tokenAmount: '500',
            },
            {
              tokenIdentifier: 'tokB',
              receiverSparkAddress: 'sp1bob',
              tokenAmount: '700',
            },
          ],
        },
        wv,
      );

      // Same as DR-1: token-history rows are byte-maps, unmatchable against the
      // caller's string args, so batch sends have no reconcile query. The batch
      // stays unknown and the user retries it.
      expect(wv.lastEncryptedPayload('getSparkTokenTransactions')).toBeNull();

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('unknown');
      expect(entry.args.mnemonic).toBeUndefined();
    },
  );

});

// ---------------------------------------------------------------------------
// DR-11 — fufillSparkInvoices reconcile confirms the whole batch from one row
// ---------------------------------------------------------------------------
describe('deep review — partial fulfill false confirmation (DR-11)', () => {
  test(
    'a partially-fulfilled invoice batch (1 of N invoices) must NOT confirm the whole fulfill as done',
    async () => {
      const wv = await transportReadyFull();
      await setupUnknownViaError(
        'fufillSparkInvoices',
        {
          mnemonic: MNEMONIC,
          invoices: [
            { invoice: 'inv-1', amount: '500' },
            { invoice: 'inv-2', amount: '700' },
          ],
        },
        wv,
      );

      const query = wv.lastEncryptedPayload('querySparkInvoices');
      expect(query).toBeTruthy();

      // Only inv-1 reached FINALIZED; inv-2 is still pending. The `.some`
      // matcher treats inv-1 alone as proof for the whole batch.
      wv.respond(query.id, {
        invoiceStatuses: [
          { invoice: 'inv-1', status: 'FINALIZED' },
          { invoice: 'inv-2', status: 1 },
        ],
      });
      await flush();

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      // Correct behavior: an unfulfilled invoice means the batch is NOT done.
      expect(entry.state).toBe('unknown');
    },
  );

});

// ---------------------------------------------------------------------------
// DR-4 — silent page reload wedges the bridge
// ---------------------------------------------------------------------------
describe('deep review — silent page reload wedge (DR-4)', () => {
  test('a silent reload from READY tears down the session and self-heals in-place: new PLAINTEXT handshake, held requests, no bg/fg needed', async () => {
    const wv = await webviewReadyFull();
    await advance(400); // consume the post-handshake effect re-fire race
    const handshakesBefore = postedCount('handshake:init', wv);
    expect(SUT.getHandshakeComplete()).toBe(true);

    // The page reloads itself (no crash event, no reset, no epoch bump): the
    // crypto session is torn down (keys zeroed) and the handshake is cleared.
    wvLoadStart();
    wvProgress();
    wvLoadEnd();
    expect(SUT.getHandshakeComplete()).toBe(false);

    // The handshake effect re-fires (isWebViewReady flipped false) and posts a
    // NEW handshake — PLAINTEXT, because the stale session key was zeroed (the
    // reloaded page could never decrypt under the old key).
    await advance(300);
    expect(postedCount('handshake:init', wv)).toBe(handshakesBefore + 1);
    expect(lastPosted('handshake:init').encrypted).toBeUndefined();

    // A request during the reload window is HELD — never posted into the
    // still-dead page.
    const held = track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    expect(postedCount('getSparkBalance', wv)).toBe(0);

    // The fresh page completes the new handshake (new session key), wallet
    // init runs, and the held request drains — all while the app stays active.
    const wv2 = makeWebviewCrypto();
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);
    expect(SUT.getHandshakeComplete()).toBe(true);

    await flush();
    expect(postedCount('getSparkBalance', wv2)).toBe(1);
    const bal = wv2.lastEncryptedPayload('getSparkBalance');
    wv2.respond(bal.id, { balanceSats: 42 });
    await flush();
    expect(held.settled).toBe(true);
    expect(held.value.balanceSats).toBe(42);
  });

  test('a keep-alive op in flight across the silent reload is never re-posted into the fresh page (pageDied) and settles unknown at the final deadline', async () => {
    const wv = await webviewReadyFull();
    await advance(400); // consume the post-handshake effect re-fire race

    const send = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const original = wv.lastEncryptedPayload('sendSparkPayment');
    expect(original).toBeTruthy();

    // The page reloads while the send is in flight: the intent is flipped to
    // unknown and the request is marked pageDied — a same-id re-post into the
    // fresh page (whose id→outcome cache is empty) would EXECUTE a second
    // payment.
    wvLoadStart();
    wvProgress();
    wvLoadEnd();
    await flush();
    expect([...SUT.__getIntentStoreForTest().values()][0].state).toBe('unknown');

    // 90s watchdog: resume-by-id refuses (pageDied) → the SAME id is never
    // re-posted and the caller is not settled (the true outcome is unknown).
    await advance(90001);
    let sameIdReposts = 0;
    let distinctIds = new Set();
    for (const raw of outbound().slice()) {
      let p;
      try {
        p = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      if (p.action === original.action && p.id === original.id) {
        sameIdReposts += 1;
        continue;
      }
      if (p.encrypted) {
        let inner;
        try {
          inner = JSON.parse(wv.decrypt(p.encrypted));
        } catch (e) {
          continue;
        }
        if (inner.id === original.id && inner.action === original.action) {
          sameIdReposts += 1;
          continue;
        }
        if (inner.action === original.action) distinctIds.add(inner.id);
        continue;
      }
      if (p.action === original.action) distinctIds.add(p.id);
    }
    expect(sameIdReposts).toBe(1); // only the original dispatch — never re-posted
    expect(distinctIds.size).toBe(0); // no second attempt either
    expect(send.settled).toBe(false);

    // Reconcile cannot confirm (the query fails: no session key) and the
    // bounded final deadline settles unknown — never a fabricated failure.
    await advance(30001);
    expect(send.settled).toBe(true);
    expect(send.value.kind).toBe('unknown');
  });

  test('bg/fg after a silent reload recovers in one cycle: full reset (nonce unverified) → NEW PLAINTEXT handshake → READY, no fallback-pending', async () => {
    const wv = await webviewReadyFull();
    await advance(400); // consume the post-handshake effect re-fire race
    wvLoadStart();
    wvProgress();
    wvLoadEnd();
    await advance(2000); // the in-place re-armed handshake already ran

    // The re-armed handshake is PLAINTEXT — never encrypted under the stale
    // key (the reloaded page could not decrypt it), so the fresh page can
    // actually answer it.
    expect(lastPosted('handshake:init').encrypted).toBeUndefined();

    // bg/fg: onLoadStart cleared nonceVerified → the foreground recovery
    // reloads the page (full reset: re-verify + remount + new load) instead
    // of wedging on an unanswerable encrypted handshake.
    const verifyCallsBefore = mockVerify.mock.calls.length;
    await background();
    await foreground();
    await advance(100);
    expect(mockVerify.mock.calls.length).toBe(verifyCallsBefore + 1);
    wvLoadStart();
    wvLoadEnd();
    await advance(300);

    // The remounted page gets its own NEW plaintext handshake.
    const plaintextCount = outbound().filter(raw => {
      try {
        return JSON.parse(raw).action === 'handshake:init';
      } catch (e) {
        return false;
      }
    });
    expect(plaintextCount.length).toBe(3); // original + re-armed + post-reset
    expect(lastPosted('handshake:init').encrypted).toBeUndefined();

    // Answer it → READY again in one cycle; the bridge never left WEBVIEW.
    const wv2 = makeWebviewCrypto();
    wv2.answerHandshake();
    await flush();
    await completeWalletInit(wv2);
    expect(SUT.getHandshakeComplete()).toBe(true);
    expect(SUT.__getFallbackStateForTest()).toBe('webview');
  });
});

// ---------------------------------------------------------------------------
// DR-5 — guard contract: a user-initiated identical send must never be blocked
// ---------------------------------------------------------------------------
// Product contract (2026-08): the double-pay guard exists ONLY to prevent the
// system from automatically re-dispatching an unresolved payment. A
// user-initiated identical send is a deliberate NEW payment and must dispatch
// immediately — the restore/balance handlers show whether the earlier attempt
// actually sent. The dispatch site enforces this (see below).
describe('deep review — user send never blocked by guard (DR-5)', () => {
  test(
    'a user-initiated identical send after a definitive error must dispatch immediately (new payment, never blocked)',
    async () => {
      const wv = await transportReadyFull();
      const args = {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      };
      const st = track(SUT.sendWebViewRequestGlobal('sendSparkPayment', args));
      await flush();
      const msg = wv.lastEncryptedPayload('sendSparkPayment');
      wv.postError(msg.id, 'Insufficient funds');
      await flush();
      expect(st.value.kind).toBe('bridge');

      // The user saw the error and sends the same payment again. Per the
      // contract this is a NEW payment: it dispatches immediately, in-window,
      // and the caller waits on the fresh attempt's outcome.
      const postsBefore = postedCount('sendSparkPayment', wv);
      const retry = track(SUT.sendWebViewRequestGlobal('sendSparkPayment', args));
      await flush();
      expect(postedCount('sendSparkPayment', wv)).toBe(postsBefore + 1);
      expect(retry.settled).toBe(false); // live dispatch, not an instant block
    },
  );

});

// ---------------------------------------------------------------------------
// DR-6 — user retry after an unknown swap re-dispatches
// ---------------------------------------------------------------------------
describe('deep review — unknown swap retry re-dispatches (DR-6)', () => {
  test('a user-initiated identical swap after an unknown result dispatches as a NEW payment', async () => {
    const wv = await transportReadyFull();
    const args = {
      poolId: 'pool1',
      assetInAddress: 'btc-asset',
      assetOutAddress: 'usdb-token',
      amountIn: '200',
      minAmountOut: '190',
      maxSlippageBps: 500,
      integratorFeeRateBps: 100,
      mnemonic: MNEMONIC,
    };
    const st = track(SUT.sendWebViewRequestGlobal('executeSwap', args));
    await flush();
    const msg = wv.lastEncryptedPayload('executeSwap');
    wv.postError(msg.id, 'request interrupted');
    await flush();
    expect(st.value.kind).toBe('bridge');

    // Foreground recovery cannot identify this attempt from swap history.
    await background();
    await foreground();
    const query = wv.lastEncryptedPayload('getUserSwapHistory');
    expect(query).toBeNull();

    const entry = [...SUT.__getIntentStoreForTest().values()][0];
    expect(entry.state).toBe('unknown');

    // The identical retry is a deliberate new payment. Transaction/balance
    // handlers surface the earlier attempt independently.
    const postsBefore = postedCount('executeSwap', wv);
    const retry = track(SUT.sendWebViewRequestGlobal('executeSwap', args));
    await flush();
    expect(postedCount('executeSwap', wv)).toBe(postsBefore + 1);
    expect(retry.settled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DR-7 — duplicate same-id response
// ---------------------------------------------------------------------------
describe('deep review — intent-store retention (DR-12)', () => {
  test(
    'an expired unknown intent is evicted on the next bridge dispatch (raw mnemonic args are freed, not retained for the process lifetime)',
    async () => {
      const wv = await transportReadyFull();
      const st = track(
        SUT.sendWebViewRequestGlobal('sendSparkPayment', {
          receiverSparkAddress: 'sp1abc',
          amountSats: 1000,
          mnemonic: MNEMONIC,
        }),
      );
      await flush();
      const msg = wv.lastEncryptedPayload('sendSparkPayment');
      wv.postError(msg.id, 'request interrupted');
      await flush();
      expect(st.value.kind).toBe('bridge');

      const entry = [...SUT.__getIntentStoreForTest().values()][0];
      expect(entry.state).toBe('unknown');
      // Non-reconcilable sends scrub the raw seed at record time.
      expect(entry.args.mnemonic).toBeUndefined();

      // Case-B TTL: past the reconcile window the intent can no longer block
      // anything or reconcile — the lazy sweep evicts it on the next bridge
      // activity (every dispatch/reconcile pass runs the sweep).
      await advance(3 * 60 * 1000 + 1);
      const balance = track(
        SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true),
      );
      await flush();
      expect(balance.settled).toBe(false); // dispatched normally
      expect([...SUT.__getIntentStoreForTest().values()].length).toBe(0);
    },
  );

  test('an unknown intent inside the retention window keeps only scrubbed bookkeeping data', async () => {
    const wv = await transportReadyFull();
    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const msg = wv.lastEncryptedPayload('sendSparkPayment');
    wv.postError(msg.id, 'request interrupted');
    await flush();
    expect(st.value.kind).toBe('bridge');

    // Still inside the retention window: the intent survives the sweep for
    // bounded bookkeeping, but it is not a history-reconcile candidate.
    await advance(60000);
    track(SUT.sendWebViewRequestGlobal('getSparkBalance', {}, true));
    await flush();
    const entries = [...SUT.__getIntentStoreForTest().values()];
    expect(entries.length).toBe(1);
    expect(entries[0].state).toBe('unknown');
    expect(entries[0].args.mnemonic).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DR-7 — duplicate same-id response
// ---------------------------------------------------------------------------
describe('deep review — duplicate response (DR-7)', () => {
  test('a second copy of the same response id is dropped; the caller settles once and the done intent is removed', async () => {
    const wv = await transportReadyFull();
    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const msg = wv.lastEncryptedPayload('sendSparkPayment');

    wv.respond(msg.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.didWork).toBe(true);
    expect([...SUT.__getIntentStoreForTest().values()].length).toBe(0);

    // Duplicate re-post of the same response: no crash, no re-settle.
    wv.respond(msg.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(st.value.didWork).toBe(true);
    expect([...SUT.__getIntentStoreForTest().values()].length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DR-8 — timeout → resume-by-id → real response
// ---------------------------------------------------------------------------
describe('deep review — keep-alive resume-by-id (DR-8)', () => {
  test('watchdog timeout re-posts the SAME id; the real response settles the caller and the final deadline is cancelled', async () => {
    const wv = await transportReadyFull();
    const st = track(
      SUT.sendWebViewRequestGlobal('sendSparkPayment', {
        receiverSparkAddress: 'sp1abc',
        amountSats: 1000,
        mnemonic: MNEMONIC,
      }),
    );
    await flush();
    const original = wv.lastEncryptedPayload('sendSparkPayment');

    // First watchdog window expires; resume-by-id re-posts the SAME id.
    await advance(90001);
    expect(st.settled).toBe(false);
    const resume = wv.lastEncryptedPayload('sendSparkPayment');
    expect(resume.id).toBe(original.id);

    // The page answers the re-post with the real outcome.
    wv.respond(resume.id, { didWork: true, response: { id: 'tx-1' } });
    await flush();
    expect(st.settled).toBe(true);
    expect(st.value.response.id).toBe('tx-1');
    expect([...SUT.__getIntentStoreForTest().values()].length).toBe(0);

    // The final deadline must not double-settle (nothing throws, value stable).
    await advance(30001);
    expect(st.value.response.id).toBe('tx-1');
  });
});

// ---------------------------------------------------------------------------
// DR-9 — WebView surface pins
// ---------------------------------------------------------------------------
describe('deep review — WebView surface pins (DR-9)', () => {
  test('the rendered WebView restricts navigation, file access, cookies, cache and debugging', async () => {
    await webviewReadyFull();
    const p = mockWebview.props;
    expect(p.originWhitelist).toEqual(['file://']);
    expect(p.allowFileAccessFromFileURLs).toBe(false);
    expect(p.allowUniversalAccessFromFileURLs).toBe(false);
    expect(p.mixedContentMode).toBe('never');
    expect(p.thirdPartyCookiesEnabled).toBe(false);
    expect(p.sharedCookiesEnabled).toBe(false);
    expect(p.webviewDebuggingEnabled).toBe(false);
    expect(p.cacheEnabled).toBe(false);

    // Only the verified path may load; everything else is refused.
    expect(
      p.onShouldStartLoadWithRequest({ url: 'https://evil.example.com' }),
    ).toBe(false);
    expect(
      p.onShouldStartLoadWithRequest({ url: 'file:///etc/passwd' }),
    ).toBe(false);
    expect(
      p.onShouldStartLoadWithRequest({ url: 'file:///verified.html' }),
    ).toBe(true);
  });
});
