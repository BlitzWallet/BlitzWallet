import React, { createContext, useMemo } from 'react';

import { useSparkWallet } from './sparkContext';
import { useNodeContext } from './nodeContext';

// Create a context for the WebView ref
const UserBalanceContext = createContext(null);

export const UserBalanceProvider = ({ children }) => {
  const { sparkInformation, USD_BALANCE } = useSparkWallet();
  const { SATS_PER_DOLLAR } = useNodeContext();

  const bitcoinBalance = sparkInformation.balance;
  const dollarBalance = USD_BALANCE * SATS_PER_DOLLAR;

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
