import React, { createContext, useMemo } from 'react';

import { useSparkWallet } from './sparkContext';
import { useFlashnet } from './flashnetContext';

// Create a context for the WebView ref
const UserBalanceContext = createContext(null);

export const UserBalanceProvider = ({ children }) => {
  const { sparkInformation, USD_BALANCE } = useSparkWallet();
  const { flatnet_sats_per_dollar } = useFlashnet();

  const bitcoinBalance = sparkInformation.balance;
  const dollarBalance = USD_BALANCE * flatnet_sats_per_dollar;

  const totalSatValue = bitcoinBalance + dollarBalance;

  const contextValue = useMemo(() => {
    return {
      bitcoinBalance,
      dollarBalance,
      totalSatValue,
    };
  }, [bitcoinBalance, dollarBalance, totalSatValue]);

  return (
    <UserBalanceContext.Provider value={contextValue}>
      {children}
    </UserBalanceContext.Provider>
  );
};

export const useUserBalanceContext = () => {
  return React.useContext(UserBalanceContext);
};
