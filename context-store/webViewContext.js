import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import WebView from 'react-native-webview';
import customUUID from '../app/functions/customUUID';
import EventEmitter from 'events';
import { sha256 } from '@noble/hashes/sha2';
import { hkdf } from '@noble/hashes/hkdf';
import { AppState, Platform } from 'react-native';
import { getSharedSecret, getPublicKey } from '@noble/secp256k1';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'react-native-quick-crypto';
import sha256Hash from '../app/functions/hash';
import { verifyAndPrepareWebView } from '../app/functions/webview/bundleVerification';
import DeviceInfo, {
  getModel,
  getSystemVersion,
  getVersion,
} from 'react-native-device-info';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import { useAppStatus } from './appStatus';
import { useActiveCustodyAccount } from './activeAccount';
import { useAuthContext } from './authContext';
import { navigationRef } from '../navigation/navigationService';

export const OPERATION_TYPES = {
  // Spark
  initWallet: 'initializeSparkWallet',
  getIdentityKey: 'getSparkIdentityPubKey',
  getBalance: 'getSparkBalance',
  getL1Address: 'getSparkStaticBitcoinL1Address',
  queryStaticL1Address: 'queryAllStaticDepositAddresses',
  getUtxosForDepositAddress: 'getUtxosForDepositAddress',
  getUtxosForIdentity: 'getUtxosForIdentity',
  getL1AddressQuote: 'getSparkStaticBitcoinL1AddressQuote',
  claimStaticDepositAddress: 'claimnSparkStaticDepositAddress',
  getSparkAddress: 'getSparkAddress',
  sendSparkPayment: 'sendSparkPayment',
  sendTokenPayment: 'sendSparkTokens',
  getSparkLeaves: 'getSparkLeaves',
  getSparkLeafExitNodes: 'getSparkLeafExitNodes',
  getLightningFee: 'getSparkLightningPaymentFeeEstimate',
  getBitcoinPaymentRequest: 'getSparkBitcoinPaymentRequest',
  getBitcoinPaymentFee: 'getSparkBitcoinPaymentFeeEstimate',
  getSparkPaymentFee: 'getSparkPaymentFeeEstimate',
  receiveLightningPayment: 'receiveSparkLightningPayment',
  getLightningSendRequest: 'getSparkLightningSendRequest',
  getLightningPaymentStatus: 'getSparkLightningPaymentStatus',
  sendLightningPayment: 'sendSparkLightningPayment',
  sendBitcoinPayment: 'sendSparkBitcoinPayment',
  getTransactions: 'getSparkTransactions',
  getTokenTransactions: 'getSparkTokenTransactions',
  addListeners: 'addWalletEventListener',
  removeListeners: 'removeWalletEventListener',
  disposeWallet: 'disposeSparkWallet',
  setPrivacyEnabled: 'setPrivacyEnabled',
  getSingleTxDetails: 'getSingleTxDetails',
  createSatsInvoice: 'createSatsInvoice',
  fufillSparkInvoices: 'fufillSparkInvoices',
  batchTransferTokens: 'batchTransferTokens',
  createTokensInvoice: 'createTokensInvoice',
  claimSparkHodlLightningPayment: 'claimSparkHodlLightningPayment',
  receiveSparkHodlLightningPayment: 'receiveSparkHodlLightningPayment',
  querySparkHodlLightningPayments: 'querySparkHodlLightningPayments',
  isOptimizationInProgress: 'isOptimizationInProgress',
  querySparkInvoices: 'querySparkInvoices',

  // Flashnet
  initializeFlashnet: 'initializeFlashnet',
  listFlashnetPools: 'listFlashnetPools',
  findBestPool: 'findBestPool',
  getPoolDetails: 'getPoolDetails',
  listAllPools: 'listAllPools',
  minFlashnetSwapAmounts: 'minFlashnetSwapAmounts',
  simulateSwap: 'simulateSwap',
  executeSwap: 'executeSwap',
  swapBitcoinToToken: 'swapBitcoinToToken',
  swapTokenToBitcoin: 'swapTokenToBitcoin',
  getLightningPaymentQuote: 'getLightningPaymentQuote',
  getUserSwapHistory: 'getUserSwapHistory',
  requestClawback: 'requestClawback',
  checkClawbackEligibility: 'checkClawbackEligibility',
  requestBatchClawback: 'requestBatchClawback',
  listClawbackableTransfers: 'listClawbackableTransfers',

  // Wallet Viewer
  initializeSparkWalletViewer: 'initializeSparkWalletViewer',
  getWalletViewerTokens: 'getWalletViewerTokens',
  getWalletViewerBitcoin: 'getWalletViewerBitcoin',
  getWalletViewerTokenTransactions: 'getWalletViewerTokenTransactions',
  getWalletViewerBitcoinTransactions: 'getWalletViewerBitcoinTransactions',
};

const longOperations = new Set([
  OPERATION_TYPES.sendSparkPayment,
  OPERATION_TYPES.sendTokenPayment,
  OPERATION_TYPES.getBitcoinPaymentRequest,
  OPERATION_TYPES.getBitcoinPaymentFee,
  OPERATION_TYPES.sendLightningPayment,
  OPERATION_TYPES.sendBitcoinPayment,
  OPERATION_TYPES.initWallet,
  OPERATION_TYPES.initializeFlashnet,
  OPERATION_TYPES.executeSwap,
  OPERATION_TYPES.swapBitcoinToToken,
  OPERATION_TYPES.swapTokenToBitcoin,
  OPERATION_TYPES.requestClawback,
  OPERATION_TYPES.claimSparkHodlLightningPayment,
  OPERATION_TYPES.receiveSparkHodlLightningPayment,
  OPERATION_TYPES.fufillSparkInvoices,
  OPERATION_TYPES.batchTransferTokens,
  OPERATION_TYPES.getSparkLeaves,
  OPERATION_TYPES.getSparkLeafExitNodes,
  OPERATION_TYPES.initializeSparkWalletViewer,
]);

const mediumOperations = new Set([
  OPERATION_TYPES.claimStaticDepositAddress,
  OPERATION_TYPES.getBalance,
  OPERATION_TYPES.queryStaticL1Address,
  OPERATION_TYPES.getUtxosForDepositAddress,
  OPERATION_TYPES.getL1AddressQuote,
  OPERATION_TYPES.getSparkAddress,
  OPERATION_TYPES.getL1Address,
  OPERATION_TYPES.receiveLightningPayment,
  OPERATION_TYPES.getLightningSendRequest,
  OPERATION_TYPES.getLightningPaymentStatus,
  OPERATION_TYPES.getTransactions,
  OPERATION_TYPES.getSingleTxDetails,
  OPERATION_TYPES.getTokenTransactions,
  OPERATION_TYPES.setPrivacyEnabled,
  OPERATION_TYPES.simulateSwap,
  OPERATION_TYPES.requestBatchClawback,
  OPERATION_TYPES.listClawbackableTransfers,
  OPERATION_TYPES.createSatsInvoice,
  OPERATION_TYPES.createTokensInvoice,
  OPERATION_TYPES.getLightningPaymentQuote,
  OPERATION_TYPES.getLightningFee,
  OPERATION_TYPES.getSparkPaymentFee,
  OPERATION_TYPES.getUserSwapHistory,
  OPERATION_TYPES.checkClawbackEligibility,
  OPERATION_TYPES.isOptimizationInProgress,
  OPERATION_TYPES.getWalletViewerTokens,
  OPERATION_TYPES.getWalletViewerBitcoin,
  OPERATION_TYPES.getWalletViewerTokenTransactions,
  OPERATION_TYPES.getWalletViewerBitcoinTransactions,
  OPERATION_TYPES.querySparkInvoices,
]);

const rejectIfNotConnectedToInternet = new Set([
  OPERATION_TYPES.claimStaticDepositAddress,
  OPERATION_TYPES.sendSparkPayment,
  OPERATION_TYPES.sendTokenPayment,
  OPERATION_TYPES.getBitcoinPaymentRequest,
  OPERATION_TYPES.getBitcoinPaymentFee,
  OPERATION_TYPES.sendLightningPayment,
  OPERATION_TYPES.sendBitcoinPayment,
  OPERATION_TYPES.receiveLightningPayment,
  OPERATION_TYPES.getL1Address,
  // The quote action matched getL1Address under the old substring matching;
  // listed explicitly so exact matching keeps rejecting it offline.
  OPERATION_TYPES.getL1AddressQuote,
  OPERATION_TYPES.getSparkAddress,
]);

export const INCOMING_SPARK_TX_NAME = 'RECEIVED_CONTACTS EVENT';
export const incomingSparkTransaction = new EventEmitter();

export const BALANCE_UPDATE_EVENT_NAME = 'SPARK_BALANCE_UPDATE';
export const sparkBalanceUpdateEmitter = new EventEmitter();

export const TOKEN_BALANCE_UPDATE_EVENT_NAME = 'SPARK_TOKEN_BALANCE_UPDATE';
export const sparkTokenBalanceUpdateEmitter = new EventEmitter();

export const STREAM_STATUS_EVENT_NAME = 'SPARK_STREAM_STATUS';
export const sparkStreamStatusEmitter = new EventEmitter();
const WASM_ERRORS = [
  'WASM',
  'WebAssembly',
  'WebAssembly.Compile is disallowed on the main thread',
  "Cannot read properties of undefined (reading '__wbindgen_malloc')",
];

// ---------------------------------------------------------------------------
// 3-state native-fallback machine (D-9). Module-level so it survives provider
// re-renders and WebView remounts; reset only on app restart or an explicit
// setForceReactNative(false) / session-start recovery.
// ---------------------------------------------------------------------------
const FALLBACK_STATE = {
  WEBVIEW: 'webview',
  PENDING: 'fallback-pending',
  NATIVE: 'native',
};
const HARD_FAIL_PERSIST_KEY = 'FORCE_REACT_NATIVE';
let fallbackState = FALLBACK_STATE.WEBVIEW;
let fallbackRetries = 0;
const MAX_WEBVIEW_FAILURES = 2;
const MAX_HOLD_REQUESTS = 50;
// Bounded hold backstop. Must exceed the longest op timeout (90s init) so it
// never races a legitimately in-progress init — it only settles requests when
// the ready-window is truly stuck (verification hung, page never loaded).
const HOLD_TTL_MS = 120 * 1000;
// Bounded re-init after a failed auto-init: without it the bridge sits
// handshake-complete but wallet-uninitialized with no drain trigger (C-5).
const INIT_RETRY_DELAY_MS = 5 * 1000;
const MAX_INIT_RETRIES = 3;

let handshakeComplete = false;
let globalSendWebViewRequest = null;
let webviewFailureCount = 0;
// A page load that produces no events is a wedge (C-11): treat it as a load
// failure after this window so the foregrounded bridge self-recovers.
const LOAD_WATCHDOG_MS = 30 * 1000;
// Verification/mount watchdog: covers VERIFYING and a WebView that mounts but
// never emits ANY load event (onLoadStart missing). Without it a hung
// verifyAndPrepareWebView / never-mounted WebView parks the bridge in VERIFYING
// with no recovery path (R-1).
const VERIFY_WATCHDOG_MS = 30 * 1000;
// In-session fallback-pending recovery: a PENDING bridge retries once while the
// app stays active instead of waiting for a bg/fg cycle (R-4).
const FALLBACK_RETRY_DELAY_MS = 5 * 1000;
// Bounded read of the hard-fail latch: a wedged AsyncStorage native read must
// not park the handshake start forever (R-6).
const HANDSHAKE_START_TIMEOUT_MS = 5 * 1000;
// Re-check interval for a request watchdog that fired while the app was
// backgrounded (W-2). The settle/resume is deferred to the foreground, but the
// request keeps owning a timer so a missed AppState transition can never leave
// a caller's promise with nothing to settle it.
const BACKGROUND_RECHECK_MS = 5 * 1000;

// ---------------------------------------------------------------------------
// Intent store (plan §3.1 — the only surviving bespoke funds-safety machinery).
// Module-level: it must survive WebView remounts (the bundle's duplicate-id Set
// dies with the page; the intent store does not).
// ---------------------------------------------------------------------------
const intentStore = new Map();

// ── Double-pay guard contract (2026-08, product decision) ──────────────────
// The ONLY purpose of the intent guard is to stop the SYSTEM from automatically
// re-dispatching a payment whose outcome is unresolved (the old queue
// re-queued and re-dispatched on reset; here, the remaining automatic path is
// coalescing a concurrent duplicate dispatch of the same user action while the
// first is still in flight). The guard is NOT an authorization gate:
//   * A user-initiated identical send is a deliberate NEW payment and must
//     always dispatch — never return a "blocked" result.
//   * Whether the previous payment actually sent is surfaced by the restore
//     handler and the balance handler (transaction restore + balance updates),
//     not by the bridge refusing the new send.
//   * The 'unknown' intent state preserves lifecycle bookkeeping; transaction
//     restore and balance updates surface any completed payment independently.
//     It must not gate later user sends.
// ───────────────────────────────────────────────────────────────────────────

// Mutating funds ops that need the intent guard so the SYSTEM never reposts an
// unresolved operation into a fresh page. sendSparkLightningPayment is
// deliberately excluded: it is SAFE-VIA-IDEMPOTENCY (bundle passes
// idempotencyKey = invoice, D-10) and never auto-retries.
const FUNDS_OPS = new Set([
  OPERATION_TYPES.sendSparkPayment,
  OPERATION_TYPES.sendTokenPayment,
  OPERATION_TYPES.sendBitcoinPayment,
  OPERATION_TYPES.claimStaticDepositAddress,
  OPERATION_TYPES.fufillSparkInvoices,
  OPERATION_TYPES.batchTransferTokens,
  OPERATION_TYPES.executeSwap,
  OPERATION_TYPES.swapBitcoinToToken,
  OPERATION_TYPES.swapTokenToBitcoin,
  OPERATION_TYPES.requestClawback,
  OPERATION_TYPES.requestBatchClawback,
]);

// Keep-alive ops (every send / mutating op): NEVER fabricated-settled by an
// app-state/background transition. Their promises stay live until a real
// outcome — backend response (page survived), resume-by-id (same epoch), or
// deterministic network reconcile where available (page reloaded) — with a
// bounded watchdog final deadline as the sole negative last resort. FUNDS_OPS
// plus the lightning send, which
// is SAFE-VIA-IDEMPOTENCY (bundle passes idempotencyKey = invoice, D-10) but
// must not be fabricated-failed mid-send either.
const KEEP_ALIVE_OPS = new Set([
  ...FUNDS_OPS,
  OPERATION_TYPES.sendLightningPayment,
  OPERATION_TYPES.getBitcoinPaymentRequest,
  OPERATION_TYPES.getBitcoinPaymentFee,
  OPERATION_TYPES.receiveLightningPayment,
  OPERATION_TYPES.getLightningFee,
  OPERATION_TYPES.getSparkPaymentFee,
  OPERATION_TYPES.initWallet,
  OPERATION_TYPES.initializeSparkWalletViewer,
]);

// Fulfill consumers cannot consume a reconcile-built success shape (they read
// .satsTransactionSuccess): on a reconcile hit the RECORDED truth settles
// 'done' (so restore/reconcile can surface it), but a live caller resolves
// with the unknown shape it already handles, never a success it mis-parses as
// a failure (F-1). That caller-visible 'unknown' is informational — per the
// guard contract it never blocks a later user-initiated identical send.
const RECONCILE_CALLER_UNKNOWN_OPS = new Set([
  OPERATION_TYPES.fufillSparkInvoices,
]);
const RECONCILE_UNKNOWN_CALLER_RESULT = {
  didWork: false,
  error: 'Request status unknown — check before retrying',
  kind: 'unknown',
};

// Ops with no reconcile query (buildReconcileQuery returns null) can never be
// reconciled — retaining their raw mnemonic in module memory for the process
// lifetime buys nothing (S-4). Their stored args are scrubbed at record time;
// the guard keys off the CALLER's args, so the intent key matches any
// identical call (and per the contract that call dispatches as a NEW payment).
const NO_RECONCILE_QUERY_OPS = new Set([
  // Send/swap history has no request-level idempotency key. Amount, recipient,
  // pool, direction and timestamps cannot distinguish two legitimate payments
  // submitted close together, so history must never fabricate the outcome of a
  // specific attempt. Transaction/balance handling remains the source of truth.
  OPERATION_TYPES.sendSparkPayment,
  OPERATION_TYPES.executeSwap,
  OPERATION_TYPES.swapBitcoinToToken,
  OPERATION_TYPES.swapTokenToBitcoin,
  OPERATION_TYPES.sendBitcoinPayment,
  OPERATION_TYPES.requestClawback,
  OPERATION_TYPES.requestBatchClawback,
  // Token sends have no reconcile query: the bundle's token-history rows carry
  // byte-map tokenIdentifier / ownerPublicKey / tokenAmount (see
  // app/functions/lrc20/index.js), never the caller's string args, so no
  // matcher could ever confirm them. A timed-out token send stays unknown; the
  // user resends and the balance / transfer handlers surface whether the first
  // attempt executed.
  OPERATION_TYPES.sendTokenPayment,
  OPERATION_TYPES.batchTransferTokens,
]);

// Shared by the claim reconcile query builder and matcher: a FULL first page
// means the unclaimed list may be truncated — absence of the utxo is then
// unproven and must not be read as "executed" (F-8).
const RECONCILE_UTXO_PAGE_LIMIT = 100;

const RECONCILE_WINDOW_MS = 3 * 60 * 1000;
// Bounded final deadline for keep-alive ops (last-resort backstop): one
// timeout window + this grace, then the watchdog settles a real
// {didWork:false, kind:'unknown'} so the promise can never zombie. Kept short
// so the total stays inside the intent-retention window.
const KEEP_ALIVE_FINAL_DEADLINE_MS = 30 * 1000;
const FULFILLED_INVOICE_STATUSES = new Set([
  2,
  'FINALIZED',
  'INVOICE_STATUS_FINALIZED',
]);

// Test seams: injected reconcile query + call count (plan Phase 0).
let reconcileQueryOverride = null;
let reconcileQueryCount = 0;
let epochForTest = 0;

const sha256Hex = value => Buffer.from(sha256(value)).toString('hex');

const canonicalArgs = args => {
  const sorted = {};
  Object.keys(args)
    .sort()
    .forEach(key => {
      sorted[key] = args[key];
    });
  return JSON.stringify(sorted);
};

const walletHashOf = mnemonic => (mnemonic ? sha256Hash(mnemonic) : '');

const stableKeyFor = (op, args, walletHash) =>
  sha256Hex(`${op}|${canonicalArgs(args)}|${walletHash}`);

const intentIdFor = (op, args, walletHash, attempt) =>
  sha256Hex(`${op}|${canonicalArgs(args)}|${walletHash}|${attempt}`);

// Settle every resolver attached to an intent. Used by the dispatch completion
// path (response/timeout) and by foreground reconcile. `resolverResult` lets a
// caller-visible settle differ from the recorded truth (F-1); a done intent is
// never reconciled again, so its mnemonic is scrubbed (S-4).
const settleIntent = (entry, result, newState, resolverResult = result) => {
  entry.state = newState;
  entry.result = result;
  if (newState === 'done' && entry.args?.mnemonic) {
    entry.args = { ...entry.args, mnemonic: undefined };
  }
  const resolvers = entry.resolvers;
  entry.resolvers = [];
  resolvers.forEach(resolve => {
    if (typeof resolve === 'function') resolve(resolverResult);
  });
};

// Eviction (DR-12 / S-4): an intent whose retention window has fully elapsed
// is either 'done' (confirmed — the record is spent; a later identical call
// dispatches as a new payment anyway) or still 'unknown' (treated as
// never-executed; the contract never blocks a user send on it). Retaining the
// entry — and its raw mnemonic args — buys nothing, so it is pruned. 'done'
// intents already had their mnemonic scrubbed by settleIntent; pruning removes
// the seed from memory entirely. Lazy sweep: runs on every dispatch and every
// reconcile pass, so memory stays bounded without a global timer. In-flight
// intents are never pruned.
const pruneExpiredIntents = () => {
  const now = Date.now();
  for (const [key, entry] of intentStore) {
    if (entry.state === 'in-flight') continue;
    if (now - entry.dispatchedAt > RECONCILE_WINDOW_MS) {
      intentStore.delete(key);
    }
  }
};

// Per-op reconcile query builders (plan §3.1.3). Return null for ops with no
// deterministic pre-response reconcile query. Send/swap history matching is
// deliberately excluded because it cannot identify a specific attempt.
const buildReconcileQuery = (op, entry, mnemonic) => {
  switch (op) {
    case OPERATION_TYPES.claimStaticDepositAddress:
      return {
        action: OPERATION_TYPES.getUtxosForDepositAddress,
        args: {
          mnemonic,
          depositAddress: entry.args.depositAddress,
          limit: RECONCILE_UTXO_PAGE_LIMIT,
          offset: 0,
          excludeClaimed: true,
        },
      };
    case OPERATION_TYPES.fufillSparkInvoices:
      return {
        action: OPERATION_TYPES.querySparkInvoices,
        args: {
          mnemonic,
          invoices: (entry.args.invoices || []).map(i => i.invoice),
        },
      };
    default:
      return null;
  }
};

const buildReconcileMatcher = op => {
  switch (op) {
    case OPERATION_TYPES.claimStaticDepositAddress:
      return (entry, result) => {
        // A failed/absent query (didWork:false or no utxos array) is a MISS,
        // not "consumed": absence-of-utxo must never be read as execution.
        if (!result || result.didWork === false || !Array.isArray(result.utxos))
          return false;
        // A FULL first page may be truncated — the deposit utxo could sit on a
        // later page, so its absence here proves nothing (F-8).
        if (result.utxos.length >= RECONCILE_UTXO_PAGE_LIMIT) return false;
        return !result.utxos.some(
          u =>
            u.txid === entry.args.transactionId &&
            Number(u.vout) === Number(entry.args.outputIndex),
        );
      };
    case OPERATION_TYPES.fufillSparkInvoices:
      return (entry, result) => {
        // EVERY invoice in the batch must be fulfilled (DR-11): one fulfilled
        // row must never confirm the whole batch.
        const invoices = entry.args.invoices || [];
        if (!invoices.length) return false;
        const statusByInvoice = new Map(
          (result?.invoiceStatuses || []).map(s => [s.invoice, s.status]),
        );
        return invoices.every(inv =>
          FULFILLED_INVOICE_STATUSES.has(statusByInvoice.get(inv.invoice)),
        );
      };
    default:
      return null;
  }
};

const extractReconcileTxid = (op, result, entry) => {
  switch (op) {
    case OPERATION_TYPES.claimStaticDepositAddress:
      return entry.args.transactionId;
    default:
      return undefined;
  }
};

// Consumer-compatible response for a deterministically reconciled op.
const extractReconcileResponse = (op, result, entry) => {
  return { id: extractReconcileTxid(op, result, entry) };
};

const setHandshakeComplete = value => {
  handshakeComplete = value;
};

// On startup/loading routes a handshake failure must not emit a reconnect
// (state: true) — the login flow handles connection itself; emitting would
// race it. Shared by the reload-verification and handshake failure paths.
const isOnStartupRoute = () => {
  try {
    if (navigationRef.isReady && navigationRef.isReady() === false) return true;
    const currentRoutes = navigationRef.getRootState().routes?.map(r => r.name);
    return (
      currentRoutes?.includes('Splash') ||
      currentRoutes?.includes('SplashReload') ||
      currentRoutes?.includes('Home') ||
      currentRoutes?.includes('ConnectingToNodeLoadingScreen')
    );
  } catch (err) {
    // navigationRef not mounted yet — treat as a startup route (no reconnect emit).
    return true;
  }
};

let clearWebViewForNative = null;
export const __setClearWebViewForNativeForTest = fn => {
  clearWebViewForNative = fn;
};

const enterNative = (reason, persist) => {
  console.warn(`Switching to native Spark runtime: ${reason}`);
  fallbackState = FALLBACK_STATE.NATIVE;
  if (persist) {
    // Version-stamped kill-switch (S-5): an app update re-tries the bridge — a
    // still-broken/tampered bundle simply re-persists on re-verification, so
    // the latch is never a permanent, un-inspectable downgrade.
    setLocalStorageItem(HARD_FAIL_PERSIST_KEY, getVersion());
  }
  // Entering native must unmount the WebView so no second
  // event source lingers (duplicate balance updates, second wallet).
  clearWebViewForNative?.();
};

const enterFallbackPending = reason => {
  if (fallbackState === FALLBACK_STATE.NATIVE) return;
  console.warn(`WebView fallback pending: ${reason}`);
  fallbackState = FALLBACK_STATE.PENDING;
  fallbackRetries += 1;
  if (fallbackRetries >= 2) {
    // One recovery attempt per session; a second consecutive failure is terminal
    // for this session (no persist — next app start retries the bridge).
    enterNative('repeated bridge failure', false);
  }
};

export const setForceReactNative = (value, reason = 'unknown') => {
  if (value === true) {
    console.warn(`forceReactNativeUse set to true. Reason: ${reason}`);
    fallbackState = FALLBACK_STATE.NATIVE;
    clearWebViewForNative?.();
  } else {
    // Explicit recovery path (D-9).
    fallbackState = FALLBACK_STATE.WEBVIEW;
  }
};

export const sendWebViewRequestGlobal = async (
  action,
  args = {},
  encrypt = true,
) => {
  if (!globalSendWebViewRequest) {
    throw new Error(
      'WebView not initialized. Ensure WebViewProvider is mounted.',
    );
  }
  return globalSendWebViewRequest(action, args, encrypt);
};

export const getHandshakeComplete = () => {
  if (fallbackState !== FALLBACK_STATE.WEBVIEW) {
    return false;
  }
  return handshakeComplete;
};

// The native latch — true only once the fallback machine has actually
// committed to native (a persisted FORCE_REACT_NATIVE flag or repeated bridge
// failure). This is the same gate the WebView send path uses (the NATIVE
// latch): during a transient reload the handshake is incomplete but this stays
// false, so callers keep routing to the WebView (which holds their requests)
// instead of spawning an orphan native wallet.
export const getIsNativeRuntime = () => fallbackState === FALLBACK_STATE.NATIVE;

// Test seams (plan Phase 0) — read-only except __setReconcileQueryForTest.
export const __getIntentStoreForTest = () => intentStore;
export const __getFallbackStateForTest = () => fallbackState;
export const __getEpochForTest = () => epochForTest;
export const __getReconcileQueryCountForTest = () => reconcileQueryCount;
export const __setReconcileQueryForTest = fn => {
  reconcileQueryOverride = fn;
};

let _testVerifiedPath = '';
export const __getVerifiedPathForTest = () => _testVerifiedPath;

// Derive AES-256 key via HKDF-SHA256 from sharedX (32 bytes)
function deriveAesKeyFromSharedX(sharedX, randomNonce) {
  // sharedX should be Uint8Array or Buffer
  const ikm =
    sharedX instanceof Uint8Array ? sharedX : Uint8Array.from(sharedX);
  // no salt, info = 'ecdh-aes-key'
  const keyBytes = hkdf(
    sha256,
    ikm,
    new Uint8Array(0),
    new TextEncoder().encode('ecdh-aes-key:' + randomNonce),
    32,
  );
  return Buffer.from(keyBytes); // Buffer of length 32
}

const WV_STATES = {
  UNLOADED: 'unloaded',
  VERIFYING: 'verifying',
  LOADING: 'loading',
  LOADED: 'loaded',
  HANDSHAKING: 'handshaking',
  READY: 'ready',
  ERROR: 'error',
};

// A reset can arrive in any state, so every state may transition to UNLOADED
// (including UNLOADED itself — e.g. an auth reset before verification).
const VALID_TRANSITIONS = {
  [WV_STATES.UNLOADED]: [WV_STATES.VERIFYING, WV_STATES.UNLOADED],
  [WV_STATES.VERIFYING]: [
    WV_STATES.LOADING,
    // Transport (test) mode marks the bridge loaded directly after
    // verification (no native load events); production reaches LOADED via
    // onLoadStart → LOADING → LOADED.
    WV_STATES.LOADED,
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.LOADING]: [WV_STATES.LOADED, WV_STATES.ERROR, WV_STATES.UNLOADED],
  [WV_STATES.LOADED]: [
    WV_STATES.HANDSHAKING,
    WV_STATES.LOADING, // the page can always reload itself before handshake
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.HANDSHAKING]: [
    WV_STATES.READY,
    WV_STATES.HANDSHAKING, // deferred handshake re-armed on the same page
    WV_STATES.LOADING, // self-reload mid-handshake
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.READY]: [
    WV_STATES.LOADING, // silent page self-reload (DR-4)
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.ERROR]: [WV_STATES.LOADING, WV_STATES.UNLOADED],
};

const WebViewContext = createContext(null);

export const WebViewProvider = ({ children, transport = null }) => {
  const { authResetkey } = useAuthContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { appState, isConnectedToTheInternet, didGetToHomepage } =
    useAppStatus();
  const webViewRef = useRef(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [verifiedPath, setVerifiedPath] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Keep module-level test seam in sync
  useEffect(() => {
    _testVerifiedPath = verifiedPath;
  }, [verifiedPath]);

  // Entering native must unmount the WebView.
  useEffect(() => {
    clearWebViewForNative = () => {
      setVerifiedPath('');
      nonceVerified.current = false;
      if (aesKeyRef.current?.fill) aesKeyRef.current.fill(0);
      aesKeyRef.current = null;
      if (sessionKeyRef.current?.privateKey?.fill)
        sessionKeyRef.current.privateKey.fill(0);
      sessionKeyRef.current = null;
      _testVerifiedPath = '';
    };
    return () => {
      clearWebViewForNative = null;
    };
  }, []);

  // sessionEpoch (D-1): monotonic int bumped on every reset; every load/message
  // callback captures the epoch it belongs to and stale-epoch events are
  // dropped before processing.
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  // Epoch of the page session the current load callbacks belong to (W-1).
  // onLoadStart bumps epochRef and records it here; onLoadEnd/onLoadProgress/
  // onError compare against THIS instead of the render-time `epoch` state,
  // which still lags by a commit when RN delivers those events in the same
  // native batch as onLoadStart — the guard was dropping the page's OWN
  // terminal load event and parking the bridge in LOADING until the watchdog.
  const pageEpochRef = useRef(0);
  const holdBufferRef = useRef([]);
  const pendingRequests = useRef({});
  const activeTimeoutsRef = useRef({});
  const sessionKeyRef = useRef(null);
  const aesKeyRef = useRef(null);
  const expectedNonceRef = useRef(null);
  const nonceVerified = useRef(false);
  const previousAppState = useRef(appState);
  const prevConnectionStatus = useRef(isConnectedToTheInternet);
  const internetConnectionRef = useRef(isConnectedToTheInternet);
  const walletInitialized = useRef(false);
  const initRetryCountRef = useRef(0);
  const drainHoldBufferRef = useRef(null);
  const isInitialRender = useRef(true);
  const currentWalletMnemoincRef = useRef(currentWalletMnemoinc);
  const isWebviewReadyRef = useRef(transport ? !!verifiedPath : false);
  const didRunHandshakeRef = useRef(false);
  // Re-entrancy guard for startHandshake, kept SEPARATE from didRunHandshakeRef.
  // didRunHandshakeRef means "the handshake has finished" — the loading screen
  // gates its reconnect on it, so it must not go true until the handshake
  // completes (or a native fallback is committed). Collapsing the two lets the
  // loading screen reconnect mid-handshake and create a native wallet.
  const didRunInit = useRef(false);
  const didGetToHomepageRef = useRef(didGetToHomepage);
  const foregroundIdRef = useRef(0);
  const loadWatchdogRef = useRef(null);
  const verifyWatchdogRef = useRef(null);
  const initRecoveryTimerRef = useRef(null);
  // Latest load-error handler for the verify watchdog (defined later in the
  // component; the watchdog itself must be armable from VERIFYING entry points).
  const loadErrorHandlerRef = useRef(null);
  // Latest refs for the always-on fallback-pending recovery tick (R-4).
  const appStateRef = useRef(appState);
  const blockAndResetRef = useRef(null);
  const [changeSparkConnectionState, setChangeSparkConnectionState] = useState({
    state: null,
    count: 0,
  });
  const wvState = useRef(WV_STATES.UNLOADED);

  const messageRateLimiter = useRef({
    count: 0,
    windowStart: Date.now(),
    maxPerSecond: 50,
  });

  const transitionWvState = useCallback((newState, reason = '') => {
    const current = wvState.current;
    const valid = VALID_TRANSITIONS[current];
    if (!valid || !valid.includes(newState)) {
      console.warn(
        `Invalid WebView state transition: ${current} → ${newState} (reason: ${reason})`,
      );
      return false;
    }
    console.log(`WebView state: ${current} → ${newState} (${reason})`);
    wvState.current = newState;

    // Any transition out of LOADING disarms the load watchdog (C-11); any
    // transition out of VERIFYING disarms the verification watchdog (R-1).
    if (newState !== WV_STATES.LOADING && loadWatchdogRef.current) {
      clearTimeout(loadWatchdogRef.current);
      loadWatchdogRef.current = null;
    }
    if (newState !== WV_STATES.VERIFYING && verifyWatchdogRef.current) {
      clearTimeout(verifyWatchdogRef.current);
      verifyWatchdogRef.current = null;
    }

    // Derive isWebViewReady from state machine
    const ready =
      newState === WV_STATES.LOADED ||
      newState === WV_STATES.HANDSHAKING ||
      newState === WV_STATES.READY;
    setIsWebViewReady(ready);
    return true;
  }, []);

  // Verification/mount watchdog (R-1): armed on every VERIFYING entry, disarmed
  // by any transition out of VERIFYING (in transitionWvState). Covers both a
  // hung verifyAndPrepareWebView and a WebView that mounts but never emits a
  // single load event (onLoadStart missing). A backgrounded/suspended
  // verification is re-armed, not failed — recovery happens 30s after the app
  // is next foregrounded. Escalation mirrors the load watchdog (failure budget
  // → fallback-pending → bounded retry → native).
  const armVerifyWatchdog = useCallback(() => {
    if (verifyWatchdogRef.current) clearTimeout(verifyWatchdogRef.current);
    verifyWatchdogRef.current = setTimeout(() => {
      verifyWatchdogRef.current = null;
      if (wvState.current !== WV_STATES.VERIFYING) return;
      if (AppState.currentState !== 'active') {
        armVerifyWatchdog();
        return;
      }
      loadErrorHandlerRef.current?.('verification watchdog timeout');
    }, VERIFY_WATCHDOG_MS);
  }, []);

  const fileHash = !!verifiedPath
    ? process.env.SPARK_WEBVIEW_SIGNING_PUBKEY
    : '';

  useEffect(() => {
    currentWalletMnemoincRef.current = currentWalletMnemoinc;
  }, [currentWalletMnemoinc]);

  // In transport (test) mode the provider is "ready" as soon as the bundle is
  // verified; in production the WebView load events drive readiness.
  useEffect(() => {
    isWebviewReadyRef.current = transport ? !!verifiedPath : isWebViewReady;
  }, [transport, verifiedPath, isWebViewReady]);

  useEffect(() => {
    didGetToHomepageRef.current = didGetToHomepage;
  }, [didGetToHomepage]);

  useEffect(() => {
    internetConnectionRef.current = isConnectedToTheInternet;
  }, [isConnectedToTheInternet]);

  // reset webview when app is stale in background
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    // Session-start recovery: an auth reset is a new session (D-9).
    if (fallbackState === FALLBACK_STATE.PENDING) {
      fallbackState = FALLBACK_STATE.WEBVIEW;
    }

    // No cross-session retention: settle the hold-buffer explicitly (the reset
    // below would settle it as 'unknown'; the auth-reset message is the one the
    // login flow has always surfaced).
    const buffer = holdBufferRef.current;
    holdBufferRef.current = [];
    buffer.forEach(({ resolvers, ttlId }) => {
      if (ttlId) clearTimeout(ttlId);
      resolvers.forEach(resolve => {
        if (typeof resolve === 'function') {
          resolve({
            error: 'Wallet initialization failed, using React Native',
          });
        }
      });
    });

    // Keep currentWalletMnemoincRef populated: logout restarts the app, and a
    // same-account auth reset needs the live ref for the post-handshake
    // wallet re-init (the old hard null left the wallet un-initialized after
    // long-background recovery).
    blockAndResetWebview();
  }, [authResetkey]);

  // Settle the hold-buffer with one result. Used on background (D-6), resets,
  // handshake failure and auth reset — the buffer never outlives the
  // ready-window it was built for.
  const settleHoldBuffer = useCallback(result => {
    const buffer = holdBufferRef.current;
    holdBufferRef.current = [];
    buffer.forEach(({ resolvers, ttlId }) => {
      if (ttlId) clearTimeout(ttlId);
      resolvers.forEach(resolve => {
        if (typeof resolve === 'function') resolve(result);
      });
    });
  }, []);

  // Bounded single-flight re-init recovery (R-5): after an explicit
  // initWallet timeout/malformed response, the bridge is handshake-complete but
  // wallet-uninitialized with no other drain trigger. Scheduling a drain re-runs
  // the auto-init path (its own bounded retries → fallback-pending → native).
  const scheduleInitRecovery = useCallback(() => {
    if (initRecoveryTimerRef.current) return;
    initRecoveryTimerRef.current = setTimeout(() => {
      initRecoveryTimerRef.current = null;
      if (fallbackState === FALLBACK_STATE.NATIVE) return;
      drainHoldBufferRef.current?.();
    }, INIT_RETRY_DELAY_MS);
  }, []);

  // Single-settle: clears the watchdog + pending entry and resolves the caller.
  // For funds ops the intent entry is settled first (done → removed; anything
  // else → unknown so foreground reconcile can settle it).
  const finalizeRequest = useCallback((id, result, intentState) => {
    const entry = pendingRequests.current[id];
    if (!entry) return;
    delete pendingRequests.current[id];
    const t = activeTimeoutsRef.current[id];
    if (t?.timeoutId) clearTimeout(t.timeoutId);
    delete activeTimeoutsRef.current[id];
    if (entry.stableKey) {
      const intent = intentStore.get(entry.stableKey);
      if (intent) {
        if (intentState === 'done') {
          settleIntent(intent, result, 'done');
          intentStore.delete(entry.stableKey);
        } else {
          settleIntent(intent, result, 'unknown');
        }
      }
    }
    entry.resolve(result);
  }, []);

  const resetWebViewState = useCallback(
    (sparkConnectionState, clearHandshake = true) => {
      console.log('Resetting WebView state', {
        clearHandshake,
        sparkConnectionState,
      });
      // Bump the session epoch: every callback from the previous session
      // (stale WebView instance, late load event, late message) is dropped.
      epochRef.current += 1;
      setEpoch(epochRef.current);
      epochForTest = epochRef.current;

      // Transition to UNLOADED — this also sets isWebViewReady(false) via
      // derived state (every state allows the reset transition).
      transitionWvState(WV_STATES.UNLOADED, 'reset');

      // No re-queue: the hold-buffer was ready-window-only and every in-flight
      // request settles as unknown (funds intents reconcile on foreground).
      settleHoldBuffer({
        didWork: false,
        error: 'Request interrupted by bridge reset',
        kind: 'unknown',
      });
      Object.keys(pendingRequests.current).forEach(id => {
        const pending = pendingRequests.current[id];
        if (pending && KEEP_ALIVE_OPS.has(pending.action)) {
          const intent =
            pending.stableKey && intentStore.get(pending.stableKey);
          // Send interrupted by a background transition whose page has now died
          // (this reset = epoch change): its outcome is unknowable and
          // reconcile could false-match a prior identical tx (see
          // [[funds-identical-resend-principle]]). Drop the intent entirely — no
          // reconcile, no re-post. Settle every coalesced caller 'unknown' and
          // allow an immediate identical resend; a send that really executed is
          // surfaced by the transaction-restore path, not by this bridge.
          if (intent && intent.backgroundedWhileInFlight) {
            settleIntent(
              intent,
              {
                didWork: false,
                error: 'Unable to finish action, request got cleaned up.',
                kind: 'unknown',
              },
              'unknown',
            );
            intentStore.delete(pending.stableKey);
            const t = activeTimeoutsRef.current[id];
            if (t?.timeoutId) clearTimeout(t.timeoutId);
            delete activeTimeoutsRef.current[id];
            delete pendingRequests.current[id];
            return;
          }
          // Live-page / clean-reset send: never fabricate a settle. The caller's
          // promise stays live — deterministic reconciliation may settle it
          // after the handshake; otherwise the watchdog's final deadline is
          // the floor. The intent is marked unknown for lifecycle bookkeeping
          // (its resolvers are NOT called here).
          if (intent && intent.state === 'in-flight') {
            intent.state = 'unknown';
            intent.result = null;
          }
          return;
        }
        finalizeRequest(
          id,
          {
            didWork: false,
            error: 'Unable to finish action, request got cleaned up.',
            kind: 'unknown',
          },
          'unknown',
        );
      });

      // Zero key material on every teardown path.
      if (aesKeyRef.current?.fill) aesKeyRef.current.fill(0);
      aesKeyRef.current = null;
      if (sessionKeyRef.current?.privateKey?.fill) {
        sessionKeyRef.current.privateKey.fill(0);
      }
      sessionKeyRef.current = null;
      expectedNonceRef.current = null;
      nonceVerified.current = false;

      // Every reset tears down the session key and reloads the page: clear the
      // handshake so the ready-window hold engages during the reload (there is
      // no AES key until the new handshake completes) and selectSparkRuntime
      // routes through the native fallback until the bridge is live again.
      if (clearHandshake) {
        setHandshakeComplete(false);
      }

      // Always reset walletInitialized because WebView reload clears its internal state
      // We'll need to reinitialize the wallet after handshake completes
      walletInitialized.current = false;
      setChangeSparkConnectionState(prev => ({
        state: sparkConnectionState,
        count: prev.count + 1,
      }));
    },
    [finalizeRequest, settleHoldBuffer, transitionWvState],
  );

  const reloadWebViewSecurely = useCallback(async () => {
    const verifyEpoch = epochRef.current;
    try {
      console.log('Re-verifying WebView before reload...');
      if (fallbackState === FALLBACK_STATE.NATIVE) return;

      transitionWvState(WV_STATES.VERIFYING, 'reload verification');
      armVerifyWatchdog();

      // Unmount the old instance so the error-path reset actually remounts
      // (the old no-op same-value set was the reset wedge).
      setVerifiedPath('');

      // Re-verify the file
      const { htmlPath, nonceHex } = await verifyAndPrepareWebView(
        Platform.OS === 'ios'
          ? require('spark-web-context')
          : 'file:///android_asset/sparkContext.html',
      );

      // A newer reset/session owns the bridge now — never apply a stale
      // verification result (or a stale nonce) to the current session.
      if (epochRef.current !== verifyEpoch) return;

      // File is verified, safe to reload
      console.log('File integrity verified, reloading WebView');
      didRunHandshakeRef.current = false;
      didRunInit.current = false; // re-arm the handshake for the reloaded page
      expectedNonceRef.current = nonceHex;
      pageEpochRef.current = epochRef.current;
      setVerifiedPath(htmlPath);
      setReloadKey(prev => prev + 1);
    } catch (err) {
      // A stale verification failure must not latch native after a newer
      // verification already succeeded (R-3).
      if (epochRef.current !== verifyEpoch) return;
      console.error('WebView re-verification failed:', err);

      // Hard-fail class — persist native fallback only on TAMPER (bad/missing
      // signature). A transient IO error goes native for this session but must
      // not persist the kill-switch (S-5).
      enterNative('bundle verification failed', err?.isTamper === true);
      setHandshakeComplete(false);
      const blockReset = isOnStartupRoute();

      setChangeSparkConnectionState(prev => ({
        state: blockReset ? null : true,
        count: prev.count + 1,
      }));
      // VERIFYING is terminal here (native latch) — disarm the watchdog.
      if (verifyWatchdogRef.current) {
        clearTimeout(verifyWatchdogRef.current);
        verifyWatchdogRef.current = null;
      }
    }
  }, []);

  const blockAndResetWebview = useCallback(() => {
    resetWebViewState(false);
    reloadWebViewSecurely(); // Will allow handshake to complete after state variables change. We are preventing a race condition here with the app state.
  }, [resetWebViewState, reloadWebViewSecurely]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);
  useEffect(() => {
    blockAndResetRef.current = blockAndResetWebview;
  }, [blockAndResetWebview]);

  const encryptMessage = useCallback(plaintext => {
    if (!aesKeyRef.current) throw new Error('AES key not initialized');
    const iv = Buffer.from(randomBytes(12));
    const cipher = createCipheriv('aes-256-gcm', aesKeyRef.current, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64'); // Get 16-byte auth tag
    return `${encrypted}?iv=${iv.toString('base64')}&tag=${authTag}`;
  }, []);

  const decryptMessage = useCallback(encryptedText => {
    if (!aesKeyRef.current) throw new Error('AES key not initialized');
    if (!encryptedText.includes('?iv=') || !encryptedText.includes('&tag=')) {
      throw new Error('Missing IV or auth tag');
    }
    const [ciphertext, params] = encryptedText.split('?iv=');
    const [ivBase64, authTagBase64] = params.split('&tag=');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', aesKeyRef.current, iv);
    decipher.setAuthTag(authTag); // Set auth tag for verification
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }, []);

  const postToWebView = useCallback(
    data => {
      if (transport) {
        transport.send(data);
        return;
      }
      if (webViewRef.current) {
        webViewRef.current.postMessage(data);
      }
    },
    [transport],
  );

  // Keep-alive resume (plan §4): re-post the SAME request id to the page that
  // received the original dispatch. The backend's id→outcome cache returns the
  // in-flight promise / stored result — the op is NEVER re-executed and the
  // original caller resolves with the real outcome. Re-sends only when the page
  // is provably the dispatch session (`dispatchEpoch` matches + handshake
  // verified); a reloaded page has a new epoch (and a new session key + empty
  // backend cache), so re-sending there would re-execute → double pay — that
  // caller falls back to deterministic reconciliation when available. Always
  // arms the bounded final deadline:
  // the ONLY negative settle for a keep-alive op, and only when the real
  // outcome never arrives.
  const resumeKeepAliveRequest = useCallback(
    id => {
      const entry = pendingRequests.current[id];
      if (!entry) return false;
      if (!KEEP_ALIVE_OPS.has(entry.action)) return false;
      if (entry.keepAliveTimedOut) return false; // final deadline already armed
      let resumed = false;
      if (entry.pageDied) {
        // DR-4: the page that dispatched this request died and a fresh page
        // loaded. Its id→outcome cache is empty — re-posting the same id
        // there would EXECUTE a second payment. Deterministic reconciliation
        // may settle it; the final deadline below is still the bounded floor —
        // without it, a pageDied keep-alive op with no deterministic query
        // would hang the caller forever (no re-post, no settle).
        // Fall through with resumed=false: skip the re-post, arm the deadline.
      } else if (
        entry.dispatchEpoch === epochRef.current &&
        nonceVerified.current
      ) {
        if (entry.payload) {
          try {
            if (entry.encrypt && aesKeyRef.current) {
              const encrypted = encryptMessage(JSON.stringify(entry.payload));
              postToWebView(JSON.stringify({ encrypted }));
            } else if (entry.encrypt) {
              console.error(
                'Keep-alive resume skipped: AES key unavailable for',
                entry.action,
              );
            } else {
              postToWebView(JSON.stringify(entry.payload));
            }
            resumed = true;
          } catch (err) {
            console.error('Keep-alive resume re-post failed:', err);
          }
        }
      }

      // Last-resort backstop: one more bounded window, then settle the caller
      // with a real {didWork:false, kind:'unknown'} — never a fabricated
      // failure while the true outcome is still unknown.
      entry.keepAliveTimedOut = true;
      const prev = activeTimeoutsRef.current[id];
      if (prev?.timeoutId) clearTimeout(prev.timeoutId);
      const finalTimeoutId = setTimeout(() => {
        const e = pendingRequests.current[id];
        if (!e) return;
        finalizeRequest(
          id,
          {
            didWork: false,
            error: `Call unresponsive (final deadline after ${KEEP_ALIVE_FINAL_DEADLINE_MS}ms)`,
            kind: 'unknown',
          },
          e.stableKey ? 'unknown' : null,
        );
      }, KEEP_ALIVE_FINAL_DEADLINE_MS);
      activeTimeoutsRef.current[id] = {
        timeoutId: finalTimeoutId,
        startedAt: Date.now(),
        duration: KEEP_ALIVE_FINAL_DEADLINE_MS,
        handler: null,
        action: entry.action,
      };
      return resumed;
    },
    [encryptMessage, postToWebView, finalizeRequest],
  );

  const getTimeoutDuration = useCallback(action => {
    if (action === 'handshake:init') return 4000;

    if (longOperations.has(action)) {
      return 90000; // 90 seconds for payment operations
    }

    if (mediumOperations.has(action)) {
      return 30000; // 30 seconds
    }

    return 10000; // 10 seconds
  }, []);

  const sendWebViewRequestInternal = useCallback(
    (action, args = {}, encrypt = true) => {
      return new Promise(resolve => {
        // Bounded memory + seed retention (DR-12/S-4): sweep expired intents on
        // every dispatch so the store never grows without bound.
        pruneExpiredIntents();

        // 1. Native latch.
        if (fallbackState === FALLBACK_STATE.NATIVE) {
          return resolve({
            didWork: false,
            error: 'Wallet initialization failed, using React Native(1)',
            kind: 'bridge',
          });
        }

        // 2. Background: settle immediately, no retention (D-5/D-6).
        if (AppState.currentState === 'background') {
          return resolve({
            didWork: false,
            error: 'Request deferred: app is in the background',
            // A handshake caught here backgrounded between the effect's
            // (lagging) React appState check and the dispatch. That is a
            // deferral, not a bridge failure — the same kind the background
            // settle path uses, so it never consumes the fallback budget (W-3).
            kind: action === 'handshake:init' ? 'deferred' : 'unknown',
          });
        }

        // 3. Offline: settle immediately, no queue (D-8).
        if (!internetConnectionRef.current) {
          return resolve({
            didWork: false,
            error: 'App is not connected to the internet',
            kind: 'offline',
          });
        }

        // 4. Ready-window hold (verify→load→handshake ≈250ms debounce + 4s
        //    watchdog; init window). Bounded, no TTL, no coalescing, no
        //    cross-background/offline retention (D-5).
        const inReadyWindow =
          !verifiedPath ||
          !isWebviewReadyRef.current ||
          !handshakeComplete ||
          (!walletInitialized.current && action !== OPERATION_TYPES.initWallet);

        if (action !== 'handshake:init' && inReadyWindow) {
          if (holdBufferRef.current.length >= MAX_HOLD_REQUESTS) {
            console.warn('Request hold-buffer full, rejecting:', action);
            return resolve({
              didWork: false,
              error: 'Request queue full',
              kind: 'not-ready',
            });
          }
          // Coalesce identical held funds ops (old-queue semantics): the drain
          // is sequential, so without this the second copy dispatches as a
          // brand-new payment after the first completes → double pay.
          let holdKey = null;
          if (FUNDS_OPS.has(action)) {
            const walletHash = args.mnemonic ? walletHashOf(args.mnemonic) : '';
            holdKey = stableKeyFor(action, args, walletHash);
            const dup = holdBufferRef.current.find(
              e => e.stableKey === holdKey,
            );
            if (dup) {
              dup.resolvers.push(resolve);
              return;
            }
          }
          console.log(
            'WebView not ready, holding request:',
            action,
            'held:',
            holdBufferRef.current.length + 1,
          );
          const holdEntry = {
            action,
            args,
            encrypt,
            resolvers: [resolve],
            stableKey: holdKey,
          };
          // Bounded hold TTL: if the ready-window never completes (verification
          // hangs, page never loads), the held promise must still settle so
          // awaiting UI can't hang forever.
          holdEntry.ttlId = setTimeout(() => {
            const idx = holdBufferRef.current.indexOf(holdEntry);
            if (idx === -1) return; // already drained/settled
            holdBufferRef.current.splice(idx, 1);
            holdEntry.resolvers.forEach(r => {
              if (typeof r === 'function') {
                r({
                  didWork: false,
                  error: 'Request timed out while the bridge was not ready',
                  kind: 'not-ready',
                });
              }
            });
          }, HOLD_TTL_MS);
          holdBufferRef.current.push(holdEntry);
          return;
        }

        let id;
        try {
          id = customUUID();
        } catch (err) {
          // Entropy failure: never dispatch with a falsy id (it would collide
          // every caller on one pending slot). Settle a bridge error instead of
          // rejecting — the always-resolve contract holds.
          return resolve({
            didWork: false,
            error: 'Unable to generate request id',
            kind: 'bridge',
          });
        }
        const timeoutDuration = getTimeoutDuration(action);
        const startedAt = Date.now();

        // 5. Funds-op intent guard — recorded BEFORE postMessage (TDD §2).
        let stableKey = null;
        if (FUNDS_OPS.has(action)) {
          const walletHash = args.mnemonic ? walletHashOf(args.mnemonic) : '';
          stableKey = stableKeyFor(action, args, walletHash);
          const existing = intentStore.get(stableKey);
          if (existing) {
            if (existing.state === 'in-flight') {
              // Same attempt racing itself → coalesce onto the first dispatch.
              existing.resolvers.push(resolve);
              return;
            }
            // Guard contract (DR-5): any non-in-flight record — 'done'
            // (confirmed executed), 'unknown' (unresolved, may or may not have
            // executed) or an expired entry — is spent/stale. A user-initiated
            // identical call is a NEW payment and MUST dispatch; whether the
            // earlier attempt actually sent is surfaced by the restore/balance
            // handlers, never by this bridge refusing the new send. Consistent
            // with the normal-success path (finalizeRequest deletes on done,
            // test.js:543-544) — drop the spent record and dispatch.
            intentStore.delete(stableKey);
          }
          const entry = {
            intentId: intentIdFor(action, args, walletHash, 0),
            stableKey,
            op: action,
            key: walletHash,
            // Retain the full args (incl. mnemonic): multiple wallets are
            // initialized/used concurrently, so a proper reconcile must query
            // each intent's OWN wallet history — currentWalletMnemoinc is only
            // one of several active seeds and cannot confirm a secondary
            // wallet's send. No-reconcile-query ops are scrubbed instead (S-4).
            args: NO_RECONCILE_QUERY_OPS.has(action)
              ? { ...args, mnemonic: undefined }
              : args,
            argsHash: sha256Hex(canonicalArgs(args)),
            state: 'in-flight',
            result: null,
            requestId: id,
            attempt: 0,
            resolvers: [resolve],
            dispatchedAt: startedAt,
            reconciledAt: 0,
          };
          intentStore.set(stableKey, entry);
        }

        const handleTimeout = () => {
          const entry = pendingRequests.current[id];
          if (!entry) return; // already settled

          // Backgrounded deferral must RE-ARM, never return bare (W-2): the
          // request would otherwise be left with no timer and no owner, and
          // only the foreground AppState effect taking exactly the right
          // branch could ever settle it. Mirrors armLoadWatchdog /
          // armVerifyWatchdog — every pending request always owns a live timer
          // until it is settled. (iOS suspends JS timers while backgrounded,
          // so this costs nothing there; on Android it is a cheap re-check.)
          const deferToForeground = () => {
            const prev = activeTimeoutsRef.current[id];
            if (prev?.timeoutId) clearTimeout(prev.timeoutId);
            activeTimeoutsRef.current[id] = {
              ...prev,
              timeoutId: setTimeout(handleTimeout, BACKGROUND_RECHECK_MS),
            };
          };

          // Keep-alive ops (sends) never settle on a watchdog timeout alone:
          // the real outcome is still unknown. First timeout → resume-by-id
          // (same page: re-post the same id — the backend cache returns the
          // real outcome, never a re-execution) or reconcile (page reloaded).
          // The final deadline armed by resumeKeepAliveRequest is the only
          // negative settle, and only as last resort. (The iOS JS timer is
          // suspended while backgrounded, so nothing fires here in the
          // background; on Android we defer to the foreground effect too.)
          if (KEEP_ALIVE_OPS.has(entry.action)) {
            if (entry.keepAliveTimedOut) return; // final deadline owns the settle
            if (AppState.currentState === 'background') {
              deferToForeground();
              return;
            }
            // initWallet is kept alive across background (so a mid-init
            // background transition isn't fabricated-failed) but must NOT
            // resume-by-id on a foreground watchdog timeout: re-posting a hung
            // init only delays the failure 30s and defeats the bounded re-init.
            // Settle at its own timeout so the drain's awaited caller sees a
            // non-connected result → onInitFailed → buffer settle + re-init
            // (R-5/R-6/N9).
            if (entry.action === OPERATION_TYPES.initWallet) {
              finalizeRequest(
                id,
                {
                  didWork: false,
                  error: `Call unresponsive (timeout after ${timeoutDuration}ms)`,
                  kind: 'timeout',
                },
                null,
              );
              scheduleInitRecovery();
              return;
            }
            const resumed = resumeKeepAliveRequest(id);
            if (!resumed) {
              // Page reloaded/crashed (epoch changed): re-sending there would
              // re-execute → double pay. Reconcile only when the operation has
              // a deterministic query; otherwise the final watchdog settles.
              reconcileUnknownIntents();
            }
            return;
          }

          const isFundsOp = FUNDS_OPS.has(entry.action);
          const result = {
            didWork: false,
            error: `Call unresponsive (timeout after ${timeoutDuration}ms)`,
            // Funds ops settle as unknown — the op may have executed. This
            // prevents a fabricated failure/success while transaction and
            // balance handling surface the eventual result.
            kind: isFundsOp ? 'unknown' : 'timeout',
          };
          console.error(`WebView request timeout for action: ${entry.action}`);

          if (entry.action === 'handshake:init') {
            if (AppState.currentState === 'background') {
              deferToForeground(); // deferred (N8), not orphaned (W-2)
              return;
            }
            finalizeRequest(id, result, null);
            // Handshake failure handling (fallback transition, buffer settle,
            // connection state) lives in initHandshake — it owns the session
            // start/stop semantics.
            return;
          }

          finalizeRequest(id, result, isFundsOp ? 'unknown' : null);
        };

        const timeoutId = setTimeout(handleTimeout, timeoutDuration);

        activeTimeoutsRef.current[id] = {
          timeoutId,
          startedAt,
          duration: timeoutDuration,
          handler: handleTimeout,
          action,
        };

        // 5b. Stamped BEFORE dispatch so the resume path can prove the request
        //     belongs to the current page session (plan §4 double-pay guard).
        const dispatchEpoch = epochRef.current;

        // 6. Hash into a copy — the intent entry above holds the pre-hash args
        //    so a replay through this function hashes exactly once (tests 9-10).
        let transportArgs = args;
        if (
          args.mnemonic &&
          action !== 'initializeSparkWallet' &&
          action !== 'initializeSparkWalletViewer'
        ) {
          transportArgs = { ...args, mnemonic: sha256Hash(args.mnemonic) };
        }

        const payload = {
          id,
          action,
          args: transportArgs,
        };

        pendingRequests.current[id] = {
          resolve,
          action,
          stableKey,
          dispatchEpoch,
          payload,
          encrypt,
          timeoutDuration,
          keepAliveTimedOut: false,
        };

        try {
          if (encrypt && aesKeyRef.current) {
            const encrypted = encryptMessage(JSON.stringify(payload));
            postToWebView(JSON.stringify({ encrypted }));
          } else if (encrypt && action !== 'handshake:init') {
            // Fail closed: encryption was requested but no session key exists
            // (pre-handshake or mid-reset race). Never downgrade the payload
            // to plaintext.
            throw new Error('Encryption required but AES key unavailable');
          } else {
            postToWebView(JSON.stringify(payload));
          }
        } catch (err) {
          // Nothing was (or could be) posted — the op did not dispatch, so the
          // intent entry is removed rather than left unknown.
          if (stableKey) intentStore.delete(stableKey);
          finalizeRequest(
            id,
            { didWork: false, error: err.message, kind: 'bridge' },
            null,
          );
        }
      });
    },
    [
      finalizeRequest,
      getTimeoutDuration,
      encryptMessage,
      postToWebView,
      resumeKeepAliveRequest,
      scheduleInitRecovery,
      verifiedPath,
      handshakeComplete,
    ],
  );

  // Drains the ready-window hold-buffer. Runs after handshake completion and
  // after wallet init. Re-initializes the wallet first when needed (the bundle
  // clears its state on reload) — unless the buffer already carries an explicit
  // initWallet — then dispatches held requests sequentially (the flood cap
  // makes parallel dispatch unsafe).
  const drainHoldBuffer = useCallback(async () => {
    if (
      handshakeComplete &&
      !walletInitialized.current &&
      currentWalletMnemoincRef.current &&
      !holdBufferRef.current.some(
        entry => entry.action === OPERATION_TYPES.initWallet,
      )
    ) {
      console.log('Re-initializing wallet before processing buffer');
      // A failed/timed-out auto-init would otherwise leave the bridge
      // handshake-complete but wallet-uninitialized forever (no other drain
      // trigger). Schedule a bounded re-init so the wallet self-heals; escalate
      // to fallback-pending once retries are exhausted.
      const onInitFailed = () => {
        settleHoldBuffer({
          didWork: false,
          error: 'Wallet initialization failed, using React Native',
          kind: 'not-ready',
        });
        if (initRetryCountRef.current < MAX_INIT_RETRIES) {
          initRetryCountRef.current += 1;
          scheduleInitRecovery();
        } else {
          enterFallbackPending('wallet init retries exhausted');
        }
      };
      try {
        const response = await sendWebViewRequestInternal(
          OPERATION_TYPES.initWallet,
          { mnemonic: currentWalletMnemoincRef.current },
          true,
        );
        if (!response?.isConnected) {
          onInitFailed();
        } else {
          initRetryCountRef.current = 0;
        }
      } catch (err) {
        console.log('Error re-initializing wallet:', err);
        onInitFailed();
      }
      return;
    }

    console.log(`Processing ${holdBufferRef.current.length} held requests`);

    const requests = holdBufferRef.current;
    holdBufferRef.current = [];

    // Process sequentially to avoid triggering the rate limiter (50 msgs/sec).
    for (const { action, args, encrypt, resolvers, ttlId } of requests) {
      if (ttlId) clearTimeout(ttlId);
      let result;
      try {
        result = await sendWebViewRequestInternal(action, args, encrypt);
      } catch (error) {
        result = {
          didWork: false,
          error: error?.message || String(error),
          kind: 'bridge',
        };
      }
      resolvers.forEach(resolve => {
        if (typeof resolve === 'function') resolve(result);
      });
    }
  }, [sendWebViewRequestInternal, settleHoldBuffer, scheduleInitRecovery]);

  useEffect(() => {
    drainHoldBufferRef.current = drainHoldBuffer;
  }, [drainHoldBuffer]);

  // Foreground settle-then-reconcile (plan §3.1.3): for intents still unknown,
  // run a per-op query only when it uniquely identifies the original attempt.
  // Hit → settle {didWork:true, status:'executed', txid}; miss/no-query → leave
  // unknown. At most once per op per foreground.
  const reconcileUnknownIntents = useCallback(async () => {
    if (fallbackState !== FALLBACK_STATE.WEBVIEW) return;
    pruneExpiredIntents();
    const foregroundId = foregroundIdRef.current;
    // Multiple wallets (main + pool/savings/gift/child) run concurrently, so
    // every unknown intent is a candidate — each reconciles against its OWN
    // wallet (below), not just the active custody account. A query against a
    // since-disposed wallet fails → a safe miss (stays unknown).
    const candidates = [...intentStore.values()].filter(
      entry => entry.state === 'unknown' && entry.reconciledAt !== foregroundId,
    );
    if (!candidates.length) return;

    for (const entry of candidates) {
      entry.reconciledAt = foregroundId;
      // Each intent's own seed — a secondary wallet's send can only be
      // confirmed with that wallet's mnemonic (falls back to the active account
      // for a keyless intent).
      const mnemonic = entry.args.mnemonic || currentWalletMnemoincRef.current;
      let matcher;
      let result = null;

      if (reconcileQueryOverride) {
        const override = reconcileQueryOverride(entry);
        if (!override) continue;
        reconcileQueryCount += 1;
        if ('result' in override) {
          result = override.result;
          matcher = override.matcher;
        } else {
          matcher = override.matcher;
          try {
            result = await sendWebViewRequestInternal(
              override.action,
              override.args,
              true,
            );
          } catch (err) {
            result = null;
          }
        }
      } else {
        const query = buildReconcileQuery(entry.op, entry, mnemonic);
        if (!query) continue;
        matcher = buildReconcileMatcher(entry.op);
        reconcileQueryCount += 1;
        try {
          result = await sendWebViewRequestInternal(
            query.action,
            query.args,
            true,
          );
        } catch (err) {
          result = null;
        }
      }

      if (result && typeof matcher === 'function' && matcher(entry, result)) {
        const txid = reconcileQueryOverride
          ? undefined
          : extractReconcileTxid(entry.op, result, entry);
        const response = reconcileQueryOverride
          ? undefined
          : extractReconcileResponse(entry.op, result, entry);
        // Keep the entry so the RECORDED truth stays 'executed' (restore /
        // balance handlers and later reconcile passes can surface it). Per
        // the guard contract this does NOT gate retries: a later
        // user-initiated identical call is a new payment and re-dispatches
        // (the dispatch site drops the spent record). Ops whose consumers
        // can't consume this shape settle their live callers as unknown
        // instead (F-1) — the recorded truth stays 'executed'.
        const executedResult = {
          didWork: true,
          status: 'executed',
          txid,
          response,
        };
        settleIntent(
          entry,
          executedResult,
          'done',
          RECONCILE_CALLER_UNKNOWN_OPS.has(entry.op)
            ? RECONCILE_UNKNOWN_CALLER_RESULT
            : executedResult,
        );
        // The intent's resolvers are the same functions bound to the bridge's
        // pendingRequests entries (and their watchdogs). Reconcile resolves
        // them directly, so those entries must be reaped too — otherwise a
        // stale final-deadline timer could settle the already-resolved caller
        // a second time and overwrite the done intent with 'unknown'.
        for (const [rid, req] of Object.entries(pendingRequests.current)) {
          if (req?.stableKey === entry.stableKey) {
            const t = activeTimeoutsRef.current[rid];
            if (t?.timeoutId) clearTimeout(t.timeoutId);
            delete activeTimeoutsRef.current[rid];
            delete pendingRequests.current[rid];
          }
        }
      }
    }
  }, [sendWebViewRequestInternal]);

  const handleWebViewResponse = useCallback(
    event => {
      if (epoch !== epochRef.current) {
        // Stale-instance event from a previous session — drop before processing.
        return;
      }
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'handshake:reply' && message.pubW) {
          const entry = pendingRequests.current[message.id];
          if (!entry) {
            // no need to handle anything here, will be handled with timeout
            console.error('Timeout: backend is unresponsive');
            return;
          }
          // A handshake reply only ever answers the pending 'handshake:init'
          // request. A reply whose id belongs to any OTHER pending request
          // (page bug, id mix-up, or a stale reply racing a reset) must be
          // dropped: settling that request with {didComplete:true} would
          // fabricate a non-outcome, drive the state machine to READY for a
          // handshake that never completed, and orphan the real handshake
          // request (B1).
          if (entry.action !== 'handshake:init') {
            console.error(
              'SECURITY: handshake reply for a non-handshake request — dropped',
            );
            return;
          }
          if (!sessionKeyRef.current) {
            // no need to handle anything here, will be handled with timeout
            console.error(
              'SECURITY: Received handshake reply without active session key',
            );
            return;
          }

          const shared = getSharedSecret(
            Buffer.from(sessionKeyRef.current.privateKey),
            Buffer.from(message.pubW, 'hex'),
            true,
          );
          const sharedX = shared.slice(1, 33);
          aesKeyRef.current = deriveAesKeyFromSharedX(
            sharedX,
            expectedNonceRef.current,
          );

          shared.fill(0);
          sharedX.fill(0);

          if (sessionKeyRef.current?.privateKey) {
            sessionKeyRef.current.privateKey.fill(0);
          }
          sessionKeyRef.current = null;

          const decodedNonce = decryptMessage(message.runtimeNonce);
          if (expectedNonceRef.current !== decodedNonce) {
            // no need to handle anything here, will be handled with timeout
            console.log('Invalid runtime nonce, something went wrong');
            aesKeyRef.current = null;
            return;
          }
          nonceVerified.current = true;
          webviewFailureCount = 0;
          fallbackRetries = 0;
          // A successful handshake is also a successful recovery from
          // fallback-pending (D-9).
          fallbackState = FALLBACK_STATE.WEBVIEW;
          console.log('Handshake complete. Got backend public key.');
          transitionWvState(WV_STATES.READY, 'handshake complete');
          setHandshakeComplete(true);
          // resolve requset to avoid timeout
          finalizeRequest(message.id, { didComplete: true }, null);

          setTimeout(() => {
            drainHoldBuffer();
          }, 100);

          // New session for reconcile: unknown intents may now be checked.
          foregroundIdRef.current += 1;
          setTimeout(() => {
            reconcileUnknownIntents();
          }, 150);
          return;
        }

        let content = message;

        if (message.encrypted && aesKeyRef.current) {
          const decrypted = decryptMessage(message.encrypted);

          try {
            content = JSON.parse(decrypted);
          } catch (err) {
            content = decrypted;
          }
        } else if (nonceVerified.current) {
          // Once the handshake completed, every legitimate webview message is
          // encrypted (the bundle only posts errors/CSP reports once sharedKey
          // exists). Accepting plaintext here would let an unauthenticated
          // message bypass GCM verification, e.g. to spoof a response.
          console.warn('Dropping plaintext message received post-handshake');
          return;
        }

        if (content.type === 'security:csp-violation') {
          // S1: only an AUTHENTICATED report may drive the persisted native
          // kill-switch. The verified bundle emits CSP reports encrypted, once
          // the session key exists — so a plaintext/pre-handshake report is
          // unauthenticated and must never trigger the downgrade. Drop it.
          if (!nonceVerified.current) {
            console.warn('Dropping unauthenticated CSP violation report');
            return;
          }
          console.error('CSP VIOLATION DETECTED:', content);
          // Hard-fail class — persist native fallback (D-9).
          enterNative('CSP violation', true);
          resetWebViewState(true, true);
          // C4: unmount the compromised page — it must not linger running.
          setVerifiedPath('');
          return;
        }

        // Unsolicited SDK push events (incoming payment, balance/token balance,
        // stream status) are not request/response traffic and must not count
        // toward the flood limiter. A burst of legitimate inbound payments would
        // otherwise trip it and force the one-way native fallback.
        const isSdkPushEvent = !!(
          content.incomingPayment ||
          content.balanceUpdate ||
          content.tokenBalanceUpdate ||
          content.streamStatus
        );

        if (!isSdkPushEvent) {
          const now = Date.now();
          const windowDuration = now - messageRateLimiter.current.windowStart;
          if (windowDuration > 1000) {
            // Reset window
            messageRateLimiter.current.count = 0;
            messageRateLimiter.current.windowStart = now;
          }
          messageRateLimiter.current.count++;

          if (
            messageRateLimiter.current.count >
            messageRateLimiter.current.maxPerSecond
          ) {
            // D-7: trip → warn + drop. No force-native, no reset — the cap is
            // operational and a flush of legitimate responses must not kill the
            // bridge (in-flight requests settle via their own watchdog).
            console.error(
              `SECURITY: Rate limit exceeded (${messageRateLimiter.current.count} msgs/sec) — dropping`,
            );
            return;
          }
        }

        // S1: past this point every branch acts on message CONTENT — errors,
        // push events, responses. Pre-handshake the ONLY legitimate message is
        // handshake:reply (handled above); the verified bundle emits all other
        // traffic encrypted, post-handshake. An unauthenticated message that
        // reached here (already counted by the flood limiter above) must never
        // drive a privileged path: a spoofed push event (fake balance/incoming
        // payment) or a spoofed response. Drop it.
        if (!nonceVerified.current) {
          console.warn(
            'Dropping unauthenticated pre-handshake content message',
          );
          return;
        }

        if (content.error) {
          // An error tied to a request id is a request-level resolution, not a
          // bridge failure — settle just that request and leave the bridge (and
          // every other in-flight request) alone. An error whose id no longer
          // matches (e.g. the timeout already settled it) is dropped like the
          // isResponse path drops stale ids. Id-less errors (D-3/D-12) are
          // dropped — the bundle includes the id when it knows it; the
          // watchdog settles the affected request.
          if (content.id) {
            const entry = pendingRequests.current[content.id];
            if (entry) {
              const result = {
                didWork: false,
                error: content.error,
                kind: 'bridge',
              };
              finalizeRequest(
                content.id,
                result,
                entry.stableKey ? 'unknown' : null,
              );
            } else {
              console.warn(
                'Dropping error for unknown/settled request:',
                content.id,
                content.error,
              );
            }
          } else {
            console.warn('Dropping id-less WebView error:', content.error);
          }
          return;
        }

        // Push events are unsolicited SDK traffic. One malformed event (or one
        // throwing listener) must be logged and dropped, never routed to the
        // outer catch — that would reset the bridge and wipe every in-flight
        // request over a single bad message.
        if (content.incomingPayment) {
          try {
            const data = JSON.parse(content.result);
            incomingSparkTransaction.emit(
              INCOMING_SPARK_TX_NAME,
              data.transferId,
              data.balance,
              content.walletId,
            );
          } catch (err) {
            console.error('Dropping malformed incomingPayment event:', err);
          }
        }
        if (content.balanceUpdate) {
          try {
            const data = JSON.parse(content.result);
            sparkBalanceUpdateEmitter.emit(
              BALANCE_UPDATE_EVENT_NAME,
              data,
              content.walletId,
            );
          } catch (err) {
            console.error('Dropping malformed balanceUpdate event:', err);
          }
        }
        if (content.tokenBalanceUpdate) {
          try {
            const data = JSON.parse(content.result);
            sparkTokenBalanceUpdateEmitter.emit(
              TOKEN_BALANCE_UPDATE_EVENT_NAME,
              data.tokensObject,
              content.walletId,
            );
          } catch (err) {
            console.error('Dropping malformed tokenBalanceUpdate event:', err);
          }
        }
        if (content.streamStatus) {
          try {
            sparkStreamStatusEmitter.emit(
              STREAM_STATUS_EVENT_NAME,
              content.streamStatus,
              content.walletId,
            );
          } catch (err) {
            console.error('Dropping failed streamStatus emit:', err);
          }
        }
        if (content.isResponse && content.id) {
          const entry = pendingRequests.current[content.id];
          if (entry) {
            let result;
            try {
              result = JSON.parse(content.result || null);
            } catch (err) {
              result = { error: 'Malformed response payload' };
            }
            // Check for WASM errors
            if (
              result?.error &&
              typeof result.error === 'string' &&
              WASM_ERRORS.some(errMsg => result.error.includes(errMsg))
            ) {
              console.warn(
                'WASM failed, switching to React Native implementation:',
                result.error,
              );

              // Hard-fail class — persist native fallback (D-9), version-stamped
              // by enterNative (S-5).
              enterNative('WASM error', true);
              resetWebViewState(true);
              // C4: unmount the broken page — it must not linger running.
              setVerifiedPath('');
            }
            webviewFailureCount = 0; // Reset on successful response

            if (entry.action === OPERATION_TYPES.initWallet) {
              if (result?.isConnected === true) {
                walletInitialized.current = true;
                // A successful init proves the bridge is healthy: recover from
                // a pending fallback and restore the session retry budget (F-5).
                if (fallbackState === FALLBACK_STATE.PENDING) {
                  fallbackState = FALLBACK_STATE.WEBVIEW;
                  fallbackRetries = 0;
                }
                setChangeSparkConnectionState(prev => ({
                  state: true,
                  count: prev.count + 1,
                }));
                setTimeout(() => {
                  drainHoldBuffer();
                }, 100);
              } else if (result?.error || result?.isConnected === false) {
                console.warn(
                  'Wallet initialization failed, forcing React Native mode:',
                  result,
                );
                enterFallbackPending('wallet init failed');
                settleHoldBuffer({
                  didWork: false,
                  error: 'Wallet initialization failed, using React Native',
                  kind: 'not-ready',
                });
              } else {
                // Malformed/unexpected init response (neither connected nor an
                // error): the bridge is healthy but the wallet never
                // initialized. Schedule the bounded auto-init recovery (R-5).
                scheduleInitRecovery();
              }
            }

            finalizeRequest(
              content.id,
              result,
              entry.stableKey
                ? result?.didWork === true
                  ? 'done'
                  : 'unknown'
                : null,
            );
          } else {
            console.warn(
              'Dropping response for unknown/settled request:',
              content,
            );
          }
        }
      } catch (err) {
        // One bad message must not tear the bridge down: per-message containment
        // (D-4). A decrypt/parse failure leaves the request to its watchdog;
        // repeated failures trigger the fallback-pending state.
        console.error('Error handling WebView message:', err);
        webviewFailureCount++;
        if (webviewFailureCount >= MAX_WEBVIEW_FAILURES) {
          enterFallbackPending('repeated WebView errors');
        }
      }
    },
    [
      epoch,
      decryptMessage,
      resetWebViewState,
      drainHoldBuffer,
      reconcileUnknownIntents,
      transitionWvState,
      finalizeRequest,
      scheduleInitRecovery,
    ],
  );

  // Injected transport (test harness) — production renders the WebView below.
  useEffect(() => {
    if (!transport) return;
    transport.onMessage(handleWebViewResponse);
    return () => {
      if (typeof transport.destroy === 'function') transport.destroy();
    };
  }, [transport, handleWebViewResponse]);

  // Handle app state changes
  useEffect(() => {
    const appStateChanged = previousAppState.current !== appState;
    const connectionChanged =
      prevConnectionStatus.current !== isConnectedToTheInternet;

    if (
      (!appStateChanged && !connectionChanged) ||
      fallbackState === FALLBACK_STATE.NATIVE
    ) {
      return; // Nothing changed
    }

    if (appState === 'background') {
      console.log(
        'App going to background - settling non-keep-alive in-flight requests',
      );
      // D-6: background settles immediately — no re-arm, no orphan bookkeeping.
      // Funds intents stay 'unknown' so foreground reconcile can settle them.
      // Keep-alive ops (sends) are NEVER fabricated-settled here: their true
      // outcome is still unknown, so the promise stays live and the foreground
      // resolves it from the real outcome (resume-by-id or reconcile). The iOS
      // JS timer for the 90s watchdog is suspended while backgrounded, so it
      // cannot fire a fake timeout in the meantime.
      settleHoldBuffer({
        didWork: false,
        error: 'Request deferred: app went to background',
        kind: 'unknown',
      });
      Object.keys(pendingRequests.current).forEach(id => {
        const entry = pendingRequests.current[id];
        if (entry && KEEP_ALIVE_OPS.has(entry.action)) {
          console.log(
            'keeping keep-alive request live across background:',
            entry.action,
          );
          // Record that this send was interrupted by a background transition.
          // If its page later dies (a reset bumps the epoch — e.g. Android
          // OOM-kills the WebView renderer), the outcome is unknowable and
          // reconcile's amount/destination matcher can false-match a prior
          // identical tx; the reset drops the intent instead of reconciling it.
          if (entry.stableKey) {
            const intent = intentStore.get(entry.stableKey);
            if (intent) intent.backgroundedWhileInFlight = true;
          }
          return;
        }
        if (entry?.action === 'handshake:init') {
          // A backgrounded handshake is DEFERRED, not failed (N8): backgrounding
          // is not a bridge failure and must not consume the fallback budget.
          // didRunInit is re-armed so the foreground handshake effect re-runs.
          didRunInit.current = false;
          finalizeRequest(
            id,
            {
              didWork: false,
              error: 'Handshake deferred: app went to background',
              kind: 'deferred',
            },
            null,
          );
          return;
        }
        finalizeRequest(
          id,
          {
            didWork: false,
            error: 'Request interrupted by app state change',
            kind: 'unknown',
          },
          'unknown',
        );
      });

      previousAppState.current = appState;
      prevConnectionStatus.current = isConnectedToTheInternet;
    } else if (appState === 'active') {
      console.log('App returned to foreground');

      // Session-start recovery from fallback-pending (D-9): the bridge gets one
      // retry per session; initHandshake's failure path escalates to native.
      if (fallbackState === FALLBACK_STATE.PENDING) {
        console.log('WebView recovery attempt on session start');
        fallbackState = FALLBACK_STATE.WEBVIEW;
        blockAndResetWebview();
        previousAppState.current = appState;
        prevConnectionStatus.current = isConnectedToTheInternet;
        return;
      }

      // Wait for internet connection before proceeding
      if (!isConnectedToTheInternet) {
        console.log('Waiting for internet connection before processing...');
        previousAppState.current = appState;
        prevConnectionStatus.current = isConnectedToTheInternet;
        return;
      }

      // Only execute if we actually transitioned to active OR connection just came back
      const justBecameActive =
        appStateChanged &&
        (previousAppState.current === 'background' ||
          previousAppState.current === 'inactive');
      const connectionJustRestored =
        connectionChanged && isConnectedToTheInternet;

      if (justBecameActive || connectionJustRestored) {
        // New foreground: unknown intents may be reconciled once each.
        foregroundIdRef.current += 1;

        const keepAliveInFlight = Object.keys(pendingRequests.current).some(
          id => KEEP_ALIVE_OPS.has(pendingRequests.current[id]?.action),
        );

        if (!nonceVerified.current) {
          if (didGetToHomepageRef.current) {
            console.log(
              'App became active and webview is not verified - reloading WebView',
            );
            blockAndResetWebview();
          } else if (wvState.current === WV_STATES.ERROR) {
            // A load failure during boot (before homepage) left the WebView in
            // ERROR; it will never self-recover. Reload to re-arm verification
            // + handshake.
            console.log('Foreground - WebView in ERROR during boot, reloading');
            blockAndResetWebview();
          } else if (connectionJustRestored && didRunHandshakeRef.current) {
            // Boot handshake was deferred while offline (didRunInit latched);
            // didRunHandshakeRef latched because the handshake RAN and settled
            // (kind:'offline'), but the page has no session. Reload to re-arm
            // the handshake — matches pre-rewrite behavior. Scoped to a
            // completed-then-deferred boot handshake on connection-restore so
            // a plain bg→fg (or a still-in-flight handshake) never double-inits.
            console.log(
              'Connection restored during boot - reloading to re-arm handshake',
            );
            blockAndResetWebview();
          }
          // Boot phase: the handshake runs when the WebView is ready; do not
          // reload before the user reaches the homepage (double-init risk).
        } else if (keepAliveInFlight) {
          // Keep-alive ops are in flight on a LIVE page: NEVER reload here —
          // a reload would wipe the backend id→outcome cache mid-send (and
          // the session key). Resume each request by re-posting the same id;
          // requests whose page died (epoch changed) skip the re-send
          // (double-pay guard) and use deterministic reconciliation when the
          // operation supports it; otherwise their watchdog settles unknown.
          console.log(
            'Foreground - resuming in-flight keep-alive requests (no reload)',
          );
          let needsReconcile = false;
          Object.keys(pendingRequests.current).forEach(id => {
            const entry = pendingRequests.current[id];
            if (!entry || !KEEP_ALIVE_OPS.has(entry.action)) return;
            if (!resumeKeepAliveRequest(id)) needsReconcile = true;
          });
          if (needsReconcile) {
            console.log(
              'Foreground - keep-alive requests lost their page; reconciling',
            );
            reconcileUnknownIntents();
          }
        } else if (connectionJustRestored) {
          // The webview may have gone stale while the connection was down.
          if (didGetToHomepageRef.current) {
            console.log(
              'Connection restored - reloading WebView to avoid stale state',
            );
            blockAndResetWebview();
          } else {
            reconcileUnknownIntents();
          }
        } else {
          console.log('Foreground - reconciling unknown intents');
          reconcileUnknownIntents();
        }
      }

      previousAppState.current = appState;
      prevConnectionStatus.current = isConnectedToTheInternet;
    } else {
      previousAppState.current = appState;
      prevConnectionStatus.current = isConnectedToTheInternet;
    }
  }, [
    appState,
    isConnectedToTheInternet,
    blockAndResetWebview,
    finalizeRequest,
    reconcileUnknownIntents,
    resumeKeepAliveRequest,
    settleHoldBuffer,
  ]);

  // In-session fallback-pending recovery (R-4): a PENDING bridge retries once
  // while the app stays active. Without this, a mid-session handshake/load
  // failure left the bridge dead until the next bg/fg or auth reset. Bounded:
  // each retry that fails escalates fallbackRetries; the second consecutive
  // failure commits NATIVE (the designed terminal fallback). The tick loop is
  // always-on (5s, one module-level boolean check) because PENDING is
  // module-level state — relying on a re-render to arm a one-shot timer
  // missed transitions that don't bump React state.
  useEffect(() => {
    const id = setInterval(() => {
      if (fallbackState !== FALLBACK_STATE.PENDING) return;
      if (appStateRef.current !== 'active') return;
      console.log('Auto-recovering fallback-pending WebView bridge');
      fallbackState = FALLBACK_STATE.WEBVIEW;
      blockAndResetRef.current?.();
    }, FALLBACK_RETRY_DELAY_MS);
    return () => clearInterval(id);
  }, []);

  const initHandshake = useCallback(async () => {
    try {
      const privN = randomBytes(32);
      const pubN = getPublicKey(privN, true); // compressed
      const pubNHex = Buffer.from(pubN).toString('hex');

      sessionKeyRef.current = {
        privateKey: privN,
        publicKey: pubNHex,
      };

      const handshakeEpoch = epochRef.current;
      const result = await sendWebViewRequestInternal('handshake:init', {
        pubN: pubNHex,
      });

      if (!result?.didComplete) {
        if (result?.kind === 'offline' || result?.kind === 'deferred') {
          // Offline/backgrounding is not a bridge failure: no fallback
          // transition. Re-arm the start latch so the handshake effect's next
          // natural run (foreground — appState is a dep) starts a fresh one;
          // without this the bridge sits in HANDSHAKING with no watchdog and
          // no owner when nothing dispatched a request to settle (W-3).
          didRunInit.current = false;
          console.warn('Handshake deferred:', result?.kind);
          return;
        }
        // Interrupted by a reset (auth/app-state/crash reload): the epoch moved
        // on and the new session owns its own handshake. Not a bridge failure —
        // it must not consume fallback/recovery state (F-7).
        if (epochRef.current !== handshakeEpoch) return;
        console.warn(
          'Handshake failed or timed out:',
          result?.error || 'no completion',
        );
        enterFallbackPending('handshake failed');
        const blockReset = isOnStartupRoute();

        setChangeSparkConnectionState(prev => ({
          state: blockReset ? null : true,
          count: prev.count + 1,
        }));
        settleHoldBuffer({
          didWork: false,
          error: 'Failed to process method, try again',
          kind: 'not-ready',
        });
      }
    } catch (error) {
      console.warn('Handshake failed or timed out:', error.message);
      enterFallbackPending('handshake failed');
      const blockReset = isOnStartupRoute();

      setChangeSparkConnectionState(prev => ({
        state: blockReset ? null : true,
        count: prev.count + 1,
      }));
      // Snapshot and clear BEFORE iterating (re-entrancy safety).
      settleHoldBuffer({
        didWork: false,
        error: 'Failed to process method, try again',
        kind: 'not-ready',
      });
    }
  }, [sendWebViewRequestInternal, settleHoldBuffer, scheduleInitRecovery]);

  useEffect(() => {
    async function startHandshake() {
      try {
        if (!transport && !webViewRef.current) return;
        if (!transport && !isWebViewReady) return;
        if (!verifiedPath) return;
        // blocking background init event from firing
        if (appState === 'background') return;
        if (didRunInit.current) return;
        didRunInit.current = true;

        // A wedged AsyncStorage native read must not park the handshake start
        // forever (R-6): bound the latch read; a timeout behaves like "no
        // latch" and proceeds to the (bounded) handshake watchdog.
        const savedVariable = await Promise.race([
          getLocalStorageItem(HARD_FAIL_PERSIST_KEY),
          new Promise(resolve => {
            setTimeout(() => resolve(null), HANDSHAKE_START_TIMEOUT_MS);
          }),
        ]);

        // The latch is version-stamped (S-5): it only applies to the app
        // version that wrote it. A stale stamp — including the legacy bare
        // 'true' — is ignored: an app update retries the bridge, and a
        // still-broken bundle re-persists on re-verification.
        if (savedVariable && savedVariable === getVersion()) {
          console.log('FORCE_REACT_NATIVE is set, skipping handshake');
          enterNative('FORCE_REACT_NATIVE localStorage flag', false);
          didRunHandshakeRef.current = true;
          return;
        }
        transitionWvState(WV_STATES.HANDSHAKING, 'handshake init');
        await initHandshake();
        didRunHandshakeRef.current = true;
      } catch (error) {
        // Fail closed: an unexpected handshake-start error must never leave the
        // login flow waiting on didRunHandshakeRef. Route through the same
        // bounded failure handling as initHandshake's catch.
        console.warn('Handshake start failed:', error.message);
        didRunHandshakeRef.current = true;
        didRunInit.current = false; // foreground re-arms the handshake
        enterFallbackPending('handshake start failed');
        const blockReset = isOnStartupRoute();
        setChangeSparkConnectionState(prev => ({
          state: blockReset ? null : true,
          count: prev.count + 1,
        }));
        settleHoldBuffer({
          didWork: false,
          error: 'Failed to process method, try again',
          kind: 'not-ready',
        });
      }
    }

    const debouceID = setTimeout(() => {
      startHandshake();
    }, 250);

    return () => {
      if (debouceID) {
        clearTimeout(debouceID);
      }
    };
  }, [
    isWebViewReady,
    verifiedPath,
    initHandshake,
    appState,
    transport,
    settleHoldBuffer,
    reloadKey,
  ]);

  useEffect(() => {
    const initialEpoch = epochRef.current;
    (async () => {
      transitionWvState(WV_STATES.VERIFYING, 'initial verification');
      armVerifyWatchdog();
      try {
        const { htmlPath, nonceHex } = await verifyAndPrepareWebView(
          Platform.OS === 'ios'
            ? require('spark-web-context')
            : 'file:///android_asset/sparkContext.html',
        );

        // A reset/auth-change during verification owns the session now; a
        // stale success must not mount a stale nonce (R-3).
        if (epochRef.current !== initialEpoch) return;

        expectedNonceRef.current = nonceHex;
        pageEpochRef.current = epochRef.current;
        setVerifiedPath(htmlPath);
        // Transport (test) mode has no load events — mark the bridge loaded.
        if (transport) transitionWvState(WV_STATES.LOADED, 'transport ready');
      } catch (err) {
        if (epochRef.current !== initialEpoch) return;
        didRunHandshakeRef.current = true;
        // Persist the native fallback only on TAMPER; a transient IO error must
        // not permanently downgrade the install (S-5).
        enterNative('bundle verification failed', err?.isTamper === true);
        console.log(
          'WebView bundle verification failed. Using react-native bundle',
          err,
        );
        if (verifyWatchdogRef.current) {
          clearTimeout(verifyWatchdogRef.current);
          verifyWatchdogRef.current = null;
        }
      }
    })();
  }, []);

  useEffect(() => {
    globalSendWebViewRequest = sendWebViewRequestInternal;
  }, [sendWebViewRequestInternal]);

  // Latest-stable refs for the unmount cleanup (empty-deps effect must not
  // capture a stale finalizeRequest/settleHoldBuffer, and must not re-run on
  // their identity changes — the cleanup may only execute on actual unmount).
  const finalizeRequestRef = useRef(null);
  useEffect(() => {
    finalizeRequestRef.current = finalizeRequest;
  }, [finalizeRequest]);
  const settleHoldBufferRef = useRef(null);
  useEffect(() => {
    settleHoldBufferRef.current = settleHoldBuffer;
  }, [settleHoldBuffer]);

  // Zero key material, settle every pending request and the hold buffer on
  // unmount (H-2): callers must never be left awaiting a promise whose
  // provider is gone, and their watchdogs must not fire into a dead component.
  useEffect(() => {
    return () => {
      if (loadWatchdogRef.current) {
        clearTimeout(loadWatchdogRef.current);
        loadWatchdogRef.current = null;
      }
      if (verifyWatchdogRef.current) {
        clearTimeout(verifyWatchdogRef.current);
        verifyWatchdogRef.current = null;
      }
      if (initRecoveryTimerRef.current) {
        clearTimeout(initRecoveryTimerRef.current);
        initRecoveryTimerRef.current = null;
      }
      settleHoldBufferRef.current?.({
        didWork: false,
        error: 'WebView provider unmounted',
        kind: 'bridge',
      });
      Object.keys(pendingRequests.current).forEach(id => {
        const entry = pendingRequests.current[id];
        finalizeRequestRef.current?.(
          id,
          {
            didWork: false,
            error: 'WebView provider unmounted',
            kind: 'bridge',
          },
          entry?.stableKey ? 'unknown' : null,
        );
      });
      if (aesKeyRef.current?.fill) aesKeyRef.current.fill(0);
      aesKeyRef.current = null;
      if (sessionKeyRef.current?.privateKey?.fill) {
        sessionKeyRef.current.privateKey.fill(0);
      }
      sessionKeyRef.current = null;
      nonceVerified.current = false;
    };
  }, []);

  const getCustomUserAgent = useCallback(() => {
    const deviceModel = getModel();
    const systemVersion = getSystemVersion();

    // For Android
    if (Platform.OS === 'android') {
      return `Mozilla/5.0 (Linux; Android ${systemVersion}; ${deviceModel}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36`;
    }

    // For iOS
    return `Mozilla/5.0 (iPhone; CPU iPhone OS ${systemVersion.replace(
      /\./g,
      '_',
    )} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`;
  }, []);

  // Load-failure recovery (C-11): a failed or hung load must not wedge the
  // bridge while foregrounded. Shares the message-error failure budget: two
  // consecutive failures escalate to fallback-pending (one recovery attempt
  // per session, mirroring the crash path).
  const handleWebViewLoadError = useCallback(
    description => {
      if (
        wvState.current === WV_STATES.UNLOADED ||
        wvState.current === WV_STATES.ERROR
      ) {
        return;
      }
      console.warn(`[WebView] load failure (${description}) — recovering`);
      transitionWvState(WV_STATES.ERROR, 'load failure');
      webviewFailureCount += 1;

      if (webviewFailureCount >= MAX_WEBVIEW_FAILURES) {
        enterFallbackPending('repeated WebView load failures');
        return;
      }

      if (AppState.currentState !== 'active') {
        // Backgrounded: defer the reload to the foreground app-state effect
        // (mirrors crash handling) by invalidating the session.
        nonceVerified.current = false;
        walletInitialized.current = false;
        return;
      }

      blockAndResetWebview();
    },
    [transitionWvState, blockAndResetWebview],
  );

  useEffect(() => {
    loadErrorHandlerRef.current = handleWebViewLoadError;
  }, [handleWebViewLoadError]);

  // Armed on a valid LOADING transition; disarmed by any state transition.
  // A load that never completes is recovered as a load failure (C-11).
  const armLoadWatchdog = useCallback(() => {
    const schedule = () => {
      if (loadWatchdogRef.current) clearTimeout(loadWatchdogRef.current);
      loadWatchdogRef.current = setTimeout(() => {
        loadWatchdogRef.current = null;
        if (wvState.current !== WV_STATES.LOADING) return;
        if (AppState.currentState !== 'active') {
          // Background-suspended load is not a failure; re-arm for foreground.
          schedule();
          return;
        }
        handleWebViewLoadError('load watchdog timeout');
      }, LOAD_WATCHDOG_MS);
    };
    schedule();
  }, [handleWebViewLoadError]);

  const handleWebViewTermination = useCallback(
    reason => {
      transitionWvState(WV_STATES.ERROR, reason);

      if (AppState.currentState !== 'active') {
        // App is backgrounded — do NOT reload now (no events should fire in background).
        // Invalidate session so the foreground app-state effect sees !nonceVerified
        // and triggers blockAndResetWebview() cleanly when the user returns.
        console.warn(
          `[WebView] Crash in background (${reason}) — deferring reload to foreground`,
        );
        nonceVerified.current = false;
        if (aesKeyRef.current?.fill) aesKeyRef.current.fill(0);
        aesKeyRef.current = null;
        if (sessionKeyRef.current?.privateKey?.fill) {
          sessionKeyRef.current.privateKey.fill(0);
        }
        sessionKeyRef.current = null;
        walletInitialized.current = false;
        return;
      }

      console.warn(`[WebView] Crash while active (${reason}) — reloading now`);
      blockAndResetWebview();
    },
    [blockAndResetWebview],
  );

  const providerValues = useMemo(() => {
    return {
      fileHash,
      changeSparkConnectionState,
      didRunHandshakeRef,
      // Consumers destructure this from useWebView(); route it through the
      // stable module-level dispatcher so the identity never changes (keeps the
      // provider-value memo stable and consumers from re-rendering).
      sendWebViewRequest: sendWebViewRequestGlobal,
    };
  }, [fileHash, changeSparkConnectionState, didRunHandshakeRef]);

  return (
    <WebViewContext.Provider value={providerValues}>
      {children}
      {!transport && verifiedPath && (
        <WebView
          key={reloadKey}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          incognito={false}
          userAgent={getCustomUserAgent()}
          webviewDebuggingEnabled={false}
          cacheEnabled={false}
          mixedContentMode="never"
          javaScriptEnabled
          ref={webViewRef}
          containerStyle={{ position: 'absolute', top: 1000, left: 1000 }}
          source={{ uri: verifiedPath }}
          originWhitelist={['file://']}
          onShouldStartLoadWithRequest={request => {
            return request.url === verifiedPath;
          }}
          onMessage={handleWebViewResponse}
          onError={event => {
            if (epochRef.current !== pageEpochRef.current) return;
            handleWebViewLoadError(
              event?.nativeEvent?.description || 'onError',
            );
          }}
          onLoadStart={() => {
            if (epoch !== epochRef.current) return;
            // A load start is a NEW page session: bump the epoch so every
            // callback from the previous page (late onLoadEnd/onLoadProgress,
            // a stale handshake:reply, an old response) is dropped instead of
            // corrupting the new session (R-2). This deliberately mirrors a
            // reset for message/load-event purposes, while the in-flight
            // request bookkeeping below keeps the keep-alive semantics (page
            // died → reconcile, never re-execute).
            epochRef.current += 1;
            setEpoch(epochRef.current);
            epochForTest = epochRef.current;
            pageEpochRef.current = epochRef.current;
            // Silent page self-reload (DR-4): the page reloaded without a
            // native reset (no crash event). Tear down the crypto
            // session so (a) the reloaded page is never addressed with the
            // stale AES key (it cannot decrypt it — the old behavior wedged
            // the handshake until a second bg/fg) and (b) no in-flight request
            // is re-posted into the fresh page, whose id→outcome cache is
            // empty — a same-id re-post there would EXECUTE a second payment.
            // The expected runtime nonce is NOT cleared: the verified file on
            // disk is unchanged, so the reloaded page carries the same nonce
            // (verifyAndPrepareWebView injects one nonce per verified file).
            if (
              nonceVerified.current ||
              aesKeyRef.current ||
              sessionKeyRef.current
            ) {
              if (aesKeyRef.current?.fill) aesKeyRef.current.fill(0);
              aesKeyRef.current = null;
              if (sessionKeyRef.current?.privateKey?.fill) {
                sessionKeyRef.current.privateKey.fill(0);
              }
              sessionKeyRef.current = null;
              nonceVerified.current = false;
              setHandshakeComplete(false);
              walletInitialized.current = false;
              Object.keys(pendingRequests.current).forEach(id => {
                const pending = pendingRequests.current[id];
                if (pending && KEEP_ALIVE_OPS.has(pending.action)) {
                  pending.pageDied = true;
                  const intent =
                    pending.stableKey && intentStore.get(pending.stableKey);
                  if (intent && intent.state === 'in-flight') {
                    intent.state = 'unknown';
                    intent.result = null;
                  }
                }
              });
            }
            if (transitionWvState(WV_STATES.LOADING, 'onLoadStart')) {
              armLoadWatchdog();
            }
            didRunHandshakeRef.current = false;
            didRunInit.current = false; // re-arm the handshake for the new load
          }}
          onLoadProgress={({ nativeEvent }) => {
            if (epochRef.current !== pageEpochRef.current) return;
            if (
              nativeEvent.progress === 1 &&
              wvState.current === WV_STATES.LOADING
            ) {
              transitionWvState(WV_STATES.LOADED, 'progress 100%');
            }
          }}
          onLoadEnd={() => {
            if (epochRef.current !== pageEpochRef.current) return;
            // Only transition if still in LOADING state
            // (onLoadProgress might have already handled it)
            if (wvState.current === WV_STATES.LOADING) {
              transitionWvState(WV_STATES.LOADED, 'onLoadEnd');
            }
          }}
          onContentProcessDidTerminate={() =>
            handleWebViewTermination('iOS process terminated')
          }
          onRenderProcessGone={({ nativeEvent }) =>
            handleWebViewTermination(
              `Android renderer gone (didCrash=${nativeEvent.didCrash})`,
            )
          }
        />
      )}
    </WebViewContext.Provider>
  );
};

export const useWebView = () => React.useContext(WebViewContext);
