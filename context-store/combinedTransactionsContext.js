import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {useGlobaleCash} from './eCash';
import {useGlobalContextProvider} from './context';
import {mergeArrays} from '../app/functions/mergeArrays';
import {useNodeContext} from './nodeContext';
import sha256Hash from '../app/functions/hash';

// Initiate context
const combinedTxContextManager = createContext(null);

const GlobalConbinedTxContextProvider = ({children}) => {
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();

  const [combinedTransactions, setCombinedTransactions] = useState([]);

  const prevDependencies = useRef({
    arr1Hash: null,
    arr2Hash: null,
    arr3Hash: null,
    n1: null,
    n2: null,
    n3: null,
  });
  const shouldStartToMergeArrays = useMemo(() => {
    return (
      (nodeInformation.didConnectToNode !== null ||
        !masterInfoObject.liquidWalletSettings?.isLightningEnabled) &&
      liquidNodeInformation.didConnectToNode &&
      (ecashWalletInformation.didConnectToNode !== null ||
        !masterInfoObject.enabledEcash)
    );
  }, [
    nodeInformation.didConnectToNode,
    liquidNodeInformation.didConnectToNode,
    ecashWalletInformation.didConnectToNode,
    masterInfoObject.enabledEcash,
    masterInfoObject.liquidWalletSettings?.isLightningEnabled,
  ]);

  const hashTransactions = useCallback((transactions, fingerprintType) => {
    try {
      let array = [];
      if (fingerprintType === 'liquid') {
        array = transactions.map(tx => `${tx?.txId}:${tx?.status}`);
      } else if (fingerprintType === 'lightning') {
        array = transactions.map(tx => `${tx?.id}:${tx?.status}`);
      } else {
        array = transactions.map(tx => `${tx?.id}`);
      }
      return sha256Hash(array.join('|'));
    } catch (err) {
      console.log('Hash transaction error', err);
      return '';
    }
  }, []);

  useEffect(() => {
    console.log('Checking changes in transactions...');
    if (!shouldStartToMergeArrays) return;
    const arr1 = nodeInformation.transactions;
    const arr2 = liquidNodeInformation.transactions;
    const arr3 = ecashWalletInformation.transactions;

    const arr1Hash = hashTransactions(arr1, 'lightning');
    const arr2Hash = hashTransactions(arr2, 'liquid');
    const arr3Hash = hashTransactions(arr3, 'ecash');

    const n1 = arr1.length;
    const n2 = arr2.length;
    const n3 = arr3.length;

    console.log(
      arr1Hash,
      prevDependencies.current.arr1Hash,
      arr2Hash,
      prevDependencies.current.arr2Hash,
      arr3Hash,
      prevDependencies.current.arr3Hash,
      prevDependencies.current.n1,
      n1,
      prevDependencies.current.n2,
      n2,
      prevDependencies.current.n3,
      n3,
    );

    const hasChanged =
      arr1Hash !== prevDependencies.current.arr1Hash ||
      arr2Hash !== prevDependencies.current.arr2Hash ||
      arr3Hash !== prevDependencies.current.arr3Hash ||
      prevDependencies.current.n1 !== n1 ||
      prevDependencies.current.n2 !== n2 ||
      prevDependencies.current.n3 !== n3;

    if (!hasChanged) return;
    console.log('Merging transactions...');

    const txs = mergeArrays({arr1, arr2, arr3, n1, n2, n3});
    setCombinedTransactions(txs);
    prevDependencies.current = {arr1Hash, arr2Hash, arr3Hash, n1, n2, n3};
  }, [
    nodeInformation.transactions,
    liquidNodeInformation.transactions,
    ecashWalletInformation.transactions,
    shouldStartToMergeArrays,
  ]);

  const contextValue = useMemo(
    () => ({
      combinedTransactions,
    }),
    [combinedTransactions],
  );

  return (
    <combinedTxContextManager.Provider value={contextValue}>
      {children}
    </combinedTxContextManager.Provider>
  );
};

function useGlobalTxContextProvider() {
  const context = useContext(combinedTxContextManager);
  if (!context) {
    throw new Error(
      'useGlobalTxContextProvider must be used within a GlobalConbinedTxContextProvider',
    );
  }
  return context;
}

export {
  combinedTxContextManager,
  GlobalConbinedTxContextProvider,
  useGlobalTxContextProvider,
};
