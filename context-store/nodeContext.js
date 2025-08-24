import {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {useGlobalContextProvider} from './context';
import loadNewFiatData from '../app/functions/saveAndUpdateFiatData';

// Initiate context
const NodeContextManager = createContext(null);

const GLobalNodeContextProider = ({children}) => {
  const {masterInfoObject} = useGlobalContextProvider();
  const [liquidNodeInformation, setLiquidNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
  });
  const selectedCurrency = masterInfoObject.fiatCurrency;
  const [fiatStats, setFiatStats] = useState({});
  const toggleFiatStats = useCallback(newInfo => {
    setFiatStats(prev => ({...prev, ...newInfo}));
  }, []);
  const didRunCurrencyUpdate = useRef(null);

  const toggleLiquidNodeInformation = useCallback(newInfo => {
    setLiquidNodeInformation(prev => ({...prev, ...newInfo}));
  }, []);

  useEffect(() => {
    if (
      !liquidNodeInformation.didConnectToNode ||
      didRunCurrencyUpdate.current ||
      !selectedCurrency
    )
      return;
    didRunCurrencyUpdate.current = true;

    async function initFiatData() {
      const response = await loadNewFiatData(selectedCurrency);
      if (response.didWork) {
        toggleFiatStats(response.fiatRate);
      }
    }
    initFiatData();
  }, [liquidNodeInformation.didConnectToNode, selectedCurrency]);

  const contextValue = useMemo(
    () => ({
      liquidNodeInformation,
      toggleLiquidNodeInformation,
      toggleFiatStats,
      fiatStats,
    }),
    [
      liquidNodeInformation,
      fiatStats,
      toggleFiatStats,
      toggleLiquidNodeInformation,
    ],
  );

  return (
    <NodeContextManager.Provider value={contextValue}>
      {children}
    </NodeContextManager.Provider>
  );
};

function useNodeContext() {
  const context = useContext(NodeContextManager);
  if (!context) {
    throw new Error(
      'useNodeContext must be used within a GLobalNodeContextProider',
    );
  }
  return context;
}

export {NodeContextManager, GLobalNodeContextProider, useNodeContext};
