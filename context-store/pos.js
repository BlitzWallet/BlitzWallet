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
  getSavedPOSTransactions,
  queuePOSTransactions,
} from '../app/functions/pos';
import {getTwoWeeksAgoDate} from '../app/functions/rotateAddressDateChecker';
// Initiate context
const POSTransactionsContextManager = createContext(null);

const POSTransactionsProvider = ({children}) => {
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const [txList, setTxList] = useState([]);

  const updateTxListFunction = useCallback(async () => {
    const txs = await getSavedPOSTransactions();
    setTxList(txs || []);
    return txs || [];
  }, []);

  useEffect(() => {
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
              updateTxListFunction,
            });
          }
        });
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [publicKey]);

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
        updateTxListFunction,
      });
    }
    if (!publicKey) return;
    loadSavedTxs();
  }, [publicKey]);

  const contextValue = useMemo(
    () => ({
      txList,
    }),
    [txList],
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
