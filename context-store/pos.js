import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useKeysContext } from './keys';
import { db } from '../db/initializeFirebase';
import {
  DID_OPEN_TABLES_EVENT_NAME,
  getSavedPOSTransactions,
  isSavedPOSTxsDatabaseOpen,
  pointOfSaleEventEmitter,
  POS_EVENT_UPDATE,
  queuePOSTransactions,
} from '../app/functions/pos';
import { getTwoWeeksAgoDate } from '../app/functions/rotateAddressDateChecker';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from '@react-native-firebase/firestore';
// Initiate context
const POSTransactionsContextManager = createContext(null);

const POSTransactionsProvider = ({ children }) => {
  const { publicKey, contactsPrivateKey } = useKeysContext();
  const [txList, setTxList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const didOpenTable = isSavedPOSTxsDatabaseOpen();

  const updateTxListFunction = useCallback(async () => {
    const txs = await getSavedPOSTransactions();
    setTxList(txs || []);
    return txs || [];
  }, []);

  const groupedTxs = useMemo(() => {
    try {
      let totals = {};
      for (const tx of txList) {
        const serverName = tx.serverName?.toLowerCase()?.trim();
        let savedAccount = totals[serverName];
        if (!savedAccount) {
          totals[serverName] = {
            totalTipAmount: 0,
            txs: [],
            unpaidTxs: [],
            lastActivity: 0,
            totalUnpaidTxs: 0,
            totalPaidTxs: 0,
          };
        }
        savedAccount = totals[serverName];

        let newUnpaidTxArray = [...savedAccount.unpaidTxs];
        if (!tx.didPay) newUnpaidTxArray.push(tx);

        totals[serverName] = {
          totalTipAmount:
            savedAccount.totalTipAmount + (tx.didPay ? 0 : tx.tipAmountSats),
          txs: [tx, ...savedAccount.txs],
          unpaidTxs: newUnpaidTxArray,
          lastActivity:
            tx.timestamp > savedAccount.lastActivity
              ? tx.timestamp
              : savedAccount.lastActivity,
          totalUnpaidTxs:
            savedAccount.totalUnpaidTxs + (!tx.didPay ? tx.tipAmountSats : 0),
          totalPaidTxs:
            savedAccount.totalPaidTxs + (!!tx.didPay ? tx.tipAmountSats : 0),
        };
      }

      if (!Object.keys(totals).length) {
        return [];
      }

      return Object.entries(totals);
    } catch (err) {
      console.log('getting tip totals error', err);
      return [];
    }
  }, [txList]);

  useEffect(() => {
    if (!didOpenTable || !publicKey) return;

    let unsubscribe;

    async function initListener() {
      const txs = await updateTxListFunction();
      const lastTimestamp = txs.length
        ? txs[0]?.dbDateAdded
        : getTwoWeeksAgoDate();

      const catchUpQuery = query(
        collection(db, 'posTransactions'),
        where('storePubKey', '==', publicKey),
        where('dateAdded', '>', lastTimestamp),
        orderBy('dateAdded'),
      );

      unsubscribe = onSnapshot(catchUpQuery, snapshot => {
        const newTxs = [];

        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            newTxs.push(change.doc.data());
          }
        });

        if (!newTxs.length) return;

        console.log(
          'received pos transactions (catch-up + live):',
          newTxs.length,
        );
        queuePOSTransactions({
          transactionsList: newTxs,
          privateKey: contactsPrivateKey,
        });
      });

      setIsLoading(false);
    }

    initListener();

    return () => {
      console.log('unsubscribing pos transactions listener...', !!unsubscribe);
      if (unsubscribe) unsubscribe();
    };
  }, [publicKey, didOpenTable]);

  useEffect(() => {
    // listens for events from the db and updates the state
    pointOfSaleEventEmitter.on(POS_EVENT_UPDATE, updateTxListFunction);
    return () => {
      pointOfSaleEventEmitter.removeAllListeners(POS_EVENT_UPDATE);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      groupedTxs,
      isLoading,
    }),
    [groupedTxs, isLoading],
  );

  return (
    <POSTransactionsContextManager.Provider value={contextValue}>
      {children}
    </POSTransactionsContextManager.Provider>
  );
};

function usePOSTransactions() {
  const context = useContext(POSTransactionsContextManager);
  if (!context) {
    throw new Error(
      'usePOSTransactions must be used within a POSTransactionsProvider',
    );
  }
  return context;
}

export {
  POSTransactionsContextManager,
  POSTransactionsProvider,
  usePOSTransactions,
};
