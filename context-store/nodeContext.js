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
import { useSparkWallet } from './sparkContext';
import { useGlobalContacts } from './globalContacts';
import liquidToSparkSwap from '../app/functions/spark/liquidToSparkSwap';
import { useAuthContext } from './authContext';
import { ensureLiquidConnection } from '../app/functions/breezLiquid/liquidNodeManager';
import { SATSPERBITCOIN } from '../app/constants';

// Initiate context
const NodeContextManager = createContext(null);

const GLobalNodeContextProider = ({ children }) => {
  const { globalContactsInformation } = useGlobalContacts();
  const { sparkInformation } = useSparkWallet();
  const { contactsPrivateKey, publicKey, accountMnemoinc } = useKeysContext();
  const { didGetToHomepage, minMaxLiquidSwapAmounts } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const [pendingLiquidPayment, setPendingLiquidPayment] = useState(null);
  const [liquidNodeInformation, setLiquidNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
  });
  const isInitialRender = useRef(true);
  const { authResetkey } = useAuthContext();
  const selectedCurrency = masterInfoObject.fiatCurrency;
  const [fiatStats, setFiatStats] = useState({ coin: 'USD', value: 100_000 });

  const SATS_PER_DOLLAR = useMemo(() => {
    return SATSPERBITCOIN / (fiatStats.value ?? 0);
  }, [fiatStats]);

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
      !sparkInformation.didConnect ||
      !sparkInformation.identityPubKey
    )
      return;
    didRunLiquidConnection.current = true;

    async function connectToLiquid() {
      const connectionResponse = await ensureLiquidConnection(accountMnemoinc);
      console.log('liquid connection response', connectionResponse);
      if (connectionResponse) {
        toggleLiquidNodeInformation({ didConnectToNode: true });
      }
    }
    connectToLiquid();
  }, [
    contactsPrivateKey,
    publicKey,
    accountMnemoinc,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
  ]);

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
    if (!sparkInformation.identityPubKey) return;
    if (!masterInfoObject.enabledLiquidAutoSwap) return;
    swapLiquidToSpark();
  }, [
    didGetToHomepage,
    liquidNodeInformation.userBalance,
    minMaxLiquidSwapAmounts,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    globalContactsInformation?.myProfile?.uniqueName,
    masterInfoObject.enabledLiquidAutoSwap,
  ]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    didRunLiquidConnection.current = false;
  }, [authResetkey]);

  const contextValue = useMemo(
    () => ({
      liquidNodeInformation,
      toggleLiquidNodeInformation,
      toggleFiatStats,
      fiatStats,
      pendingLiquidPayment,
      setPendingLiquidPayment,
      SATS_PER_DOLLAR,
    }),
    [
      liquidNodeInformation,
      fiatStats,
      toggleFiatStats,
      toggleLiquidNodeInformation,
      pendingLiquidPayment,
      setPendingLiquidPayment,
      SATS_PER_DOLLAR,
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
