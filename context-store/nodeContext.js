import {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useGlobalContextProvider } from './context';
import loadNewFiatData from '../app/functions/saveAndUpdateFiatData';
import { useKeysContext } from './keys';
import { useAppStatus } from './appStatus';
import connectToLiquidNode from '../app/functions/connectToLiquid';

// Initiate context
const NodeContextManager = createContext(null);

const GLobalNodeContextProider = ({ children }) => {
  const { contactsPrivateKey, publicKey, accountMnemoinc } = useKeysContext();
  const { didGetToHomepage } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const [liquidNodeInformation, setLiquidNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
  });
  const selectedCurrency = masterInfoObject.fiatCurrency;
  const [fiatStats, setFiatStats] = useState({ coin: 'USD', value: 100_000 });

  const toggleFiatStats = useCallback(newInfo => {
    setFiatStats({ ...newInfo, coin: newInfo.coin?.toUpperCase() });
  }, []);

  const didRunCurrencyUpdate = useRef(null);
  const didRunLiquidConnection = useRef(null);

  const toggleLiquidNodeInformation = useCallback(newInfo => {
    setLiquidNodeInformation(prev => ({ ...prev, ...newInfo }));
  }, []);

  useEffect(() => {
    if (
      !contactsPrivateKey ||
      !publicKey ||
      didRunCurrencyUpdate.current ||
      !selectedCurrency
    )
      return;
    didRunCurrencyUpdate.current = true;

    async function initFiatData() {
      const response = await loadNewFiatData(
        selectedCurrency,
        contactsPrivateKey,
        publicKey,
        masterInfoObject,
      );
      if (response.didWork) {
        toggleFiatStats(response.fiatRateResponse);
      }
    }
    initFiatData();
  }, [contactsPrivateKey, selectedCurrency, publicKey]);

  useEffect(() => {
    if (
      !contactsPrivateKey ||
      !publicKey ||
      didRunLiquidConnection.current ||
      !didGetToHomepage
    )
      return;
    didRunLiquidConnection.current = true;

    async function connectToLiquid() {
      const connectionResponse = await connectToLiquidNode(accountMnemoinc);
      console.log('liquid connection response', connectionResponse);
      if (connectionResponse.isConnected) {
        toggleLiquidNodeInformation({
          didConnectToNode: true,
        });
      }
    }
    connectToLiquid();
  }, [contactsPrivateKey, publicKey, didGetToHomepage, accountMnemoinc]);

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

export { NodeContextManager, GLobalNodeContextProider, useNodeContext };
