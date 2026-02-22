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
  fullRestoreSparkState,
  updateSparkTxStatus,
} from '../app/functions/spark/restore';
import { useGlobalContacts } from './globalContacts';
import {
  initializeSparkSession,
  initWallet,
} from '../app/functions/initiateWalletConnection';
// import { useNodeContext } from './nodeContext';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import { AppState } from 'react-native';
import getDepositAddressTxIds from '../app/functions/spark/getDepositAdressTxIds';
import { useKeysContext } from './keys';
import { navigationRef } from '../navigation/navigationService';
import { transformTxToPaymentObject } from '../app/functions/spark/transformTxToPayment';
import handleBalanceCache from '../app/functions/spark/handleBalanceCache';
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
    useGlobalContacts();
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

  const pendingSparkTxIds = useRef(new Set());
  const txObjectCache = useRef(new Map());
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
  const currentUpdateIdRef = useRef(0);
  const pendingTxRange = useRef({ start: -1, end: -1 });
  const pendingTxCount = useRef(0);
  const balanceVersionRef = useRef(0);
  const handleUpdateQueueRef = useRef(Promise.resolve());
  const hasRunInitBalancePoll = useRef(false);

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
      // let transfersOffset = 0;
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
        handleBalanceCache({
          isCheck: false,
          passedBalance: balance,
          mnemonic: currentMnemonicRef.current,
        });
        setSparkInformation(prev => ({
          ...prev,
          balance: balance,
        }));
        return;
      }

      try {
        await bulkUpdateSparkTransactions(
          paymentObjects,
          'incomingPayment',
          0,
          balance,
        );
      } catch (error) {
        console.error('bulkUpdateSparkTransactions failed:', error);
      }
    },
    [sendWebViewRequest],
  );

  const getCachedTx = (tx, isPending) => {
    const key = `${tx.sparkID}-${isPending}`;
    const cached = txObjectCache.current.get(key);

    if (cached) return cached;

    const newTx = isPending ? { ...tx, isBalancePending: true } : tx;
    txObjectCache.current.set(key, newTx);
    return newTx;
  };

  const handleUpdateInternal = useCallback(async (...args) => {
    try {
      const [updateType = 'transactions', fee = 0, passedBalance = 0] = args;
      const mnemonic = currentMnemonicRef.current;
      const { identityPubKey, balance: prevBalance } = sparkInfoRef.current;

      const updateId = ++currentUpdateIdRef.current;
      const runtime = await selectSparkRuntime(mnemonic);
      console.log(
        'running update in spark context from db changes',
        updateType,
        runtime,
      );

      if (!identityPubKey) {
        console.warn(
          'handleUpdate called but identityPubKey is not available yet',
        );
        return;
      }

      const txs = await getAllSparkTransactions({
        limit: null,
        accountId: identityPubKey,
      });

      const isLatestRequest = updateId === currentUpdateIdRef.current;

      const applyPendingFlags = transactions => {
        if (!transactions?.length) return transactions;

        // Source of truth for pending state across overlapping full updates.
        if (pendingSparkTxIds.current.size > 0) {
          let hasPendingTx = false;
          const withPendingFlags = transactions.map(tx => {
            if (!pendingSparkTxIds.current.has(tx.sparkID)) return tx;
            hasPendingTx = true;
            return getCachedTx(tx, true);
          });

          if (hasPendingTx) {
            pendingTxCount.current = transactions.length;
            return withPendingFlags;
          }
        }

        const { start, end } = pendingTxRange.current;
        const previousTxCount = pendingTxCount.current;

        if (start === -1 || end === -1 || previousTxCount === 0)
          return transactions;

        const currentTxCount = transactions.length;
        const txCountDiff = currentTxCount - previousTxCount;
        const adjustedStart = start + txCountDiff;
        const adjustedEnd = end + txCountDiff;

        if (
          adjustedStart < 0 ||
          adjustedEnd >= currentTxCount ||
          adjustedStart > adjustedEnd
        ) {
          console.warn('Pending range out of bounds, clearing pending state');
          pendingTxRange.current = { start: -1, end: -1 };
          pendingTxCount.current = 0;
          return transactions;
        }

        const before =
          adjustedStart > 0 ? transactions.slice(0, adjustedStart) : [];
        const pending = [];
        const after =
          adjustedEnd < currentTxCount - 1
            ? transactions.slice(adjustedEnd + 1)
            : [];

        for (let i = adjustedStart; i <= adjustedEnd; i++) {
          pending.push(getCachedTx(transactions[i], true));
        }

        return [...before, ...pending, ...after];
      };

      if (
        updateType === 'lrc20Payments' ||
        updateType === 'txStatusUpdate' ||
        updateType === 'transactions' ||
        updateType === 'contactDetailsUpdate' ||
        updateType === 'incrementalRestore'
      ) {
        if (isLatestRequest) {
          setSparkInformation(prev => ({
            ...prev,
            transactions: applyPendingFlags(txs),
          }));
        }
      } else if (updateType === 'incomingPayment') {
        pendingSparkTxIds.current.clear();
        pendingTxRange.current = { start: -1, end: -1 };
        pendingTxCount.current = 0;

        const myVersion = ++balanceVersionRef.current;
        handleBalanceCache({
          isCheck: false,
          passedBalance: Number(passedBalance),
          mnemonic,
        });
        const balanceResponse = await getSparkBalance(mnemonic);

        if (isLatestRequest) {
          setSparkInformation(prev => {
            if (myVersion < balanceVersionRef.current) return prev;
            return {
              ...prev,
              transactions: txs || prev.transactions,
              balance: Number(passedBalance),
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            };
          });
        } else {
          setSparkInformation(prev => {
            if (myVersion < balanceVersionRef.current) return prev;
            return {
              ...prev,
              balance: Number(passedBalance),
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            };
          });
        }
      } else if (
        updateType === 'fullUpdate-waitBalance' ||
        updateType === 'paymentWrapperTx' ||
        updateType === 'fullUpdate' ||
        updateType === 'fullUpdate-tokens'
      ) {
        const pollerAbortController = new AbortController();
        balancePollingAbortControllerRef.current = pollerAbortController;
        currentPollingMnemonicRef.current = mnemonic;
        const pollingMnemonic = mnemonic;

        // Mark new txs as pending while we wait for balance confirmation
        setSparkInformation(prev => {
          const existingIds = new Set(prev.transactions.map(t => t.sparkID));

          // Find the range of new transactions
          let firstNewIndex = -1;
          let lastNewIndex = -1;

          for (let i = 0; i < txs.length; i++) {
            if (!existingIds.has(txs[i].sparkID)) {
              if (firstNewIndex === -1) firstNewIndex = i;
              lastNewIndex = i;
              pendingSparkTxIds.current.add(txs[i].sparkID);
            } else if (firstNewIndex !== -1) {
              // Found existing tx after new ones - stop looking
              break;
            }
          }

          // Do not overwrite existing pending range unless this cycle
          // discovered a new visible contiguous range.
          if (firstNewIndex !== -1 && lastNewIndex !== -1) {
            pendingTxRange.current = {
              start: firstNewIndex,
              end: lastNewIndex,
            };
            pendingTxCount.current = txs.length;
          } else if (pendingSparkTxIds.current.size === 0) {
            pendingTxRange.current = { start: -1, end: -1 };
            pendingTxCount.current = 0;
          }

          return {
            ...prev,
            transactions: applyPendingFlags(txs),
          };
        });

        const poller = createBalancePoller(
          mnemonic,
          currentMnemonicRef,
          pollerAbortController,
          async balanceResult => {
            // Ignore stale pollers that were replaced by a newer update cycle.
            if (
              balancePollingAbortControllerRef.current !== pollerAbortController
            )
              return;
            if (pollingMnemonic !== currentMnemonicRef.current) return;

            if (!balanceResult.didWork) {
              sparkTransactionsEventEmitter.emit(
                SPARK_TX_UPDATE_ENVENT_NAME,
                'fullUpdate-waitBalance',
              );
              return;
            }
            pendingSparkTxIds.current.clear();
            pendingTxRange.current = { start: -1, end: -1 };
            pendingTxCount.current = 0;

            const myVersion = ++balanceVersionRef.current;
            const freshTxs = await getAllSparkTransactions({
              limit: null,
              accountId: sparkInfoRef.current.identityPubKey,
            });
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              handleBalanceCache({
                isCheck: false,
                passedBalance: Number(balanceResult.balance),

                mnemonic: pollingMnemonic,
              });
              return {
                ...prev,
                balance: Number(balanceResult.balance),
                tokens: balanceResult.tokensObj,
                transactions: freshTxs, //removes all pending flags since we have the updated balance now
              };
            });
          },
          prevBalance,
        );

        balancePollingTimeoutRef.current = poller;
        const response = await poller.start();
        if (response.reason === 'aborted') {
          console.warn('Polling aborted');
          return;
        }
      } else {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000;
        let balanceResponse = await getSparkBalance(mnemonic);

        const shouldRetry = balanceResponse => {
          return (
            balanceResponse.didWork &&
            Object.entries(balanceResponse.tokensObj).length &&
            !Object.entries(balanceResponse.tokensObj).find(item => {
              const [key, value] = item;
              return !!value.balance;
            }) &&
            (updateType === 'fullUpdate-tokens' || updateType === 'fullUpdate')
          );
        };

        if (shouldRetry(balanceResponse)) {
          console.log('Invalid balance returned retrying balance:');

          for (let index = 0; index < MAX_RETRIES; index++) {
            balanceResponse = await getSparkBalance(mnemonic);
            if (shouldRetry(balanceResponse)) {
              console.log(
                'Invalid balance returned retrying balance, waiting for timeout',
              );
              await new Promise(res => setTimeout(res, RETRY_DELAY));
              continue;
            } else {
              break;
            }
          }
        }

        const newBalance = balanceResponse.didWork
          ? Number(balanceResponse.balance)
          : prevBalance;

        const stillLatest = updateId === currentUpdateIdRef.current;
        const myVersion = ++balanceVersionRef.current;

        if (updateType === 'paymentWrapperTx') {
          const updatedBalance = Math.round(newBalance - fee);
          pendingSparkTxIds.current.clear();
          pendingTxRange.current = { start: -1, end: -1 };
          pendingTxCount.current = 0;

          handleBalanceCache({
            isCheck: false,
            passedBalance: updatedBalance,
            mnemonic,
          });

          if (stillLatest) {
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              return {
                ...prev,
                transactions: txs || prev.transactions,
                balance: updatedBalance,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          } else {
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              return {
                ...prev,
                balance: updatedBalance,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          }
        } else if (updateType === 'fullUpdate-tokens') {
          handleBalanceCache({
            isCheck: false,
            passedBalance: newBalance,
            mnemonic,
          });
          if (stillLatest) {
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              return {
                ...prev,
                transactions: applyPendingFlags(txs),
                balance: newBalance,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          } else {
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              return {
                ...prev,
                balance: newBalance,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          }
        } else if (updateType === 'fullUpdate') {
          pendingSparkTxIds.current.clear();
          pendingTxRange.current = { start: -1, end: -1 };
          pendingTxCount.current = 0;

          handleBalanceCache({
            isCheck: false,
            passedBalance: newBalance,
            mnemonic,
          });

          if (stillLatest) {
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              return {
                ...prev,
                balance: newBalance,
                transactions: txs || prev.transactions,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          } else {
            setSparkInformation(prev => {
              if (myVersion < balanceVersionRef.current) return prev;
              return {
                ...prev,
                balance: newBalance,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          }
        }
      }

      if (
        updateType === 'paymentWrapperTx' ||
        updateType === 'transactions' ||
        updateType === 'txStatusUpdate' ||
        updateType === 'lrc20Payments' ||
        updateType === 'contactDetailsUpdate' ||
        updateType === 'incrementalRestore'
      ) {
        console.log(
          'Payment type is send payment, transaction, lrc20 first render, updateContactDetails, or txstatus update, skipping confirm tx page navigation',
        );
        return;
      }
      const [lastAddedTx] = await getAllSparkTransactions({
        accountId: identityPubKey,
        limit: 1,
      });

      if (!lastAddedTx) {
        console.log(
          'No transaction found, skipping confirm tx page navigation',
        );

        return;
      }

      const parsedTx = {
        ...lastAddedTx,
        details: JSON.parse(lastAddedTx.details),
      };

      if (handledNavigatedTxs.current.has(parsedTx.sparkID)) {
        console.log(
          'Already handled transaction, skipping confirm tx page navigation',
        );
        return;
      }
      handledNavigatedTxs.current.add(parsedTx.sparkID);

      const details = parsedTx?.details;

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

      if (new Date(details.time).getTime() < sessionTimeRef.current) {
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
        console.log('Is sending payment, skipping confirm tx page navigation');
        return;
      }

      if (details.direction === 'OUTGOING') {
        console.log(
          'Only incoming payments navigate here, skipping confirm tx page navigation',
        );
        return;
      }

      const isOnReceivePage =
        navigationRef
          .getRootState()
          .routes?.filter(item => item.name === 'ReceiveBTC').length === 1;

      const isNewestPayment =
        !!details?.createdTime || !!details?.time
          ? new Date(details.createdTime || details?.time).getTime() >
            newestPaymentTimeRef.current
          : false;

      let shouldShowConfirm = false;

      if (
        (lastAddedTx.paymentType?.toLowerCase() === 'lightning' &&
          !details.isLNURL &&
          !details?.shouldNavigate &&
          isOnReceivePage &&
          isNewestPayment) ||
        (lastAddedTx.paymentType?.toLowerCase() === 'spark' &&
          !details.isLRC20Payment &&
          isOnReceivePage &&
          isNewestPayment)
      ) {
        if (lastAddedTx.paymentType?.toLowerCase() === 'spark') {
          const upaidLNInvoices = await getAllUnpaidSparkLightningInvoices();
          const lastMatch = upaidLNInvoices.findLast(invoice => {
            const savedInvoiceDetails = JSON.parse(invoice.details);
            return (
              !savedInvoiceDetails.sendingUUID &&
              !savedInvoiceDetails.isLNURL &&
              invoice.amount === details.amount
            );
          });

          if (lastMatch && !usedSavedTxIds.current.has(lastMatch.id)) {
            usedSavedTxIds.current.add(lastMatch.id);
            const lastInvoiceDetails = JSON.parse(lastMatch.details);
            if (details.time - lastInvoiceDetails.createdTime < 60 * 1000) {
              shouldShowConfirm = true;
            }
          }
        } else {
          shouldShowConfirm = true;
        }
      }

      // Handle confirm animation here
      setPendingNavigation({
        tx: parsedTx,
        amount: details.amount,
        LRC20Token: details.LRC20Token,
        isLRC20Payment: !!details.LRC20Token,
        showFullAnimation: shouldShowConfirm,
      });
    } catch (err) {
      console.log('error in spark handle db update function', err);
    }
  }, []);

  const handleUpdate = useCallback(
    (...args) => {
      const [updateType] = args;

      if (
        !(
          updateType === 'lrc20Payments' ||
          updateType === 'txStatusUpdate' ||
          updateType === 'transactions' ||
          updateType === 'contactDetailsUpdate' ||
          updateType === 'incrementalRestore' ||
          updateType === 'incomingPayment'
        )
      ) {
        console.log(`Aborting any existing poller for incoming ${updateType}`);
        if (balancePollingAbortControllerRef.current) {
          balancePollingAbortControllerRef.current.abort();
          balancePollingAbortControllerRef.current = null;
        }
      }

      // Then queue the actual work
      handleUpdateQueueRef.current = handleUpdateQueueRef.current
        .then(() => handleUpdateInternal(...args))
        .catch(err =>
          console.log('error in serialized handleUpdate queue', err),
        );
      return handleUpdateQueueRef.current;
    },
    [handleUpdateInternal],
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
    //Clear balance polling
    // if (balancePollingTimeoutRef.current) {
    //   clearTimeout(balancePollingTimeoutRef.current);
    //   balancePollingTimeoutRef.current = null;
    // }
    // if (balancePollingAbortControllerRef.current) {
    //   balancePollingAbortControllerRef.current.abort();
    //   balancePollingAbortControllerRef.current = null;
    // }
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
      balancePollingTimeoutRef.current = null;
      balancePollingAbortControllerRef.current = null;
      txPollingAbortControllerRef.current = null;
      txPollingTimeoutRef.current = null;
      currentPollingMnemonicRef.current = null;
      didRunInitialRestore.current = false;
      hasRestoreCompleted.current = false;
      pendingSparkTxIds.current.clear();
      pendingTxRange.current = { start: -1, end: -1 };
      pendingTxCount.current = 0;
      txObjectCache.current.clear();
      currentUpdateIdRef.current = 0;
      balanceVersionRef.current = 0;
      hasRunInitBalancePoll.current = false;
      handleUpdateQueueRef.current = Promise.resolve();

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
                creditAmountSats: tx.amount - tx.fee,
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

            console.log('Claimed deposit address transaction:', claimTx);

            // Wait for the transfer to settle
            await new Promise(res => setTimeout(res, 2000));

            const bitcoinTransfer = await getSingleTxDetails(
              currentMnemonicRef.current,
              claimTx.transferId,
            );

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
                  fee: Math.abs(
                    quote.creditAmountSats - bitcoinTransfer.totalValue,
                  ),
                  totalFee: Math.abs(
                    quote.creditAmountSats - bitcoinTransfer.totalValue,
                  ),
                  supportFee: 0,
                },
              };
            }

            console.log('Updated bitcoin transaction:', updatedTx);
            await bulkUpdateSparkTransactions([updatedTx]);

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

    const addPendingTransaction = async (quote, address, sparkInformation) => {
      const pendingTx = {
        id: quote.transactionId,
        paymentStatus: 'pending',
        paymentType: 'bitcoin',
        accountId: sparkInformation.identityPubKey,
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

  // Always-poll-on-init: after wallet connects and state is set (listeners attached),
  // poll getSparkBalance() until it stabilizes, then set the confirmed balance.
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;
    if (hasRunInitBalancePoll.current) return;
    hasRunInitBalancePoll.current = true;

    const mnemonic = currentMnemonicRef.current;
    const initialBalance = sparkInformation.initialBalance;

    // If no initialBalance was provided (e.g. balance fetch failed), skip polling
    if (initialBalance == null) {
      console.log(
        'No initialBalance from init — skipping balance confirmation poll',
      );
      return;
    }

    console.log(
      'Starting init balance confirmation poll. Initial SDK read:',
      initialBalance,
    );

    if (balancePollingAbortControllerRef.current) {
      balancePollingAbortControllerRef.current.abort();
    }
    balancePollingAbortControllerRef.current = new AbortController();
    currentPollingMnemonicRef.current = mnemonic;

    const pollingMnemonic = mnemonic;

    const poller = createBalancePoller(
      mnemonic,
      currentMnemonicRef,
      balancePollingAbortControllerRef.current,
      async balanceResult => {
        // Balance has stabilized — this is our confirmed value
        console.log(
          'Init balance confirmed via polling:',
          balanceResult.balance,
        );
        const myVersion = ++balanceVersionRef.current;

        handleBalanceCache({
          isCheck: false,
          passedBalance: Number(balanceResult.balance),
          mnemonic: pollingMnemonic,
        });

        const freshTxs = await getAllSparkTransactions({
          limit: null,
          accountId: sparkInfoRef.current.identityPubKey,
        });

        setSparkInformation(prev => {
          if (pollingMnemonic !== currentMnemonicRef.current) return prev;
          if (myVersion < balanceVersionRef.current) return prev;
          return {
            ...prev,
            balance: Number(balanceResult.balance),
            tokens: balanceResult.tokensObj,
            transactions: freshTxs || prev.transactions,
            initialBalance: undefined, // Clean up — no longer needed
          };
        });
      },
      initialBalance, // Seed the poller with the first SDK read
    );

    balancePollingTimeoutRef.current = poller;
    poller.start().then(response => {
      if (response.reason === 'aborted') {
        console.log('Init balance poll aborted');
      } else if (response.reason === 'max_retries') {
        // Polling exhausted without stabilization — accept last known value
        console.log(
          'Init balance poll exhausted retries, accepting current balance',
        );
        const myVersion = ++balanceVersionRef.current;
        const lastBalance = response.result;
        if (lastBalance != null) {
          handleBalanceCache({
            isCheck: false,
            passedBalance: lastBalance,
            mnemonic: pollingMnemonic,
          });
          setSparkInformation(prev => {
            if (pollingMnemonic !== currentMnemonicRef.current) return prev;
            if (myVersion < balanceVersionRef.current) return prev;
            return {
              ...prev,
              balance: lastBalance,
              initialBalance: undefined,
            };
          });
        }
      }
    });

    return () => {
      if (balancePollingAbortControllerRef.current) {
        balancePollingAbortControllerRef.current.abort();
      }
    };
  }, [sparkInformation.didConnect, sparkInformation.identityPubKey]);

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(async () => {
    const { didWork, error } = await initWallet({
      setSparkInformation,
      // toggleGlobalContactsInformation,
      // globalContactsInformation,
      mnemonic: accountMnemoinc,
      sendWebViewRequest,
      hasRestoreCompleted: hasRestoreCompleted.current,
    });
    setDidRunNormalConnection(true);
    // lastConnectedTimeRef.current = Date.now();
    if (!didWork) {
      setSparkInformation(prev => ({ ...prev, didConnect: false }));
      setSparkConnectionError(error);
      console.log('Error connecting to spark wallet:', error);
      return;
    }
  }, [accountMnemoinc, sendWebViewRequest]);

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
