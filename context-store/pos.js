import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {useKeysContext} from './keys';
import {db} from '../db/initializeFirebase';
import {
  DID_OPEN_TABLES_EVENT_NAME,
  getSavedPOSTransactions,
  pointOfSaleEventEmitter,
  POS_EVENT_UPDATE,
  queuePOSTransactions,
} from '../app/functions/pos';
import {getTwoWeeksAgoDate} from '../app/functions/rotateAddressDateChecker';
// Initiate context
const POSTransactionsContextManager = createContext(null);

const POSTransactionsProvider = ({children}) => {
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const [txList, setTxList] = useState([]);
  const [didOpenTable, setDidOpenTable] = useState(false);

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
        if (!tx.didPay) newUnpaidTxArray.push;

        totals[serverName] = {
          totalTipAmount:
            savedAccount.totalTipAmount + (tx.didPay ? 0 : tx.tipAmountSats),
          txs: [tx, ...savedAccount.txs],
          unpaidTxs: newUnpaidTxArray,
          lastActivity:
            tx.timestamp > savedAccount.lastActivity
              ? tx.timestamp
              : savedAccount.lastActivity,
          totalUnpaidTxs: savedAccount.totalUnpaidTxs + (!tx.didPay ? 1 : 0),
          totalPaidTxs: savedAccount.totalPaidTxs + (tx.didPay ? 1 : 0),
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
    if (!didOpenTable) return;
    if (!publicKey) return;
    console.log('running pos transactions listener...');
    const now = new Date().getTime();
    const unsubscribe = db
      .collection('posTransactions')
      .where('storePubKey', '==', publicKey)
      .orderBy('dateAdded')
      .startAfter(now)
      .onSnapshot(snapshot => {
        snapshot?.docChanges()?.forEach(async change => {
          console.log('recived a new message', change.type);
          if (change.type === 'added') {
            const newTX = change.doc.data();
            queuePOSTransactions({
              transactionsList: [newTX],
              privateKey: contactsPrivateKey,
            });
          }
        });
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [publicKey, didOpenTable]);

  useEffect(() => {
    async function loadSavedTxs() {
      const txs = await updateTxListFunction();
      console.log('saved pos transactions', txs);
      const lastMessageTimestamp = txs.length
        ? txs[0]?.dbDateAdded
        : getTwoWeeksAgoDate();

      console.log('last pos transaction timestamp', txs[0]?.dbDateAdded);

      const missedMessags = await db
        .collection('posTransactions')
        .where('storePubKey', '==', publicKey)
        .where('dateAdded', '>', lastMessageTimestamp)
        .get();

      if (missedMessags.empty) {
        return;
      }

      let messsageList = [];

      for (const doc of missedMessags.docs) {
        const data = doc.data();
        messsageList.push(data);
      }
      console.log('loaded missed pos transactions', messsageList);
      queuePOSTransactions({
        transactionsList: messsageList,
        privateKey: contactsPrivateKey,
      });
    }
    if (!didOpenTable) return;
    if (!publicKey) return;
    loadSavedTxs();
  }, [publicKey, didOpenTable]);

  const handlePosTableOpen = useCallback(eventType => {
    if (eventType === 'opened') {
      setDidOpenTable(true);
    }
  }, []);
  useEffect(() => {
    // listens for events from the db and updates the state
    pointOfSaleEventEmitter.on(DID_OPEN_TABLES_EVENT_NAME, handlePosTableOpen);
    pointOfSaleEventEmitter.on(POS_EVENT_UPDATE, updateTxListFunction);
    return () => {
      pointOfSaleEventEmitter.off(POS_EVENT_UPDATE, updateTxListFunction);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      groupedTxs,
    }),
    [groupedTxs],
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
