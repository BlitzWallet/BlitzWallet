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
import {useAppStatus} from './appStatus';
import {getTwoWeeksAgoDate} from '../app/functions/rotateAddressDateChecker';
// Initiate context
const POSTransactionsContextManager = createContext(null);

const POSTransactionsProvider = ({children}) => {
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const {didGetToHomepage} = useAppStatus();
  const [lastSavedMessage, setLastSavedMessage] = useState(null);
  const [txList, setTxList] = useState([]);

  const updateTxListFunction = useCallback(async () => {
    const txs = await getSavedPOSTransactions();
    setTxList(txs || []);
    return txs || [];
  }, []);

  useEffect(() => {
    if (!lastSavedMessage || !publicKey) return;
    console.log('running pos transactions listener...');
    const unsubscribe = db
      .collection('posTransactions')
      .where('storePubKey', '==', publicKey)
      .orderBy('dateAdded')
      .startAfter(lastSavedMessage)
      .onSnapshot(snapshot => {
        snapshot?.docChanges()?.forEach(async change => {
          console.log('recived a new message', change.type);
          if (change.type === 'added') {
            const newTX = change.doc.data();
            console.log(newTX, 'new transactions');

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
  }, [lastSavedMessage, publicKey]);

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
        setLastSavedMessage(lastMessageTimestamp);
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
      setLastSavedMessage(messsageList[0]?.dateAdded || new Date().getTime());
    }
    if (!didGetToHomepage || !publicKey) return;
    loadSavedTxs();
  }, [didGetToHomepage, publicKey]);

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
