import React, { createContext, useMemo } from 'react';

import { useSparkWallet } from './sparkContext';
import { useFlashnet } from './flashnetContext';
import { USDB_TOKEN_ID } from '../app/constants';
import formatTokensNumber from '../app/functions/lrc20/formatTokensBalance';

// Create a context for the WebView ref
const UserBalanceContext = createContext(null);

export const UserBalanceProvider = ({ children }) => {
  const { sparkInformation } = useSparkWallet();
  const { flatnet_sats_per_dollar } = useFlashnet();

  const usdbTokenInfo = sparkInformation?.tokens?.[USDB_TOKEN_ID];

  const dollarBalanceToken = useMemo(() => {
    return usdbTokenInfo
      ? formatTokensNumber(
          usdbTokenInfo?.balance,
          usdbTokenInfo?.tokenMetadata?.decimals,
        )
      : 0;
  }, [usdbTokenInfo]);

  const bitcoinBalance = sparkInformation.balance;

  const dollarBalanceSat = dollarBalanceToken * flatnet_sats_per_dollar;

  const totalSatValue = bitcoinBalance + dollarBalanceSat;

  const contextValue = useMemo(() => {
    return {
      bitcoinBalance,
      dollarBalanceSat,
      totalSatValue,
      dollarBalanceToken,
    };
  }, [bitcoinBalance, dollarBalanceToken, totalSatValue, dollarBalanceSat]);

  return (
    <UserBalanceContext.Provider value={contextValue}>
      {children}
    </UserBalanceContext.Provider>
  );
};

export const useUserBalanceContext = () => {
  return React.useContext(UserBalanceContext);
};
