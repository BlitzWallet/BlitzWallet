import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {getBoltzSwapPairInformation} from '../app/functions/boltz/boltzSwapInfo';
import * as Network from 'expo-network';
import {navigationRef} from '../navigation/navigationService';
// Initiate context
const AppStatusManager = createContext(null);

const AppStatusProvider = ({children}) => {
  const [minMaxLiquidSwapAmounts, setMinMaxLiquidSwapAmounts] = useState({
    min: 1000,
    max: 25000000,
  });

  const [isConnectedToTheInternet, setIsConnectedToTheInternet] =
    useState(null);

  const [didGetToHomepage, setDidGetToHomePage] = useState(false);

  const toggleDidGetToHomepage = useCallback(newInfo => {
    setDidGetToHomePage(newInfo);
  }, []);
  const toggleMinMaxLiquidSwapAmounts = useCallback(newInfo => {
    setMinMaxLiquidSwapAmounts(prev => ({...prev, ...newInfo}));
  }, []);

  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => {
      console.log(
        'Current navigation stack',
        navigationRef.getRootState().routes,
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [reverseSwapStats, submarineSwapStats] = await Promise.all([
        getBoltzSwapPairInformation('ln-liquid'),
        getBoltzSwapPairInformation('liquid-ln'),
      ]);
      const min = reverseSwapStats?.limits?.minimal || 1000;
      const max = reverseSwapStats?.limits?.maximal || 25000000;
      if (reverseSwapStats) {
        toggleMinMaxLiquidSwapAmounts({
          reverseSwapStats,
          submarineSwapStats,
          min,
          max,
        });
      }
    })();
  }, []);
  useEffect(() => {
    const networkSubscription = Network.addNetworkStateListener(
      ({type, isConnected, isInternetReachable}) => {
        console.log(
          `Network type: ${type}, Connected: ${isConnected}, Internet Reachable: ${isInternetReachable}`,
        );
        setIsConnectedToTheInternet(isConnected);
      },
    );

    const checkNetworkState = async () => {
      const networkState = await Network.getNetworkStateAsync();
      console.log(networkState, 'network state in startup function');
      setIsConnectedToTheInternet(networkState.isConnected);
    };

    checkNetworkState();

    return () => networkSubscription.remove();
  }, []);

  const contextValue = useMemo(
    () => ({
      minMaxLiquidSwapAmounts,
      toggleMinMaxLiquidSwapAmounts,
      isConnectedToTheInternet,
      didGetToHomepage,
      toggleDidGetToHomepage,
    }),
    [
      minMaxLiquidSwapAmounts,
      toggleMinMaxLiquidSwapAmounts,
      isConnectedToTheInternet,
      didGetToHomepage,
      toggleDidGetToHomepage,
    ],
  );

  return (
    <AppStatusManager.Provider value={contextValue}>
      {children}
    </AppStatusManager.Provider>
  );
};

function useAppStatus() {
  const context = useContext(AppStatusManager);
  if (!context) {
    throw new Error('useAppStatus must be used within a AppStatusProvider');
  }
  return context;
}

export {AppStatusManager, AppStatusProvider, useAppStatus};
