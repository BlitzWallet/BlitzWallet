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
    rsk: {
      min: 3000,
      max: 10000000,
    },
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
      const [submarineSwapStats, reverseSwapStats] = await Promise.all([
        getBoltzSwapPairInformation('submarine'),
        getBoltzSwapPairInformation('reverse'),
      ]);

      const liquidReverse = reverseSwapStats.BTC['L-BTC'];

      const min = liquidReverse?.limits?.minimal || 1000;
      const max = liquidReverse?.limits?.maximal || 25000000;

      toggleMinMaxLiquidSwapAmounts({
        reverseSwapStats: liquidReverse,
        submarineSwapStats: submarineSwapStats['L-BTC'].BTC,
        min,
        max,
        rsk: {
          submarine: reverseSwapStats.BTC.RBTC,
          reverse: submarineSwapStats.RBTC.BTC,
          min: reverseSwapStats.BTC.RBTC.limits.minimal,
          max: reverseSwapStats.BTC.RBTC.limits.maximal,
        },
      });
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

  console.log(minMaxLiquidSwapAmounts, 'min max liquid swap amounts');

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
