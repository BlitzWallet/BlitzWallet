import {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { clearMnemonicCache } from '../app/functions/spark';
import { acquire, disposeIdentity } from '../app/functions/spark/walletRuntime';
import { createBalanceEngine } from '../app/functions/spark/balanceEngine';
import { clearEnrichedTxCache } from '../app/functions/spark/enrichedTxCache';
import { disposeWalletViewer } from '../app/functions/spark/walletViewer';
import {
  claimDepositUtxo,
  fetchAllIdentityDepositUtxos,
} from '../app/functions/spark/depositClaim';
import {
  getAllSparkTransactions,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../app/functions/spark/transactions';
import { useAppStatus } from './appStatus';
import {
  fullRestoreSparkState,
  updateSparkTxStatus,
} from '../app/functions/spark/restore';
import {
  clearMigrationMarkerCache,
  projectBreezPayments,
} from '../app/functions/spark/paymentIngest';
import { hasPendingTxDrift } from '../app/functions/spark/pendingTxDrift';
import { useGlobalContactsInfo } from './globalContacts';
import { initWallet } from '../app/functions/initiateWalletConnection';
import { AppState } from 'react-native';
import { useKeysContext } from './keys';
import {
  clearSpendAndReplaceCorrelationMemo,
  setSpendAndReplaceAuthGetter,
} from '../app/functions/spark/spendAndReplaceCorrelation';
import { navigationRef } from '../navigation/navigationService';
import EventEmitter from 'events';
import { useActiveCustodyAccount } from './activeAccount';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';
import { getBalanceWithTimeout } from '../app/functions/pollingManager';
import { USDB_TOKEN_ID } from '../app/constants';
import { saveAccountBalanceSnapshot } from '../app/functions/spark/balanceSnapshots';
import { isFlashnetTransfer } from '../app/functions/spark/handleFlashnetTransferIds';
import { getCachedTokenImages } from '../app/functions/spark/tokenImageCache';
import { useToastActions } from './toastManager';
import { clearSharedSecretCache } from '../app/functions/messaging/encodingAndDecodingMessages';

export const isSendingPayingEventEmiiter = new EventEmitter();
export const SENDING_PAYMENT_EVENT_NAME = 'SENDING_PAYMENT_EVENT';

if (!global.blitzWalletSparkIntervalState) {
  global.blitzWalletSparkIntervalState = {
    allIntervalIds: new Set(),
    depositIntervalIds: new Set(),
  };
}
const { allIntervalIds, depositIntervalIds } =
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
  'SendAmount', // sendAmountScreen.js
  'SendDescription', // sendDescriptionScreen.js
  'SendReview', // sendReviewScreen.js
  'ConfirmSplitPayment', // confirmSplitPayment.js
  'StablecoinSendScreen', // stablecoinSendScreen.js
]);

// Newest rows read per tx event: enough for the change signal, the confirm
// toast and the pending-drift backstop. Pages read their own lists.
const TX_SIGNAL_WINDOW = 50;

// See scheduleHistoryDiff in the provider.
const HISTORY_DIFF_DELAY_MS = 2500;
// While the sending flag is set, decreases are held, so a send path that
// misses its `false` must not hold them forever.
const SENDING_FLAG_MAX_MS = 180000;

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
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { showToast } = useToastActions();
  const { didGetToHomepage, appState } = useAppStatus();
  const { toggleGlobalContactsInformation, globalContactsInformation } =
    useGlobalContactsInfo();
  const contactsPrivateKeyRef = useRef('');
  const contactsPublicKeyRef = useRef(null);
  const [sparkConnectionError, setSparkConnectionError] = useState(null);
  const [sparkInformation, setSparkInformation] = useState({
    balance: 0,
    tokens: {},
    identityPubKey: '',
    sparkAddress: '',
    didConnect: null,
    didConnectToFlashnet: null,
  });
  const [tokensImageCache, setTokensImageCache] = useState({});
  // Tx lists are not held here: pages read SQLite on demand. txsVersion bumps
  // on every tx event (reload signal); txsHashKey only changes when the newest
  // completed rows do (for the heavier analytics reads).
  const [txsVersion, setTxsVersion] = useState(0);
  const [txsHashKey, setTxsHashKey] = useState('');
  // Pending rows from the last signal read, for the lost-event drift backstop.
  const pendingTxsRef = useRef([]);

  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const initialBitcoinIntervalRun = useRef(null);
  const sparkInfoRef = useRef({
    balance: 0,
    tokens: {},
    identityPubKey: '',
    sparkAddress: '',
    didConnect: false,
  });
  const sessionTimeRef = useRef(Date.now());
  const prevAppState = useRef(appState);
  const isSendingPaymentRef = useRef(false);
  const isInitialRender = useRef(true);
  const authResetKeyRef = useRef(authResetkey);

  const txLaneQueueRef = useRef(Promise.resolve());
  const uiLaneQueueRef = useRef(Promise.resolve());
  const queueDepthRef = useRef(0);
  const eventSequenceRef = useRef(0);

  // The one Breez subscription for the main wallet. attachedMnemonicRef names
  // the wallet it belongs to; connectWorkForRef latches the per-session connect
  // work (history diff, status sweep, pending interval).
  const walletHandleRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const attachedMnemonicRef = useRef(null);
  const connectWorkForRef = useRef(null);
  const ingestQueueRef = useRef(Promise.resolve());
  const historyDiffTimerRef = useRef(null);

  const showTokensInformation =
    masterInfoObject.enabledBTKNTokens === null
      ? !!Object.keys(sparkInformation.tokens || {}).filter(
          token => token !== USDB_TOKEN_ID,
        ).length
      : masterInfoObject.enabledBTKNTokens;

  const handledNavigatedTxs = useRef(new Set());

  const currentMnemonicRef = useRef(currentWalletMnemoinc);

  const clearPendingInterval = () => {
    for (const intervalId of allIntervalIds) clearInterval(intervalId);
    allIntervalIds.clear();
    updatePendingPaymentsIntervalRef.current = null;
  };

  const clearAllDepositIntervals = () => {
    for (const intervalId of depositIntervalIds) clearInterval(intervalId);
    depositIntervalIds.clear();
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
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    // Fixing race condition with new preloaded txs
    sessionTimeRef.current = Date.now() + 5 * 1000;
  }, [currentWalletMnemoinc, authResetkey]);

  useEffect(() => {
    if (!sparkInfoRef.current?.tokens) return;

    async function updateTokensImageCache() {
      const tokenIds = Object.keys(sparkInfoRef.current.tokens);
      const newCache = await getCachedTokenImages(tokenIds);
      setTokensImageCache(prev => ({ ...prev, ...newCache }));
    }

    updateTokensImageCache();
  }, [Object.keys(sparkInformation.tokens || {}).length]);

  const sendingFlagTimerRef = useRef(null);

  const toggleIsSendingPayment = useCallback(isSending => {
    console.log('Setting is sending payment', isSending);
    isSendingPaymentRef.current = isSending;
    clearTimeout(sendingFlagTimerRef.current);
    sendingFlagTimerRef.current = isSending
      ? setTimeout(() => {
          console.warn('Sending flag never cleared; releasing held balance');
          isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
        }, SENDING_FLAG_MAX_MS)
      : null;
    const settled = engineRef.current?.onSendingChange(isSending);
    // Outgoing payment events were skipped while sending: pick them up now.
    if (!isSending) {
      Promise.resolve(settled).then(() => scheduleHistoryDiff());
    }
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

  const signalTxChange = useCallback(rows => {
    pendingTxsRef.current = rows.filter(tx => tx.paymentStatus === 'pending');
    setTxsHashKey(
      rows
        .filter(tx => tx.paymentStatus === 'completed')
        .map(tx => tx.sparkID)
        .join(','),
    );
    setTxsVersion(v => v + 1);
  }, []);

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
          [lastAddedTx] = await getAllSparkTransactions({
            accountId: identityPubKey,
            limit: 1,
          });
        }

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

        if (parsedTx.paymentStatus === 'pending') {
          // Run a tx status check. Will delay toast message
          // but will prevent a stale pending stae from making the trasnsaction show pending after toast message
          const { updated } = await updateSparkTxStatus(
            currentMnemonicRef.current,
            sparkInfoRef.current.identityPubKey,
            true,
            contactsPrivateKey,
            publicKey,
          );
          const didUpdateStatus = updated.find(
            tx =>
              tx.tempId === parsedTx.sparkID &&
              tx.paymentStatus === 'completed',
          );
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
        limit: TX_SIGNAL_WINDOW,
        accountId: identityPubKey,
      });
      if (sparkInfoRef.current.identityPubKey !== identityPubKey) return;
      signalTxChange(txs);

      enqueueUiLane(event.updateType, () =>
        maybeHandleConfirmNavigation(
          event.updateType,
          txs,
          'project transactions for event',
        ),
      );
    },
    [enqueueUiLane, maybeHandleConfirmNavigation, signalTxChange],
  );

  // The displayed sats balance as the balance engine last set it (engine
  // commits write it synchronously; other writers sync through the effect
  // below), so back-to-back engine decisions never compare against a value
  // that is a render behind.
  const balanceRef = useRef(sparkInformation.balance);
  useEffect(() => {
    balanceRef.current = sparkInformation.balance;
  }, [sparkInformation.balance]);

  // Connect-time and periodic Breez history diff. Breez imports history
  // silently on its first sync after a restart (no events), so a listPayments
  // pass is what surfaces it; later runs end on the first page with nothing new.
  const runHistoryDiff = (isInitialRestore = false) => {
    const mnemonic = currentMnemonicRef.current;
    const identityPubKey = sparkInfoRef.current.identityPubKey;
    if (!mnemonic || !identityPubKey) return Promise.resolve();
    return fullRestoreSparkState({
      mnemonic,
      identityPubKey,
      isSendingPayment: isSendingPaymentRef.current,
      isInitialRestore,
    });
  };
  const scheduleHistoryDiff = () => {
    if (historyDiffTimerRef.current) return;
    historyDiffTimerRef.current = setTimeout(() => {
      historyDiffTimerRef.current = null;
      runHistoryDiff(false);
    }, HISTORY_DIFF_DELAY_MS);
  };
  const clearHistoryDiff = () => {
    clearTimeout(historyDiffTimerRef.current);
    historyDiffTimerRef.current = null;
  };

  // One balance engine per wallet session (recreated after resetSparkState).
  // See app/functions/spark/balanceEngine.js for the rules.
  const engineRef = useRef(null);
  const getBalanceEngine = () => {
    if (!engineRef.current) {
      engineRef.current = createBalanceEngine({
        getDisplayed: () => balanceRef.current,
        commit: (value, { tokens, verified, lastVerifiedAt }) => {
          const nextTokens = tokens ?? sparkInfoRef.current.tokens;
          console.log(`[BAL] commit ${balanceRef.current} -> ${value}`);
          balanceRef.current = value;
          saveAccountBalanceSnapshot(
            sparkInfoRef.current.identityPubKey,
            value,
            nextTokens,
            verified ? lastVerifiedAt : null,
          );
          setSparkInformation(prev =>
            prev.balance === value && (!tokens || prev.tokens === tokens)
              ? prev
              : { ...prev, balance: value, ...(tokens ? { tokens } : {}) },
          );
        },
        read: () => getBalanceWithTimeout(currentMnemonicRef.current),
        isSending: () => isSendingPaymentRef.current,
        isActive: () =>
          AppState.currentState === 'active' && !!currentMnemonicRef.current,
      });
    }
    return engineRef.current;
  };

  const handleUpdate = useCallback(
    (...args) => {
      const [updateType = 'transactions'] = args;

      const event = {
        seq: ++eventSequenceRef.current,
        updateType,
      };

      // These update types mark a funds-moving DB write (send wrapper, swap,
      // restore completion, deposit claim). The engine reads once — this is the
      // send's own settle read, so it may run while the sending flag is still
      // set: the engine holds the send's events and this read lands post-send
      // sats and post-swap token balances.
      if (BALANCE_INTENT_UPDATE_TYPES.has(updateType)) {
        getBalanceEngine().settle({ allowDuringSend: true });
      }

      if (!TX_REFRESH_UPDATE_TYPES.has(updateType)) {
        return Promise.resolve();
      }

      return enqueueTxLane(updateType, () =>
        projectTransactionsForEvent(event),
      );
    },
    [enqueueTxLane, projectTransactionsForEvent],
  );

  // Payment events are applied in arrival order (pending -> completed).
  const ingestBreezPayment = payment => {
    const accountId = sparkInfoRef.current.identityPubKey;
    const authKey = authResetKeyRef.current;
    if (!payment || !accountId) return;
    const completedReceive =
      payment.paymentType === 'receive' && payment.status === 'completed';
    ingestQueueRef.current = ingestQueueRef.current
      .then(() => {
        if (authKey !== authResetKeyRef.current) return;
        return projectBreezPayments([payment], {
          accountId,
          updateType: completedReceive ? 'incomingPayment' : 'transactions',
          // The send path writes its own row; the post-send diff catches up.
          skipOutgoing: isSendingPaymentRef.current,
        });
      })
      .catch(err => console.log('ingestBreezPayment error', err));
  };

  const handleBreezEvent = event => {
    switch (event?.type) {
      case 'synced':
        getBalanceEngine().onEvent(event);
        scheduleHistoryDiff();
        break;
      case 'paymentSucceeded':
      case 'paymentPending':
      case 'paymentFailed':
        getBalanceEngine().onEvent(event);
        ingestBreezPayment(event.payment);
        break;
      case 'claimedDeposits':
      case 'autoOptimization':
      case 'recoverableFunds':
        getBalanceEngine().onEvent(event);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!sparkInformation.identityPubKey) return;

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    return () => {
      sparkTransactionsEventEmitter.removeListener(
        SPARK_TX_UPDATE_ENVENT_NAME,
        handleUpdate,
      );
    };
  }, [sparkInformation.identityPubKey, handleUpdate]);

  const detachWallet = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    walletHandleRef.current = null;
    attachedMnemonicRef.current = null;
  };

  // Subscribes to the main wallet's Breez events. The handle is held for the
  // whole session: it is only closed by resetSparkState (logout) or when the
  // active wallet changes.
  const attachWallet = async () => {
    const mnemonic = currentMnemonicRef.current;
    const identityPubKey = sparkInfoRef.current.identityPubKey;
    if (!mnemonic || !identityPubKey) return false;
    if (attachedMnemonicRef.current === mnemonic) return true;

    const previous = attachedMnemonicRef.current;
    detachWallet();
    if (previous) await disposeIdentity(previous);

    const authKey = authResetKeyRef.current;
    try {
      const handle = await acquire(mnemonic, {
        mode: 'client',
        expectedIdentity: identityPubKey,
      });
      if (
        authKey !== authResetKeyRef.current ||
        mnemonic !== currentMnemonicRef.current
      ) {
        return false;
      }
      walletHandleRef.current = handle;
      unsubscribeRef.current = handle.on(handleBreezEvent);
      attachedMnemonicRef.current = mnemonic;
      return true;
    } catch (err) {
      console.log('Error attaching Breez events', err);
      return false;
    }
  };

  // Pending-row sweep + the drift backstop: a row still "pending" in memory
  // while the DB no longer lists it means a SPARK_TX event was lost.
  const runPendingSweep = async () => {
    const response = await updateSparkTxStatus(
      currentMnemonicRef.current,
      sparkInfoRef.current.identityPubKey,
      false,
      contactsPrivateKeyRef.current,
      contactsPublicKeyRef.current,
    );
    if (
      Array.isArray(response?.pendingIds) &&
      hasPendingTxDrift(pendingTxsRef.current, response.pendingIds)
    ) {
      sparkTransactionsEventEmitter.emit(
        SPARK_TX_UPDATE_ENVENT_NAME,
        'transactions',
      );
    }
    return response;
  };

  // Once per wallet session, after the subscription is live: anything missed
  // before this point lands (balance read, history diff, status sweep) and
  // nothing after it can be missed.
  const startConnectWork = () => {
    getBalanceEngine().settle();
    runHistoryDiff(true).finally(() => runPendingSweep());

    clearPendingInterval();
    const capturedAuthKey = authResetKeyRef.current;
    const capturedMnemonic = currentMnemonicRef.current;
    const intervalId = setInterval(async () => {
      try {
        if (
          capturedAuthKey !== authResetKeyRef.current ||
          capturedMnemonic !== currentMnemonicRef.current
        ) {
          clearInterval(intervalId);
          allIntervalIds.delete(intervalId);
          return;
        }
        if (AppState.currentState !== 'active') return;
        await runPendingSweep();
      } catch (err) {
        console.error('Error during periodic restore:', err);
      }
    }, 10 * 1000);
    updatePendingPaymentsIntervalRef.current = intervalId;
    allIntervalIds.add(intervalId);
  };

  const resetSparkState = useCallback(
    async (shouldClearMnemonicCache = true) => {
      clearPendingInterval();
      detachWallet();
      if (shouldClearMnemonicCache) {
        // Closes every cached Breez wallet, including the main one.
        clearMnemonicCache();
        clearSharedSecretCache();
        disposeWalletViewer();
        clearEnrichedTxCache();
        clearMigrationMarkerCache();
      }
      connectWorkForRef.current = null;
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
        didConnect: false,
      };
      pendingTxsRef.current = [];
      setTxsHashKey('');
      handledNavigatedTxs.current.clear();
      prevAppState.current = 'active';
      isSendingPaymentRef.current = false;
      clearTimeout(sendingFlagTimerRef.current);
      ingestQueueRef.current = Promise.resolve();
      // In-flight reads and staged events belong to the old session.
      engineRef.current?.dispose();
      engineRef.current = null;
      clearHistoryDiff();

      txLaneQueueRef.current = Promise.resolve();
      uiLaneQueueRef.current = Promise.resolve();
      queueDepthRef.current = 0;
      eventSequenceRef.current = 0;

      setSparkConnectionError(null);
      setSparkInformation(prev => ({
        balance: 0,
        tokens: {},
        identityPubKey: '',
        sparkAddress: '',
        didConnect: null,
        didConnectToFlashnet: null,
      }));
      contactsPrivateKeyRef.current = '';
      contactsPublicKeyRef.current = null;
      clearSpendAndReplaceCorrelationMemo();
      currentMnemonicRef.current = null;
      setTokensImageCache({});
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

  // Subscribe once the wallet is connected and the app is in the foreground,
  // then run the connect work.
  useEffect(() => {
    if (!didGetToHomepage || appState !== 'active') return;
    if (!sparkInformation.didConnect || !sparkInformation.identityPubKey)
      return;

    let cancelled = false;
    (async () => {
      const attached = await attachWallet();
      if (cancelled || !attached) return;
      const sessionKey = `${sparkInformation.identityPubKey}:${authResetKeyRef.current}`;
      if (connectWorkForRef.current === sessionKey) return;
      connectWorkForRef.current = sessionKey;
      startConnectWork();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    appState,
    didGetToHomepage,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    currentWalletMnemoinc,
  ]);

  // Background voids any read in flight; foreground reads again and sweeps.
  useEffect(() => {
    const prev = prevAppState.current;
    prevAppState.current = appState;
    if (appState === 'background') {
      engineRef.current?.invalidate();
      return;
    }

    if (appState !== 'active' || prev === 'active') return;
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;

    getBalanceEngine().settle();
    runPendingSweep();
    scheduleHistoryDiff();
  }, [
    appState,
    didGetToHomepage,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
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

        // Identity-scoped detection: one sweep returns every deposit UTXO the
        // identity owns across ALL of its static deposit addresses, so a
        // deposit is claimable even when queryStaticDepositAddresses does not
        // list its address (the address-enumeration miss that left deposits
        // stuck.
        const unclaimedUtxos = await fetchAllIdentityDepositUtxos(
          currentMnemonicRef.current,
          true,
        );

        if (!unclaimedUtxos.didWork || !unclaimedUtxos.utxos.length) return;

        // Claim pass: each identity UTXO carries the address it paid to.
        for (const utxo of unclaimedUtxos.utxos) {
          const { txid, vout, address, isConfirmed } = utxo;

          // Claim the UTXO (quote → SSP claim → settle check → persist).
          const outcome = await claimDepositUtxo({
            txid,
            vout,
            address,
            mnemonic: currentMnemonicRef.current,
            identityPubKey: sparkInfoRef.current.identityPubKey,
            isConfirmed,
          });

          if (!outcome.didClaim) {
            console.log('Claim static deposit address error', outcome.error);
            continue;
          }

          if (!outcome.persisted) {
            console.error(
              'Claimed deposit but failed to persist transaction; the Breez payment event is the remaining writer',
              outcome.transferId,
            );
          }

          console.log(
            'Claimed deposit address transaction:',
            outcome.transferId,
          );
          console.log('Updated bitcoin transaction:', outcome.updatedTx);

          // Navigate to confirm screen if we have details
          if (outcome.updatedTx.details) {
            if (handledNavigatedTxs.current.has(outcome.updatedTx.id)) {
              continue;
            }
            handledNavigatedTxs.current.add(outcome.updatedTx.id);
            if (!isOnSendScreen()) {
              showToast({
                amount: outcome.updatedTx.details.amount,
                duration: 7000,
                type: 'confirmTx',
              });
            }
          }
        }
      } catch (err) {
        console.log('Handle deposit address check error', err);
      }
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

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(
    async identityPubKey => {
      // A connect outlived by a logout must not write the old wallet back,
      // and its slow read (up to 10 s) must not overwrite a newer balance the
      // engine committed meanwhile.
      const startAuthKey = authResetKeyRef.current;
      const startVersion = getBalanceEngine().version();
      const setIfCurrent = update =>
        setSparkInformation(prev => {
          if (authResetKeyRef.current !== startAuthKey) return prev;
          const next = typeof update === 'function' ? update(prev) : update;
          if (getBalanceEngine().version() === startVersion) return next;
          return { ...next, balance: prev.balance, tokens: prev.tokens };
        });
      const { didWork, error } = await initWallet({
        setSparkInformation: setIfCurrent,
        // toggleGlobalContactsInformation,
        // globalContactsInformation,
        mnemonic: currentMnemonicRef.current || currentWalletMnemoinc,
        identityPubKey,
      });
      if (authResetKeyRef.current !== startAuthKey)
        return { didWork: false, error: 'Logged out during connect' };
      // lastConnectedTimeRef.current = Date.now();
      if (!didWork) {
        setSparkInformation(prev => ({ ...prev, didConnect: false }));
        setSparkConnectionError(error);
        console.log('Error connecting to spark wallet:', error);
      }
      // A timed-out connect read left the snapshot on screen; the read the
      // attach effect runs once listeners are live lands the real balance.
      return { didWork, error };
    },
    [currentWalletMnemoinc],
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
      engineRef.current?.dispose();
      clearHistoryDiff();
      clearTimeout(sendingFlagTimerRef.current);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      sparkInformation,
      txsHashKey,
      txsVersion,
      setSparkInformation,
      connectToSparkWallet,
      sparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      sparkInfoRef,
    }),
    [
      sparkInformation,
      txsHashKey,
      txsVersion,
      setSparkInformation,
      connectToSparkWallet,
      sparkConnectionError,
      tokensImageCache,
      showTokensInformation,
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
