// Web replacement for webViewContext.js.
//
// On native, the Spark SDK runs inside an offscreen WebView and this module is
// a heavy encrypted-postMessage RPC bridge (queue, dedupe, rate limiter, reset
// machinery) to manage that crashy external process. On web the exact same
// browser bundle (spark-web-context) runs directly in the page, so we call its
// handlers in-process and keep only the public contract the app depends on:
//   sendWebViewRequestGlobal(action, args), the 4 event emitters,
//   getHandshakeComplete()/setForceReactNative(), and the WebViewProvider hook.
//
// This file fully shadows webViewContext.js on web (Metro .web.js resolution),
// so it re-declares the shared constants rather than importing the native file.
import React, { createContext, useMemo, useRef } from 'react';
import EventEmitter from 'events';
import { SparkAPI } from 'spark-web-context/src/spark.js';
import { decryptMessage } from 'spark-web-context/src/utils/encription.js';

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

function getTimeoutDuration(action) {
  if (longOperations.has(action)) return 90000;
  if (mediumOperations.has(action)) return 30000;
  return 10000;
}

// --- Event emitters (same names/signatures the app subscribes to) ---
export const INCOMING_SPARK_TX_NAME = 'RECEIVED_CONTACTS EVENT';
export const incomingSparkTransaction = new EventEmitter();

export const BALANCE_UPDATE_EVENT_NAME = 'SPARK_BALANCE_UPDATE';
export const sparkBalanceUpdateEmitter = new EventEmitter();

export const TOKEN_BALANCE_UPDATE_EVENT_NAME = 'SPARK_TOKEN_BALANCE_UPDATE';
export const sparkTokenBalanceUpdateEmitter = new EventEmitter();

export const STREAM_STATUS_EVENT_NAME = 'SPARK_STREAM_STATUS';
export const sparkStreamStatusEmitter = new EventEmitter();

// --- In-page Spark API ---
// A real random 32-byte key is required: spark.js unconditionally encrypts push
// events with it (and swallows encryption errors), so a null key would silently
// drop every incoming-payment / balance-update event.
const sharedKey = (() => {
  const k = new Uint8Array(32);
  crypto.getRandomValues(k);
  return k;
})();

// Mirrors the native onMessage push-event routing.
function routeEvent(content) {
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
}

// Stands in for ReactNativeWebView: spark.js posts encrypted push events here.
const fakeBridge = {
  postMessage: async json => {
    try {
      const { encrypted } = JSON.parse(json);
      const content = JSON.parse(await decryptMessage(sharedKey, encrypted));
      if (content.isResponse) routeEvent(content);
    } catch (err) {
      console.error('web bridge event decode failed:', err);
    }
  },
};

const sparkAPI = SparkAPI({ sharedKey, ReactNativeWebView: fakeBridge });

function timeout(ms, action) {
  return new Promise(resolve =>
    setTimeout(
      () => resolve({ error: `Call unresponsive (timeout after ${ms}ms)` }),
      ms,
    ),
  );
}

export const sendWebViewRequestGlobal = async (action, args = {}) => {
  const handler = sparkAPI[action];
  if (typeof handler !== 'function') {
    throw new Error(`Unknown Spark action: ${action}`);
  }
  const result = await Promise.race([
    Promise.resolve(handler(args)),
    timeout(getTimeoutDuration(action), action),
  ]);
  // Parity with the native bridge's JSON.stringify/parse round-trip (drops
  // undefined, normalizes bigint-toString shapes already applied by spark.js).
  return JSON.parse(JSON.stringify(result ?? null));
};

// The whole point of the WebView bridge is a crashy external process; there is
// none on web, so the handshake is always "complete" and force-native is inert.
export const getHandshakeComplete = () => true;
export const setForceReactNative = () => {};
export const __getPendingRequestIdsForTest = () => [];

const WebViewContext = createContext(null);

export const WebViewProvider = ({ children }) => {
  const webViewRef = useRef(null);
  const didRunHandshakeRef = useRef(true);

  const providerValues = useMemo(
    () => ({
      webViewRef,
      sendWebViewRequest: sendWebViewRequestGlobal,
      fileHash: 'in-page (web)',
      changeSparkConnectionState: {},
      didRunHandshakeRef,
    }),
    [],
  );

  return (
    <WebViewContext.Provider value={providerValues}>
      {children}
    </WebViewContext.Provider>
  );
};

export const useWebView = () => React.useContext(WebViewContext);
