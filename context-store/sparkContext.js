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
  getSparkBalance,
  getSparkStaticBitcoinL1AddressQuote,
  getSparkTransactions,
  queryAllStaticDepositAddresses,
  sparkWallet,
} from '../app/functions/spark';
import {
  addSingleSparkTransaction,
  bulkUpdateSparkTransactions,
  getAllSparkTransactions,
  getAllUnpaidSparkLightningInvoices,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../app/functions/spark/transactions';
import {useAppStatus} from './appStatus';
import {
  findSignleTxFromHistory,
  fullRestoreSparkState,
  updateSparkTxStatus,
} from '../app/functions/spark/restore';
import {useGlobalContacts} from './globalContacts';
import {initWallet} from '../app/functions/initiateWalletConnection';
import {useNodeContext} from './nodeContext';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
import {AppState} from 'react-native';
import getDepositAddressTxIds, {
  handleTxIdState,
} from '../app/functions/spark/getDepositAdressTxIds';
import {useKeysContext} from './keys';
import {navigationRef} from '../navigation/navigationService';
import {transformTxToPaymentObject} from '../app/functions/spark/transformTxToPayment';
import handleBalanceCache from '../app/functions/spark/handleBalanceCache';
import liquidToSparkSwap from '../app/functions/spark/liquidToSparkSwap';
import EventEmitter from 'events';
import {getLRC20Transactions} from '../app/functions/lrc20';
import {useActiveCustodyAccount} from './activeAccount';
import sha256Hash from '../app/functions/hash';
import i18n from 'i18next';

export const isSendingPayingEventEmiiter = new EventEmitter();
export const SENDING_PAYMENT_EVENT_NAME = 'SENDING_PAYMENT_EVENT';

// Initiate context
const SparkWalletManager = createContext(null);

const SparkWalletProvider = ({children}) => {
  const {accountMnemoinc, contactsPrivateKey, publicKey} = useKeysContext();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {didGetToHomepage, minMaxLiquidSwapAmounts, appState} = useAppStatus();
  const {liquidNodeInformation} = useNodeContext();
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const {toggleGlobalContactsInformation, globalContactsInformation} =
    useGlobalContacts();
  const prevAccountMnemoincRef = useRef(null);
  const [sparkConnectionError, setSparkConnectionError] = useState(null);
  const [sparkInformation, setSparkInformation] = useState({
    balance: 0,
    tokens: {},
    transactions: [],
    identityPubKey: '',
    sparkAddress: '',
    didConnect: null,
  });
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [pendingLiquidPayment, setPendingLiquidPayment] = useState(null);
  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const isInitialRestore = useRef(true);
  const isInitialLRC20Run = useRef(true);
  const didInitializeSendingPaymentEvent = useRef(false);
  const initialBitcoinIntervalRun = useRef(null);
  const [numberOfCachedTxs, setNumberOfCachedTxs] = useState(0);

  const sessionTime = useMemo(() => {
    return Date.now();
  }, [currentWalletMnemoinc]);

  // Debounce refs
  const debounceTimeoutRef = useRef(null);
  const pendingTransferIds = useRef(new Set());

  const toggleIsSendingPayment = isSending => {
    setIsSendingPayment(isSending);
  };

  useEffect(() => {
    if (didInitializeSendingPaymentEvent.current) return;
    didInitializeSendingPaymentEvent.current = true;

    isSendingPayingEventEmiiter.addListener(
      SENDING_PAYMENT_EVENT_NAME,
      toggleIsSendingPayment,
    );
  }, []);

  // This is a function that handles incoming transactions and formats it to required format
  const handleTransactionUpdate = async (
    recevedTxId,
    transactions,
    balance,
  ) => {
    try {
      if (!transactions)
        throw new Error('Unable to get transactions from spark');
      const {transfers} = transactions;
      let selectedSparkTransaction = transfers.find(
        tx => tx.id === recevedTxId,
      );

      if (!selectedSparkTransaction) {
        console.log('Running full history sweep');
        const singleTxResponse = await findSignleTxFromHistory(
          recevedTxId,
          25,
          currentWalletMnemoinc,
        );
        if (!singleTxResponse.tx)
          throw new Error('Unable to find tx in all of history');
        selectedSparkTransaction = singleTxResponse.tx;
      }

      console.log(
        selectedSparkTransaction,
        'received transaction from spark tx list',
      );
      if (!selectedSparkTransaction)
        throw new Error('Not able to get recent transfer');

      const unpaidInvoices = await getAllUnpaidSparkLightningInvoices();
      const paymentObject = await transformTxToPaymentObject(
        selectedSparkTransaction,
        sparkInformation.sparkAddress,
        undefined,
        false,
        unpaidInvoices,
        sparkInformation.identityPubKey,
      );

      if (paymentObject) {
        await bulkUpdateSparkTransactions(
          [paymentObject],
          'incomingPayment',
          0,
          balance,
        );
      }

      const savedTxs = await getAllSparkTransactions({
        limit: 5,
        accountId: sparkInformation.identityPubKey,
      });
      return {
        txs: savedTxs,
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
        mnemonic: currentWalletMnemoinc,
      });
      setSparkInformation(prev => ({
        ...prev,
        balance: balance,
      }));

      return;
    }
    const selectedStoredPayment = storedTransaction.txs.find(
      tx => tx.sparkID === transferId,
    );

    if (!selectedStoredPayment) return;

    const details = JSON.parse(selectedStoredPayment.details);
    if (details?.shouldNavigate && !details.isLNURL) return;
    if (
      details.isLNURL &&
      !details.isBlitzContactPayment &&
      navigationRef
        .getRootState()
        .routes?.filter(item => item.name === 'ReceiveBTC').length !== 1
    )
      return;
    if (details.isRestore) return;
    if (storedTransaction.paymentCreatedTime < sessionTime) return;
    // Handle confirm animation here
    setPendingNavigation({
      routes: [
        {
          name: 'HomeAdmin',
          params: {screen: 'Home'},
        },
        {
          name: 'ConfirmTxPage',
          params: {
            for: 'invoicePaid',
            transaction: {...selectedStoredPayment, details},
          },
        },
      ],
    });
  };

  // Debounced version of handleIncomingPayment
  const debouncedHandleIncomingPayment = useCallback(
    async balance => {
      if (pendingTransferIds.current.size === 0) return;

      const transferIdsToProcess = Array.from(pendingTransferIds.current);
      pendingTransferIds.current.clear();

      console.log(
        'Processing debounced incoming payments:',
        transferIdsToProcess,
      );
      const transactions = await getSparkTransactions(
        1,
        undefined,
        currentWalletMnemoinc,
      );
      // Process all pending transfer IDs
      for (const transferId of transferIdsToProcess) {
        try {
          await handleIncomingPayment(transferId, transactions, balance);
        } catch (error) {
          console.error(
            'Error processing incoming payment:',
            transferId,
            error,
          );
        }
      }
    },
    [navigationRef, currentWalletMnemoinc, sparkInformation.identityPubKey],
  );

  const handleUpdate = async (...args) => {
    try {
      const [updateType = 'transactions', fee = 0, passedBalance = 0] = args;
      console.log(
        'running update in spark context from db changes',
        updateType,
      );
      const txs = await getAllSparkTransactions({
        limit: 50,
        accountId: sparkInformation.identityPubKey,
      });
      if (
        updateType === 'supportTx' ||
        updateType === 'restoreTxs' ||
        updateType === 'transactions'
      ) {
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
        }));
        return;
      }
      if (updateType === 'incomingPayment') {
        handleBalanceCache({
          isCheck: false,
          passedBalance: Number(passedBalance),
          mnemonic: currentWalletMnemoinc,
        });
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
          balance: Number(passedBalance),
        }));
        return;
      }
      const balance = await getSparkBalance(currentWalletMnemoinc);

      if (updateType === 'paymentWrapperTx') {
        setSparkInformation(prev => {
          handleBalanceCache({
            isCheck: false,
            passedBalance: Math.round(
              (balance.didWork ? Number(balance.balance) : prev.balance) - fee,
            ),
            mnemonic: currentWalletMnemoinc,
          });
          return {
            ...prev,
            transactions: txs || prev.transactions,
            balance: Math.round(
              (balance.didWork ? Number(balance.balance) : prev.balance) - fee,
            ),
            tokens: balance.tokensObj,
          };
        });
      } else if (updateType === 'fullUpdate') {
        setSparkInformation(prev => {
          handleBalanceCache({
            isCheck: false,
            passedBalance: balance.didWork
              ? Number(balance.balance)
              : prev.balance,
            mnemonic: currentWalletMnemoinc,
          });
          return {
            ...prev,
            balance: balance.didWork ? Number(balance.balance) : prev.balance,
            transactions: txs || prev.transactions,
            tokens: balance.tokensObj,
          };
        });
      }
    } catch (err) {
      console.log('error in spark handle db update function', err);
    }
  };

  const transferHandler = (transferId, balance) => {
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

  const addListeners = async mode => {
    console.log('Adding Spark listeners...');
    if (AppState.currentState !== 'active') return;

    sparkTransactionsEventEmitter.removeAllListeners(
      SPARK_TX_UPDATE_ENVENT_NAME,
    );
    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);

    if (mode === 'full') {
      sparkWallet[sha256Hash(currentWalletMnemoinc)].on(
        'transfer:claimed',
        transferHandler,
      );

      if (isInitialRestore.current) {
        isInitialRestore.current = false;
      }

      await fullRestoreSparkState({
        sparkAddress: sparkInformation.sparkAddress,
        batchSize: isInitialRestore.current ? 15 : 5,
        isSendingPayment: isSendingPayment,
        mnemonic: currentWalletMnemoinc,
        identityPubKey: sparkInformation.identityPubKey,
      });

      await updateSparkTxStatus(
        currentWalletMnemoinc,
        sparkInformation.identityPubKey,
      );

      if (updatePendingPaymentsIntervalRef.current) {
        console.log('BLOCKING TRYING TO SET INTERVAL AGAIN');
        clearInterval(updatePendingPaymentsIntervalRef.current);
      }
      updatePendingPaymentsIntervalRef.current = setInterval(async () => {
        try {
          await updateSparkTxStatus(
            currentWalletMnemoinc,
            sparkInformation.identityPubKey,
          );
          await getLRC20Transactions({
            ownerPublicKeys: [sparkInformation.identityPubKey],
            sparkAddress: sparkInformation.sparkAddress,
            isInitialRun: isInitialLRC20Run.current,
            mnemonic: currentWalletMnemoinc,
          });
          if (isInitialLRC20Run.current) {
            isInitialLRC20Run.current = false;
          }
        } catch (err) {
          console.error('Error during periodic restore:', err);
        }
      }, 10 * 1000);
    }
  };

  const removeListeners = () => {
    console.log('Removing spark listeners');
    console.log(
      sparkTransactionsEventEmitter.listenerCount(SPARK_TX_UPDATE_ENVENT_NAME),
      'Nymber of event emiitter litsenrs',
    );

    if (
      sparkTransactionsEventEmitter.listenerCount(SPARK_TX_UPDATE_ENVENT_NAME)
    ) {
      sparkTransactionsEventEmitter.removeAllListeners(
        SPARK_TX_UPDATE_ENVENT_NAME,
      );
    }
    if (
      prevAccountMnemoincRef.current &&
      sparkWallet[sha256Hash(prevAccountMnemoincRef.current)].listenerCount(
        'transfer:claimed',
      )
    ) {
      sparkWallet[
        sha256Hash(prevAccountMnemoincRef.current)
      ]?.removeAllListeners('transfer:claimed');
    }
    prevAccountMnemoincRef.current = currentWalletMnemoinc;

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
  };

  // Add event listeners to listen for bitcoin and lightning or spark transfers when receiving only when screen is active
  useEffect(() => {
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;

    const shouldHaveListeners = appState === 'active' && !isSendingPayment;
    const shouldHaveSparkEventEmitter = appState === 'active';

    removeListeners();

    if (shouldHaveListeners) {
      addListeners('full');
    } else if (shouldHaveSparkEventEmitter && isSendingPayment) {
      addListeners('sparkOnly');
    }
  }, [
    appState,
    sparkInformation.didConnect,
    didGetToHomepage,
    isSendingPayment,
    currentWalletMnemoinc,
  ]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;

    // Interval to check deposit addresses to see if they were paid
    const handleDepositAddressCheck = async () => {
      try {
        console.log('l1Deposit check running....');
        if (AppState.currentState !== 'active') return;
        const allTxs = await getAllSparkTransactions({
          accountId: sparkInformation.identityPubKey,
        });
        const savedTxMap = new Map(allTxs.map(tx => [tx.sparkID, tx]));
        const depoistAddress = await queryAllStaticDepositAddresses(
          currentWalletMnemoinc,
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
            const {didwork, quote, error} =
              await getSparkStaticBitcoinL1AddressQuote(
                txid.txid,
                currentWalletMnemoinc,
              );
            const hasAlreadySaved = savedTxMap.has(txid.txid);

            if (!txid.isConfirmed) {
              if (!hasAlreadySaved) {
                await addPendingTransaction(
                  {
                    transactionId: txid.txid,
                    creditAmountSats: txid.amount - txid.fee,
                  },
                  address,
                  sparkInformation,
                );
              }
            }

            if (!didwork || !quote) {
              console.log(error, 'Error getting deposit address quote');
              if (
                error.includes('UTXO is already claimed by the current user.')
              ) {
                await handleTxIdState(txid, true, address);
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
              mnemonic: currentWalletMnemoinc,
            });

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

            // Add pending transaction if not already saved (after successful claim)
            if (!hasAlreadySaved) {
              await addPendingTransaction(quote, address, sparkInformation);
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
              currentWalletMnemoinc,
            );

            let updatedTx = {};
            if (!findBitcoinTxResponse.tx) {
              updatedTx = {
                useTempId: true,
                id: claimTx.transferId,
                tempId: quote.transactionId,
                paymentStatus: 'pending',
                paymentType: 'bitcoin',
                accountId: sparkInformation.identityPubKey,
              };
            } else {
              const {tx: bitcoinTransfer} = findBitcoinTxResponse;
              if (!bitcoinTransfer) {
                updatedTx = {
                  useTempId: true,
                  id: claimTx.transferId,
                  tempId: quote.transactionId,
                  paymentStatus: 'pending',
                  paymentType: 'bitcoin',
                  accountId: sparkInformation.identityPubKey,
                };
              } else {
                updatedTx = {
                  useTempId: true,
                  tempId: quote.transactionId,
                  id: bitcoinTransfer.id,
                  paymentStatus: 'completed',
                  paymentType: 'bitcoin',
                  accountId: sparkInformation.identityPubKey,
                  details: {
                    amount: bitcoinTransfer.totalValue,
                    fee: Math.abs(
                      quote.creditAmountSats - bitcoinTransfer.totalValue,
                    ),
                  },
                };
              }
            }

            await bulkUpdateSparkTransactions([updatedTx]);
            console.log('Updated bitcoin transaction:', updatedTx);
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
      await addSingleSparkTransaction(pendingTx);
    };

    if (depositAddressIntervalRef.current) {
      clearInterval(depositAddressIntervalRef.current);
    }

    if (isSendingPayment) return;

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
    isSendingPayment,
    currentWalletMnemoinc,
  ]);

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        const {didWork, error} = await initWallet({
          setSparkInformation,
          // toggleGlobalContactsInformation,
          // globalContactsInformation,
          mnemonic: accountMnemoinc,
        });
        if (!didWork) {
          setSparkInformation(prev => ({...prev, didConnect: false}));
          setSparkConnectionError(error);
          console.log('Error connecting to spark wallet:', error);
          return;
        }
      });
    });
  }, [accountMnemoinc]);

  // Function to update db when all reqiured information is loaded
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!globalContactsInformation?.myProfile) return;

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
  }, [globalContactsInformation.myProfile, sparkInformation]);

  // This function checks to see if there are any liquid funds that need to be sent to spark
  useEffect(() => {
    async function swapLiquidToSpark() {
      try {
        if (liquidNodeInformation.userBalance > minMaxLiquidSwapAmounts.min) {
          setPendingLiquidPayment(true);
          await liquidToSparkSwap(
            globalContactsInformation.myProfile.uniqueName,
          );
        }
      } catch (err) {
        console.log('transfering liquid to spark error', err);
      }
    }
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    swapLiquidToSpark();
  }, [
    didGetToHomepage,
    liquidNodeInformation,
    minMaxLiquidSwapAmounts,
    sparkInformation.didConnect,
    globalContactsInformation?.myProfile?.uniqueName,
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
      numberOfCachedTxs,
      setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      pendingLiquidPayment,
      setPendingLiquidPayment,
    }),
    [
      sparkInformation,
      setSparkInformation,
      pendingNavigation,
      setPendingNavigation,
      numberOfCachedTxs,
      setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      pendingLiquidPayment,
      setPendingLiquidPayment,
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

export {SparkWalletManager, SparkWalletProvider, useSparkWallet};
