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

// Initiate context
const combinedTxContextManager = createContext(null);

const GlobalConbinedTxContextProvider = ({children}) => {
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const [combinedTransactions, setCombinedTransactions] = useState([]);
  const prevDependencies = useRef({arr1, arr2, arr3, n1, n2, n3});

  const didConnectToLiquidNode = liquidNodeInformation.didConnectToNode;
  const didConnectToLightningNode = nodeInformation.didConnectToNode;
  const didConnectToEcashNode = ecashWalletInformation.didConnectToNode;
  const enabledEcash = masterInfoObject.enabledEcash;
  const enabledLightning =
    masterInfoObject.liquidWalletSettings?.isLightningEnabled;

  const shouldStartToMergeArrays = useMemo(() => {
    return (
      (didConnectToLightningNode || !enabledLightning) &&
      didConnectToLiquidNode &&
      (didConnectToEcashNode || !enabledEcash)
    );
  }, [
    didConnectToEcashNode,
    didConnectToLightningNode,
    didConnectToLiquidNode,
    enabledEcash,
    enabledLightning,
  ]);

  const arr1 = nodeInformation.transactions;
  const arr2 = liquidNodeInformation.transactions;
  const arr3 = ecashWalletInformation.transactions;
  const n1 = nodeInformation.transactions.length;
  const n2 = liquidNodeInformation.transactions.length;
  const n3 = ecashWalletInformation.transactions.length;

  useEffect(() => {
    const hasChanged =
      JSON.stringify(prevDependencies.current.arr1) !== JSON.stringify(arr1) ||
      JSON.stringify(prevDependencies.current.arr2) !== JSON.stringify(arr2) ||
      JSON.stringify(prevDependencies.current.arr3) !== JSON.stringify(arr3) ||
      prevDependencies.current.n1 !== n1 ||
      prevDependencies.current.n2 !== n2 ||
      prevDependencies.current.n3 !== n3;

    if (!hasChanged || !shouldStartToMergeArrays) return;
    console.log('re-filtering transaactins');

    const txs = mergeArrays({arr1, arr2, arr3, n1, n2, n3});
    setCombinedTransactions(txs);
  }, [arr1, arr2, arr3, n1, n2, n3, shouldStartToMergeArrays]);

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
