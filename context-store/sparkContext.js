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
  getSparkLightningPaymentStatus,
  getSparkStaticBitcoinL1AddressQuote,
  getSparkTransactions,
  queryAllStaticDepositAddresses,
  sparkWallet,
  sparkPaymentType,
} from '../app/functions/spark';
import {
  addSingleSparkTransaction,
  bulkUpdateSparkTransactions,
  deleteUnpaidSparkLightningTransaction,
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

import {breezLiquidLNAddressPaymentWrapper} from '../app/functions/breezLiquid';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
import {AppState} from 'react-native';
import getDepositAddressTxIds, {
  handleTxIdState,
} from '../app/functions/spark/getDepositAdressTxIds';
import {useKeysContext} from './keys';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import {navigationRef} from '../navigation/navigationService';

// Initiate context
const SparkWalletManager = createContext(null);
const sessionTime = new Date().getTime();
const SparkWalletProvider = ({children}) => {
  const {accountMnemoinc, contactsPrivateKey, publicKey} = useKeysContext();
  const {didGetToHomepage, minMaxLiquidSwapAmounts} = useAppStatus();
  const {liquidNodeInformation} = useNodeContext();
  const {toggleGlobalContactsInformation, globalContactsInformation} =
    useGlobalContacts();

  const [sparkInformation, setSparkInformation] = useState({
    balance: 0,
    transactions: [],
    identityPubKey: '',
    sparkAddress: '',
    didConnect: null,
  });
  const [numberOfIncomingLNURLPayments, setNumberOfIncomingLNURLPayments] =
    useState(0);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const [numberOfCachedTxs, setNumberOfCachedTxs] = useState(0);
  const [currentAppState, setCurrentAppState] = useState('');

  // Debounce refs
  const debounceTimeoutRef = useRef(null);
  const pendingTransferIds = useRef(new Set());

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
        const singleTxResponse = await findSignleTxFromHistory(recevedTxId, 50);
        if (!singleTxResponse.tx)
          throw new Error('Unable to find tx in all of history');
        selectedSparkTransaction = singleTxResponse.tx;
      }

      console.log(
        selectedSparkTransaction,
        'received transaction from spark tx list',
      );
      let paymentObject = {};
      const paymentType = sparkPaymentType(selectedSparkTransaction);
      if (paymentType === 'lightning') {
        const unpaidInvoices = await getAllUnpaidSparkLightningInvoices();
        console.log(unpaidInvoices);
        const posibleOptions = unpaidInvoices.filter(
          unpaidInvoice =>
            unpaidInvoice.amount == selectedSparkTransaction.totalValue,
        );
        let matchedUnpaidInvoice = null;
        let savedInvoice = null;
        for (const invoice of posibleOptions) {
          console.log('Checking invoice', invoice);
          let paymentDetials;
          let attempts = 0;
          // Try up to 5 times with 1 second delay if transfer is undefined
          while (attempts < 5) {
            const result = await getSparkLightningPaymentStatus({
              lightningInvoiceId: invoice.sparkID,
            });
            // If transfer is defined, assign and break out of while loop
            if (result?.transfer !== undefined) {
              paymentDetials = result;
              break;
            }
            // Wait 1 second before next attempt
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          // If paymentDetials is still undefined after 5 tries, continue to next invoice
          if (!paymentDetials || !paymentDetials.transfer) continue;
          console.log(paymentDetials, 'payment details');
          if (paymentDetials.transfer.sparkId === recevedTxId) {
            savedInvoice = invoice;
            matchedUnpaidInvoice = paymentDetials;
            break;
          }
        }
        if (savedInvoice) {
          // removes invoice from the unpaid list
          deleteUnpaidSparkLightningTransaction(savedInvoice.sparkID);
        }
        const details = savedInvoice?.details
          ? JSON.parse(savedInvoice?.details)
          : {};
        paymentObject = {
          id: recevedTxId,
          paymentStatus: 'completed',
          paymentType: 'lightning',
          accountId: selectedSparkTransaction.receiverIdentityPublicKey,
          details: {
            fee: 0,
            amount: selectedSparkTransaction.totalValue,
            address: matchedUnpaidInvoice?.invoice?.encodedInvoice || '',
            time: new Date().getTime(),
            direction: 'INCOMING',
            description: savedInvoice?.description || '',
            preimage: matchedUnpaidInvoice?.paymentPreimage || '',
            shouldNavigate:
              savedInvoice?.shouldNavigate === undefined
                ? 0 //if not specified navigate to confirm screen
                : savedInvoice?.shouldNavigate,
            isLNULR: details?.isLNURL || false,
          },
        };
        console.log('lightning payment object', paymentObject);
      } else if (paymentType === 'spark') {
        paymentObject = {
          id: recevedTxId,
          paymentStatus: 'completed',
          paymentType: 'spark',
          accountId: selectedSparkTransaction.receiverIdentityPublicKey,
          details: {
            fee: 0,
            amount: selectedSparkTransaction.totalValue,
            address: sparkInformation.sparkAddress,
            time: new Date().getTime(),
            direction: 'INCOMING',
            senderIdentityPublicKey:
              selectedSparkTransaction.senderIdentityPublicKey,
            description: '',
          },
        };
      }
      //Don't need to do anything here for bitcoin This gets hanldes by the payment state update which will turn it from pending to confirmed once one confirmation happens

      if (!selectedSparkTransaction)
        throw new Error('Not able to get recent transfer');
      await bulkUpdateSparkTransactions(
        [paymentObject],
        'incomingPayment',
        0,
        balance,
      );
      const savedTxs = await getAllSparkTransactions();
      return {
        txs: savedTxs,
        paymentObject,
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
      setSparkInformation(prev => ({
        ...prev,
        balance: balance,
      }));

      return;
    }
    const selectedStoredPayment = storedTransaction.txs.find(
      tx => tx.sparkID === transferId,
    );

    const details = JSON.parse(selectedStoredPayment.details);

    if (details?.shouldNavigate && !details.isLNULR) return;
    if (
      details.isLNULR &&
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
      const transactions = await getSparkTransactions(10, undefined);
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
    [navigationRef],
  );

  const handleUpdate = async (...args) => {
    try {
      const [updateType = 'transactions', fee = 0, passedBalance = 0] = args;
      console.log(
        'running update in spark context from db changes',
        updateType,
      );
      const txs = await getAllSparkTransactions();
      if (updateType === 'supportTx') {
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
        }));
        return;
      }
      if (updateType === 'incomingPayment') {
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
          balance: passedBalance,
        }));
        return;
      }
      const balance = await getSparkBalance();

      if (updateType === 'paymentWrapperTx') {
        setSparkInformation(prev => ({
          ...prev,
          transactions: txs || prev.transactions,
          balance: Math.round((Number(balance?.balance) || prev.balance) - fee),
        }));
      } else {
        setSparkInformation(prev => ({
          ...prev,
          balance: Number(balance?.balance) || prev.balance,
          transactions: txs || prev.transactions,
        }));
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

  const addListeners = async () => {
    console.log('Adding Spark listeners...');

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    sparkWallet.on('transfer:claimed', transferHandler);
    // sparkWallet.on('deposit:confirmed', transferHandler);

    await updateSparkTxStatus();
    if (updatePendingPaymentsIntervalRef.current) {
      console.log('BLOCKING TRYING TO SET INTERVAL AGAIN');
      return;
    }
    updatePendingPaymentsIntervalRef.current = setInterval(async () => {
      try {
        await updateSparkTxStatus();
      } catch (err) {
        console.error('Error during periodic restore:', err);
      }
    }, 10 * 1000);
  };

  const removeListeners = () => {
    console.log('Removing spark listeners');
    sparkTransactionsEventEmitter.removeAllListeners(
      SPARK_TX_UPDATE_ENVENT_NAME,
    );
    sparkWallet?.removeAllListeners('transfer:claimed');
    // sparkWallet.off('deposit:confirmed', transferHandler);

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

  // Add event listeners to listen for bitcoin and lightning or spark transfers when receiving does not handle sending
  useEffect(() => {
    if (!currentAppState) return;
    if (currentAppState === 'active') {
      addListeners();
    } else if (currentAppState.match(/inactive|background/)) {
      removeListeners();
    }
  }, [currentAppState]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    const handleAppStateChange = nextAppState => {
      setCurrentAppState(nextAppState);
    };
    AppState.addEventListener('change', handleAppStateChange);
    // Add on mount if app is already active
    if (AppState.currentState === 'active') {
      setCurrentAppState('active');
    }
  }, [sparkInformation.didConnect, didGetToHomepage]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    // Interval to check deposit addresses to see if they were paid
    const handleDepositAddressCheck = async () => {
      try {
        console.log('l1Deposit check running....');
        const allTxs = await getAllSparkTransactions();
        const savedTxMap = new Map(allTxs.map(tx => [tx.sparkID, tx]));
        const depoistAddress = await queryAllStaticDepositAddresses();
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
              await getSparkStaticBitcoinL1AddressQuote(txid.txid);
            console.log('Deposit address quote:', quote);
            if (!didwork) {
              console.log(error, 'Error getting deposit address quote');
              if (
                error.includes('UTXO is already claimed by the current user.')
              ) {
                await handleTxIdState(txid, true, address);
              }
              continue;
            }
            if (claimedTxs?.includes(quote.signature)) {
              await handleTxIdState(txid, true, address);
              continue;
            }
            const hasAlreadySaved = savedTxMap.has(quote.transactionId);
            console.log('Has already saved transaction:', hasAlreadySaved);
            if (!hasAlreadySaved) {
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
                  description: 'Deposit address payment',
                  onChainTxid: quote.transactionId,
                  isRestore: true, // This is a restore payment
                },
              };
              await addSingleSparkTransaction(pendingTx);
            }
            // If the address has been paid, claim the transaction
            const claimTx = await claimnSparkStaticDepositAddress({
              ...quote,
              sspSignature: quote.signature,
            });
            if (!claimTx) continue;
            console.log('Claimed deposit address transaction:', claimTx);
            if (!claimedTxs?.includes(quote.signature)) {
              claimedTxs.push(quote.signature);
              await setLocalStorageItem(
                'claimedBitcoinTxs',
                JSON.stringify(claimedTxs),
              );
            }
            await new Promise(res => setTimeout(res, 2000));
            const incomingTxs = await getSparkTransactions(999);
            const bitcoinTransfer = incomingTxs.transfers.find(
              tx => tx.id === claimTx.transferId,
            );
            const updatedTx = bitcoinTransfer
              ? {
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
                }
              : {
                  useTempId: true,
                  id: claimTx.transferId,
                  tempId: quote.transactionId,
                  paymentStatus: 'pending',
                  paymentType: 'bitcoin',
                  accountId: sparkInformation.identityPubKey,
                };
            await bulkUpdateSparkTransactions([updatedTx]);
            console.log('Updated bitcoin transaction:', updatedTx);
          }
        }
      } catch (err) {
        console.log('Handle deposit address check error', err);
      }
    };
    if (depositAddressIntervalRef.current) {
      clearInterval(depositAddressIntervalRef.current);
    }
    setTimeout(handleDepositAddressCheck, 1_000 * 5);
    depositAddressIntervalRef.current = setInterval(
      handleDepositAddressCheck,
      1_000 * 60,
    );
  }, [sparkInformation.didConnect, didGetToHomepage]);

  useEffect(() => {
    // This function runs once per load and check to see if a user received any payments while offline. It also starts a timeout to update payment status of paymetns every 30 seconds.
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;

    const restoreTxState = async () => {
      const isFirstWalletLoad = await getLocalStorageItem('isFirstWalletLoad');
      console.log(isFirstWalletLoad, 'is first wallet load');
      if (isFirstWalletLoad === 'true') return;
      await setLocalStorageItem('isFirstWalletLoad', 'true');
      await fullRestoreSparkState({
        sparkAddress: sparkInformation.sparkAddress,
      });
    };
    restoreTxState();
  }, [didGetToHomepage, sparkInformation.didConnect]);

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        const {didWork} = await initWallet({
          setSparkInformation,
          // toggleGlobalContactsInformation,
          // globalContactsInformation,
          mnemonic: accountMnemoinc,
        });
        console.log(didWork, 'did connect to spark wallet in context');
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
          const parsed = await parse(
            `${globalContactsInformation.myProfile.uniqueName}@blitz-wallet.com`,
          );

          await breezLiquidLNAddressPaymentWrapper({
            description: 'Liquid to Spark Swap',
            paymentInfo: parsed.data,
            shouldDrain: true,
          });
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
      numberOfIncomingLNURLPayments,
      setNumberOfIncomingLNURLPayments,
      numberOfCachedTxs,
      setNumberOfCachedTxs,
      connectToSparkWallet,
    }),
    [
      sparkInformation,
      setSparkInformation,
      pendingNavigation,
      setPendingNavigation,
      numberOfIncomingLNURLPayments,
      setNumberOfIncomingLNURLPayments,
      numberOfCachedTxs,
      setNumberOfCachedTxs,
      connectToSparkWallet,
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
