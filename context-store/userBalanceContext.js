import React, {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
} from '../app/functions';
import {
  CUSTODY_ACCOUNTS_STORAGE_KEY,
  NWC_SECURE_STORE_MNEMOINC,
} from '../app/constants';
import { useSparkWallet } from './sparkContext';
import { useNodeContext } from './nodeContext';
import {
  decryptMnemonic,
  encryptMnemonic,
} from '../app/functions/handleMnemonic';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';

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
