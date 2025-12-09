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
  findTransactionTxFromTxHistory,
  getCachedSparkTransactions,
  getSparkBalance,
  getSparkStaticBitcoinL1AddressQuote,
  queryAllStaticDepositAddresses,
  selectSparkRuntime,
  sparkWallet,
} from '../app/functions/spark';
import {
  addSingleSparkTransaction,
  bulkUpdateSparkTransactions,
  getAllSparkTransactions,
  getAllSparkContactInvoices,
  getAllUnpaidSparkLightningInvoices,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../app/functions/spark/transactions';
import { useAppStatus } from './appStatus';
import {
  findSignleTxFromHistory,
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

export const isSendingPayingEventEmiiter = new EventEmitter();
export const SENDING_PAYMENT_EVENT_NAME = 'SENDING_PAYMENT_EVENT';

// Initiate context
const SparkWalletManager = createContext(null);

const SparkWalletProvider = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { changeSparkConnectionState, sendWebViewRequest } = useWebView();
  const { accountMnemoinc, contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { didGetToHomepage, appState, lastConnectedTimeRef } = useAppStatus();
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
  });
  const [tokensImageCache, setTokensImageCache] = useState({});
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const hasRestoreCompleted = useRef(false);
  const [reloadNewestPaymentTimestamp, setReloadNewestPaymentTimestamp] =
    useState(0);

  // const [pendingLiquidPayment, setPendingLiquidPayment] = useState(null);
  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const isInitialRestore = useRef(true);
  const isInitialLRC20Run = useRef(true);
  const didInitializeSendingPaymentEvent = useRef(false);
  const initialBitcoinIntervalRun = useRef(null);
  const sparkInfoRef = useRef({
    balance: 0,
    tokens: {},
    identityPubKey: '',
    sparkAddress: '',
  });
  const sessionTimeRef = useRef(Date.now());
  const newestPaymentTimeRef = useRef(Date.now());
  const handledTransfers = useRef(new Set());
  const prevListenerType = useRef(null);
  const prevAppState = useRef(appState);
  const prevAccountId = useRef(null);
  const isSendingPaymentRef = useRef(false);
  const balancePollingTimeoutRef = useRef(null);
  const balancePollingAbortControllerRef = useRef(null);
  const currentPollingMnemonicRef = useRef(null);
  const isInitialRender = useRef(true);
  const authResetKeyRef = useRef(authResetkey);
  const showTokensInformation =
    masterInfoObject.enabledBTKNTokens === null
      ? !!Object.keys(sparkInformation.tokens || {}).length
      : masterInfoObject.enabledBTKNTokens;

  const didRunInitialRestore = useRef(false);

  const handledNavigatedTxs = useRef(new Set());

  const [didRunNormalConnection, setDidRunNormalConnection] = useState(false);
  const [normalConnectionTimeout, setNormalConnectionTimeout] = useState(false);
  const shouldRunNormalConnection =
    didRunNormalConnection || normalConnectionTimeout;
  const currentMnemonicRef = useRef(currentWalletMnemoinc);

  useEffect(() => {
    authResetKeyRef.current = authResetkey;
  }, [authResetkey]);

  useEffect(() => {
    sparkInfoRef.current = {
      balance: sparkInformation.balance,
      tokens: sparkInformation.tokens,
      identityPubKey: sparkInformation.identityPubKey,
      sparkAddress: sparkInformation.sparkAddress,
    };
  }, [
    sparkInformation.balance,
    sparkInformation.tokens,
    sparkInformation.identityPubKey,
    sparkInformation.sparkAddress,
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
        if (!sparkInfoRef.current.identityPubKey && shouldRunNormalConnection) {
          initializeSparkSession({
            setSparkInformation,
            mnemonic: currentMnemonicRef.current,
          });
        } else {
          setSparkInformation(prev => ({
            ...prev,
            didConnect: !!prev.identityPubKey,
          }));
        }
        const runtime = await selectSparkRuntime(currentMnemonicRef.current);
        if (runtime === 'native') {
          await addListeners('full');
        }
      }
    }
    handleWalletStateChange();
  }, [changeSparkConnectionState, didGetToHomepage, shouldRunNormalConnection]);

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

  const toggleIsSendingPayment = isSending => {
    isSendingPaymentRef.current = isSending;
  };

  const toggleNewestPaymentTimestamp = () => {
    setReloadNewestPaymentTimestamp(prev => prev + 1);
  };

  useEffect(() => {
    if (didInitializeSendingPaymentEvent.current) return;
    didInitializeSendingPaymentEvent.current = true;

    if (
      !isSendingPayingEventEmiiter.listenerCount(SENDING_PAYMENT_EVENT_NAME)
    ) {
      isSendingPayingEventEmiiter.addListener(
        SENDING_PAYMENT_EVENT_NAME,
        toggleIsSendingPayment,
      );
    }
  }, []);

  // This is a function that handles incoming transactions and formats it to required format
  const handleTransactionUpdate = async (
    recevedTxId,
    transactions,
    balance,
  ) => {
    try {
      console.log(recevedTxId, transactions, balance);
      if (!transactions)
        throw new Error('Unable to get transactions from spark');
      const { transfers } = transactions;
      let selectedSparkTransaction = transfers.find(
        tx => tx.id === recevedTxId,
      );

      if (!selectedSparkTransaction) {
        console.log('Running full history sweep');
        const singleTxResponse = await findSignleTxFromHistory(
          recevedTxId,
          5,
          currentMnemonicRef.current,
          sendWebViewRequest,
        );
        if (!singleTxResponse.tx)
          throw new Error('Unable to find tx in all of history');
        selectedSparkTransaction = singleTxResponse.tx;
      }

      console.log(
        selectedSparkTransaction,
        selectedSparkTransaction.type,
        'received transaction from spark tx list',
      );
      if (!selectedSparkTransaction)
        throw new Error('Not able to get recent transfer');

      if (selectedSparkTransaction.type === 'UTXO_SWAP')
        throw new Error('Being handled by bitcoin functionality bellow');

      const [unpaidInvoices, unpaidContactInvoices] = await Promise.all([
        getAllUnpaidSparkLightningInvoices(),
        getAllSparkContactInvoices(),
      ]);
      const paymentObject = await transformTxToPaymentObject(
        selectedSparkTransaction,
        sparkInfoRef.current.sparkAddress,
        undefined,
        false,
        unpaidInvoices,
        sparkInfoRef.current.identityPubKey,
        1,
        undefined,
        unpaidContactInvoices,
      );

      if (paymentObject) {
        await bulkUpdateSparkTransactions(
          [paymentObject],
          'incomingPayment',
          0,
          balance,
        );
      }

      return {
        paymentObject: paymentObject || {},
        paymentCreatedTime: new Date(
          selectedSparkTransaction.createdTime,
        ).getTime(),
      };
    } catch (err) {
      console.log('Handle incoming transaction error', err);
    }
  };

  const handleIncomingPayment = async (transferId, transactions, balance) => {
    let storedTransaction = await handleTransactionUpdate(
      transferId,
      transactions,
      balance,
    );
    // block incoming paymetns here
    // if the tx storage fails at least update the balance
    if (!storedTransaction) {
      handleBalanceCache({
        isCheck: false,
        passedBalance: balance,
        mnemonic: currentMnemonicRef.current,
      });
      setSparkInformation(prev => ({
        ...prev,
        balance: balance,
      }));
    }
  };

  const debouncedHandleIncomingPayment = useCallback(
    async balance => {
      if (pendingTransferIds.current.size === 0) return;

      const transferIdsToProcess = Array.from(pendingTransferIds.current);
      pendingTransferIds.current.clear();

      console.log(
        'Processing debounced incoming payments:',
        transferIdsToProcess,
      );
      let transfersOffset = 0;
      let cachedTransfers = [];

      for (const transferId of transferIdsToProcess) {
        try {
          const findTxResponse = await findTransactionTxFromTxHistory(
            transferId,
            transfersOffset,
            cachedTransfers,
            currentMnemonicRef.current,
            sendWebViewRequest,
            5,
          );
          if (findTxResponse.offset || findTxResponse.foundTransfers) {
            transfersOffset = findTxResponse.offset;
            cachedTransfers = findTxResponse.foundTransfers;
          }

          if (!findTxResponse.didWork || !findTxResponse.bitcoinTransfer)
            continue;
          await handleIncomingPayment(
            transferId,
            { transfers: cachedTransfers },
            balance,
          );
        } catch (error) {
          console.error(
            'Error processing incoming payment:',
            transferId,
            error,
          );
        }
      }
    },
    [sendWebViewRequest],
  );

  const handleUpdate = async (...args) => {
    try {
      const [updateType = 'transactions', fee = 0, passedBalance = 0] = args;
      const runtime = await selectSparkRuntime(currentMnemonicRef.current);
      console.log(
        'running update in spark context from db changes',
        updateType,
        runtime,
      );
      const txs = await getAllSparkTransactions({
        limit: null,
        accountId: sparkInfoRef.current.identityPubKey,
      });

      if (
        updateType === 'lrc20Payments' ||
        updateType === 'txStatusUpdate' ||
        updateType === 'transactions'
      ) {
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
        }));
      } else if (updateType === 'incomingPayment') {
        handleBalanceCache({
          isCheck: false,
          passedBalance: Number(passedBalance),
          mnemonic: currentMnemonicRef.current,
        });
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
          balance: Number(passedBalance),
        }));
      } else if (updateType === 'fullUpdate-waitBalance') {
        if (balancePollingTimeoutRef.current) {
          clearTimeout(balancePollingTimeoutRef.current);
          balancePollingTimeoutRef.current = null;
        }
        if (balancePollingAbortControllerRef.current) {
          balancePollingAbortControllerRef.current.abort();
        }

        balancePollingAbortControllerRef.current = new AbortController();
        currentPollingMnemonicRef.current = currentMnemonicRef.current;

        const pollingMnemonic = currentPollingMnemonicRef.current;
        const currentAbortController = balancePollingAbortControllerRef.current;

        const initialBalance = await getSparkBalance(pollingMnemonic);

        const startBalance = initialBalance.didWork
          ? Number(initialBalance.balance)
          : sparkInfoRef.current.balance;

        setSparkInformation(prev => {
          handleBalanceCache({
            isCheck: false,
            passedBalance: startBalance,
            mnemonic: pollingMnemonic,
          });
          return {
            ...prev,
            transactions: txs || prev.transactions,
            balance: startBalance,
            tokens: initialBalance.tokensObj || prev.tokens,
          };
        });

        const delays = [1000, 2000, 5000, 15000];
        let previousBalance = startBalance;

        const pollBalance = async delayIndex => {
          try {
            if (
              currentAbortController.signal.aborted ||
              pollingMnemonic !== currentMnemonicRef.current
            ) {
              console.log(
                'Balance polling stopped:',
                currentAbortController.signal.aborted
                  ? 'aborted'
                  : 'wallet changed',
              );
              return;
            }

            if (delayIndex >= delays.length) {
              console.log('Balance polling completed after all retries');
              balancePollingAbortControllerRef.current = null;
              currentPollingMnemonicRef.current = null;
              return;
            }

            balancePollingTimeoutRef.current = setTimeout(async () => {
              try {
                if (
                  currentAbortController.signal.aborted ||
                  pollingMnemonic !== currentMnemonicRef.current
                ) {
                  return;
                }

                const balance = await getSparkBalance(pollingMnemonic);
                const newBalance = balance.didWork
                  ? Number(balance.balance)
                  : previousBalance;

                if (newBalance > previousBalance) {
                  console.log(
                    `Balance polling: updated from ${previousBalance} to ${newBalance} ` +
                      `after ${delays
                        .slice(0, delayIndex + 1)
                        .reduce((a, b) => a + b, 0)}ms`,
                  );
                  previousBalance = newBalance;

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
                      tokens: balance.tokensObj || prev.tokens,
                    };
                  });
                  return;
                }
                pollBalance(delayIndex + 1);
              } catch (err) {
                console.log('Error in balance polling, continuing:', err);
                pollBalance(delayIndex + 1);
              }
            }, delays[delayIndex]);
          } catch (err) {
            console.log('Error in poll balance', err);
          }
        };

        pollBalance(0);
      } else {
        const balance = await getSparkBalance(currentMnemonicRef.current);

        if (updateType === 'paymentWrapperTx') {
          setSparkInformation(prev => {
            handleBalanceCache({
              isCheck: false,
              passedBalance: Math.round(
                (balance.didWork ? Number(balance.balance) : prev.balance) -
                  fee,
              ),
              mnemonic: currentMnemonicRef.current,
            });
            return {
              ...prev,
              transactions: txs || prev.transactions,
              balance: Math.round(
                (balance.didWork ? Number(balance.balance) : prev.balance) -
                  fee,
              ),
              tokens: balance.didWork ? balance.tokensObj : prev.tokens,
            };
          });
        } else if (updateType === 'fullUpdate') {
          setSparkInformation(prev => {
            handleBalanceCache({
              isCheck: false,
              passedBalance: balance.didWork
                ? Number(balance.balance)
                : prev.balance,
              mnemonic: currentMnemonicRef.current,
            });
            return {
              ...prev,
              balance: balance.didWork ? Number(balance.balance) : prev.balance,
              transactions: txs || prev.transactions,
              tokens: balance.didWork ? balance.tokensObj : prev.tokens,
            };
          });
        }
      }

      if (
        updateType === 'paymentWrapperTx' ||
        updateType === 'transactions' ||
        updateType === 'txStatusUpdate' ||
        updateType === 'lrc20Payments'
      ) {
        console.log(
          'Payment type is send payment, transaction, lrc20 first render, or txstatus update, skipping confirm tx page navigation',
        );
        return;
      }
      const [lastAddedTx] = await getAllSparkTransactions({
        accountId: sparkInfoRef.current.identityPubKey,
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

      if (new Date(details.time).getTime() < sessionTimeRef.current) {
        console.log(
          'created before session time was set, skipping confirm tx page navigation',
        );
        return;
      }

      if (isSendingPaymentRef.current) {
        console.log('Is sending payment, skipping confirm tx page navigation');
        return;
      }

      const isOnReceivePage =
        navigationRef
          .getRootState()
          .routes?.filter(item => item.name === 'ReceiveBTC').length === 1;

      const isNewestPayment = details?.createdTime
        ? new Date(details.createdTime).getTime() > newestPaymentTimeRef.current
        : false;

      let shouldShowConfirm = false;

      if (
        lastAddedTx.paymentType?.toLowerCase() === 'lightning' &&
        !details.isLNURL &&
        !details?.shouldNavigate &&
        isOnReceivePage &&
        isNewestPayment
      ) {
        shouldShowConfirm = true;
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
  };

  const transferHandler = (transferId, balance) => {
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
  };

  useEffect(() => {
    // setup listener for webview once
    console.log('adding web view listeners');
    if (incomingSparkTransaction.listenerCount(INCOMING_SPARK_TX_NAME)) {
      incomingSparkTransaction.removeAllListeners(INCOMING_SPARK_TX_NAME);
    }

    if (
      sparkTransactionsEventEmitter.listenerCount(SPARK_TX_UPDATE_ENVENT_NAME)
    ) {
      sparkTransactionsEventEmitter.removeAllListeners(
        SPARK_TX_UPDATE_ENVENT_NAME,
      );
    }

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    incomingSparkTransaction.on(INCOMING_SPARK_TX_NAME, transferHandler);
  }, []);

  const addListeners = async mode => {
    console.log('Adding Spark listeners...');
    if (AppState.currentState !== 'active') return;
    if (isRunningAddListeners.current) return;

    const walletHash = sha256Hash(currentMnemonicRef.current);
    isRunningAddListeners.current = true;
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
        await fullRestoreSparkState({
          sparkAddress: sparkInfoRef.current.sparkAddress,
          batchSize: isInitialRestore.current ? 5 : 2,
          isSendingPayment: isSendingPaymentRef.current,
          mnemonic: currentMnemonicRef.current,
          identityPubKey: sparkInfoRef.current.identityPubKey,
          sendWebViewRequest,
          isInitialRestore: isInitialRestore.current,
        });
      }

      await updateSparkTxStatus(
        currentMnemonicRef.current,
        sparkInfoRef.current.identityPubKey,
        sendWebViewRequest,
      );

      if (updatePendingPaymentsIntervalRef.current) {
        console.log('BLOCKING TRYING TO SET INTERVAL AGAIN');
        clearInterval(updatePendingPaymentsIntervalRef.current);
      }

      const capturedAuthKey = authResetKeyRef.current;
      const capturedMnemonic = currentMnemonicRef.current;

      updatePendingPaymentsIntervalRef.current = setInterval(async () => {
        try {
          if (capturedAuthKey !== authResetKeyRef.current) {
            console.log('Auth key changed. Aborting interval.');
            return;
          }

          if (capturedMnemonic !== currentMnemonicRef.current) {
            console.log('Mnemonic changed. Aborting interval.');
            return;
          }

          if (AppState.currentState !== 'active') {
            console.log('App not active. Skipping interval.');
            return;
          }

          await updateSparkTxStatus(
            currentMnemonicRef.current,
            sparkInfoRef.current.identityPubKey,
            sendWebViewRequest,
          );

          if (
            capturedAuthKey !== authResetKeyRef.current ||
            capturedMnemonic !== currentMnemonicRef.current
          ) {
            console.log(
              'Context changed during updateSparkTxStatus. Aborting getLRC20Transactions.',
            );
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
    }
    isRunningAddListeners.current = false;
  };

  const removeListeners = async (onlyClearIntervals = false) => {
    console.log('Removing spark listeners');
    if (!onlyClearIntervals) {
      const runtime = await selectSparkRuntime(currentMnemonicRef.current);
      if (!prevAccountMnemoincRef.current) {
        prevAccountMnemoincRef.current = currentMnemonicRef.current;
        return;
      }
      const hashedMnemoinc = sha256Hash(prevAccountMnemoincRef.current);

      if (runtime === 'native') {
        if (
          prevAccountMnemoincRef.current &&
          sparkWallet[hashedMnemoinc]?.listenerCount('transfer:claimed')
        ) {
          sparkWallet[hashedMnemoinc]?.removeAllListeners('transfer:claimed');
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
    currentPollingMnemonicRef.current = null;
  };

  const resetSparkState = useCallback(async () => {
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
    updatePendingPaymentsIntervalRef.current = null;
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
    currentPollingMnemonicRef.current = null;
    didRunInitialRestore.current = false;
    hasRestoreCompleted.current = false;

    // Reset state variables
    setSparkConnectionError(null);
    setSparkInformation({
      balance: 0,
      tokens: {},
      transactions: [],
      identityPubKey: '',
      sparkAddress: '',
      didConnect: null,
    });
    setPendingNavigation(null);
    setDidRunNormalConnection(false);
    setNormalConnectionTimeout(false);
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

            const findBitcoinTxResponse = await findSignleTxFromHistory(
              claimTx.transferId,
              5,
              currentMnemonicRef.current,
              sendWebViewRequest,
            );

            let updatedTx = {};
            if (!findBitcoinTxResponse.tx) {
              updatedTx = {
                useTempId: true,
                id: claimTx.transferId,
                tempId: quote.transactionId,
                paymentStatus: 'pending',
                paymentType: 'bitcoin',
                accountId: sparkInfoRef.current.identityPubKey,
              };
            } else {
              const { tx: bitcoinTransfer } = findBitcoinTxResponse;
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
      await addSingleSparkTransaction(pendingTx, 'transactions');
    };

    if (depositAddressIntervalRef.current) {
      clearInterval(depositAddressIntervalRef.current);
    }

    if (!initialBitcoinIntervalRun.current) {
      setTimeout(handleDepositAddressCheck, 1_000 * 5);
      initialBitcoinIntervalRun.current = true;
    }

    depositAddressIntervalRef.current = setInterval(
      handleDepositAddressCheck,
      1_000 * 60,
    );
  }, [
    sparkInformation.didConnect,
    didGetToHomepage,
    sparkInformation.identityPubKey,
  ]);

  // Run fullRestore when didConnect becomes true
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
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
  }, [sparkInformation.didConnect]);

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
    lastConnectedTimeRef.current = Date.now();
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
