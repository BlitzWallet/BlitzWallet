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
import getDepositAddressTxIds, {
  handleTxIdState,
} from '../app/functions/spark/getDepositAdressTxIds';
import { useKeysContext } from './keys';
import { navigationRef } from '../navigation/navigationService';
import { transformTxToPaymentObject } from '../app/functions/spark/transformTxToPayment';
import handleBalanceCache from '../app/functions/spark/handleBalanceCache';
import liquidToSparkSwap from '../app/functions/spark/liquidToSparkSwap';
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
          await resetSparkState(true);
          await connectToSparkWallet();
          await initializeFlashnet(currentMnemonicRef.current);
          alreadyRanConnection = true;
        } else {
          setSparkInformation(prev => ({
            ...prev,
            didConnect: !!prev.identityPubKey,
          }));
        }

        const runtime = await selectSparkRuntime(currentMnemonicRef.current);
        if (runtime === 'native') {
          if (!alreadyRanConnection) {
            await resetSparkState(true);
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

  const markNewTransactionsPending = (
    txs,
    prevLatestId,
    pendingIds,
    BUFFER_LIMIT = 15,
  ) => {
    let foundAnchor = false;
    let lastNewIndex = -1;
    let numSinceLastFound = 0;

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const txId = tx.sparkID;

      if (txId === prevLatestId) {
        foundAnchor = true;
      }

      if (!foundAnchor || pendingIds.has(txId)) {
        pendingIds.add(txId);
        lastNewIndex = i;
        numSinceLastFound = 0;
      } else {
        numSinceLastFound++;
        if (numSinceLastFound > BUFFER_LIMIT) break;
      }
    }

    if (lastNewIndex === -1 && pendingIds.size === 0) {
      return { txs };
    }

    const result = [...txs];
    for (let i = 0; i <= lastNewIndex; i++) {
      const tx = txs[i];
      if (pendingIds.has(tx.sparkID) && !tx.isBalancePending) {
        result[i] = getCachedTx(tx, true);
      }
    }

    return { txs: result };
  };

  const handleUpdate = useCallback(async (...args) => {
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

      if (
        updateType === 'lrc20Payments' ||
        updateType === 'txStatusUpdate' ||
        updateType === 'transactions' ||
        updateType === 'contactDetailsUpdate'
      ) {
        if (isLatestRequest) {
          setSparkInformation(prev => {
            const latestKnownId = txs[0]?.sparkID;
            const { txs: updatedTxs } = markNewTransactionsPending(
              txs,
              latestKnownId,
              pendingSparkTxIds.current,
            );
            return {
              ...prev,
              transactions: updatedTxs,
            };
          });
        }
      } else if (updateType === 'incomingPayment') {
        // incomingPayment has authoritative balance - clear ALL pending flags
        if (balancePollingAbortControllerRef.current) {
          balancePollingAbortControllerRef.current.abort();
          balancePollingAbortControllerRef.current = null;
        }

        pendingSparkTxIds.current.clear();

        handleBalanceCache({
          isCheck: false,
          passedBalance: Number(passedBalance),
          mnemonic,
        });
        if (isLatestRequest) {
          setSparkInformation(prev => ({
            ...prev,
            transactions: txs || prev.transactions,
            balance: Number(passedBalance),
          }));
        } else {
          setSparkInformation(prev => ({
            ...prev,
            balance: Number(passedBalance),
          }));
        }
      } else if (updateType === 'fullUpdate-waitBalance') {
        if (balancePollingAbortControllerRef.current) {
          balancePollingAbortControllerRef.current.abort();
        }

        balancePollingAbortControllerRef.current = new AbortController();
        currentPollingMnemonicRef.current = mnemonic;

        const pollingMnemonic = currentPollingMnemonicRef.current;

        setSparkInformation(prev => {
          const latestKnownId = prev.transactions[0]?.sparkID;

          const { txs: updatedTxs } = markNewTransactionsPending(
            txs,
            latestKnownId,
            pendingSparkTxIds.current,
          );

          return {
            ...prev,
            transactions: updatedTxs,
          };
        });

        const poller = createBalancePoller(
          mnemonic,
          currentMnemonicRef,
          balancePollingAbortControllerRef.current,
          async newBalance => {
            pendingSparkTxIds.current.clear();

            const freshTxs = await getAllSparkTransactions({
              limit: null,
              accountId: sparkInfoRef.current.identityPubKey,
            });
            setSparkInformation(prev => {
              if (pollingMnemonic !== currentMnemonicRef.current) {
                return prev;
              }
              handleBalanceCache({
                isCheck: false,
                passedBalance: newBalance,
                mnemonic: pollingMnemonic,
              });
              return {
                ...prev,
                balance: newBalance,
                transactions: freshTxs, //removes all pending flags since we have the updated balance now
              };
            });
          },
          prevBalance,
        );

        balancePollingTimeoutRef.current = poller;
        const response = await poller.start();
        if (response.reason === 'aborted') return;
      } else {
        if (balancePollingAbortControllerRef.current) {
          balancePollingAbortControllerRef.current.abort();
        }

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

        if (updateType === 'paymentWrapperTx') {
          const updatedBalance = Math.round(newBalance - fee);
          pendingSparkTxIds.current.clear();
          handleBalanceCache({
            isCheck: false,
            passedBalance: updatedBalance,
            mnemonic,
          });

          if (stillLatest) {
            setSparkInformation(prev => ({
              ...prev,
              transactions: txs || prev.transactions,
              balance: updatedBalance,
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            }));
          } else {
            setSparkInformation(prev => ({
              ...prev,
              balance: updatedBalance,
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            }));
          }
        } else if (updateType === 'fullUpdate-tokens') {
          handleBalanceCache({
            isCheck: false,
            passedBalance: newBalance,
            mnemonic,
          });
          if (stillLatest) {
            setSparkInformation(prev => {
              const latestKnownId = txs[0]?.sparkID;
              const { txs: updatedTxs } = markNewTransactionsPending(
                txs,
                latestKnownId,
                pendingSparkTxIds.current,
              );
              return {
                ...prev,
                transactions: updatedTxs,
                balance: newBalance,
                tokens: balanceResponse.didWork
                  ? balanceResponse.tokensObj
                  : prev.tokens,
              };
            });
          } else {
            setSparkInformation(prev => ({
              ...prev,
              balance: newBalance,
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            }));
          }
        } else if (updateType === 'fullUpdate') {
          pendingSparkTxIds.current.clear();
          handleBalanceCache({
            isCheck: false,
            passedBalance: newBalance,
            mnemonic,
          });

          if (stillLatest) {
            setSparkInformation(prev => ({
              ...prev,
              balance: newBalance,
              transactions: txs || prev.transactions,
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            }));
          } else {
            setSparkInformation(prev => ({
              ...prev,
              balance: newBalance,
              tokens: balanceResponse.didWork
                ? balanceResponse.tokensObj
                : prev.tokens,
            }));
          }
        }
      }

      if (
        updateType === 'paymentWrapperTx' ||
        updateType === 'transactions' ||
        updateType === 'txStatusUpdate' ||
        updateType === 'lrc20Payments' ||
        updateType === 'contactDetailsUpdate'
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

    sparkTransactionsEventEmitter.removeAllListeners(
      SPARK_TX_UPDATE_ENVENT_NAME,
    );
    incomingSparkTransaction.removeAllListeners(INCOMING_SPARK_TX_NAME);

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
              const isStateUnalighed = txs.find(
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
    if (balancePollingTimeoutRef.current) {
      clearTimeout(balancePollingTimeoutRef.current);
      balancePollingTimeoutRef.current = null;
    }
    if (balancePollingAbortControllerRef.current) {
      balancePollingAbortControllerRef.current.abort();
      balancePollingAbortControllerRef.current = null;
    }
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

  const resetSparkState = useCallback(async (internalRefresh = false) => {
    // Reset refs to initial values
    await removeListeners(true);
    clearMnemonicCache();
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
    txObjectCache.current.clear();
    currentUpdateIdRef.current = 0;

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
  }, []);

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
        const depoistAddress = await queryAllStaticDepositAddresses(
          currentMnemonicRef.current,
        );

        for (const address of depoistAddress) {
          console.log('Checking deposit address:', address);
          if (!address) continue;

          // Get new txids for an address
          const txids = await getDepositAddressTxIds(
            address,
            contactsPrivateKey,
            publicKey,
          );
          console.log('Deposit address txids:', txids);
          if (!txids || !txids.length) continue;

          const unpaidTxids = txids.filter(txid => !txid.didClaim);
          let claimedTxs =
            JSON.parse(await getLocalStorageItem('claimedBitcoinTxs')) || [];

          for (const txid of unpaidTxids) {
            const hasAlreadySaved = savedTxMap.has(txid.txid);

            // Case 1: Unconfirmed transaction - add as pending if not saved
            if (!txid.isConfirmed) {
              if (!hasAlreadySaved) {
                await addPendingTransaction(
                  {
                    transactionId: txid.txid,
                    creditAmountSats: txid.amount - txid.fee,
                  },
                  address,
                  sparkInfoRef.current,
                );
              }
              continue;
            }

            // Case 2: Confirmed transaction - attempt to get quote
            const {
              didWork: quoteDidWorkResponse,
              quote,
              error,
            } = await getSparkStaticBitcoinL1AddressQuote(
              txid.txid,
              currentMnemonicRef.current,
            );

            if (!quoteDidWorkResponse || !quote) {
              console.log(error, 'Error getting deposit address quote');
              if (
                error.includes('UTXO is already claimed by the current user.')
              ) {
                await handleTxIdState(txid, true, address);
              } else if (!hasAlreadySaved) {
                await addPendingTransaction(
                  {
                    transactionId: txid.txid,
                    creditAmountSats: txid.amount - txid.fee,
                  },
                  address,
                  sparkInfoRef.current,
                );
              }
              continue;
            }

            if (claimedTxs?.includes(quote.signature)) {
              continue;
            }

            // Case 2: Transaction is confirmed - attempt to claim
            const {
              didWork,
              error: claimError,
              response: claimTx,
            } = await claimnSparkStaticDepositAddress({
              ...quote,
              sspSignature: quote.signature,
              mnemonic: currentMnemonicRef.current,
            });

            // Add pending transaction if not already saved (after successful claim)
            if (!hasAlreadySaved) {
              await addPendingTransaction(quote, address, sparkInfoRef.current);
            }

            if (!claimTx || !didWork) {
              console.log('Claim static deposit address error', claimError);
              if (
                claimError.includes('Static deposit has already been claimed')
              ) {
                await handleTxIdState(txid, true, address);
              }
              // For any other claim errors (like utxo not found), don't add to DB
              continue;
            }

            console.log('Claimed deposit address transaction:', claimTx);

            if (!claimedTxs?.includes(quote.signature)) {
              claimedTxs.push(quote.signature);
              await setLocalStorageItem(
                'claimedBitcoinTxs',
                JSON.stringify(claimedTxs),
              );
              await handleTxIdState(txid, true, address);
            }

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
              // the fee should actually be the txid.amount(orignial sending amount) -  bitcoinTransfer.totalValue
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
                    (txid.amount || quote.creditAmountSats) -
                      bitcoinTransfer.totalValue,
                  ),
                  totalFee: Math.abs(
                    (txid.amount || quote.creditAmountSats) -
                      bitcoinTransfer.totalValue,
                  ),
                  supportFee: 0,
                },
              };
            }

            console.log('Updated bitcoin transaction:', updatedTx);
            await bulkUpdateSparkTransactions([updatedTx]);
            // If no details are provided do not show confirm screen
            // Navigate here, since bulkUpdateSparkTransactions will default to transactions and get blocked in other path
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
