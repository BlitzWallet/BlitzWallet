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
  getCachedSparkTransactions,
  getSingleTxDetails,
  getSparkBalance,
  getSparkStaticBitcoinL1AddressQuote,
  getUtxosForDepositAddress,
  initializeFlashnet,
  queryAllStaticDepositAddresses,
  selectSparkRuntime,
  sparkWallet,
} from '../app/functions/spark';
import {
  bulkUpdateSparkTransactions,
  getAllSparkTransactions,
  getAllSparkContactInvoices,
  getAllUnpaidSparkLightningInvoices,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../app/functions/spark/transactions';
import { useAppStatus } from './appStatus';
import {
  checkHodlInvoicePaymentStatuses,
  fullRestoreSparkState,
  updateSparkTxStatus,
} from '../app/functions/spark/restore';
import { useGlobalContactsInfo } from './globalContacts';
import {
  initializeSparkSession,
  initWallet,
} from '../app/functions/initiateWalletConnection';
// import { useNodeContext } from './nodeContext';
import { AppState } from 'react-native';
import getDepositAddressTxIds from '../app/functions/spark/getDepositAdressTxIds';
import { useKeysContext } from './keys';
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
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
  useWebView,
} from './webViewContext';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';
import {
  createBalancePoller,
  createRestorePoller,
} from '../app/functions/pollingManager';
import { USDB_TOKEN_ID } from '../app/constants';
import { saveAccountBalanceSnapshot } from '../app/functions/spark/balanceSnapshots';
import {
  cleanupOptimization,
  checkIfOptimizationNeeded,
  runLeafOptimization,
  runTokenOptimization,
} from '../app/functions/spark/optimization';
import { isFlashnetTransfer } from '../app/functions/spark/handleFlashnetTransferIds';

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

// Initiate context
const SparkWalletManager = createContext(null);

const SparkWalletProvider = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { changeSparkConnectionState, sendWebViewRequest } = useWebView();
  const { accountMnemoinc, contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const {
    didGetToHomepage,
    appState,
    // lastConnectedTimeRef
  } = useAppStatus();
  // const { liquidNodeInformation } = useNodeContext();
  const { toggleGlobalContactsInformation, globalContactsInformation } =
    useGlobalContactsInfo();
  const prevAccountMnemoincRef = useRef(null);
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
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const hasRestoreCompleted = useRef(false);
  const [reloadNewestPaymentTimestamp, setReloadNewestPaymentTimestamp] =
    useState(0);

  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const isInitialRestore = useRef(true);
  const isInitialLRC20Run = useRef(true);
  const initialBitcoinIntervalRun = useRef(null);
  const sparkInfoRef = useRef({
    balance: 0,
    tokens: {},
    identityPubKey: '',
    sparkAddress: '',
    transactions: [],
  });
  const sessionTimeRef = useRef(Date.now());
  const newestPaymentTimeRef = useRef(Date.now());
  const handledTransfers = useRef(new Set());
  const usedSavedTxIds = useRef(new Set());
  const prevListenerType = useRef(null);
  const prevAppState = useRef(appState);
  const prevAccountId = useRef(null);
  const isSendingPaymentRef = useRef(false);
  const balancePollingTimeoutRef = useRef(null);
  const balancePollingAbortControllerRef = useRef(null);
  const txPollingTimeoutRef = useRef(null);
  const txPollingAbortControllerRef = useRef(null);
  const currentPollingMnemonicRef = useRef(null);
  const isInitialRender = useRef(true);
  const authResetKeyRef = useRef(authResetkey);
  const balanceVersionRef = useRef(0);
  const hasRunInitBalancePoll = useRef(false);

  const txLaneQueueRef = useRef(Promise.resolve());
  const uiLaneQueueRef = useRef(Promise.resolve());
  const queueDepthRef = useRef(0);
  const eventSequenceRef = useRef(0);
  const preSendBoundaryRef = useRef(null);

  const balanceEpochRef = useRef({
    target: 0,
    applied: 0,
  });
  const balanceSupervisorRunIdRef = useRef(0);
  const forcedPendingBySparkIdRef = useRef(new Map());
  const lastConfirmedTxBoundaryRef = useRef(null);

  const isBalancePollerRunningRef = useRef(false);
  const lastBalancePollEventRef = useRef({
    updateType: null,
    timestamp: 0,
  });

  const showTokensInformation =
    masterInfoObject.enabledBTKNTokens === null
      ? !!Object.keys(sparkInformation.tokens || {}).filter(
          token => token !== USDB_TOKEN_ID,
        ).length
      : masterInfoObject.enabledBTKNTokens;

  const didRunInitialRestore = useRef(false);

  const handledNavigatedTxs = useRef(new Set());

  const [didRunNormalConnection, setDidRunNormalConnection] = useState(false);
  const [normalConnectionTimeout, setNormalConnectionTimeout] = useState(false);
  const shouldRunNormalConnection =
    didRunNormalConnection || normalConnectionTimeout;
  const currentMnemonicRef = useRef(currentWalletMnemoinc);

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
      balance: sparkInformation.balance,
      tokens: sparkInformation.tokens,
      identityPubKey: sparkInformation.identityPubKey,
      sparkAddress: sparkInformation.sparkAddress,
      transactions: sparkInformation.transactions?.slice(0, 50),
    };
  }, [
    sparkInformation.balance,
    sparkInformation.tokens,
    sparkInformation.identityPubKey,
    sparkInformation.sparkAddress,
    sparkInformation.transactions,
  ]);

  useEffect(() => {
    currentMnemonicRef.current = currentWalletMnemoinc;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    // Fixing race condition with new preloaded txs
    sessionTimeRef.current = Date.now() + 5 * 1000;
  }, [currentWalletMnemoinc, authResetkey]);

  useEffect(() => {
    newestPaymentTimeRef.current = Date.now();
  }, [reloadNewestPaymentTimestamp]);

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
      const availableAssets = Object.entries(sparkInfoRef.current.tokens);
      const extensions = ['jpg', 'png'];
      const newCache = {};

      for (const [tokenId] of availableAssets) {
        newCache[tokenId] = null;

        for (const ext of extensions) {
          const url = `https://tokens.sparkscan.io/${tokenId}.${ext}`;
          try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
              newCache[tokenId] = url;
              break;
            }
          } catch (err) {
            console.log('Image fetch error:', tokenId, err);
          }
        }
      }

      setTokensImageCache(newCache);
    }

    updateTokensImageCache();
  }, [Object.keys(sparkInformation.tokens || {}).length]);

  // Debounce refs
  const debounceTimeoutRef = useRef(null);
  const pendingTransferIds = useRef(new Set());

  const toggleIsSendingPayment = useCallback(isSending => {
    console.log('Setting is sending payment', isSending);
    if (isSending) {
      if (txPollingAbortControllerRef.current) {
        txPollingAbortControllerRef.current.abort();
        txPollingAbortControllerRef.current = null;
      }
      // Snapshot boundary before the send tx is written to DB
      preSendBoundaryRef.current = getBoundaryFromTxs(
        sparkInfoRef.current.transactions || [],
      );
    } else {
      preSendBoundaryRef.current = null;
    }
    isSendingPaymentRef.current = isSending;
  }, []);

  const toggleNewestPaymentTimestamp = () => {
    setReloadNewestPaymentTimestamp(prev => prev + 1);
  };

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
        await bulkUpdateSparkTransactions(placeholders, 'transactions');
      } catch (error) {
        console.error('Error writing placeholder transactions:', error);
      }

      // ─── Step 2: Fetch full tx details (blocked untill app is foregrounded)
      let cachedTransfers = [];

      for (const transferId of transferIdsToProcess) {
        try {
          const transfer = await getSingleTxDetails(
            currentMnemonicRef.current,
            transferId,
          );

          if (!transfer) continue;
          cachedTransfers.push(transfer);
        } catch (error) {
          console.error(
            'Error processing incoming payment:',
            transferId,
            error,
          );
        }
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
          currentPollingMnemonicRef.current,
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

  const getTxAddedAt = tx => {
    try {
      return Number(JSON.parse(tx.details)?.dateAddedToDb) || 0;
    } catch {
      return 0;
    }
  };

  const getBoundaryFromTxs = transactions =>
    (transactions || []).slice(0, 10).reduce((max, tx) => {
      return Math.max(max, getTxAddedAt(tx));
    }, 0);

  const ensureConfirmedBoundary = transactions => {
    if (lastConfirmedTxBoundaryRef.current != null) return;
    const boundary = getBoundaryFromTxs(transactions);
    lastConfirmedTxBoundaryRef.current = boundary || 0;
  };

  const registerForcedPendingForEpoch = (transactions, epoch) => {
    if (!epoch || !transactions?.length) return;
    ensureConfirmedBoundary(sparkInfoRef.current.transactions || transactions);

    // Use pre-send boundary if available so the outgoing tx (written before
    // paymentWrapperTx fires) lands above the watermark and gets registered.
    const boundary =
      preSendBoundaryRef.current ?? lastConfirmedTxBoundaryRef.current ?? 0;

    let confirmedStreak = 0;
    for (let index = 0; index < transactions.length; index++) {
      const tx = transactions[index];
      const addedAt = getTxAddedAt(tx);

      if (addedAt > boundary) {
        const existing = forcedPendingBySparkIdRef.current.get(tx.sparkID);
        // Keep the first pending epoch for a tx. Re-bucketing the same tx
        // into newer epochs causes sticky pending state during overlapping
        // balance intents.
        if (!existing) {
          forcedPendingBySparkIdRef.current.set(tx.sparkID, {
            epoch,
            addedAt,
          });
        }
        confirmedStreak = 0;
      } else {
        confirmedStreak += 1;
        if (confirmedStreak > 25) break;
      }
    }
  };

  const releaseForcedPendingUpToEpoch = epoch => {
    let maxReleasedBoundary = lastConfirmedTxBoundaryRef.current ?? 0;
    for (const [sparkId, meta] of forcedPendingBySparkIdRef.current.entries()) {
      if ((meta?.epoch || 0) <= epoch) {
        maxReleasedBoundary = Math.max(maxReleasedBoundary, meta?.addedAt || 0);
        forcedPendingBySparkIdRef.current.delete(sparkId);
      }
    }

    // Safety valve: if a tx is at or behind the most recently confirmed
    // boundary, it must not remain force-pending even if a later epoch
    // was enqueued while polling.
    for (const [sparkId, meta] of forcedPendingBySparkIdRef.current.entries()) {
      if ((meta?.addedAt || 0) <= maxReleasedBoundary) {
        forcedPendingBySparkIdRef.current.delete(sparkId);
      }
    }

    lastConfirmedTxBoundaryRef.current = maxReleasedBoundary;
  };

  const releaseForcedPendingUpToBoundary = boundary => {
    if (!Number.isFinite(boundary)) return;
    const normalizedBoundary = Number(boundary) || 0;

    for (const [sparkId, meta] of forcedPendingBySparkIdRef.current.entries()) {
      if ((meta?.addedAt || 0) <= normalizedBoundary) {
        forcedPendingBySparkIdRef.current.delete(sparkId);
      }
    }

    lastConfirmedTxBoundaryRef.current = Math.max(
      lastConfirmedTxBoundaryRef.current || 0,
      normalizedBoundary,
    );
  };

  const applyForcedPendingFlags = transactions => {
    if (!transactions?.length) return transactions;
    if (!forcedPendingBySparkIdRef.current.size) return transactions;

    const appliedEpoch = balanceEpochRef.current.applied;
    return transactions.map(tx => {
      const pendingMeta = forcedPendingBySparkIdRef.current.get(tx.sparkID);
      if (!pendingMeta || pendingMeta.epoch <= appliedEpoch) return tx;
      if (tx.isBalancePending) return tx;
      return { ...tx, isBalancePending: true };
    });
  };

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

        if (parsedTx.isBalancePending) {
          console.log(
            'Payment balance is still being confimed, will be handled once balance pollar is done',
          );
          return;
        }

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

        // Handle confirm animation here
        setPendingNavigation({
          tx: parsedTx,
          amount: details.amount,
          LRC20Token: details.LRC20Token,
          isLRC20Payment: !!details.LRC20Token,
          showFullAnimation: false,
        });
      } catch (err) {
        console.log('[UiLane] confirm navigation error', err);
      }
    },
    [],
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

      if (event.balanceEpoch) {
        registerForcedPendingForEpoch(txs, event.balanceEpoch);
      } else {
        ensureConfirmedBoundary(txs);
      }

      const txListWithPendingFlags = applyForcedPendingFlags(txs);

      setSparkInformation(prev => ({
        ...prev,
        transactions: txListWithPendingFlags,
      }));

      enqueueUiLane(event.updateType, () =>
        maybeHandleConfirmNavigation(
          event.updateType,
          txListWithPendingFlags,
          'project transactions for event',
        ),
      );
    },
    [enqueueUiLane, maybeHandleConfirmNavigation],
  );

  const applyConfirmedBalanceSnapshot = useCallback(
    async (epoch, result) => {
      const { identityPubKey } = sparkInfoRef.current;

      balanceEpochRef.current.applied = Math.max(
        balanceEpochRef.current.applied,
        epoch,
      );

      const numericBalance = Number(result?.balance);
      saveAccountBalanceSnapshot(
        identityPubKey,
        Number.isFinite(numericBalance)
          ? numericBalance
          : sparkInfoRef.current.balance,
        result?.didWork ? result.tokensObj : sparkInfoRef.current.tokens,
      );

      const freshTxs = identityPubKey
        ? await getAllSparkTransactions({
            limit: null,
            accountId: identityPubKey,
          })
        : sparkInfoRef.current.transactions || [];

      releaseForcedPendingUpToEpoch(epoch);
      releaseForcedPendingUpToBoundary(getBoundaryFromTxs(freshTxs));
      ensureConfirmedBoundary(freshTxs);
      const projectedTxs = applyForcedPendingFlags(freshTxs);
      await maybeHandleConfirmNavigation(
        'afterBalancePoller',
        projectedTxs,
        'apply confimred balance snapshot',
      );

      const myVersion = ++balanceVersionRef.current;
      setSparkInformation(prev => {
        if (myVersion < balanceVersionRef.current) return prev;
        return {
          ...prev,
          balance: Number.isFinite(numericBalance)
            ? numericBalance
            : prev.balance,
          tokens: result?.didWork ? result.tokensObj : prev.tokens,
          transactions: projectedTxs || prev.transactions,
        };
      });
    },
    [maybeHandleConfirmNavigation, contactsPrivateKey, publicKey],
  );

  const runBalanceSupervisor = useCallback(async () => {
    if (isBalancePollerRunningRef.current) return;
    const mnemonic = currentMnemonicRef.current;
    if (!mnemonic) return;

    isBalancePollerRunningRef.current = true;
    const runId = ++balanceSupervisorRunIdRef.current;
    currentPollingMnemonicRef.current = mnemonic;

    try {
      while (
        balanceEpochRef.current.applied < balanceEpochRef.current.target &&
        mnemonic === currentMnemonicRef.current
      ) {
        const epochToResolve = balanceEpochRef.current.target;
        const abortController = new AbortController();
        balancePollingAbortControllerRef.current = abortController;

        console.log(
          `[BalanceLane] starting poll for epoch ${epochToResolve} (${
            lastBalancePollEventRef.current.updateType || 'unknown'
          })`,
        );

        const poller = createBalancePoller(
          mnemonic,
          currentMnemonicRef,
          abortController,
          async balanceResult => {
            if (abortController.signal.aborted) return;
            if (runId !== balanceSupervisorRunIdRef.current) return;
            await applyConfirmedBalanceSnapshot(epochToResolve, balanceResult);
          },
          sparkInfoRef.current.balance,
        );

        balancePollingTimeoutRef.current = poller;
        const response = await poller.start();

        if (runId !== balanceSupervisorRunIdRef.current) return;
        if (abortController.signal.aborted) return;
        if (mnemonic !== currentMnemonicRef.current) return;
        if (response.reason === 'aborted') return;

        if (response.reason === 'max_retries') {
          const fallbackResult =
            response.result?.didWork === true
              ? response.result
              : await getSparkBalance(mnemonic);
          await applyConfirmedBalanceSnapshot(epochToResolve, fallbackResult);
        }

        balanceEpochRef.current.applied = Math.max(
          balanceEpochRef.current.applied,
          epochToResolve,
        );
        releaseForcedPendingUpToEpoch(balanceEpochRef.current.applied);
      }
    } catch (err) {
      console.log('[BalanceLane] poller error', err);
    } finally {
      isBalancePollerRunningRef.current = false;
      balancePollingAbortControllerRef.current = null;

      if (
        balanceEpochRef.current.applied < balanceEpochRef.current.target &&
        mnemonic === currentMnemonicRef.current
      ) {
        setTimeout(() => {
          runBalanceSupervisor();
        }, 60);
      }
    }
  }, [applyConfirmedBalanceSnapshot]);

  const requestBalanceReconcile = useCallback(
    (updateType, options = {}) => {
      const { shouldForcePending = true } = options;
      const epoch = balanceEpochRef.current.target + 1;
      balanceEpochRef.current.target = epoch;
      lastBalancePollEventRef.current = {
        updateType,
        timestamp: Date.now(),
      };

      if (shouldForcePending) {
        const currentTxs = sparkInfoRef.current.transactions || [];
        registerForcedPendingForEpoch(currentTxs, epoch);
        setSparkInformation(prev => ({
          ...prev,
          transactions: applyForcedPendingFlags(prev.transactions || []),
        }));
      }

      runBalanceSupervisor();
      return epoch;
    },
    [runBalanceSupervisor],
  );

  const applyIncomingPaymentSnapshot = useCallback(
    async passedBalance => {
      const mnemonic = currentMnemonicRef.current;
      const { identityPubKey } = sparkInfoRef.current;

      if (balancePollingAbortControllerRef.current) {
        balancePollingAbortControllerRef.current.abort();
        balancePollingAbortControllerRef.current = null;
      }
      balanceSupervisorRunIdRef.current += 1;
      isBalancePollerRunningRef.current = false;

      const settledEpoch = balanceEpochRef.current.target + 1;
      balanceEpochRef.current.target = settledEpoch;
      balanceEpochRef.current.applied = settledEpoch;
      forcedPendingBySparkIdRef.current.clear();

      const [balanceResponse, freshTxs] = await Promise.all([
        getSparkBalance(mnemonic),
        identityPubKey
          ? getAllSparkTransactions({
              limit: null,
              accountId: identityPubKey,
            })
          : Promise.resolve([]),
      ]);

      const numericPassedBalance = Number(passedBalance);
      saveAccountBalanceSnapshot(
        identityPubKey,
        Number.isFinite(numericPassedBalance)
          ? numericPassedBalance
          : sparkInfoRef.current.balance,
        balanceResponse.didWork
          ? balanceResponse.tokensObj
          : sparkInfoRef.current.tokens,
      );

      ensureConfirmedBoundary(freshTxs);
      lastConfirmedTxBoundaryRef.current = Math.max(
        lastConfirmedTxBoundaryRef.current || 0,
        getBoundaryFromTxs(freshTxs),
      );

      const myVersion = ++balanceVersionRef.current;
      setSparkInformation(prev => {
        if (myVersion < balanceVersionRef.current) return prev;
        return {
          ...prev,
          transactions: applyForcedPendingFlags(freshTxs || prev.transactions),
          balance: Number.isFinite(numericPassedBalance)
            ? numericPassedBalance
            : prev.balance,
          tokens: balanceResponse.didWork
            ? balanceResponse.tokensObj
            : prev.tokens,
        };
      });
    },
    [contactsPrivateKey, publicKey],
  );

  const handleUpdate = useCallback(
    (...args) => {
      const [updateType = 'transactions', fee = 0, passedBalance = 0] = args;

      const event = {
        seq: ++eventSequenceRef.current,
        updateType,
        fee,
        passedBalance,
        balanceEpoch: null,
      };

      if (BALANCE_INTENT_UPDATE_TYPES.has(updateType)) {
        event.balanceEpoch = requestBalanceReconcile(updateType, {
          shouldForcePending: true,
        });
      }

      if (updateType === 'incomingPayment') {
        applyIncomingPaymentSnapshot(passedBalance).catch(err =>
          console.log('[BalanceLane] incoming payment snapshot error', err),
        );
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
      requestBalanceReconcile,
      applyIncomingPaymentSnapshot,
    ],
  );

  const transferHandler = useCallback((transferId, balance) => {
    if (handledTransfers.current.has(transferId)) return;
    handledTransfers.current.add(transferId);
    console.log(`Transfer ${transferId} claimed. New balance: ${balance}`);

    // Add transferId to pending set
    pendingTransferIds.current.add(transferId);

    // Clear existing timeout if any
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced execution (500ms delay)
    debounceTimeoutRef.current = setTimeout(() => {
      debouncedHandleIncomingPayment(balance);
    }, 500);
  }, []);

  useEffect(() => {
    if (!sparkInformation.identityPubKey) {
      console.log('Skipping listener setup - no identity pub key yet');
      return;
    }

    console.log('adding web view listeners');

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    incomingSparkTransaction.on(INCOMING_SPARK_TX_NAME, transferHandler);

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
    };
  }, [sparkInformation.identityPubKey, handleUpdate, transferHandler]);

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
          if (!sparkWallet[walletHash]?.listenerCount('transfer:claimed')) {
            sparkWallet[walletHash]?.on('transfer:claimed', transferHandler);
          }
        } else {
          await sendWebViewRequestGlobal(OPERATION_TYPES.addListeners, {
            mnemonic: currentMnemonicRef.current,
          });
        }
        if (!isInitialRestore.current) {
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
        }

        updateSparkTxStatus(
          currentMnemonicRef.current,
          sparkInfoRef.current.identityPubKey,
          sendWebViewRequest,
          false,
          contactsPrivateKey,
          publicKey,
        );

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

            if (
              capturedAuthKey !== authResetKeyRef.current ||
              capturedMnemonic !== currentMnemonicRef.current
            ) {
              console.log(
                'Context changed during updateSparkTxStatus. Aborting getLRC20Transactions.',
              );
              clearInterval(intervalId);
              intervalTracker.delete(capturedWalletHash);
              allIntervalIds.delete(intervalId);
              return;
            }

            await getLRC20Transactions({
              ownerPublicKeys: [sparkInfoRef.current.identityPubKey],
              sparkAddress: sparkInfoRef.current.sparkAddress,
              isInitialRun: isInitialLRC20Run.current,
              mnemonic: currentMnemonicRef.current,
              sendWebViewRequest,
            });
            if (isInitialLRC20Run.current) {
              isInitialLRC20Run.current = false;
            }

            // await checkHodlInvoicePaymentStatuses(
            //   currentMnemonicRef.current,
            //   sparkInfoRef.current.identityPubKey,
            // );
          } catch (err) {
            console.error('Error during periodic restore:', err);
          }
        }, 10 * 1000);

        if (isInitialRestore.current) {
          isInitialRestore.current = false;
        }

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
        if (
          prevAccountMnemoincRef.current &&
          sparkWallet[hashedMnemonic]?.listenerCount('transfer:claimed')
        ) {
          sparkWallet[hashedMnemonic]?.removeAllListeners('transfer:claimed');
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
    // Clear pending transfer IDs
    pendingTransferIds.current.clear();

    // Clear update payment state timer
    if (updatePendingPaymentsIntervalRef.current) {
      clearInterval(updatePendingPaymentsIntervalRef.current);
      updatePendingPaymentsIntervalRef.current = null;
    }
    // Clear balance polling lane
    if (balancePollingAbortControllerRef.current) {
      balancePollingAbortControllerRef.current.abort();
      balancePollingAbortControllerRef.current = null;
    }
    balanceSupervisorRunIdRef.current += 1;
    isBalancePollerRunningRef.current = false;

    if (txPollingTimeoutRef.current) {
      clearTimeout(txPollingTimeoutRef.current);
      txPollingTimeoutRef.current = null;
    }
    if (txPollingAbortControllerRef.current) {
      txPollingAbortControllerRef.current.abort();
      txPollingAbortControllerRef.current = null;
    }
    currentPollingMnemonicRef.current = null;
  };

  // optimizations for leaves and tokens
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;
    if (!didGetToHomepage) return;
    if (AppState.currentState !== 'active') return;

    const runInitialOptimizationCheck = async () => {
      if (!sparkInfoRef.current.identityPubKey) return;
      if (AppState.currentState !== 'active') return;

      const needed = await checkIfOptimizationNeeded(
        currentMnemonicRef.current,
      );

      if (needed) {
        console.log('Running initial optimization check...');
        await runLeafOptimization(
          currentMnemonicRef.current,
          sparkInfoRef.current.identityPubKey,
        );
        await runTokenOptimization(
          currentMnemonicRef.current,
          sparkInfoRef.current.identityPubKey,
        );
      }
    };

    runInitialOptimizationCheck();
  }, [
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    didGetToHomepage,
  ]);

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
      };
      handledTransfers.current = new Set();
      prevListenerType.current = null;
      prevAppState.current = 'active';
      prevAccountId.current = null;
      isSendingPaymentRef.current = false;
      if (balancePollingAbortControllerRef.current) {
        balancePollingAbortControllerRef.current.abort();
      }
      balancePollingTimeoutRef.current = null;
      balancePollingAbortControllerRef.current = null;
      txPollingAbortControllerRef.current = null;
      txPollingTimeoutRef.current = null;
      currentPollingMnemonicRef.current = null;
      didRunInitialRestore.current = false;
      hasRestoreCompleted.current = false;
      balanceVersionRef.current = 0;
      hasRunInitBalancePoll.current = false;

      txLaneQueueRef.current = Promise.resolve();
      uiLaneQueueRef.current = Promise.resolve();
      queueDepthRef.current = 0;
      eventSequenceRef.current = 0;

      balanceEpochRef.current = {
        target: 0,
        applied: 0,
      };
      balanceSupervisorRunIdRef.current = 0;
      forcedPendingBySparkIdRef.current.clear();
      lastConfirmedTxBoundaryRef.current = null;

      isBalancePollerRunningRef.current = false;
      lastBalancePollEventRef.current = {
        updateType: null,
        timestamp: 0,
      };
      preSendBoundaryRef.current = null;

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
      setPendingNavigation(null);
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
        await removeListeners();
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
        const allTxs = await getAllSparkTransactions({
          accountId: sparkInfoRef.current.identityPubKey,
        });
        const savedTxMap = new Map(allTxs.map(tx => [tx.sparkID, tx]));
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
            if (savedTxMap.has(tx.txid)) continue; // Already in our DB

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
            savedTxMap.set(tx.txid, true);
          }

          console.log('Unclaimed UTXOs for address:', address, unclaimedUtxos);

          if (!unclaimedUtxos.didWork || !unclaimedUtxos.utxos.length) continue;

          for (const utxo of unclaimedUtxos.utxos) {
            const { txid, vout } = utxo;
            const exploraTx = exploraData?.find(t => t.txid === txid);
            const hasAlreadySaved = savedTxMap.has(txid);

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
              await addPendingTransaction(quote, address, sparkInfoRef.current);
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

            let fee = 0;

            if (exploraTx) {
              fee = Math.abs(exploraTx?.amount - bitcoinTransfer.totalValue);
            } else {
              const savedTxDetails = (() => {
                try {
                  return JSON.parse(savedTxMap.get(txid)?.details ?? 'null');
                } catch {
                  return null;
                }
              })();
              fee = Math.abs(
                savedTxDetails?.amount - bitcoinTransfer.totalValue,
              );
            }

            let updatedTx = {};
            if (!bitcoinTransfer) {
              updatedTx = {
                useTempId: true,
                id: claimTx.transferId,
                tempId: quote.transactionId,
                paymentStatus: 'pending',
                paymentType: 'bitcoin',
                accountId: sparkInfoRef.current.identityPubKey,
              };
            } else {
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
              if (handledNavigatedTxs.current.has(updatedTx.id)) return;
              handledNavigatedTxs.current.add(updatedTx.id);
              setPendingNavigation({
                tx: updatedTx,
                amount: updatedTx.details.amount,
                showFullAnimation: false,
              });
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
  ]);

  // Run fullRestore when didConnect becomes true
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;
    if (didRunInitialRestore.current) return;
    didRunInitialRestore.current = true;

    async function runRestore() {
      const restoreResponse = await fullRestoreSparkState({
        sparkAddress: sparkInfoRef.current.sparkAddress,
        batchSize: isInitialRestore.current ? 5 : 2,
        isSendingPayment: isSendingPaymentRef.current,
        mnemonic: currentMnemonicRef.current,
        identityPubKey: sparkInfoRef.current.identityPubKey,
        sendWebViewRequest,
        isInitialRestore: isInitialRestore.current,
      });

      if (!restoreResponse) {
        setRestoreCompleted(true); // This will get the transactions for the session
      }
    }

    runRestore();
  }, [sparkInformation.didConnect, sparkInformation.identityPubKey]);

  // Run transactions after BOTH restore completes
  useEffect(() => {
    if (!restoreCompleted) return;

    async function fetchTransactions() {
      const transactions = await getCachedSparkTransactions(
        null,
        sparkInfoRef.current.identityPubKey,
      );
      setSparkInformation(prev => ({ ...prev, transactions }));
      hasRestoreCompleted.current = true;
    }

    fetchTransactions();
  }, [restoreCompleted]);

  // Run an initial balance reconciliation once per wallet session.
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;
    if (hasRunInitBalancePoll.current) return;

    hasRunInitBalancePoll.current = true;
    requestBalanceReconcile('initialConnect', {
      shouldForcePending: false,
    });
  }, [
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    requestBalanceReconcile,
  ]);

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(
    async identityPubKey => {
      const { didWork, error } = await initWallet({
        setSparkInformation,
        // toggleGlobalContactsInformation,
        // globalContactsInformation,
        mnemonic: accountMnemoinc,
        sendWebViewRequest,
        hasRestoreCompleted: hasRestoreCompleted.current,
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
    },
    [accountMnemoinc, sendWebViewRequest],
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
      pendingTransferIds.current.clear();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      sparkInformation,
      setSparkInformation,
      pendingNavigation,
      setPendingNavigation,
      // numberOfCachedTxs,
      // setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      toggleNewestPaymentTimestamp,
      isSendingPaymentRef,
      sparkInfoRef,
    }),
    [
      sparkInformation,
      setSparkInformation,
      pendingNavigation,
      setPendingNavigation,
      // numberOfCachedTxs,
      // setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      toggleNewestPaymentTimestamp,
      isSendingPaymentRef,
      sparkInfoRef,
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
