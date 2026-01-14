import React, { createContext, useMemo } from 'react';

import { useSparkWallet } from './sparkContext';
import { useFlashnet } from './flashnetContext';
import { USDB_TOKEN_ID } from '../app/constants';
import formatTokensNumber from '../app/functions/lrc20/formatTokensBalance';
import { dollarsToSats } from '../app/functions/spark/flashnet';

const UserBalanceContext = createContext(null);

export const UserBalanceProvider = ({ children }) => {
  const { sparkInformation } = useSparkWallet();
  const { poolInfo } = useFlashnet();

  const usdbTokenInfo = sparkInformation?.tokens?.[USDB_TOKEN_ID];

  const dollarBalanceToken = useMemo(() => {
    if (
      !usdbTokenInfo?.balance ||
      usdbTokenInfo?.tokenMetadata?.decimals == null
    ) {
      return 0;
    }

    try {
      const formatted = formatTokensNumber(
        usdbTokenInfo.balance,
        usdbTokenInfo.tokenMetadata.decimals,
      );

      return parseFloat(formatted) || 0;
    } catch (error) {
      console.error('Error formatting dollar balance:', error, {
        balance: usdbTokenInfo.balance,
        decimals: usdbTokenInfo.tokenMetadata.decimals,
      });
      return 0;
    }
  }, [usdbTokenInfo]);

  const bitcoinBalance = useMemo(() => {
    try {
      const balance = sparkInformation?.balance;
      if (balance == null) return 0;

      return typeof balance === 'bigint'
        ? Number(balance)
        : Number(balance) || 0;
    } catch (error) {
      console.error('Error processing bitcoin balance:', error);
      return 0;
    }
  }, [sparkInformation]);

  const dollarBalanceSat = useMemo(() => {
    try {
      const price = poolInfo?.currentPriceAInB;
      if (!price || dollarBalanceToken === 0) {
        return 0;
      }

      const result = dollarsToSats(dollarBalanceToken, price);
      return Number(result) || 0;
    } catch (error) {
      console.error('Error calculating dollar balance in sats:', error, {
        dollarBalanceToken,
        currentPriceAInB: poolInfo?.currentPriceAInB,
      });
      return 0;
    }
  }, [dollarBalanceToken, poolInfo]);

  const totalSatValue = useMemo(() => {
    try {
      const total = bitcoinBalance + dollarBalanceSat;
      return isNaN(total) ? 0 : total;
    } catch (error) {
      console.error('Error calculating total sat value:', error);
      return 0;
    }
  }, [bitcoinBalance, dollarBalanceSat]);

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
