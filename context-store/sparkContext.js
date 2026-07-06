import {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  claimnSparkStaticDepositAddress,
  clearMnemonicCache,
  getSingleTxDetails,
  getSparkTransactions,
  getSparkStaticBitcoinL1AddressQuote,
  getUtxosForDepositAddress,
  initializeFlashnet,
  queryAllStaticDepositAddresses,
  selectSparkRuntime,
  sparkWallet,
} from '../app/functions/spark';
import {
  bulkUpdateSparkTransactions,
  insertSparkTransactionPlaceholders,
  getAllSparkTransactions,
  getAllSparkContactInvoices,
  getSparkTransactionBySparkId,
  getAllUnpaidSparkLightningInvoices,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../app/functions/spark/transactions';
import { useAppStatus } from './appStatus';
import {
  checkHodlInvoicePaymentStatuses,
  updateSparkTxStatus,
} from '../app/functions/spark/restore';
import { useGlobalContactsInfo } from './globalContacts';
import { initWallet } from '../app/functions/initiateWalletConnection';
// import { useNodeContext } from './nodeContext';
import { AppState } from 'react-native';
import getDepositAddressTxIds from '../app/functions/spark/getDepositAdressTxIds';
import { useKeysContext } from './keys';
import {
  clearSpendAndReplaceCorrelationMemo,
  setSpendAndReplaceAuthGetter,
} from '../app/functions/spark/spendAndReplaceCorrelation';
import { navigationRef } from '../navigation/navigationService';
import { transformTxToPaymentObject } from '../app/functions/spark/transformTxToPayment';
import EventEmitter from 'events';
import { getLRC20Transactions } from '../app/functions/lrc20';
import { useActiveCustodyAccount } from './activeAccount';
import sha256Hash from '../app/functions/hash';
import i18n from 'i18next';
import {
  INCOMING_SPARK_TX_NAME,
  incomingSparkTransaction,
  BALANCE_UPDATE_EVENT_NAME,
  sparkBalanceUpdateEmitter,
  TOKEN_BALANCE_UPDATE_EVENT_NAME,
  sparkTokenBalanceUpdateEmitter,
  STREAM_STATUS_EVENT_NAME,
  sparkStreamStatusEmitter,
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
  useWebView,
} from './webViewContext';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';
import {
  createRestorePoller,
  getBalanceWithTimeout,
} from '../app/functions/pollingManager';
import { USDB_TOKEN_ID } from '../app/constants';
import { saveAccountBalanceSnapshot } from '../app/functions/spark/balanceSnapshots';
import { mergeAndCacheTokens } from '../app/functions/lrc20/cachedTokens';
import {
  cleanupOptimization,
  checkIfOptimizationNeeded,
  runLeafOptimization,
  runTokenOptimization,
} from '../app/functions/spark/optimization';
import { isFlashnetTransfer } from '../app/functions/spark/handleFlashnetTransferIds';
import { filterDisplayableTransactions } from '../app/functions/spark/filterTransactions';
import { getCachedTokenImages } from '../app/functions/spark/tokenImageCache';
import { useToastActions } from './toastManager';

export const isSendingPayingEventEmiiter = new EventEmitter();
export const SENDING_PAYMENT_EVENT_NAME = 'SENDING_PAYMENT_EVENT';

if (!global.blitzWalletSparkIntervalState) {
  global.blitzWalletSparkIntervalState = {
    intervalTracker: new Map(),
    listenerLock: new Map(),
    allIntervalIds: new Set(),
    depositIntervalIds: new Set(),
  };
}
const { intervalTracker, listenerLock, allIntervalIds, depositIntervalIds } =
  global.blitzWalletSparkIntervalState;

const TX_REFRESH_UPDATE_TYPES = new Set([
  'transactions',
  'txStatusUpdate',
  'lrc20Payments',
  'contactDetailsUpdate',
  'incrementalRestore',
  'incomingPayment',
  'fullUpdate',
  'fullUpdate-waitBalance',
  'fullUpdate-tokens',
  'paymentWrapperTx',
]);

const BALANCE_INTENT_UPDATE_TYPES = new Set([
  'fullUpdate-waitBalance',
  'paymentWrapperTx',
  'fullUpdate',
  'fullUpdate-tokens',
]);

const SKIP_CONFIRM_NAV_UPDATE_TYPES = new Set([
  'paymentWrapperTx',
  'transactions',
  'txStatusUpdate',
  'lrc20Payments',
  'contactDetailsUpdate',
  'incrementalRestore',
]);

// Send screens where an incoming-payment toast would obscure the send UI. Keyed
// by the route names registered in navigation/screens.js.
const BLOCKED_TOAST_ROUTE_NAMES = new Set([
  'ConfirmPaymentScreen', // sendPaymentScreen.js
  'ConfirmSplitPayment', // confirmSplitPayment.js
  'StablecoinSendScreen', // stablecoinSendScreen.js
]);

function isOnSendScreen() {
  try {
    if (!navigationRef.isReady()) return false;
    return BLOCKED_TOAST_ROUTE_NAMES.has(navigationRef.getCurrentRoute()?.name);
  } catch {
    return false;
  }
}

// Initiate context
const SparkWalletManager = createContext(null);

const SparkWalletProvider = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { changeSparkConnectionState, sendWebViewRequest } = useWebView();
  const { accountMnemoinc, contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { showToast } = useToastActions();
  const {
    didGetToHomepage,
    appState,
    // lastConnectedTimeRef
  } = useAppStatus();
  // const { liquidNodeInformation } = useNodeContext();
  const { toggleGlobalContactsInformation, globalContactsInformation } =
    useGlobalContactsInfo();
  const prevAccountMnemoincRef = useRef(null);
  const contactsPrivateKeyRef = useRef('');
  const contactsPublicKeyRef = useRef(null);
  const [sparkConnectionError, setSparkConnectionError] = useState(null);
  const isRunningAddListeners = useRef(false);
  const [sparkInformation, setSparkInformation] = useState({
    balance: 0,
    tokens: {},
    transactions: [],
    identityPubKey: '',
    sparkAddress: '',
    didConnect: null,
    didConnectToFlashnet: null,
  });
  const [tokensImageCache, setTokensImageCache] = useState({});

  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const isInitialLRC20Run = useRef(true);
  const initialBitcoinIntervalRun = useRef(null);
  const sparkInfoRef = useRef({
    balance: 0,
    tokens: {},
    identityPubKey: '',
    sparkAddress: '',
    transactions: [],
    didConnect: false,
  });
  const sessionTimeRef = useRef(Date.now());
  const handledTransfers = useRef(new Set());
  const prevListenerType = useRef(null);
  const prevAppState = useRef(appState);
  const prevAccountId = useRef(null);
  const isSendingPaymentRef = useRef(false);
  const txPollingTimeoutRef = useRef(null);
  const txPollingAbortControllerRef = useRef(null);
  const isInitialRender = useRef(true);
  const authResetKeyRef = useRef(authResetkey);
  const balanceVersionRef = useRef(0);
  const hasRunInitBalancePoll = useRef(false);
  const foregroundReconcileAppStateRef = useRef(appState);

  const txLaneQueueRef = useRef(Promise.resolve());
  const uiLaneQueueRef = useRef(Promise.resolve());
  const queueDepthRef = useRef(0);
  const eventSequenceRef = useRef(0);

  const scrollPositionRef = useRef('total');

  // Single-flight guard for the balance reconcile read (see reconcileBalance).
  // reconcileRunIdRef gives each run ownership so a read that parks across a
  // background transition can't clear a newer run's lock when it finally settles.
  const isReconcilingBalanceRef = useRef(false);
  const reconcileBalanceAgainRef = useRef(false);
  const reconcileRunIdRef = useRef(0);

  // Tracks whether the Spark event stream has dropped, so a later
  // stream:connected is recognized as a *re*connect (which warrants one
  // reconcile read) rather than the benign initial connect.
  const streamWasDisconnectedRef = useRef(false);
  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const hideSmallPaymentsHomepage = masterInfoObject.hideSmallPaymentsHomepage;

  const showTokensInformation =
    masterInfoObject.enabledBTKNTokens === null
      ? !!Object.keys(sparkInformation.tokens || {}).filter(
          token => token !== USDB_TOKEN_ID,
        ).length
      : masterInfoObject.enabledBTKNTokens;

  const handledNavigatedTxs = useRef(new Set());

  const [didRunNormalConnection, setDidRunNormalConnection] = useState(false);
  const [normalConnectionTimeout, setNormalConnectionTimeout] = useState(false);
  const shouldRunNormalConnection =
    didRunNormalConnection || normalConnectionTimeout;
  const currentMnemonicRef = useRef(currentWalletMnemoinc);
  // Hash of the active main wallet mnemonic. Push events (balance/token/transfer)
  // are tagged with a walletId (mnemonic hash) so derived gift/pool/savings
  // wallets sharing the WebView bridge can be told apart from the main wallet.
  // We ignore any event whose walletId isn't this one. Cached here so we don't
  // re-hash on every event.
  const mainWalletHashRef = useRef(
    currentWalletMnemoinc ? sha256Hash(currentWalletMnemoinc) : null,
  );

  const cleanStatusAndLRC20Intervals = () => {
    try {
      for (const intervalId of allIntervalIds) {
        console.log('Clearing stored interval ID:', intervalId);
        clearInterval(intervalId);
      }

      intervalTracker.clear();
      allIntervalIds.clear();
    } catch (err) {
      console.log('Error cleaning lrc20 intervals', err);
    }
  };

  const clearAllDepositIntervals = () => {
    console.log(
      'Clearing all deposit address intervals. Counts:',
      depositIntervalIds.size,
    );

    for (const intervalId of depositIntervalIds) {
      console.log('Clearing deposit interval ID:', intervalId);
      clearInterval(intervalId);
    }

    depositIntervalIds.clear();
    console.log('All deposit intervals cleared');
  };

  useEffect(() => {
    authResetKeyRef.current = authResetkey;
  }, [authResetkey]);

  useEffect(() => {
    sparkInfoRef.current = {
      ...sparkInfoRef.current,
      balance: sparkInformation.balance,
      tokens: sparkInformation.tokens,
      identityPubKey: sparkInformation.identityPubKey,
      sparkAddress: sparkInformation.sparkAddress,
      didConnect: sparkInformation.didConnect,
    };
  }, [
    sparkInformation.balance,
    sparkInformation.tokens,
    sparkInformation.identityPubKey,
    sparkInformation.sparkAddress,
    sparkInformation.didConnect,
  ]);

  useEffect(() => {
    currentMnemonicRef.current = currentWalletMnemoinc;
    mainWalletHashRef.current = currentWalletMnemoinc
      ? sha256Hash(currentWalletMnemoinc)
      : null;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    // Fixing race condition with new preloaded txs
    sessionTimeRef.current = Date.now() + 5 * 1000;
  }, [currentWalletMnemoinc, authResetkey]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    const timer = setTimeout(() => {
      setNormalConnectionTimeout(true);
    }, 20000);

    return () => clearTimeout(timer);
  }, [didGetToHomepage]);

  useEffect(() => {
    async function handleWalletStateChange() {
      if (!didGetToHomepage) return;
      if (!sparkInfoRef.current.identityPubKey) return;
      if (changeSparkConnectionState.state == null) return;
      if (!changeSparkConnectionState.state) {
        setSparkInformation(prev => ({ ...prev, didConnect: false }));
      } else {
        let alreadyRanConnection = false;
        if (!sparkInfoRef.current.identityPubKey && shouldRunNormalConnection) {
          await resetSparkState(true, false);
          await connectToSparkWallet();
          await initializeFlashnet(currentMnemonicRef.current);
          alreadyRanConnection = true;
        } else {
          setSparkInformation(prev => ({
            ...prev,
            didConnect: !!prev.identityPubKey,
          }));
        }

        const runtime = await selectSparkRuntime(
          currentMnemonicRef.current,
          false,
          undefined,
          false,
        );
        if (runtime === 'native') {
          if (!alreadyRanConnection) {
            await resetSparkState(true, false);
            await connectToSparkWallet();
            await initializeFlashnet(currentMnemonicRef.current);
          }
        }
      }
    }
    handleWalletStateChange();
  }, [
    changeSparkConnectionState,
    didGetToHomepage,
    shouldRunNormalConnection,
    resetSparkState,
    connectToSparkWallet,
  ]);

  useEffect(() => {
    if (!sparkInfoRef.current?.tokens) return;

    async function updateTokensImageCache() {
      const tokenIds = Object.keys(sparkInfoRef.current.tokens);
      const newCache = await getCachedTokenImages(tokenIds);
      setTokensImageCache(prev => ({ ...prev, ...newCache }));
    }

    updateTokensImageCache();
  }, [Object.keys(sparkInformation.tokens || {}).length]);

  // Debounce refs
  const debounceTimeoutRef = useRef(null);
  const debounceMaxWaitRef = useRef(null);
  const latestIncomingBalanceRef = useRef(null);
  const pendingTransferIds = useRef(new Set());

  // Debounce refs for balance:update — a burst of inbound payments emits one
  // balance:update each; we coalesce them into a single state write.
  const balanceDebounceTimeoutRef = useRef(null);
  const balanceDebounceMaxWaitRef = useRef(null);
  const latestBalanceRef = useRef(null);

  // Debounce refs for token-balance:update — same coalescing for token events.
  const tokenDebounceTimeoutRef = useRef(null);
  const tokenDebounceMaxWaitRef = useRef(null);
  const latestTokensRef = useRef(null);

  const toggleIsSendingPayment = useCallback(isSending => {
    console.log('Setting is sending payment', isSending);
    if (isSending) {
      if (txPollingAbortControllerRef.current) {
        txPollingAbortControllerRef.current.abort();
        txPollingAbortControllerRef.current = null;
      }
    }
    isSendingPaymentRef.current = isSending;
  }, []);

  useEffect(() => {
    if (
      !isSendingPayingEventEmiiter.listenerCount(SENDING_PAYMENT_EVENT_NAME)
    ) {
      isSendingPayingEventEmiiter.addListener(
        SENDING_PAYMENT_EVENT_NAME,
        toggleIsSendingPayment,
      );
    }

    return () => {
      console.log('clearning up toggle send pament');
      isSendingPayingEventEmiiter.removeListener(
        SENDING_PAYMENT_EVENT_NAME,
        toggleIsSendingPayment,
      );
    };
  }, [toggleIsSendingPayment]);

  const debouncedHandleIncomingPayment = useCallback(
    async balance => {
      if (pendingTransferIds.current.size === 0) return;

      const transferIdsToProcess = Array.from(pendingTransferIds.current);
      pendingTransferIds.current.clear();

      console.log(
        'Processing debounced incoming payments:',
        transferIdsToProcess,
      );

      // ─── Step 1: Immediately write placeholders so the restore handler
      //     sees these transfer IDs as already-present in SQLite and skips them.
      const placeholders = transferIdsToProcess.map(transferId => ({
        id: transferId,
        paymentStatus: 'pending',
        paymentType: 'unknown',
        accountId: sparkInfoRef.current.identityPubKey,
        details: {
          createdTime: Date.now(),
          isPlaceholder: true,
          direction: 'INCOMING',
        },
      }));

      try {
        await insertSparkTransactionPlaceholders(placeholders);
      } catch (error) {
        console.error('Error writing placeholder transactions:', error);
      }

      // ─── Step 2: Fetch tx details in a SINGLE batched call (one WebView
      //     message) instead of one round-trip per transfer.
      let cachedTransfers = [];

      try {
        const idSet = new Set(transferIdsToProcess);
        const { transfers = [] } = await getSparkTransactions(
          Math.max(50, transferIdsToProcess.length),
          undefined,
          currentMnemonicRef.current,
        );
        cachedTransfers = transfers.filter(transfer => idSet.has(transfer.id));

        // Fallback only for ids NOT in the batch window (e.g. an older transfer
        // that settled while many newer transfers arrived in the same burst).
        // Normal load hits zero of these, so the single-message goal holds; this
        // just stops a dropped id from being stuck as a pending placeholder.
        const foundIds = new Set(cachedTransfers.map(transfer => transfer.id));
        const missingIds = transferIdsToProcess.filter(id => !foundIds.has(id));
        for (const transferId of missingIds) {
          const transfer = await getSingleTxDetails(
            currentMnemonicRef.current,
            transferId,
          );
          if (transfer) cachedTransfers.push(transfer);
        }
      } catch (error) {
        console.error('Error fetching batched incoming payments:', error);
      }

      const paymentObjects = [];

      const [unpaidInvoices, unpaidContactInvoices] = await Promise.all([
        getAllUnpaidSparkLightningInvoices(),
        getAllSparkContactInvoices(),
      ]);

      for (const transferId of transferIdsToProcess) {
        const tx = cachedTransfers.find(t => t.id === transferId);
        if (!tx) continue;

        // Skip UTXO_SWAP handling here — old logic kept
        if (tx.type === 'UTXO_SWAP') continue;

        const paymentObj = await transformTxToPaymentObject(
          tx,
          sparkInfoRef.current.sparkAddress,
          undefined,
          false,
          unpaidInvoices,
          sparkInfoRef.current.identityPubKey,
          1,
          undefined,
          unpaidContactInvoices,
          currentMnemonicRef.current,
        );

        if (paymentObj) {
          paymentObjects.push(paymentObj);
        }
      }

      if (!paymentObjects.length) {
        setSparkInformation(prev => ({
          ...prev,
          balance: balance,
        }));
        return;
      }

      try {
        await bulkUpdateSparkTransactions(
          paymentObjects,
          isSendingPaymentRef.current ? 'transactions' : 'incomingPayment',
          0,
          balance,
        );
      } catch (error) {
        console.error('bulkUpdateSparkTransactions failed:', error);
      }
    },
    [sendWebViewRequest],
  );

  const filterAndSetTransactions = useCallback(
    freshTxs => {
      sparkInfoRef.current.transactions = freshTxs.slice(0, 50);
      const filtered = filterDisplayableTransactions({
        transactions: freshTxs,
        scrollPosition: scrollPositionRef.current,
        enabledLRC20: showTokensInformation,
        tokens: sparkInfoRef.current.tokens,
        limit: homepageTxPreferance,
        hideSmallPaymentsHomepage,
      });
      setSparkInformation(prev => ({ ...prev, transactions: filtered }));
    },
    [showTokensInformation, homepageTxPreferance, hideSmallPaymentsHomepage],
  );

  const updateHomepageScrollPosition = useCallback(
    async pos => {
      scrollPositionRef.current = pos;
      const allTxs = await getAllSparkTransactions({
        limit: null,
        accountId: sparkInfoRef.current.identityPubKey,
      });
      const filtered = filterDisplayableTransactions({
        transactions: allTxs,
        scrollPosition: pos,
        enabledLRC20: showTokensInformation,
        tokens: sparkInfoRef.current.tokens,
        limit: homepageTxPreferance,
        hideSmallPaymentsHomepage,
      });
      if (scrollPositionRef.current !== pos) return;
      setSparkInformation(prev => ({ ...prev, transactions: filtered }));
    },
    [showTokensInformation, homepageTxPreferance, hideSmallPaymentsHomepage],
  );

  const updateHomepageTxPreferance = useCallback(
    async (num, smallPaymentOverrides) => {
      const allTxs = await getAllSparkTransactions({
        limit: null,
        accountId: sparkInfoRef.current.identityPubKey,
      });
      const filtered = filterDisplayableTransactions({
        transactions: allTxs,
        scrollPosition: scrollPositionRef.current,
        enabledLRC20: showTokensInformation,
        tokens: sparkInfoRef.current.tokens,
        limit: num,
        hideSmallPaymentsHomepage:
          smallPaymentOverrides ?? hideSmallPaymentsHomepage,
      });
      setSparkInformation(prev => ({ ...prev, transactions: filtered }));
    },
    [showTokensInformation, hideSmallPaymentsHomepage],
  );

  const enqueueTxLane = useCallback((updateType, task) => {
    queueDepthRef.current += 1;
    console.log(
      `[TxLane] +1 (${updateType}) -> depth: ${queueDepthRef.current}`,
    );

    txLaneQueueRef.current = txLaneQueueRef.current
      .then(task)
      .catch(err => console.log('[TxLane] task error', updateType, err))
      .finally(() => {
        queueDepthRef.current -= 1;
        console.log(
          `[TxLane] -1 (${updateType}) -> depth: ${queueDepthRef.current}`,
        );
      });

    return txLaneQueueRef.current;
  }, []);

  const enqueueUiLane = useCallback((updateType, task) => {
    uiLaneQueueRef.current = uiLaneQueueRef.current
      .then(task)
      .catch(err => console.log('[UiLane] task error', updateType, err));

    return uiLaneQueueRef.current;
  }, []);

  const maybeHandleConfirmNavigation = useCallback(
    async (updateType, txs = null, from) => {
      try {
        if (SKIP_CONFIRM_NAV_UPDATE_TYPES.has(updateType)) return;

        const { identityPubKey } = sparkInfoRef.current;
        if (!identityPubKey) return;

        let lastAddedTx;
        if (txs) {
          lastAddedTx = txs[0];
        } else {
          [lastAddedTx] = getAllSparkTransactions({
            accountId: identityPubKey,
            limit: 1,
          });
        }

        console.log(lastAddedTx, txs);
        if (!lastAddedTx) return;

        let parsedDetails = {};
        try {
          parsedDetails = JSON.parse(lastAddedTx.details || '{}');
        } catch {
          parsedDetails = {};
        }

        const parsedTx = {
          ...lastAddedTx,
          details: parsedDetails,
        };
        const details = parsedTx.details || {};
        console.log(parsedTx, details, from, 'testing notifications');

        if (parsedTx.paymentStatus === 'pending') {
          // Run a tx status check. Will delay toast message
          // but will prevent a stale pending stae from making the trasnsaction show pending after toast message
          const { updated } = await updateSparkTxStatus(
            currentMnemonicRef.current,
            sparkInfoRef.current.identityPubKey,
            sendWebViewRequest,
            true,
            contactsPrivateKey,
            publicKey,
          );
          const didUpdateStatus = updated.find(
            tx =>
              tx.tempId === parsedTx.sparkID &&
              tx.paymentStatus === 'completed',
          );
          console.log(updated, didUpdateStatus);
          if (!didUpdateStatus) {
            console.log('Payment is pending, show navigation once confimred');
            return;
          }
        }

        if (isFlashnetTransfer(parsedTx.sparkID)) {
          console.log('Failed swap refund, do not show tosat here');
          return;
        }

        if (
          details.senderIdentityPublicKey === process.env.SPARK_IDENTITY_PUBKEY
        ) {
          console.log('Refund from Spark, do not show tosat here');
          return;
        }

        const txTime = new Date(details.time).getTime();
        if (Number.isFinite(txTime) && txTime < sessionTimeRef.current) {
          console.log(
            'created before session time was set, skipping confirm tx page navigation',
          );
          return;
        }

        if (parsedTx?.paymentStatus?.toLowerCase() === 'failed') {
          console.log('This payment is of type failed, do not navigate here');
          return;
        }

        if (details.performSwaptoUSD) {
          console.log(
            'This payment is being used to perform a swap, do not navigate here.',
          );
          return;
        }

        if (isSendingPaymentRef.current) {
          console.log(
            'Is sending payment, skipping confirm tx page navigation',
          );
          return;
        }

        if (details.direction === 'OUTGOING') {
          console.log(
            'Only incoming payments navigate here, skipping confirm tx page navigation',
          );
          return;
        }

        if (details.isHoldInvoice && parsedTx.paymentStatus !== 'completed') {
          console.log('Blocking unconfirmed hodl invoice from showing');
          return;
        }

        if (handledNavigatedTxs.current.has(parsedTx.sparkID)) {
          console.log(
            'Already handled transaction, skipping confirm tx page navigation',
          );
          return;
        }
        handledNavigatedTxs.current.add(parsedTx.sparkID);

        if (isOnSendScreen()) {
          console.log('On a send screen — suppressing incoming payment toast');
          return;
        }

        // const isOnReceivePage =
        //   navigationRef
        //     .getRootState()
        //     .routes?.filter(item => item.name === 'ReceiveBTC').length === 1;

        // const hasPaymentTime = !!details.createdTime || !!details.time;
        // const isNewestPayment = hasPaymentTime
        //   ? new Date(details.createdTime || details.time).getTime() >
        //     newestPaymentTimeRef.current
        //   : false;

        // let shouldShowConfirm = false;
        // if (
        //   (lastAddedTx.paymentType?.toLowerCase() === 'lightning' &&
        //     !details.isLNURL &&
        //     !details.shouldNavigate &&
        //     isOnReceivePage &&
        //     isNewestPayment) ||
        //   (lastAddedTx.paymentType?.toLowerCase() === 'spark' &&
        //     !details.isLRC20Payment &&
        //     isOnReceivePage &&
        //     isNewestPayment)
        // ) {
        //   if (lastAddedTx.paymentType?.toLowerCase() === 'spark') {
        //     const unpaidLNInvoices = await getAllUnpaidSparkLightningInvoices();
        //     const lastMatch = unpaidLNInvoices.findLast(invoice => {
        //       const savedInvoiceDetails = JSON.parse(invoice.details);
        //       return (
        //         !savedInvoiceDetails.sendingUUID &&
        //         !savedInvoiceDetails.isLNURL &&
        //         invoice.amount === details.amount
        //       );
        //     });

        //     if (lastMatch && !usedSavedTxIds.current.has(lastMatch.id)) {
        //       usedSavedTxIds.current.add(lastMatch.id);
        //       const lastInvoiceDetails = JSON.parse(lastMatch.details);
        //       if (details.time - lastInvoiceDetails.createdTime < 60 * 1000) {
        //         shouldShowConfirm = true;
        //       }
        //     }
        //   } else {
        //     shouldShowConfirm = true;
        //   }
        // }

        showToast({
          amount: details.amount,
          LRC20Token: details.LRC20Token,
          isLRC20Payment: !!details.LRC20Token,
          duration: 7000,
          isSARPayment: !!details.isSARIncoming,
          type: 'confirmTx',
        });
      } catch (err) {
        console.log('[UiLane] confirm navigation error', err);
      }
    },
    [showToast],
  );

  const projectTransactionsForEvent = useCallback(
    async event => {
      const { identityPubKey } = sparkInfoRef.current;
      if (!identityPubKey) {
        console.warn(
          'Skipping tx projection because identityPubKey is not ready yet',
        );
        return;
      }

      const txs = await getAllSparkTransactions({
        limit: null,
        accountId: identityPubKey,
      });

      filterAndSetTransactions(txs);

      enqueueUiLane(event.updateType, () =>
        maybeHandleConfirmNavigation(
          event.updateType,
          txs,
          'project transactions for event',
        ),
      );
    },
    [enqueueUiLane, maybeHandleConfirmNavigation, filterAndSetTransactions],
  );

  // Applies the most recent balance:update value immediately, cancelling the
  // debounce. Used as the balance:update debounce flush AND to sync the
  // displayed balance with the incoming-payment toast: balance:update fires
  // before transfer:claimed, so the new value is already staged in
  // latestBalanceRef and we flush it in the same pass the toast is shown.
  const flushBalanceNow = useCallback(() => {
    if (balanceDebounceTimeoutRef.current) {
      clearTimeout(balanceDebounceTimeoutRef.current);
      balanceDebounceTimeoutRef.current = null;
    }
    if (balanceDebounceMaxWaitRef.current) {
      clearTimeout(balanceDebounceMaxWaitRef.current);
      balanceDebounceMaxWaitRef.current = null;
    }

    const nextBalance = latestBalanceRef.current;
    if (!Number.isFinite(nextBalance)) return;
    if (nextBalance === sparkInfoRef.current.balance) return;

    // Ordering guard shared with reconcileBalance so a slow reconcile read
    // can't overwrite this newer event value.
    const myVersion = ++balanceVersionRef.current;
    const { identityPubKey } = sparkInfoRef.current;

    saveAccountBalanceSnapshot(
      identityPubKey,
      nextBalance,
      sparkInfoRef.current.tokens,
    );

    setSparkInformation(prev => {
      if (myVersion < balanceVersionRef.current) return prev;
      if (prev.balance === nextBalance) return prev;
      return { ...prev, balance: nextBalance };
    });
  }, []);

  // One authoritative balance read, applied directly. The displayed balance is
  // driven in real time by balance:update events; this read is a safety net to
  // recover a balance whose event was missed (backgrounded / stream drop) and
  // to land post-restore deposit claims. Single-flight: a request while a read
  // is in flight sets a re-run flag instead of stacking reads. The version
  // guard makes a live balance:update win over a slower reconcile read.
  const reconcileBalance = useCallback(async () => {
    const mnemonic = currentMnemonicRef.current;
    if (!mnemonic) return false;

    if (isReconcilingBalanceRef.current) {
      reconcileBalanceAgainRef.current = true;
      return false;
    }

    isReconcilingBalanceRef.current = true;
    const runId = ++reconcileRunIdRef.current;
    // Whether this run landed an authoritative (finite) balance read. Returned
    // so callers like the post-connect timeout retry know when to stop.
    let didApplyFinite = false;

    try {
      do {
        reconcileBalanceAgainRef.current = false;
        const myVersion = ++balanceVersionRef.current;
        const result = await getBalanceWithTimeout(mnemonic);

        // A background transition (or account switch) invalidates this run; the
        // foreground effect bumps reconcileRunIdRef so a parked read can't apply
        // a stale value or clear a newer run's lock.
        if (runId !== reconcileRunIdRef.current) return didApplyFinite;
        if (mnemonic !== currentMnemonicRef.current) return didApplyFinite;
        if (AppState.currentState !== 'active') return didApplyFinite;

        const numericBalance = Number(result?.balance);
        if (Number.isFinite(numericBalance)) didApplyFinite = true;
        const { identityPubKey } = sparkInfoRef.current;

        saveAccountBalanceSnapshot(
          identityPubKey,
          Number.isFinite(numericBalance)
            ? numericBalance
            : sparkInfoRef.current.balance,
          result?.didWork ? result.tokensObj : sparkInfoRef.current.tokens,
        );

        setSparkInformation(prev => {
          if (myVersion < balanceVersionRef.current) return prev;
          return {
            ...prev,
            balance: Number.isFinite(numericBalance)
              ? numericBalance
              : prev.balance,
            tokens: result?.didWork ? result.tokensObj : prev.tokens,
          };
        });
      } while (
        reconcileBalanceAgainRef.current &&
        runId === reconcileRunIdRef.current &&
        mnemonic === currentMnemonicRef.current
      );
    } catch (err) {
      console.log('[reconcileBalance] error', err);
    } finally {
      if (runId === reconcileRunIdRef.current) {
        isReconcilingBalanceRef.current = false;
      }
    }
    return didApplyFinite;
  }, []);

  // After a cold connect where the init balance read timed out, the stale
  // snapshot is on screen and the connect-time balance:update was missed (the
  // listeners attach only after connect). Retry a bounded, backing-off reconcile
  // so a payment received while backgrounded still lands, independent of whether
  // the restore poller surfaces a tx delta. Stops on the first finite read.
  const retryBalanceAfterTimeout = useCallback(async () => {
    const mnemonic = currentMnemonicRef.current;
    const delays = [0, 3000, 6000];
    for (const delay of delays) {
      await new Promise(res => setTimeout(res, delay));
      if (mnemonic !== currentMnemonicRef.current) return;
      if (AppState.currentState !== 'active') return;
      // Don't read a balance while leaves are locked for a send — it would read
      // the transient 0. The send's own reconcile lands the settled value.
      if (isSendingPaymentRef.current) continue;
      const didApply = await reconcileBalance();
      if (didApply) return;
    }
  }, [reconcileBalance]);

  const handleUpdate = useCallback(
    (...args) => {
      const [updateType = 'transactions'] = args;

      const event = {
        seq: ++eventSequenceRef.current,
        updateType,
      };

      // Balance is driven in real time by balance:update / token-balance:update.
      // These update types mark a balance-changing DB action (restore
      // completion, deposit claim, send wrapper); we fire one reconcile read as
      // a safety net in case the matching event was missed.
      if (BALANCE_INTENT_UPDATE_TYPES.has(updateType)) {
        reconcileBalance();
      }

      // Apply the displayed balance in the same pass as the incoming toast.
      // balance:update fires before transfer:claimed, so the new value is
      // already staged in latestBalanceRef — flush it now so the number ticks
      // up exactly when the "received" toast appears.
      if (updateType === 'incomingPayment') {
        flushBalanceNow();
      }

      if (!TX_REFRESH_UPDATE_TYPES.has(updateType)) {
        return Promise.resolve();
      }

      return enqueueTxLane(updateType, () =>
        projectTransactionsForEvent(event),
      );
    },
    [
      enqueueTxLane,
      projectTransactionsForEvent,
      reconcileBalance,
      flushBalanceNow,
    ],
  );

  const transferHandler = useCallback((transferId, balance, walletId) => {
    // Ignore events from derived wallets (gift/pool/savings). Undefined walletId
    // = pre-tagging bundle → treat as main wallet (backward compatible).
    if (walletId && walletId !== mainWalletHashRef.current) return;
    if (handledTransfers.current.has(transferId)) return;
    handledTransfers.current.add(transferId);
    console.log(`Transfer ${transferId} claimed. New balance: ${balance}`);

    // Add transferId to pending set
    pendingTransferIds.current.add(transferId);
    // Always flush with the most recent balance, even when the max-wait timer
    // (set on the first event of the burst) fires.
    latestIncomingBalanceRef.current = balance;

    const flush = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (debounceMaxWaitRef.current) {
        clearTimeout(debounceMaxWaitRef.current);
        debounceMaxWaitRef.current = null;
      }
      debouncedHandleIncomingPayment(latestIncomingBalanceRef.current);
    };

    // Trailing debounce: flush 500ms after the last event…
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(flush, 500);

    // …but cap the wait at 10s so a sustained burst (events arriving faster
    // than every 500ms, which would perpetually reset the trailing timer and
    // never flush) still applies the balance periodically.
    if (!debounceMaxWaitRef.current) {
      debounceMaxWaitRef.current = setTimeout(flush, 10000);
    }
  }, []);

  // Authoritative writer for the displayed sats balance. balance:update fires on
  // every balance change (deposits, transfers, swaps, claims) with the real
  // current { available, owned, incoming }; we display `available` (parity with
  // the SDK's deprecated `balance` field). This is the single fast path that
  // makes sends/swaps/deposits reflect immediately — previously only inbound
  // claims had a push event and everything else waited on the poller.
  const balanceUpdateHandler = useCallback(
    (snapshot, walletId) => {
      // Ignore events from derived wallets (gift/pool/savings). Undefined
      // walletId = pre-tagging bundle → treat as main wallet (backward compatible).
      if (walletId && walletId !== mainWalletHashRef.current) return;
      const available = Number(snapshot?.available);

      console.log('hanlding balance update before send block', available);
      // blocking send screen changes to not affect payments
      if (isOnSendScreen() && available <= sparkInfoRef.current.balance) return;

      if (!Number.isFinite(available)) return;
      // Value-gate: ignore no-op events so a burst of inbound transfers (each
      // emitting balance:update) can't trigger a render / DB-write storm.
      if (available === sparkInfoRef.current.balance) return;

      // Always flush with the most recent value, even when the max-wait timer
      // (set on the first event of the burst) fires.
      latestBalanceRef.current = available;

      // Trailing debounce: flush 3s after the last event…
      if (balanceDebounceTimeoutRef.current)
        clearTimeout(balanceDebounceTimeoutRef.current);
      balanceDebounceTimeoutRef.current = setTimeout(flushBalanceNow, 3000);

      // …but cap the wait at 10s so a sustained burst (events arriving faster
      // than every 3s, which would perpetually reset the trailing timer and
      // never flush) still applies the balance periodically.
      if (!balanceDebounceMaxWaitRef.current) {
        balanceDebounceMaxWaitRef.current = setTimeout(flushBalanceNow, 10000);
      }
    },
    [flushBalanceNow],
  );

  // token-balance:update fires when a token tx finalizes and carries the full
  // current token-balance map (getTokenBalanceMap() in the SDK). We merge that
  // payload straight into the cache instead of issuing another getSparkBalance
  // round-trip — same result, one fewer WebView read per event. The WebView
  // runtime delivers the already-normalized map; the native runtime delivers the
  // raw SDK Map and is normalized at registration (see addListeners).
  // Token analog of debouncedHandleIncomingPayment / reconcileBalance: builds token
  // (LRC20) transaction history. Driven by token-balance:update events, a one-time
  // startup fetch, and the reconnect/foreground reconcile — replacing the old 10s poll.
  const reconcileTokenTransactions = useCallback((isInitialRun = false) => {
    if (isSendingPaymentRef.current) return;
    const mnemonic = currentMnemonicRef.current;
    if (!mnemonic) return;
    getLRC20Transactions({
      ownerPublicKeys: [sparkInfoRef.current.identityPubKey],
      sparkAddress: sparkInfoRef.current.sparkAddress,
      isInitialRun,
      mnemonic,
    });
  }, []);

  const tokenBalanceUpdateHandler = useCallback(
    (tokensObject, walletId) => {
      // Ignore events from derived wallets (gift/pool/savings). Undefined walletId
      // = pre-tagging bundle → treat as main wallet (backward compatible).
      if (walletId && walletId !== mainWalletHashRef.current) return;
      // Each event carries the full current token-balance map, so only the latest
      // payload matters during a burst.
      latestTokensRef.current = tokensObject ?? {};

      const flush = async () => {
        if (tokenDebounceTimeoutRef.current) {
          clearTimeout(tokenDebounceTimeoutRef.current);
          tokenDebounceTimeoutRef.current = null;
        }
        if (tokenDebounceMaxWaitRef.current) {
          clearTimeout(tokenDebounceMaxWaitRef.current);
          tokenDebounceMaxWaitRef.current = null;
        }

        const mnemonic = currentMnemonicRef.current;
        if (!mnemonic) return;
        const merged = await mergeAndCacheTokens(
          latestTokensRef.current,
          mnemonic,
        );
        if (mnemonic !== currentMnemonicRef.current) return;
        setSparkInformation(prev => ({ ...prev, tokens: merged }));
        // Persist tokens so a token-only change survives a cold start, matching
        // flushBalanceNow / reconcileBalance.
        saveAccountBalanceSnapshot(
          sparkInfoRef.current.identityPubKey,
          sparkInfoRef.current.balance,
          merged,
        );
        // A token balance change means a token tx finalized — fetch its history now
        reconcileTokenTransactions(false);
      };

      // Trailing debounce 500ms after the last event, capped at 10s so a
      // sustained burst still flushes periodically (see balanceUpdateHandler).
      if (tokenDebounceTimeoutRef.current)
        clearTimeout(tokenDebounceTimeoutRef.current);
      tokenDebounceTimeoutRef.current = setTimeout(flush, 3000);

      if (!tokenDebounceMaxWaitRef.current) {
        tokenDebounceMaxWaitRef.current = setTimeout(flush, 10000);
      }
    },
    [reconcileTokenTransactions],
  );

  // Stream lifecycle. A connect after a drop means events may have been missed
  // while the stream was down, so fire one reconcile read. The initial connect
  // is benign and skipped.
  const streamStatusHandler = useCallback(
    status => {
      if (status === 'disconnected' || status === 'reconnecting') {
        streamWasDisconnectedRef.current = true;
        return;
      }
      if (status !== 'connected') return;
      if (!streamWasDisconnectedRef.current) return;
      streamWasDisconnectedRef.current = false;
      if (AppState.currentState !== 'active') return;
      if (!sparkInfoRef.current.didConnect) return;
      // Skip the balance reconcile while a send is in flight — a mid-send read
      // returns the locked 0/partial; the send's paymentWrapperTx reconcile
      // lands the settled balance at settlement.
      if (!isSendingPaymentRef.current) reconcileBalance();
      // Recover token txs whose token-balance:update fired while the stream was down.
      reconcileTokenTransactions(false);
    },
    [reconcileBalance, reconcileTokenTransactions],
  );

  useEffect(() => {
    if (!sparkInformation.identityPubKey) {
      console.log('Skipping listener setup - no identity pub key yet');
      return;
    }

    console.log('adding web view listeners');

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    incomingSparkTransaction.on(INCOMING_SPARK_TX_NAME, transferHandler);
    sparkBalanceUpdateEmitter.on(
      BALANCE_UPDATE_EVENT_NAME,
      balanceUpdateHandler,
    );
    sparkTokenBalanceUpdateEmitter.on(
      TOKEN_BALANCE_UPDATE_EVENT_NAME,
      tokenBalanceUpdateHandler,
    );
    sparkStreamStatusEmitter.on(STREAM_STATUS_EVENT_NAME, streamStatusHandler);

    return () => {
      console.log('Cleaning up spark event listeners');
      sparkTransactionsEventEmitter.removeListener(
        SPARK_TX_UPDATE_ENVENT_NAME,
        handleUpdate,
      );
      incomingSparkTransaction.removeListener(
        INCOMING_SPARK_TX_NAME,
        transferHandler,
      );
      sparkBalanceUpdateEmitter.removeListener(
        BALANCE_UPDATE_EVENT_NAME,
        balanceUpdateHandler,
      );
      sparkTokenBalanceUpdateEmitter.removeListener(
        TOKEN_BALANCE_UPDATE_EVENT_NAME,
        tokenBalanceUpdateHandler,
      );
      sparkStreamStatusEmitter.removeListener(
        STREAM_STATUS_EVENT_NAME,
        streamStatusHandler,
      );
    };
  }, [
    sparkInformation.identityPubKey,
    handleUpdate,
    transferHandler,
    balanceUpdateHandler,
    tokenBalanceUpdateHandler,
    streamStatusHandler,
  ]);

  const addListeners = async mode => {
    console.log('Adding Spark listeners...');
    if (AppState.currentState !== 'active') return;

    const walletHash = sha256Hash(currentMnemonicRef.current);

    if (listenerLock.get(walletHash)) {
      console.log('addListeners already running for this wallet, skippingdh');
      return;
    }

    listenerLock.set(walletHash, true);

    try {
      const runtime = await selectSparkRuntime(currentMnemonicRef.current);

      if (mode === 'full') {
        if (runtime === 'native') {
          const nativeWallet = sparkWallet[walletHash];
          if (nativeWallet) {
            // This native wallet is the main wallet — tag its events with
            // walletHash so the handlers' walletId guard passes.
            if (!nativeWallet.listenerCount('transfer:claimed')) {
              nativeWallet.on('transfer:claimed', (transferId, balance) =>
                transferHandler(transferId, balance, walletHash),
              );
            }
            if (!nativeWallet.listenerCount('balance:update')) {
              nativeWallet.on('balance:update', balance =>
                balanceUpdateHandler(balance, walletHash),
              );
            }
            if (!nativeWallet.listenerCount('token-balance:update')) {
              // Native delivers the raw SDK event ({ tokenBalances: Map });
              // normalize it to the same token map the WebView runtime posts so
              // tokenBalanceUpdateHandler can stay runtime-agnostic.
              nativeWallet.on('token-balance:update', event => {
                const tokensObject = {};
                for (const [id, data] of event?.tokenBalances ?? []) {
                  tokensObject[id] = {
                    ...data,
                    balance: data.availableToSendBalance,
                  };
                }
                tokenBalanceUpdateHandler(tokensObject, walletHash);
              });
            }
            if (!nativeWallet.listenerCount('stream:connected')) {
              nativeWallet.on('stream:connected', () =>
                streamStatusHandler('connected'),
              );
            }
            if (!nativeWallet.listenerCount('stream:disconnected')) {
              nativeWallet.on('stream:disconnected', () =>
                streamStatusHandler('disconnected'),
              );
            }
            if (!nativeWallet.listenerCount('stream:reconnecting')) {
              nativeWallet.on('stream:reconnecting', () =>
                streamStatusHandler('reconnecting'),
              );
            }
          }
        } else {
          await sendWebViewRequestGlobal(OPERATION_TYPES.addListeners, {
            mnemonic: currentMnemonicRef.current,
          });
        }
        // Single restore path for every connect (initial + subsequent). The
        // poller writes txs via bulkUpdateSparkTransactions, whose SPARK_TX
        // update event drives the UI/balance refresh; isRestoringState guards
        // against overlap.
        if (txPollingAbortControllerRef.current) {
          txPollingAbortControllerRef.current.abort();
        }

        txPollingAbortControllerRef.current = new AbortController();
        const restorePoller = createRestorePoller(
          currentMnemonicRef.current,
          isSendingPaymentRef.current,
          currentMnemonicRef,
          txPollingAbortControllerRef.current,
          result => {
            console.log('RESTORE COMPLETE');
          },
          sparkInfoRef.current,
          sendWebViewRequest,
        );

        restorePoller.start();

        updateSparkTxStatus(
          currentMnemonicRef.current,
          sparkInfoRef.current.identityPubKey,
          sendWebViewRequest,
          false,
          contactsPrivateKey,
          publicKey,
        );

        // One-time startup token history fetch (token analog of
        // restorePoller.start()) — catches token txs received while the app was
        // closed. Live updates thereafter come from token-balance:update.
        reconcileTokenTransactions(isInitialLRC20Run.current);
        if (isInitialLRC20Run.current) isInitialLRC20Run.current = false;

        if (updatePendingPaymentsIntervalRef.current) {
          console.log('BLOCKING TRYING TO SET INTERVAL AGAIN');
          clearInterval(updatePendingPaymentsIntervalRef.current);
          updatePendingPaymentsIntervalRef.current = null;
        }

        const capturedAuthKey = authResetKeyRef.current;
        const capturedMnemonic = currentMnemonicRef.current;
        const capturedWalletHash = walletHash;

        const intervalId = setInterval(async () => {
          try {
            if (capturedAuthKey !== authResetKeyRef.current) {
              console.log('Auth key changed. Aborting interval.');
              clearInterval(intervalId);
              intervalTracker.delete(capturedWalletHash);
              allIntervalIds.delete(intervalId);
              return;
            }

            if (capturedMnemonic !== currentMnemonicRef.current) {
              console.log('Mnemonic changed. Aborting interval.');
              clearInterval(intervalId);
              intervalTracker.delete(capturedWalletHash);
              allIntervalIds.delete(intervalId);
              return;
            }

            if (AppState.currentState !== 'active') {
              console.log('App not active. Skipping interval.');
              return;
            }

            const response = await updateSparkTxStatus(
              currentMnemonicRef.current,
              sparkInfoRef.current.identityPubKey,
              sendWebViewRequest,
              false,
              contactsPrivateKey,
              publicKey,
            );

            if (response.shouldCheck) {
              // No pending txs listed
              const txs = sparkInfoRef.current.transactions;
              // if we find a pending tx that means the db and spark state are unaligned
              const isStateUnalighed = txs?.find(
                tx => tx.paymentStatus === 'pending',
              );
              if (isStateUnalighed) {
                // send message to update the state with the correct txs
                sparkTransactionsEventEmitter.emit(
                  SPARK_TX_UPDATE_ENVENT_NAME,
                  'transactions',
                );
              }
            }

            // await checkHodlInvoicePaymentStatuses(
            //   currentMnemonicRef.current,
            //   sparkInfoRef.current.identityPubKey,
            // );
          } catch (err) {
            console.error('Error during periodic restore:', err);
          }
        }, 10 * 1000);

        updatePendingPaymentsIntervalRef.current = intervalId;
        intervalTracker.set(walletHash, intervalId);
        allIntervalIds.add(intervalId);
      }
    } catch (error) {
      console.error('Error in addListeners:', error);
    } finally {
      listenerLock.set(walletHash, false);
      console.log('Lock released for wallet:', walletHash);
    }
  };

  const removeListeners = async (onlyClearIntervals = false) => {
    console.log('Removing spark listeners');

    cleanStatusAndLRC20Intervals();

    if (!onlyClearIntervals) {
      const runtime = await selectSparkRuntime(currentMnemonicRef.current);
      if (!prevAccountMnemoincRef.current) {
        prevAccountMnemoincRef.current = currentMnemonicRef.current;
        return;
      }
      const hashedMnemonic = sha256Hash(prevAccountMnemoincRef.current);

      if (runtime === 'native') {
        const nativeWallet = sparkWallet[hashedMnemonic];
        if (prevAccountMnemoincRef.current && nativeWallet) {
          if (nativeWallet.listenerCount('transfer:claimed')) {
            nativeWallet.removeAllListeners('transfer:claimed');
          }
          if (nativeWallet.listenerCount('balance:update')) {
            nativeWallet.removeAllListeners('balance:update');
          }
          if (nativeWallet.listenerCount('token-balance:update')) {
            nativeWallet.removeAllListeners('token-balance:update');
          }
          if (nativeWallet.listenerCount('stream:connected')) {
            nativeWallet.removeAllListeners('stream:connected');
          }
          if (nativeWallet.listenerCount('stream:disconnected')) {
            nativeWallet.removeAllListeners('stream:disconnected');
          }
          if (nativeWallet.listenerCount('stream:reconnecting')) {
            nativeWallet.removeAllListeners('stream:reconnecting');
          }
        }
      } else {
        await sendWebViewRequestGlobal(OPERATION_TYPES.removeListeners, {
          mnemonic: prevAccountMnemoincRef.current,
        });
      }
      prevAccountMnemoincRef.current = currentMnemonicRef.current;
    }

    // Clear debounce timeout when removing listeners
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (debounceMaxWaitRef.current) {
      clearTimeout(debounceMaxWaitRef.current);
      debounceMaxWaitRef.current = null;
    }
    if (balanceDebounceTimeoutRef.current) {
      clearTimeout(balanceDebounceTimeoutRef.current);
      balanceDebounceTimeoutRef.current = null;
    }
    if (balanceDebounceMaxWaitRef.current) {
      clearTimeout(balanceDebounceMaxWaitRef.current);
      balanceDebounceMaxWaitRef.current = null;
    }
    if (tokenDebounceTimeoutRef.current) {
      clearTimeout(tokenDebounceTimeoutRef.current);
      tokenDebounceTimeoutRef.current = null;
    }
    if (tokenDebounceMaxWaitRef.current) {
      clearTimeout(tokenDebounceMaxWaitRef.current);
      tokenDebounceMaxWaitRef.current = null;
    }
    // Clear pending transfer IDs
    pendingTransferIds.current.clear();

    // Clear update payment state timer
    if (updatePendingPaymentsIntervalRef.current) {
      clearInterval(updatePendingPaymentsIntervalRef.current);
      updatePendingPaymentsIntervalRef.current = null;
    }

    if (txPollingTimeoutRef.current) {
      clearTimeout(txPollingTimeoutRef.current);
      txPollingTimeoutRef.current = null;
    }
    if (txPollingAbortControllerRef.current) {
      txPollingAbortControllerRef.current.abort();
      txPollingAbortControllerRef.current = null;
    }
  };

  const resetSparkState = useCallback(
    async (internalRefresh = false, shouldClearMnemonicCache = true) => {
      // Reset refs to initial values
      await removeListeners(true);
      if (shouldClearMnemonicCache) {
        clearMnemonicCache();
      }
      prevAccountMnemoincRef.current = null;
      isRunningAddListeners.current = false;
      if (depositAddressIntervalRef.current) {
        clearInterval(depositAddressIntervalRef.current);
      }
      initialBitcoinIntervalRun.current = null;
      depositAddressIntervalRef.current = null;
      sparkInfoRef.current = {
        balance: 0,
        tokens: {},
        identityPubKey: '',
        sparkAddress: '',
        transactions: [],
        didConnect: false,
      };
      handledTransfers.current = new Set();
      streamWasDisconnectedRef.current = false;
      prevListenerType.current = null;
      prevAppState.current = 'active';
      prevAccountId.current = null;
      isSendingPaymentRef.current = false;
      txPollingAbortControllerRef.current = null;
      txPollingTimeoutRef.current = null;
      balanceVersionRef.current = 0;
      hasRunInitBalancePoll.current = false;

      txLaneQueueRef.current = Promise.resolve();
      uiLaneQueueRef.current = Promise.resolve();
      queueDepthRef.current = 0;
      eventSequenceRef.current = 0;

      // Invalidate any in-flight reconcile read and release the single-flight
      // lock so the next session starts clean.
      reconcileRunIdRef.current += 1;
      isReconcilingBalanceRef.current = false;
      reconcileBalanceAgainRef.current = false;

      // Reset state variables
      setSparkConnectionError(null);
      setSparkInformation({
        balance: 0,
        tokens: {},
        transactions: [],
        identityPubKey: '',
        sparkAddress: '',
        didConnect: null,
        didConnectToFlashnet: null,
      });
      contactsPrivateKeyRef.current = '';
      contactsPublicKeyRef.current = null;
      clearSpendAndReplaceCorrelationMemo();
      if (!internalRefresh) {
        setDidRunNormalConnection(false);
        setNormalConnectionTimeout(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    resetSparkState();
  }, [authResetkey]);

  useEffect(() => {
    contactsPrivateKeyRef.current = contactsPrivateKey;
    contactsPublicKeyRef.current = publicKey;
  }, [contactsPrivateKey, publicKey]);

  // Register a stable getter so transaction writes can snapshot the centralized
  // auth keys without storing key material in module scope or changing every
  // bulkUpdateSparkTransactions call site.
  useEffect(() => {
    setSpendAndReplaceAuthGetter(() => ({
      privateKey: contactsPrivateKeyRef.current,
      publicKey: contactsPublicKeyRef.current,
    }));
    return () => setSpendAndReplaceAuthGetter(null);
  }, []);

  // Add event listeners to listen for bitcoin and lightning or spark transfers when receiving only when screen is active
  useEffect(() => {
    // Handle immediate background transitions synchronously(background events on android were not running)
    if (prevAppState.current !== appState && appState === 'background') {
      console.log('App moved to background — clearing listener type');
      prevListenerType.current = null;
    }

    const timeoutId = setTimeout(async () => {
      if (!didGetToHomepage) return;
      if (!sparkInfoRef.current.identityPubKey) return;

      const getListenerType = () => {
        if (appState === 'active') return 'full';
        return null;
      };

      const newType = getListenerType();
      const prevType = prevListenerType.current;
      const prevId = prevAccountId.current;

      // Only reconfigure listeners when becoming active
      if (
        (newType !== prevType ||
          prevId !== sparkInfoRef.current.identityPubKey) &&
        appState === 'active'
      ) {
        await removeListeners(false);
        if (newType) await addListeners(newType);
        prevListenerType.current = newType;
        prevAccountId.current = sparkInfoRef.current.identityPubKey;
      }

      prevAppState.current = appState;
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    appState,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    didGetToHomepage,
    // isSendingPayment,
    sendWebViewRequest,
  ]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;

    // Interval to check deposit addresses to see if they were paid
    const handleDepositAddressCheck = async () => {
      try {
        console.log('l1Deposit check running....');
        if (AppState.currentState !== 'active') return;
        if (isSendingPaymentRef.current) return;
        if (!currentMnemonicRef.current) return;
        const savedTxCache = new Map();
        const getSavedTxByTxid = async txid => {
          if (!txid) return null;
          if (savedTxCache.has(txid)) return savedTxCache.get(txid);

          const savedTx = await getSparkTransactionBySparkId(
            txid,
            sparkInfoRef.current.identityPubKey,
          );
          savedTxCache.set(txid, savedTx);
          return savedTx;
        };
        const depositAddresses = await queryAllStaticDepositAddresses(
          currentMnemonicRef.current,
        );

        for (const address of depositAddresses) {
          console.log('Checking deposit address:', address);
          if (!address) continue;

          const [exploraData, unclaimedUtxos, allUtxos] = await Promise.all([
            getDepositAddressTxIds(address, contactsPrivateKey, publicKey),
            getUtxosForDepositAddress({
              depositAddress: address,
              mnemonic: currentMnemonicRef.current,
              excludeClaimed: true,
            }),
            getUtxosForDepositAddress({
              depositAddress: address,
              mnemonic: currentMnemonicRef.current,
              excludeClaimed: false,
            }),
          ]);

          const claimableByTxid = new Set(
            unclaimedUtxos.didWork ? unclaimedUtxos.utxos.map(u => u.txid) : [],
          );

          const allKnownByTxid = new Set(
            allUtxos.didWork ? allUtxos.utxos.map(u => u.txid) : [],
          );

          for (const tx of exploraData) {
            if (claimableByTxid.has(tx.txid)) continue; // Spark has it, Phase 2 handles it
            if (allKnownByTxid.has(tx.txid)) continue; // Already claimed by Spark
            const savedTx = await getSavedTxByTxid(tx.txid);
            if (savedTx) continue; // Already in our DB marked as pending

            console.log(
              'Adding pending deposit tx (not yet claimable):',
              tx.txid,
              {
                isConfirmed: tx.isConfirmed,
              },
            );

            await addPendingTransaction(
              {
                transactionId: tx.txid,
                creditAmountSats: tx.amount,
              },
              address,
              sparkInfoRef.current,
            );
            savedTxCache.set(tx.txid, {
              sparkID: tx.txid,
              accountId: sparkInfoRef.current.identityPubKey,
              details: JSON.stringify({ amount: tx.amount }),
            });
          }

          console.log('Unclaimed UTXOs for address:', address, unclaimedUtxos);

          if (!unclaimedUtxos.didWork || !unclaimedUtxos.utxos.length) continue;

          for (const utxo of unclaimedUtxos.utxos) {
            const { txid, vout } = utxo;
            const exploraTx = exploraData?.find(t => t.txid === txid);
            let savedTx = await getSavedTxByTxid(txid);
            const hasAlreadySaved = !!savedTx;

            // Get quote for this specific UTXO
            const {
              didWork: quoteDidWorkResponse,
              quote,
              error,
            } = await getSparkStaticBitcoinL1AddressQuote(
              txid,
              currentMnemonicRef.current,
            );

            if (!quoteDidWorkResponse || !quote) {
              console.log(error, 'Error getting deposit address quote');
              continue;
            }

            // Attempt to claim the UTXO
            const {
              didWork,
              error: claimError,
              response: claimTx,
            } = await claimnSparkStaticDepositAddress({
              transactionId: quote.transactionId,
              creditAmountSats: quote.creditAmountSats,
              sspSignature: quote.signature,
              outputIndex: vout, // Use the vout from the UTXO
              mnemonic: currentMnemonicRef.current,
            });

            // Add pending transaction if not already saved
            if (!hasAlreadySaved) {
              const pendingTx = await addPendingTransaction(
                quote,
                address,
                sparkInfoRef.current,
              );
              savedTx = {
                sparkID: pendingTx.id,
                accountId: pendingTx.accountId,
                details: JSON.stringify(pendingTx.details),
              };
              savedTxCache.set(txid, savedTx);
            }

            if (!claimTx || !didWork) {
              console.log('Claim static deposit address error', claimError);
              continue;
            }

            // Mark the transfer as handled so transferHandler skips it.
            // The SDK fires a transfer event for this claim, and without this guard,
            // debouncedHandleIncomingPayment would write a placeholder record that
            // races with our own bulkUpdateSparkTransactions call below.
            handledTransfers.current.add(claimTx.transferId);

            console.log('Claimed deposit address transaction:', claimTx);

            // Wait for the transfer to settle
            await new Promise(res => setTimeout(res, 2000));

            const bitcoinTransfer = await getSingleTxDetails(
              currentMnemonicRef.current,
              claimTx.transferId,
            );

            let updatedTx = {};
            if (!bitcoinTransfer) {
              // Claim succeeded but the transfer has not settled yet (or the
              // SDK lookup failed). Keep it pending keyed by the new
              // transferId; a later run finalizes it. bitcoinTransfer is
              // undefined here, so it must NOT be dereferenced below.
              updatedTx = {
                useTempId: true,
                id: claimTx.transferId,
                tempId: quote.transactionId,
                paymentStatus: 'pending',
                paymentType: 'bitcoin',
                accountId: sparkInfoRef.current.identityPubKey,
              };
            } else {
              let fee = 0;

              if (exploraTx) {
                fee = Math.abs(exploraTx?.amount - bitcoinTransfer.totalValue);
              } else {
                const savedTxDetails = (() => {
                  try {
                    return JSON.parse(savedTx?.details ?? 'null');
                  } catch {
                    return null;
                  }
                })();
                fee = Math.abs(
                  savedTxDetails?.amount - bitcoinTransfer.totalValue,
                );
              }
              updatedTx = {
                useTempId: true,
                tempId: quote.transactionId,
                id: bitcoinTransfer.id,
                paymentStatus: 'completed',
                paymentType: 'bitcoin',
                accountId: sparkInfoRef.current.identityPubKey,
                details: {
                  amount: bitcoinTransfer.totalValue,
                  fee: fee,
                  totalFee: fee,
                  supportFee: 0,
                  dateAddedToDb: Date.now(),
                },
              };
            }

            console.log('Updated bitcoin transaction:', updatedTx);
            await bulkUpdateSparkTransactions(
              [updatedTx],
              'fullUpdate-waitBalance',
            );

            // Navigate to confirm screen if we have details
            if (updatedTx.details) {
              if (handledNavigatedTxs.current.has(updatedTx.id)) continue;
              handledNavigatedTxs.current.add(updatedTx.id);
              if (!isOnSendScreen()) {
                showToast({
                  amount: updatedTx.details.amount,
                  duration: 7000,
                  type: 'confirmTx',
                });
              }
            }
          }
        }
      } catch (err) {
        console.log('Handle deposit address check error', err);
      }
    };

    const addPendingTransaction = async (quote, address, sparkState) => {
      const pendingTx = {
        id: quote.transactionId,
        paymentStatus: 'pending',
        paymentType: 'bitcoin',
        accountId: sparkState.identityPubKey,
        details: {
          fee: 0,
          amount: quote.creditAmountSats,
          address: address,
          time: new Date().getTime(),
          direction: 'INCOMING',
          description: i18n.t('contexts.spark.depositLabel'),
          onChainTxid: quote.transactionId,
          isRestore: true, // This is a restore payment
        },
      };
      await bulkUpdateSparkTransactions([pendingTx], 'transactions');
      return pendingTx;
    };

    clearAllDepositIntervals();

    if (depositAddressIntervalRef.current) {
      clearInterval(depositAddressIntervalRef.current);
      depositAddressIntervalRef.current = null;
    }

    if (!initialBitcoinIntervalRun.current) {
      setTimeout(handleDepositAddressCheck, 1_000 * 5);
      initialBitcoinIntervalRun.current = true;
    }

    const depositIntervalId = setInterval(
      handleDepositAddressCheck,
      1_000 * 60,
    );

    depositAddressIntervalRef.current = depositIntervalId;
    depositIntervalIds.add(depositIntervalId);

    return () => {
      console.log('Cleaning up deposit interval on unmount/dependency change');
      if (depositIntervalId) {
        clearInterval(depositIntervalId);
        depositIntervalIds.delete(depositIntervalId);
      }
      if (depositAddressIntervalRef.current) {
        clearInterval(depositAddressIntervalRef.current);
        depositAddressIntervalRef.current = null;
      }
    };
  }, [
    sparkInformation.didConnect,
    didGetToHomepage,
    sparkInformation.identityPubKey,
    showToast,
  ]);

  // Balance reconcile lifecycle:
  //  • On background: a balance read can't settle (the WebView request timeout
  //    is neutered), so a read issued before backgrounding would park. Bump the
  //    run id and release the single-flight lock so the parked read can't apply
  //    a stale value or hold the lock, and the foreground branch can issue a
  //    fresh read. balanceVersionRef is bumped so the parked read loses the
  //    ordering guard too.
  //  • On background→active: fire one authoritative reconcile. This lands
  //    balance received while backgrounded (whose event was missed) and recovers
  //    the lane.
  useEffect(() => {
    const prev = foregroundReconcileAppStateRef.current;
    foregroundReconcileAppStateRef.current = appState;
    if (appState === 'background') {
      reconcileRunIdRef.current += 1;
      isReconcilingBalanceRef.current = false;
      reconcileBalanceAgainRef.current = false;
      balanceVersionRef.current += 1;
      return;
    }

    if (appState !== 'active' || prev === 'active') return;
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;

    // Skip the balance reconcile while a send is in flight — the leaves are
    // locked so this read would return a transient 0/partial. The send's own
    // paymentWrapperTx → reconcileBalance lands the settled balance instead.
    if (!isSendingPaymentRef.current) {
      reconcileBalance();
    }
    // Recover token txs whose token-balance:update fired while backgrounded.
    reconcileTokenTransactions(false);
  }, [
    appState,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    reconcileBalance,
    reconcileTokenTransactions,
  ]);

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(
    async identityPubKey => {
      const { didWork, error, balanceTimedOut } = await initWallet({
        setSparkInformation,
        filterAndSetTransactions,
        // toggleGlobalContactsInformation,
        // globalContactsInformation,
        mnemonic: accountMnemoinc,
        sendWebViewRequest,
        // Restore now runs solely via createRestorePoller in addListeners, so
        // always load cached txs on connect (the poller's SPARK_TX events layer
        // in any newly restored txs afterward).
        hasRestoreCompleted: false,
        identityPubKey,
      });
      setDidRunNormalConnection(true);
      // lastConnectedTimeRef.current = Date.now();
      if (!didWork) {
        setSparkInformation(prev => ({ ...prev, didConnect: false }));
        setSparkConnectionError(error);
        console.log('Error connecting to spark wallet:', error);
        return;
      }
      // The init balance read timed out and painted the stale snapshot — recover
      // the real balance out-of-band so it can't stay stale until a foreground
      // cycle or manual refresh.
      if (balanceTimedOut) retryBalanceAfterTimeout();
    },
    [accountMnemoinc, sendWebViewRequest, retryBalanceAfterTimeout],
  );

  // Function to update db when all reqiured information is loaded
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!globalContactsInformation?.myProfile) return;
    if (!sparkInformation.identityPubKey) return;
    if (!sparkInformation.sparkAddress) return;

    if (sparkDBaddress.current) return;
    sparkDBaddress.current = true;

    if (
      !globalContactsInformation.myProfile.sparkAddress ||
      !globalContactsInformation.myProfile.sparkIdentityPubKey
    ) {
      toggleGlobalContactsInformation(
        {
          myProfile: {
            ...globalContactsInformation.myProfile,
            sparkAddress: sparkInformation.sparkAddress,
            sparkIdentityPubKey: sparkInformation.identityPubKey,
          },
        },
        true,
      );
    }
  }, [
    globalContactsInformation.myProfile,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    sparkInformation.sparkAddress,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (balanceDebounceTimeoutRef.current) {
        clearTimeout(balanceDebounceTimeoutRef.current);
      }
      if (balanceDebounceMaxWaitRef.current) {
        clearTimeout(balanceDebounceMaxWaitRef.current);
      }
      if (tokenDebounceTimeoutRef.current) {
        clearTimeout(tokenDebounceTimeoutRef.current);
      }
      if (tokenDebounceMaxWaitRef.current) {
        clearTimeout(tokenDebounceMaxWaitRef.current);
      }
      pendingTransferIds.current.clear();
    };
  }, []);

  const txsHashKey = useMemo(
    () =>
      sparkInformation.transactions
        .filter(tx => tx.paymentStatus === 'completed')
        .map(tx => tx.sparkID)
        .join(','),
    [sparkInformation.transactions],
  );

  const contextValue = useMemo(
    () => ({
      sparkInformation,
      txsHashKey,
      setSparkInformation,
      // numberOfCachedTxs,
      // setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      isSendingPaymentRef,
      sparkInfoRef,
      updateHomepageScrollPosition,
      filterAndSetTransactions,
      updateHomepageTxPreferance,
    }),
    [
      sparkInformation,
      txsHashKey,
      setSparkInformation,
      // numberOfCachedTxs,
      // setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      isSendingPaymentRef,
      sparkInfoRef,
      updateHomepageScrollPosition,
      filterAndSetTransactions,
      updateHomepageTxPreferance,
    ],
  );

  return (
    <SparkWalletManager.Provider value={contextValue}>
      {children}
    </SparkWalletManager.Provider>
  );
};

function useSparkWallet() {
  const context = useContext(SparkWalletManager);
  if (!context) {
    throw new Error('useSparkWallet must be used within a SparkWalletProvider');
  }
  return context;
}

export { SparkWalletManager, SparkWalletProvider, useSparkWallet };
