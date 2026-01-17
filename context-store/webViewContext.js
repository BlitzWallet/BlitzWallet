import React, {
  createContext,
  useCallback,
  useEffect,
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
  getL1AddressQuote: 'getSparkStaticBitcoinL1AddressQuote',
  claimStaticDepositAddress: 'claimnSparkStaticDepositAddress',
  getSparkAddress: 'getSparkAddress',
  sendSparkPayment: 'sendSparkPayment',
  sendTokenPayment: 'sendSparkTokens',
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
  setPrivacyEnabled: 'setPrivacyEnabled',
  getSingleTxDetails: 'getSingleTxDetails',
  createSatsInvoice: 'createSatsInvoice',
  createTokensInvoice: 'createTokensInvoice',

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

const longOperations = [
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
];

const mediumOperations = [
  OPERATION_TYPES.getBalance,
  OPERATION_TYPES.queryStaticL1Address,
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
];

const rejectIfNotConnectedToInternet = [
  OPERATION_TYPES.claimStaticDepositAddress,
  OPERATION_TYPES.sendSparkPayment,
  OPERATION_TYPES.sendTokenPayment,
  OPERATION_TYPES.getBitcoinPaymentRequest,
  OPERATION_TYPES.getBitcoinPaymentFee,
  OPERATION_TYPES.sendLightningPayment,
  OPERATION_TYPES.sendBitcoinPayment,
  OPERATION_TYPES.receiveLightningPayment,
  OPERATION_TYPES.getL1Address,
  OPERATION_TYPES.getSparkAddress,
];

export const INCOMING_SPARK_TX_NAME = 'RECEIVED_CONTACTS EVENT';
export const incomingSparkTransaction = new EventEmitter();
const WASM_ERRORS = [
  'WASM',
  'WebAssembly',
  'WebAssembly.Compile is disallowed on the main thread',
  "Cannot read properties of undefined (reading '__wbindgen_malloc')",
];
let handshakeComplete = false;
let forceReactNativeUse = null;
let globalSendWebViewRequest = null;

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

export const setForceReactNative = value => {
  forceReactNativeUse = value;
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
      queuedRequests.current.forEach(({ reject }) => {
        reject({
          error: 'Wallet initialization failed, using React Native',
        });
      });
      queuedRequests.current = [];
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
    maxPerSecond: 20,
  });

  const blockAndResetWebview = shouldClearPending => {
    didRunInit.current = true; // Block handshakes during reload

    resetWebViewState(false, false, shouldClearPending);
    reloadWebViewSecurely(); // Will allow handshake to complete after state variables change. We are preventing a race condition here with the app state.
  };

  const getNextSequence = useCallback(() => {
    const current = expectedSequenceRef.current;
    expectedSequenceRef.current = current + 1;
    return current;
  }, []);

  const resetWebViewState = useCallback(
    (
      clearHandshake = false,
      sparkConnectionState,
      shouldClearPending = true,
    ) => {
      if (forceReactNativeUse) return;
      console.log('Resetting WebView state', {
        clearHandshake,
        sparkConnectionState,
        shouldClearPending,
      });
      isResetting.current = true;
      setIsWebViewReady(false);
      // setVerifiedPath('');

      Object.values(activeTimeoutsRef.current).forEach(t =>
        clearTimeout(t.timeoutId),
      );
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

      if (shouldClearPending) {
        Object.entries(pendingRequests.current).forEach(([id, resolve]) => {
          // Call the resolve to trigger timeout cleanup
          if (typeof resolve === 'function') {
            resolve({
              error: 'Unable to finish action, request got cleaned up.',
            });
          }
        });
        pendingRequests.current = {};
      }

      sessionKeyRef.current = null;
      expectedSequenceRef.current = 0;
      aesKeyRef.current = null;
      nonceVerified.current = false;
    },
    [],
  );

  const reloadWebViewSecurely = useCallback(async () => {
    try {
      console.log('Re-verifying WebView before reload...');
      if (forceReactNativeUse) return;

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
      forceReactNativeUse = true;
      setHandshakeComplete(false);
      const currentRoutes = navigationRef
        .getRootState()
        .routes?.map(r => r.name);

      const blockReset =
        currentRoutes?.includes('Splash') ||
        currentRoutes?.includes('Home') ||
        currentRoutes?.includes('ConnectingToNodeLoadingScreen');

      setChangeSparkConnectionState(prev => ({
        state: blockReset ? null : true,
        count: prev.count + 1,
      }));
    }
  }, []);

  // Handle app state changes
  useEffect(() => {
    const appStateChanged = previousAppState.current !== appState;
    const connectionChanged =
      prevConnectionStatus.current !== isConnectedToTheInternet;

    if ((!appStateChanged && !connectionChanged) || forceReactNativeUse) {
      return; // Nothing changed
    }

    if (appState === 'background') {
      console.log('App going to background - clearing all timeouts');
      // Clear everything to prevent timeout issues on background
      Object.values(activeTimeoutsRef.current).forEach(t =>
        clearTimeout(t.timeoutId),
      );
      activeTimeoutsRef.current = {};

      previousAppState.current = appState;
      prevConnectionStatus.current = isConnectedToTheInternet;
    } else if (appState === 'active') {
      console.log('App returned to foreground');
      // clear any active timeouts to prevent timeout from switching to rn
      Object.values(activeTimeoutsRef.current).forEach(t =>
        clearTimeout(t.timeoutId),
      );

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
  ]);

  const isDuplicate = (queue, action, args) => {
    return queue.some(
      req =>
        ![
          OPERATION_TYPES.getSingleTxDetails,
          OPERATION_TYPES.getUserSwapHistory,
        ].includes(req.action) &&
        req.action === action &&
        JSON.stringify(req.args) === JSON.stringify(args),
    );
  };

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

  const handleWebViewResponse = useCallback(
    event => {
      try {
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
          forceReactNativeUse = true;
          return;
        }

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
            Buffer.from(sessionKeyRef.current.privateKey).toString('hex'),
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
            return;
          }
          nonceVerified.current = true;
          console.log('Handshake complete. Got backend public key.');
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
        }
        console.log('receiving message from webview', content);

        if (content.type === 'security:csp-violation') {
          console.error('CSP VIOLATION DETECTED:', content);

          resetWebViewState(true, true);
          forceReactNativeUse = true;
          return;
        }

        if (content.error) throw new Error(content.error);

        if (content.incomingPayment) {
          const data = JSON.parse(content.result);
          incomingSparkTransaction.emit(
            INCOMING_SPARK_TX_NAME,
            data.transferId,
            data.balance,
          );
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
              forceReactNativeUse = true;

              setLocalStorageItem('FORCE_REACT_NATIVE', 'true');
            }
            resolve(result);

            delete pendingRequests.current[content.id];
          }
        }
      } catch (err) {
        console.error('Error handling WebView message:', err);
        if (
          typeof err.message === 'string' &&
          err.message === 'Rejected stale message'
        )
          return;
        resetWebViewState(true, true);
        forceReactNativeUse = true;
      }
    },
    [decryptMessage, resetWebViewState],
  );

  const sendWebViewRequestInternal = useCallback(
    async (action, args = {}, encrypt = true) => {
      return new Promise(async (resolve, reject) => {
        let timeoutId = null;
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
          const id = customUUID();

          // Queue messages during reset/background
          if (
            (isResetting.current || AppState.currentState !== 'active') &&
            action !== 'handshake:init' &&
            action !== 'initializeSparkWallet'
          ) {
            console.log(
              'WebView is resetting or in the background, queueing message:',
              action,
            );
            if (!isDuplicate(queuedRequests.current, action, args)) {
              queuedRequests.current.push({
                id,
                action,
                args,
                encrypt,
                resolve,
                reject,
              });
            } else {
              console.log('Duplicate request ignored:', action, args);
              reject('Duplicate request ignored');
            }
            return;
          }

          // Reject importent messages if app is not connected to the internet
          if (!internetConnectionRef.current && action !== 'handshake:init') {
            console.log(
              'App is not connected to the internet, queueing message:',
              action,
            );
            if (
              rejectIfNotConnectedToInternet.some(op =>
                action.toLowerCase().includes(op.toLowerCase()),
              )
            ) {
              reject(new Error(`App is not connected to the internet`));
            } else if (action !== OPERATION_TYPES.initWallet) {
              //don't add init wallet, this will be added during webview reset
              if (!isDuplicate(queuedRequests.current, action, args)) {
                queuedRequests.current.push({
                  id,
                  action,
                  args,
                  encrypt,
                  resolve,
                  reject,
                });
              } else {
                console.log('Duplicate request ignored:', action, args);
                reject('Duplicate request ignored');
              }
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
            if (!isDuplicate(queuedRequests.current, action, args)) {
              queuedRequests.current.push({
                id,
                action,
                args,
                encrypt,
                resolve,
                reject,
              });
            } else {
              console.log('Duplicate request ignored:', action, args);
              reject('Duplicate request ignored');
            }
            return;
          }

          const getTimeoutDuration = action => {
            if (action === 'handshake:init') return 2000;

            if (
              longOperations.some(op =>
                action.toLowerCase().includes(op.toLowerCase()),
              )
            ) {
              return 90000; // 90 seconds for payment operations
            }

            if (
              mediumOperations.some(op =>
                action.toLowerCase().includes(op.toLowerCase()),
              )
            ) {
              return 30000; // 30 seconds
            }

            return 10000; // 10 seconds
          };

          const timeoutDuration = getTimeoutDuration(action);
          const startedAt = Date.now();

          const handleTimeout = () => {
            if (appState !== 'active') {
              console.log(
                `Skipping timeout for ${action} because app is not active (${appState})`,
              );
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

            resetWebViewState(true, true);
            forceReactNativeUse = true;

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
          };

          const originalResolve = resolve;
          pendingRequests.current[id] = result => {
            const t = activeTimeoutsRef.current[id];
            if (t?.timeoutId) clearTimeout(t.timeoutId);
            delete activeTimeoutsRef.current[id];
            originalResolve(result);
          };

          if (args.mnemonic && action !== 'initializeSparkWallet') {
            args.mnemonic = sha256Hash(args.mnemonic);
          }

          // Handle initializeSparkWallet specially
          if (action === 'initializeSparkWallet') {
            if (!getHandshakeComplete()) {
              console.log('Handshake not complete, cannot initialize wallet');
              if (timeoutId) clearTimeout(timeoutId);
              forceReactNativeUse = true;
              setChangeSparkConnectionState(prev => ({
                state: true,
                count: prev.count + 1,
              }));
              return resolve({ isConnected: false });
            }
            if (!nonceVerified.current) {
              console.log('Nonce not verified, cannot initialize wallet');
              if (timeoutId) clearTimeout(timeoutId);
              forceReactNativeUse = true;
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

                forceReactNativeUse = true;
                setChangeSparkConnectionState(prev => ({
                  state: true,
                  count: prev.count + 1,
                }));

                queuedRequests.current.forEach(({ reject }) => {
                  reject({
                    error: 'Wallet initialization failed, using React Native',
                  });
                });
                queuedRequests.current = [];
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

              // Queue the request instead of blocking
              if (!isDuplicate(queuedRequests.current, action, args)) {
                queuedRequests.current.push({
                  id,
                  action,
                  args,
                  encrypt,
                  resolve,
                  reject,
                });

                // Clean up timeout since we're queueing
                if (timeoutId) clearTimeout(timeoutId);
                delete activeTimeoutsRef.current[id];

                return;
              } else {
                console.log('Duplicate request ignored:', action);
                if (timeoutId) clearTimeout(timeoutId);
                return reject(new Error('Duplicate request ignored'));
              }
            }
          }

          const sequence = getNextSequence();
          const timestamp = Date.now();

          let payload = { id, action, args, sequence, timestamp };
          console.log('sending message to webview', action, payload);

          try {
            if (encrypt && aesKeyRef.current) {
              const encrypted = encryptMessage(JSON.stringify(payload));
              payload = { type: 'secure:msg', encrypted };
            }
            webViewRef.current.postMessage(JSON.stringify(payload));
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            delete pendingRequests.current[id];
            reject(err);
          }
        } catch (err) {
          // Clean up timeout on error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          console.log(
            'Error sending webview request from internal function',
            err,
          );
          reject(err);
        }
      });
    },
    [
      encryptMessage,
      resetWebViewState,
      getNextSequence,
      appState,
      isConnectedToTheInternet,
    ],
  );

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
      forceReactNativeUse = true;
      const currentRoutes = navigationRef
        .getRootState()
        .routes?.map(r => r.name);

      const blockReset =
        currentRoutes?.includes('Splash') ||
        currentRoutes?.includes('Home') ||
        currentRoutes?.includes('ConnectingToNodeLoadingScreen');

      setChangeSparkConnectionState(prev => ({
        state: blockReset ? null : true,
        count: prev.count + 1,
      }));
      queuedRequests.current.forEach(({ reject }) => {
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
        forceReactNativeUse = true;
        didRunHandshakeRef.current = true;
        return;
      }
      await initHandshake();
      didRunHandshakeRef.current = true;
    }

    const debouceID = setTimeout(() => {
      // forceReactNativeUse = true;
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
      try {
        const { htmlPath, nonceHex, hashHex } = await verifyAndPrepareWebView(
          Platform.OS === 'ios'
            ? require('spark-web-context')
            : 'file:///android_asset/sparkContext.html',
        );

        expectedNonceRef.current = nonceHex;
        setVerifiedPath(htmlPath);
      } catch (err) {
        console.log(
          'WebView bundle verification failed. Using react-native bundle',
          err,
        );
      }
    })();
  }, []);

  useEffect(() => {
    globalSendWebViewRequest = sendWebViewRequestInternal;
  }, [sendWebViewRequestInternal]);

  const processQueuedRequests = useCallback(
    async connectionJustRestored => {
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
          forceReactNativeUse = true;
          // Reject all queued requests since WebView is now unusable
          queuedRequests.current.forEach(({ reject }) => {
            reject({
              error: 'Wallet initialization failed, using React Native',
            });
          });
          queuedRequests.current = [];
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
      await Promise.allSettled(
        requests.map(({ id, action, args, encrypt, resolve, reject }) =>
          sendWebViewRequestInternal(action, args, encrypt)
            .then(resolve)
            .catch(reject)
            .finally(() => {
              queuedRequests.current = queuedRequests.current.filter(
                req => req.id !== id,
              );
            }),
        ),
      );

      isResetting.current = false;
    },
    [sendWebViewRequestInternal],
  );

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

  return (
    <WebViewContext.Provider
      value={{
        webViewRef,
        sendWebViewRequest: sendWebViewRequestInternal,
        fileHash,
        changeSparkConnectionState,
        didRunHandshakeRef,
      }}
    >
      {children}
      <WebView
        key={reloadKey}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
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
        onLoadEnd={() => {
          setIsWebViewReady(true);
          console.log('WebView loaded and ready');
        }}
        onContentProcessDidTerminate={() => {
          console.warn('WebView content process terminated — reloading...');
          blockAndResetWebview();
        }}
      />
    </WebViewContext.Provider>
  );
};

export const useWebView = () => React.useContext(WebViewContext);
