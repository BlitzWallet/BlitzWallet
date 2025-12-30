import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BTC_ASSET_ADDRESS,
  findBestPool,
  getPoolDetails,
  USD_ASSET_ADDRESS,
} from '../app/functions/spark/flashnet';
import { useAppStatus } from './appStatus';
import { useSparkWallet } from './sparkContext';
import { useActiveCustodyAccount } from './activeAccount';

const FlashnetContext = createContext(null);

export function FlashnetProvider({ children }) {
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { appState } = useAppStatus();
  const { sparkInformation } = useSparkWallet();
  const [poolInfo, setPoolInfo] = useState(null);
  const poolInfoRef = useRef(null);
  const poolIntervalRef = useRef(null);

  const togglePoolInfo = poolInfo => {
    setPoolInfo(poolInfo);
  };

  const refreshPool = async () => {
    if (!sparkInformation.didConnect) return;
    if (appState !== 'active') return;

    const result = await findBestPool(
      currentWalletMnemoincRef.current,
      BTC_ASSET_ADDRESS,
      USD_ASSET_ADDRESS,
    );

    if (result?.didWork && result.pool) {
      setPoolInfo(result.pool);
    }
  };

  const currentWalletMnemoincRef = useRef(currentWalletMnemoinc);

  useEffect(() => {
    currentWalletMnemoincRef.current = currentWalletMnemoinc;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    poolInfoRef.current = poolInfo;
  }, [poolInfo]);

  useEffect(() => {
    // Stop any existing interval first
    if (poolIntervalRef.current) {
      clearInterval(poolIntervalRef.current);
      poolIntervalRef.current = null;
    }

    // Only start polling when conditions are correct
    if (!sparkInformation.didConnect) return;
    if (appState !== 'active') return;

    // Run immediately on activation
    refreshPool();

    // Start interval
    poolIntervalRef.current = setInterval(() => {
      refreshPool();
    }, 30_000);

    return () => {
      if (poolIntervalRef.current) {
        clearInterval(poolIntervalRef.current);
        poolIntervalRef.current = null;
      }
    };
  }, [appState, sparkInformation.didConnect]);

  return (
    <FlashnetContext.Provider
      value={{
        poolInfo,
        togglePoolInfo,
        poolInfoRef: poolInfoRef.current,
      }}
    >
      {children}
    </FlashnetContext.Provider>
  );
}

export const useFlashnet = () => useContext(FlashnetContext);
