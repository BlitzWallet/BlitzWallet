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
  payLightningWithToken: 'payLightningWithToken',
  getUserSwapHistory: 'getUserSwapHistory',
  requestClawback: 'requestClawback',
  checkClawbackEligibility: 'checkClawbackEligibility',
  checkClawbackStatus: 'checkClawbackStatus',
  requestBatchClawback: 'requestBatchClawback',
  listClawbackableTransfers: 'listClawbackableTransfers',

  // Wallet optimizations
  abortOptimization: 'abortOptimization',
  isOptimizationRunning: 'isOptimizationRunning',
  checkIfOptimizationNeeded: 'checkIfOptimizationNeeded',
  runLeafOptimization: 'runLeafOptimization',
  runTokenOptimization: 'runTokenOptimization',
};

const longOperations = new Set([
  OPERATION_TYPES.claimStaticDepositAddress,
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
  OPERATION_TYPES.payLightningWithToken,
  OPERATION_TYPES.requestClawback,
  OPERATION_TYPES.runLeafOptimization,
  OPERATION_TYPES.runTokenOptimization,
  OPERATION_TYPES.claimSparkHodlLightningPayment,
  OPERATION_TYPES.receiveSparkHodlLightningPayment,
  OPERATION_TYPES.fufillSparkInvoices,
  OPERATION_TYPES.batchTransferTokens,
  OPERATION_TYPES.getSparkLeaves,
  OPERATION_TYPES.getSparkLeafExitNodes,
]);

const mediumOperations = new Set([
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
  OPERATION_TYPES.checkIfOptimizationNeeded,
  OPERATION_TYPES.listClawbackableTransfers,
  OPERATION_TYPES.createSatsInvoice,
  OPERATION_TYPES.createTokensInvoice,
  OPERATION_TYPES.getLightningPaymentQuote,
  OPERATION_TYPES.getLightningFee,
  OPERATION_TYPES.getSparkPaymentFee,
  OPERATION_TYPES.getUserSwapHistory,
  OPERATION_TYPES.checkClawbackEligibility,
  OPERATION_TYPES.checkClawbackStatus,
  OPERATION_TYPES.isOptimizationInProgress,
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
let handshakeComplete = false;
let forceReactNativeUse = null;
let globalSendWebViewRequest = null;
let globalPendingRequests = null;
let webviewFailureCount = 0;
const MAX_WEBVIEW_FAILURES = 2;
const MAX_QUEUED_REQUESTS = 50;
const QUEUED_REQUEST_TTL_MS = 5 * 60 * 1000;

// These two return fresh data per call, so concurrent identical calls are
// legitimate and must never be deduped/coalesced in the queue.
const QUEUE_DEDUPE_EXEMPT = [
  OPERATION_TYPES.getSingleTxDetails,
  OPERATION_TYPES.getUserSwapHistory,
];

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
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.LOADING]: [WV_STATES.LOADED, WV_STATES.ERROR, WV_STATES.UNLOADED],
  [WV_STATES.LOADED]: [
    WV_STATES.HANDSHAKING,
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.HANDSHAKING]: [
    WV_STATES.READY,
    WV_STATES.ERROR,
    WV_STATES.UNLOADED,
  ],
  [WV_STATES.READY]: [WV_STATES.ERROR, WV_STATES.UNLOADED],
  [WV_STATES.ERROR]: [WV_STATES.UNLOADED],
};

const WebViewContext = createContext(null);

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

const setHandshakeComplete = value => {
  handshakeComplete = value;
};

// On startup/loading routes a handshake failure must not emit a reconnect
// (state: true) — the login flow handles connection itself; emitting would
// race it. Shared by the reload-verification and handshake failure paths.
const isOnStartupRoute = () => {
  const currentRoutes = navigationRef.getRootState().routes?.map(r => r.name);
  return (
    currentRoutes?.includes('Splash') ||
    currentRoutes?.includes('SplashReload') ||
    currentRoutes?.includes('Home') ||
    currentRoutes?.includes('ConnectingToNodeLoadingScreen')
  );
};

export const setForceReactNative = (value, reason = 'unknown') => {
  if (value === true) {
    console.warn(`forceReactNativeUse set to true. Reason: ${reason}`);
  }
  forceReactNativeUse = value;
};

const forceNativeMode = reason => {
  console.warn(`Forcing React Native mode: ${reason}`);
  forceReactNativeUse = true;
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
  if (forceReactNativeUse !== null) {
    return false;
  }
  return handshakeComplete;
};

// Test seam: exposes the in-flight request ids so the harness can assert that
// interrupted requests are settled AND removed (no zombie hangs). Prod code never
// reads this — it mirrors the existing globalSendWebViewRequest wiring below.
export const __getPendingRequestIdsForTest = () =>
  globalPendingRequests ? Object.keys(globalPendingRequests.current) : [];

export const WebViewProvider = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { appState, isConnectedToTheInternet, didGetToHomepage } =
    useAppStatus();
  const webViewRef = useRef(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isResetting = useRef(false);
  const queuedRequests = useRef([]);
  const pendingRequests = useRef({});
  const activeTimeoutsRef = useRef({});
  const sessionKeyRef = useRef(null);
  const aesKeyRef = useRef(null);
  const expectedNonceRef = useRef(null);
  const [verifiedPath, setVerifiedPath] = useState('');
  const expectedSequenceRef = useRef(0);
  const nonceVerified = useRef(false);
  const previousAppState = useRef(appState);
  const prevConnectionStatus = useRef(isConnectedToTheInternet);
  const internetConnectionRef = useRef(isConnectedToTheInternet);
  const walletInitialized = useRef(false);
  const isInitialRender = useRef(true);
  const currentWalletMnemoincRef = useRef(currentWalletMnemoinc);
  const didRunInit = useRef(null);
  const isWebviewReadyRef = useRef(null);
  const didRunHandshakeRef = useRef(false);
  const didGetToHomepageRef = useRef(didGetToHomepage);
  const [changeSparkConnectionState, setChangeSparkConnectionState] = useState({
    state: null,
    count: 0,
  });
  const wvState = useRef(WV_STATES.UNLOADED);

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

    // Derive isWebViewReady from state machine
    const ready =
      newState === WV_STATES.LOADED ||
      newState === WV_STATES.HANDSHAKING ||
      newState === WV_STATES.READY;
    setIsWebViewReady(ready);
    return true;
  }, []);

  const fileHash = !!verifiedPath ? process.env.WEBVIEW_BUNDLE_HASH : '';

  useEffect(() => {
    currentWalletMnemoincRef.current = currentWalletMnemoinc;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    isWebviewReadyRef.current = isWebViewReady;
  }, [isWebViewReady]);

  // reset webview when app is stale in background
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    // clear any qued requests
    if (queuedRequests.current.length) {
      console.log('[auth reset webview] clearing qued requests');
      // Snapshot and clear BEFORE iterating: a reject handler can synchronously
      // route back into a queue drain (see wrapped init resolve), so the array
      // must already be empty to keep that re-entry from recursing infinitely.
      const requestsToReject = queuedRequests.current;
      queuedRequests.current = [];
      requestsToReject.forEach(({ reject }) => {
        reject({
          error: 'Wallet initialization failed, using React Native',
        });
      });
    }
    blockAndResetWebview();
  }, [authResetkey]);

  useEffect(() => {
    didGetToHomepageRef.current = didGetToHomepage;
  }, [didGetToHomepage]);

  useEffect(() => {
    internetConnectionRef.current = isConnectedToTheInternet;
  }, [isConnectedToTheInternet]);

  const messageRateLimiter = useRef({
    count: 0,
    windowStart: Date.now(),
    maxPerSecond: 50,
  });

  const getNextSequence = useCallback(() => {
    const current = expectedSequenceRef.current;
    expectedSequenceRef.current = current + 1;
    return current;
  }, []);

  // Settle-and-remove queued entries older than the TTL. Runs on every queue
  // push AND at drain time: a stale read just refetches, but a stale send
  // (e.g. a payment queued before a long background) must never execute
  // minutes later.
  const evictExpiredQueuedRequests = useCallback(() => {
    const queue = queuedRequests.current;
    const now = Date.now();
    for (let i = queue.length - 1; i >= 0; i--) {
      if (now - queue[i].queuedAt > QUEUED_REQUEST_TTL_MS) {
        const [expired] = queue.splice(i, 1);
        if (typeof expired.resolve === 'function') {
          expired.resolve({ error: 'Request expired while queued' });
        }
      }
    }
  }, []);

  // Single entry point for deferring a request ({id, action, args, encrypt,
  // resolve, reject}) into queuedRequests. Owns the queue policy:
  //   - expired entries are settled and evicted first (TTL),
  //   - an identical queued request coalesces — both callers settle with the
  //     same outcome from one message,
  //   - a full queue rejects the newcomer instead of growing unbounded.
  const queueRequest = useCallback(
    entry => {
      const queue = queuedRequests.current;
      const now = Date.now();

      evictExpiredQueuedRequests();

      const existing =
        !QUEUE_DEDUPE_EXEMPT.includes(entry.action) &&
        queue.find(
          req =>
            req.action === entry.action &&
            JSON.stringify(req.args) === JSON.stringify(entry.args),
        );
      if (existing) {
        console.log('Coalescing duplicate queued request:', entry.action);
        const prevResolve = existing.resolve;
        const prevReject = existing.reject;
        existing.resolve = result => {
          if (typeof prevResolve === 'function') prevResolve(result);
          if (typeof entry.resolve === 'function') entry.resolve(result);
        };
        existing.reject = error => {
          if (typeof prevReject === 'function') prevReject(error);
          if (typeof entry.reject === 'function') entry.reject(error);
        };
        return;
      }

      if (queue.length >= MAX_QUEUED_REQUESTS) {
        console.warn('Request queue full, rejecting:', entry.action);
        entry.reject(new Error('Request queue full'));
        return;
      }

      queue.push({ ...entry, queuedAt: now });
    },
    [evictExpiredQueuedRequests],
  );

  const resetWebViewState = useCallback(
    (
      clearHandshake = false,
      sparkConnectionState,
      shouldClearPending = true,
    ) => {
      console.log('Resetting WebView state', {
        clearHandshake,
        sparkConnectionState,
        shouldClearPending,
      });
      // Transition to UNLOADED — this also sets isWebViewReady(false) via
      // derived state (every state allows the reset transition).
      transitionWvState(WV_STATES.UNLOADED, 'reset');
      isResetting.current = true;
      // setVerifiedPath('');

      Object.entries(activeTimeoutsRef.current).forEach(([id, timeoutInfo]) => {
        clearTimeout(timeoutInfo.timeoutId);

        // Re-queue the request if it's not a handshake
        // and if we're not clearing pending requests
        if (!shouldClearPending && timeoutInfo.action !== 'handshake:init') {
          // Find the pending request's resolve/reject functions
          const originalResolve = pendingRequests.current[id];
          if (originalResolve && timeoutInfo.originalRequest) {
            const { action, args, encrypt } = timeoutInfo.originalRequest;

            console.log(`Re-queueing interrupted request: ${action}`);

            // IMPORTANT: We pass the original resolve function so the promise
            // chain is preserved; a queue duplicate coalesces onto the existing
            // entry so this promise still settles.
            queueRequest({
              id, // Keep original ID for tracking
              action,
              args,
              encrypt,
              resolve: originalResolve,
              reject: error => {
                // Reject using the original resolve function (which handles both resolve/reject)
                if (typeof originalResolve === 'function') {
                  originalResolve({ error: error.message || error });
                }
              },
            });

            // Remove from pendingRequests since it's now queued
            delete pendingRequests.current[id];
          }
        }
      });
      activeTimeoutsRef.current = {};

      // Only clear handshake if explicitly told to (actual failures)
      // Don't clear it for normal app lifecycle resets
      // Our app uses this to choose wheater to make calls to the webview or react native
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

      // Settle everything still pending. When shouldClearPending is false the
      // re-queued ids were already removed inside the loop above, so this only
      // sweeps entries that could not be re-queued (handshake:init, lost
      // bookkeeping) — leaving them would strand their promises forever.
      // Resolving a pending handshake:init with a plain {error} makes
      // initHandshake's await return (it does NOT throw), so its
      // forceNativeMode catch intentionally does not run here.
      Object.entries(pendingRequests.current).forEach(([id, resolve]) => {
        if (typeof resolve === 'function') {
          resolve({
            error: 'Unable to finish action, request got cleaned up.',
          });
        }
      });
      pendingRequests.current = {};

      sessionKeyRef.current = null;
      expectedSequenceRef.current = 0;
      aesKeyRef.current = null;
      nonceVerified.current = false;
    },
    [queueRequest, transitionWvState],
  );

  // App-state / connectivity transitions clear per-request timers but leave the
  // pending promise in place. For every in-flight request, either revive it or
  // settle it so it can never hang forever:
  //   - bookkeeping still present  -> re-arm the timer from the preserved entry
  //     (fields already carry handler/duration) so it settles via handleTimeout.
  //   - bookkeeping already wiped   -> orphan; settle it now via the stored
  //     resolver (which does not self-delete from pendingRequests) and remove it.
  const rearmOrSweepPendingRequests = useCallback(() => {
    Object.keys(pendingRequests.current).forEach(id => {
      const entry = activeTimeoutsRef.current[id];
      if (entry) {
        clearTimeout(entry.timeoutId);
        entry.timeoutId = setTimeout(entry.handler, entry.duration);
      } else {
        const resolve = pendingRequests.current[id];
        if (typeof resolve === 'function') {
          resolve({ error: 'Request interrupted by app state change' });
        }
        delete pendingRequests.current[id];
      }
    });
  }, []);

  const reloadWebViewSecurely = useCallback(async () => {
    try {
      console.log('Re-verifying WebView before reload...');
      if (forceReactNativeUse) return;

      transitionWvState(WV_STATES.VERIFYING, 'reload verification');

      // Re-verify the file
      const { htmlPath, nonceHex, hashHex } = await verifyAndPrepareWebView(
        Platform.OS === 'ios'
          ? require('spark-web-context')
          : 'file:///android_asset/sparkContext.html',
      );

      // File is verified, safe to reload
      console.log('File integrity verified, reloading WebView');
      didRunInit.current = false;
      expectedNonceRef.current = nonceHex;
      setVerifiedPath(htmlPath);
      setReloadKey(prev => prev + 1);
    } catch (err) {
      console.error('WebView re-verification failed:', err);

      // On verification failure, force React Native mode
      forceNativeMode('bundle verification failed');
      setHandshakeComplete(false);
      const blockReset = isOnStartupRoute();

      setChangeSparkConnectionState(prev => ({
        state: blockReset ? null : true,
        count: prev.count + 1,
      }));
    }
  }, []);

  const blockAndResetWebview = useCallback(
    shouldClearPending => {
      didRunInit.current = true; // Block handshakes during reload

      resetWebViewState(false, false, shouldClearPending);
      reloadWebViewSecurely(); // Will allow handshake to complete after state variables change. We are preventing a race condition here with the app state.
    },
    [resetWebViewState, reloadWebViewSecurely],
  );

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

  const sendWebViewRequestInternal = useCallback(
    (action, args = {}, encrypt = true) => {
      let resolveFn, rejectFn;
      const promise = new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      });

      const execute = async () => {
        const resolve = resolveFn;
        const reject = rejectFn;
        let timeoutId = null;
        const id = customUUID();
        try {
          // If forceReactNativeUse is set, reject immediately
          if (forceReactNativeUse === true) {
            console.log(
              'Forced React Native mode, rejecting WebView request:',
              action,
            );
            return resolve({
              error: 'Wallet initialization failed, using React Native(1)',
            });
          }

          // Queue messages during reset/background
          if (
            (isResetting.current || AppState.currentState === 'background') &&
            action !== 'handshake:init' &&
            action !== 'initializeSparkWallet'
          ) {
            console.log(
              'WebView is resetting or in the background, queueing message:',
              action,
            );
            queueRequest({ id, action, args, encrypt, resolve, reject });
            return;
          }

          // Reject importent messages if app is not connected to the internet
          if (
            !internetConnectionRef.current &&
            action !== 'handshake:init' &&
            action !== 'initializeSparkWallet'
          ) {
            console.log(
              'App is not connected to the internet, queueing message:',
              action,
            );
            if (rejectIfNotConnectedToInternet.has(action)) {
              reject(new Error(`App is not connected to the internet`));
            } else if (action !== OPERATION_TYPES.initWallet) {
              //don't add init wallet, this will be added during webview reset
              queueRequest({ id, action, args, encrypt, resolve, reject });
            }
            return;
          }

          if (!webViewRef.current || !isWebviewReadyRef.current) {
            console.log(
              'WebView not ready or internet is not connected, queueing message:',
              action,
              webViewRef.current,
              isWebviewReadyRef.current,
            );
            queueRequest({ id, action, args, encrypt, resolve, reject });
            return;
          }

          const getTimeoutDuration = action => {
            if (action === 'handshake:init') return 4000;

            if (longOperations.has(action)) {
              return 90000; // 90 seconds for payment operations
            }

            if (mediumOperations.has(action)) {
              return 30000; // 30 seconds
            }

            return 10000; // 10 seconds
          };

          const timeoutDuration = getTimeoutDuration(action);
          const startedAt = Date.now();

          const handleTimeout = () => {
            if (AppState.currentState !== 'active') {
              console.log(
                `Skipping timeout for ${action} because app is not active (${AppState.currentState})`,
              );
              // Timers can still fire in iOS 'inactive'; killing the request here
              // would leave it in pendingRequests forever. Re-arm so the entry
              // survives until an active-state firing settles it.
              const entry = activeTimeoutsRef.current[id];
              if (entry) {
                entry.timeoutId = setTimeout(handleTimeout, timeoutDuration);
              }
              return;
            }

            if (!pendingRequests.current[id]) {
              console.log(`Request ${id} already resolved, skipping timeout`);
              delete activeTimeoutsRef.current[id];
              return;
            }

            console.error(`WebView request timeout for action: ${action}`);

            delete pendingRequests.current[id];
            delete activeTimeoutsRef.current[id];

            // If handshake is complete and this is not a handshake action,
            // the WebView bridge is functional — this is a service timeout.
            // Don't kill the WebView for a backend service being slow.
            if (handshakeComplete && action !== 'handshake:init') {
              console.warn(
                `Service timeout for ${action} — WebView bridge is healthy, not forcing native mode`,
              );
            } else {
              // WebView-level failure (handshake timeout or bridge issue)
              webviewFailureCount++;
              console.warn(
                `WebView failure #${webviewFailureCount} for ${action}`,
              );
              if (webviewFailureCount >= MAX_WEBVIEW_FAILURES) {
                forceNativeMode(
                  `${MAX_WEBVIEW_FAILURES} consecutive WebView failures`,
                );
              }
              resetWebViewState(true, true);
            }

            reject(
              new Error(
                `Call unresponsive (timeout after ${timeoutDuration}ms)`,
              ),
            );
          };

          timeoutId = setTimeout(handleTimeout, timeoutDuration);

          activeTimeoutsRef.current[id] = {
            timeoutId,
            startedAt,
            duration: timeoutDuration,
            handler: handleTimeout,
            remaining: timeoutDuration,
            action,
            originalRequest: { action, args, encrypt }, //Store request details
          };

          const originalResolve = resolve;
          pendingRequests.current[id] = result => {
            const t = activeTimeoutsRef.current[id];
            if (t?.timeoutId) clearTimeout(t.timeoutId);
            delete activeTimeoutsRef.current[id];
            originalResolve(result);
          };

          // Handle initializeSparkWallet specially
          if (action === 'initializeSparkWallet') {
            if (!getHandshakeComplete()) {
              console.log('Handshake not complete, cannot initialize wallet');
              if (timeoutId) clearTimeout(timeoutId);
              delete pendingRequests.current[id];
              delete activeTimeoutsRef.current[id];
              forceNativeMode('handshake incomplete for wallet init');
              setChangeSparkConnectionState(prev => ({
                state: true,
                count: prev.count + 1,
              }));
              return resolve({ isConnected: false });
            }
            if (!nonceVerified.current) {
              console.log('Nonce not verified, cannot initialize wallet');
              if (timeoutId) clearTimeout(timeoutId);
              delete pendingRequests.current[id];
              delete activeTimeoutsRef.current[id];
              forceNativeMode('nonce not verified for wallet init');
              setChangeSparkConnectionState(prev => ({
                state: true,
                count: prev.count + 1,
              }));
              return resolve({ isConnected: false });
            }

            // Wrap the resolve to check initialization result
            const wrappedResolve = pendingRequests.current[id];
            pendingRequests.current[id] = result => {
              if (result?.error || result?.isConnected === false) {
                console.warn(
                  'Wallet initialization failed, forcing React Native mode:',
                  result,
                );

                // forceReactNativeUse = true;
                // setChangeSparkConnectionState(prev => ({
                //   state: true,
                //   count: prev.count + 1,
                // }));

                // Snapshot and clear BEFORE iterating. This forEach is the
                // re-entrant frame in the crash: one of these rejects belongs to
                // a re-queued init request whose reject calls THIS wrapped resolve
                // again, which would re-enter this forEach on the same array.
                // Clearing first makes that re-entry a no-op and breaks the loop.
                const requestsToReject = queuedRequests.current;
                queuedRequests.current = [];
                requestsToReject.forEach(({ reject }) => {
                  reject({
                    error: 'Wallet initialization failed, using React Native',
                  });
                });
              } else {
                walletInitialized.current = true;
                setChangeSparkConnectionState(prev => ({
                  state: true,
                  count: prev.count + 1,
                }));
                console.log('Wallet initialized successfully');
                processQueuedRequests();
              }
              wrappedResolve(result);
            };
          } else if (action !== 'handshake:init') {
            // For non-init actions, check if wallet was initialized
            if (handshakeComplete && !walletInitialized.current) {
              console.log(
                'Wallet initialization in progress, queueing request:',
                action,
              );

              // Queue the request instead of blocking. Ownership of the promise
              // moves to the queue entry, so drop the timeout AND the
              // pendingRequests entry (leaving it would let a later sweep
              // settle the caller prematurely).
              if (timeoutId) clearTimeout(timeoutId);
              delete pendingRequests.current[id];
              delete activeTimeoutsRef.current[id];
              queueRequest({ id, action, args, encrypt, resolve, reject });
              return;
            }
          }

          // Hash into a copy, and only after every queue/store branch above:
          // originalRequest and queued entries must hold the pre-hash args so a
          // replay through this function hashes exactly once.
          if (args.mnemonic && action !== 'initializeSparkWallet') {
            args = { ...args, mnemonic: sha256Hash(args.mnemonic) };
          }

          const sequence = getNextSequence();
          const timestamp = Date.now();

          let payload = {
            id,
            action,
            args,
            sequence,
            timestamp,
          };
          console.log('sending message to webview', action, payload);

          try {
            if (encrypt && aesKeyRef.current) {
              const encrypted = encryptMessage(JSON.stringify(payload));
              payload = { type: 'secure:msg', encrypted };
            } else if (encrypt && action !== 'handshake:init') {
              // Fail closed: encryption was requested but no session key exists
              // (pre-handshake or mid-reset race). Never downgrade the payload
              // to plaintext.
              throw new Error('Encryption required but AES key unavailable');
            }
            webViewRef.current.postMessage(JSON.stringify(payload));
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            delete pendingRequests.current[id];
            delete activeTimeoutsRef.current[id];
            reject(err);
          }
        } catch (err) {
          // Clean up timeout on error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (id) {
            delete pendingRequests.current[id];
            delete activeTimeoutsRef.current[id];
          }
          console.log(
            'Error sending webview request from internal function',
            err,
          );
          reject(err);
        }
      };
      execute();
      return promise;
    },
    [encryptMessage, resetWebViewState, getNextSequence],
  );

  const processQueuedRequests = useCallback(
    async connectionJustRestored => {
      // Never execute work that expired while waiting (see helper).
      evictExpiredQueuedRequests();

      // After a soft reset, the WebView's internal state is cleared
      // We must reinitialize the wallet before processing any queued requests
      if (
        (handshakeComplete &&
          !walletInitialized.current &&
          currentWalletMnemoincRef.current) ||
        (currentWalletMnemoincRef.current && connectionJustRestored)
      ) {
        console.log('Re-initializing wallet before processing queue');
        try {
          // No need to handle any state changes here, handled inside of the promise. But this might be where the stale connection state comes from. if a request is sent to the webview but not responded to the change to react-native woudnt have happpened before leaving everything in "not connected to spark".
          const response = await sendWebViewRequestInternal(
            OPERATION_TYPES.initWallet,
            { mnemonic: currentWalletMnemoincRef.current },
            true,
          );
          if (!response?.isConnected) throw new Error('Wallet init failed');
        } catch (err) {
          console.log('Error re-initializing wallet:', err);
          // forceReactNativeUse = true;
          // Reject all queued requests since WebView is now unusable
          // Snapshot and clear BEFORE iterating (re-entrancy safety).
          const requestsToReject = queuedRequests.current;
          queuedRequests.current = [];
          requestsToReject.forEach(({ reject }) => {
            reject({
              error: 'Wallet initialization failed, using React Native',
            });
          });
          return;
        }
      }
      isResetting.current = false;

      console.log(
        `Processing ${queuedRequests.current.length} queued requests`,
      );

      if (
        queuedRequests.current.length === 0 ||
        !currentWalletMnemoincRef.current
      ) {
        isResetting.current = false;
        return;
      }

      const requests = [...queuedRequests.current];
      queuedRequests.current = [];

      // Process sequentially to avoid triggering the rate limiter (50 msgs/sec).
      // Parallel dispatch via Promise.allSettled could fire 51+ messages at once,
      // permanently killing the WebView.
      for (const { action, args, encrypt, resolve, reject } of requests) {
        try {
          const result = await sendWebViewRequestInternal(
            action,
            args,
            encrypt,
          );
          if (typeof resolve === 'function') {
            resolve(result);
          }
        } catch (error) {
          if (typeof reject === 'function') {
            reject(error);
          }
        }
      }

      isResetting.current = false;
    },
    [sendWebViewRequestInternal, evictExpiredQueuedRequests],
  );

  const handleWebViewResponse = useCallback(
    event => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'handshake:reply' && message.pubW) {
          const resolve = pendingRequests.current[message.id];
          if (!resolve) {
            // no need to handle anything here, will be handled with timeout
            console.error('Timeout: backend is unresponsive');
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
          console.log('Handshake complete. Got backend public key.');
          transitionWvState(WV_STATES.READY, 'handshake complete');
          setHandshakeComplete(true);
          // resolve requset to avoid timeout
          resolve({ didComplete: true });
          delete pendingRequests.current[message.id];

          setTimeout(() => {
            processQueuedRequests();
          }, 100);
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
        console.log('receiving message from webview', content);

        if (content.type === 'security:csp-violation') {
          console.error('CSP VIOLATION DETECTED:', content);

          resetWebViewState(true, true);
          forceNativeMode('CSP violation');
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
            console.error(
              `SECURITY: Rate limit exceeded (${messageRateLimiter.current.count} msgs/sec)`,
            );

            resetWebViewState(true, true);
            forceNativeMode('rate limit exceeded');
            return;
          }
        }

        if (content.error) {
          // An error tied to a request id is a request-level resolution, not a
          // bridge failure — settle just that request and leave the bridge (and
          // every other in-flight request) alone. An error whose id no longer
          // matches (e.g. the timeout already settled it) is dropped like the
          // isResponse path drops stale ids. Only an id-less top-level error
          // keeps the reset/failure-count behavior via the outer catch.
          if (content.id) {
            const resolve = pendingRequests.current[content.id];
            if (typeof resolve === 'function') {
              resolve({ error: content.error });
              delete pendingRequests.current[content.id];
            } else {
              console.warn(
                'Dropping error for unknown/settled request:',
                content.id,
                content.error,
              );
            }
            return;
          }
          throw new Error(content.error);
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
            );
          } catch (err) {
            console.error('Dropping failed streamStatus emit:', err);
          }
        }
        if (content.isResponse && content.id) {
          const resolve = pendingRequests.current[content.id];
          if (resolve) {
            const result = JSON.parse(content.result || null);
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

              resetWebViewState(true, true);
              forceNativeMode('WASM error');

              setLocalStorageItem('FORCE_REACT_NATIVE', 'true');
            }
            webviewFailureCount = 0; // Reset on successful response
            resolve(result);

            delete pendingRequests.current[content.id];
          }
        }
      } catch (err) {
        console.error('Error handling WebView message:', err);
        if (
          typeof err.message === 'string' &&
          // The webview reports these as e.g.
          // "SECURITY: Rejected stale message: 5000ms old" — routine after a
          // long background, so never spend a teardown/failure strike on it.
          err.message.includes('Rejected stale message')
        )
          return;
        webviewFailureCount++;
        if (webviewFailureCount >= MAX_WEBVIEW_FAILURES) {
          forceNativeMode('repeated WebView errors');
        }
        resetWebViewState(true, true);
      }
    },
    [
      decryptMessage,
      resetWebViewState,
      processQueuedRequests,
      transitionWvState,
    ],
  );

  // Handle app state changes
  useEffect(() => {
    const appStateChanged = previousAppState.current !== appState;
    const connectionChanged =
      prevConnectionStatus.current !== isConnectedToTheInternet;

    if ((!appStateChanged && !connectionChanged) || forceReactNativeUse) {
      return; // Nothing changed
    }

    if (appState === 'background') {
      console.log(
        'App going to background - pausing timers (keeping bookkeeping so foreground can re-arm)',
      );
      // Clear live timers so an accumulated/stale timer can't fire a spurious
      // timeout on resume, but KEEP each entry (handler/duration/originalRequest)
      // so rearmOrSweepPendingRequests re-arms the in-flight request on foreground
      // instead of sweeping it as an orphan. Wiping this map was the cause of
      // "Request interrupted by app state change" on a background→foreground send.
      Object.values(activeTimeoutsRef.current).forEach(t => {
        clearTimeout(t.timeoutId);
        t.timeoutId = null;
      });

      previousAppState.current = appState;
      prevConnectionStatus.current = isConnectedToTheInternet;
    } else if (appState === 'active') {
      console.log('App returned to foreground');
      // clear any active timeouts to prevent timeout from switching to rn
      Object.values(activeTimeoutsRef.current).forEach(t =>
        clearTimeout(t.timeoutId),
      );

      // The loop above cleared every timer but left the pending promises intact.
      // Re-arm each request (or sweep orphans whose bookkeeping was wiped on
      // background) so nothing hangs forever. This runs before the offline return
      // and the reset paths below, covering all of them uniformly.
      rearmOrSweepPendingRequests();

      // Wait for internet connection before proceeding
      if (!isConnectedToTheInternet) {
        console.log('Waiting for internet connection before processing...');
        // Update refs so we can detect when connection comes back
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
        if (!nonceVerified.current && !isResetting.current) {
          console.log(
            'App became active or connection restored and webview is not varified and not resetting - reloading WebView',
          );
          if (didGetToHomepageRef.current) {
            blockAndResetWebview();
          }
        } else {
          // sometimes the webview becomes stale, if internet connection goes away make sure to reset webview but dont clear pending events so they are handled once webview is active again
          if (connectionJustRestored) {
            blockAndResetWebview(false);
          } else {
            // Make sure to handle any events that happen during background and are within the three minute refresh timeout
            if (!didGetToHomepageRef.current) {
              // we need to make sure this doesn't double run before getting to the hompage otherwise we will send multiple init requests
              console.log(
                'Did not get to homepage yet, blocking duplicate request created by biometric login popup',
              );
            } else {
              setTimeout(() => {
                processQueuedRequests(connectionJustRestored);
              }, 100);
            }
          }
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
    processQueuedRequests,
    rearmOrSweepPendingRequests,
  ]);

  const initHandshake = useCallback(async () => {
    try {
      const privN = randomBytes(32);
      const pubN = getPublicKey(privN, true); // compressed
      const pubNHex = Buffer.from(pubN).toString('hex');

      sessionKeyRef.current = {
        privateKey: privN,
        publicKey: pubNHex,
      };

      await sendWebViewRequestInternal('handshake:init', {
        pubN: pubNHex,
      });
    } catch (error) {
      console.warn('Handshake failed or timed out:', error.message);
      forceNativeMode('handshake failed');
      const blockReset = isOnStartupRoute();

      setChangeSparkConnectionState(prev => ({
        state: blockReset ? null : true,
        count: prev.count + 1,
      }));
      // Snapshot and clear BEFORE iterating (re-entrancy safety). This site also
      // previously never cleared the queue, leaving zombie requests behind.
      const requestsToReject = queuedRequests.current;
      queuedRequests.current = [];
      requestsToReject.forEach(({ reject }) => {
        reject({
          error: 'Failed to process method, try again',
        });
      });
    }
  }, [sendWebViewRequestInternal]);

  useEffect(() => {
    async function startHandshake() {
      if (!webViewRef.current) return;
      if (!isWebViewReady) return;
      if (!verifiedPath) return;
      // blocking background init event from firing
      if (appState === 'background') return;
      if (didRunInit.current) return;
      didRunInit.current = true;

      // const androidAPI = DeviceInfo.getApiLevelSync();
      // if (androidAPI == 33 || androidAPI == 34) {
      //   console.warn(`Skipping handshake on Android API ${androidAPI}`);
      //   forceReactNativeUse = true;
      //   return;
      // }

      const savedVariable = await getLocalStorageItem('FORCE_REACT_NATIVE');

      if (savedVariable === 'true') {
        console.log('FORCE_REACT_NATIVE is set, skipping handshake');
        forceNativeMode('FORCE_REACT_NATIVE localStorage flag');
        didRunHandshakeRef.current = true;
        return;
      }
      transitionWvState(WV_STATES.HANDSHAKING, 'handshake init');
      await initHandshake();
      didRunHandshakeRef.current = true;
    }

    const debouceID = setTimeout(() => {
      // forceReactNativeUse = true;
      // didRunHandshakeRef.current = true
      startHandshake(); //remove this and app fully uses RN
    }, 250);

    return () => {
      if (debouceID) {
        clearTimeout(debouceID);
      }
    };
  }, [isWebViewReady, verifiedPath, initHandshake, appState]);

  useEffect(() => {
    (async () => {
      transitionWvState(WV_STATES.VERIFYING, 'initial verification');
      try {
        const { htmlPath, nonceHex, hashHex } = await verifyAndPrepareWebView(
          Platform.OS === 'ios'
            ? require('spark-web-context')
            : 'file:///android_asset/sparkContext.html',
        );

        expectedNonceRef.current = nonceHex;
        setVerifiedPath(htmlPath);
      } catch (err) {
        didRunHandshakeRef.current = true;
        forceNativeMode('bundle verification failed');
        console.log(
          'WebView bundle verification failed. Using react-native bundle',
          err,
        );
      }
    })();
  }, []);

  useEffect(() => {
    globalSendWebViewRequest = sendWebViewRequestInternal;
    globalPendingRequests = pendingRequests;
  }, [sendWebViewRequestInternal]);

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

  const handleWebViewTermination = useCallback(
    reason => {
      transitionWvState(WV_STATES.ERROR, reason);

      if (AppState.currentState !== 'active') {
        // App is backgrounded — do NOT reload now (no events should fire in background).
        // Invalidate session so the foreground app-state effect sees !nonceVerified
        // and triggers blockAndResetWebview() cleanly when the user returns.
        // Critically: do NOT set isResetting.current = true here, as that would
        // block the foreground handler's !isResetting.current guard.
        console.warn(
          `[WebView] Crash in background (${reason}) — deferring reload to foreground`,
        );
        nonceVerified.current = false;
        aesKeyRef.current = null;
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
      webViewRef,
      sendWebViewRequest: sendWebViewRequestInternal,
      fileHash,
      changeSparkConnectionState,
      didRunHandshakeRef,
    };
  }, [
    webViewRef,
    sendWebViewRequestInternal,
    fileHash,
    changeSparkConnectionState,
    didRunHandshakeRef,
  ]);

  return (
    <WebViewContext.Provider value={providerValues}>
      {children}
      {verifiedPath && (
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
          onLoadStart={() => {
            transitionWvState(WV_STATES.LOADING, 'onLoadStart');
            didRunHandshakeRef.current = false;
          }}
          onLoadProgress={({ nativeEvent }) => {
            if (
              nativeEvent.progress === 1 &&
              wvState.current === WV_STATES.LOADING
            ) {
              transitionWvState(WV_STATES.LOADED, 'progress 100%');
            }
          }}
          onLoadEnd={() => {
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
