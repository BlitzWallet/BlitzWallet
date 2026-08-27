import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSparkWallet } from './sparkContext';
import { useFlashnet } from './flashnetContext';
import { getMonthlyTransactions } from '../app/functions/spark/transactions';
import {
  computeSpentTotal,
  deriveAnalytics,
} from '../app/functions/analytics/deriveAnalytics';
import { useAppStatus } from './appStatus';

// --- Global numbers provider: always mounted. Computes ONLY spentTotal, the one
// value budget hooks need outside the analytics stack. The heavy analytics-only
// math (income totals, counts, chart series) lives in AnalyticsArraysProvider so
// it never runs while analytics is closed. ---
const AnalyticsNumbersContext = createContext(null);

export function AnalyticsNumbersProvider({ children }) {
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const { didGetToHomepage } = useAppStatus();
  const { poolInfoRef } = useFlashnet();
  const [spentTotal, setSpentTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    async function load() {
      if (!sparkInformation.identityPubKey || !didGetToHomepage) {
        setIsLoading(false);
        return;
      }
      if (hasLoadedRef.current) {
        setIsReloading(true);
      }
      try {
        const startTime = Date.now();
        const [outgoingBTC, outgoingUSD] = await Promise.all([
          getMonthlyTransactions(sparkInformation.identityPubKey, 'OUTGOING'),
          getMonthlyTransactions(
            sparkInformation.identityPubKey,
            'OUTGOING',
            true,
          ),
        ]);

        setSpentTotal(
          computeSpentTotal(
            outgoingBTC,
            outgoingUSD,
            poolInfoRef.currentPriceAInB,
          ),
        );

        hasLoadedRef.current = true;
        const elapsed = Date.now() - startTime;
        const minDuration = 500;
        await new Promise(resolve =>
          setTimeout(resolve, Math.max(60, minDuration - elapsed)),
        );
      } catch (e) {
        console.error('AnalyticsNumbersContext load error', e);
      } finally {
        setIsLoading(false);
        setIsReloading(false);
      }
    }
    load();
  }, [txsHashKey, sparkInformation.identityPubKey, didGetToHomepage]);

  const value = useMemo(
    () => ({ spentTotal, isLoading, isReloading }),
    [spentTotal, isLoading, isReloading],
  );

  return (
    <AnalyticsNumbersContext.Provider value={value}>
      {children}
    </AnalyticsNumbersContext.Provider>
  );
}

export function useAnalyticsNumbers() {
  const ctx = useContext(AnalyticsNumbersContext);
  if (!ctx)
    throw new Error(
      'useAnalyticsNumbers must be used within AnalyticsNumbersProvider',
    );
  return ctx;
}

// --- Local arrays provider: scoped to analytics stack, GC'd on unmount. Owns the
// full analytics computation (raw month arrays + derived totals/counts/charts). ---
const AnalyticsArraysContext = createContext(null);

const DERIVED_DEFAULTS = {
  incomeTotalBTC: 0,
  spentTotalBTC: 0,
  incomeTotalUSD: 0,
  spentTotalUSD: 0,
  incomeTxCountBTC: 0,
  spentTxCountBTC: 0,
  incomeTxCountUSD: 0,
  spentTxCountUSD: 0,
  cumulativeIncomeDataBTC: [],
  cumulativeSpentDataBTC: [],
  cumulativeIncomeDataUSD: [],
  cumulativeSpentDataUSD: [],
};

export function AnalyticsArraysProvider({ children }) {
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const [inTxsBTC, setInTxsBTC] = useState([]);
  const [outTxsBTC, setOutTxsBTC] = useState([]);
  const [inTxsUSD, setInTxsUSD] = useState([]);
  const [outTxsUSD, setOutTxsUSD] = useState([]);
  const [derived, setDerived] = useState(DERIVED_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!sparkInformation.identityPubKey) {
        setIsLoading(false);
        return;
      }
      try {
        const startTime = Date.now();
        const [incomingBTC, outgoingBTC, incomingUSD, outgoingUSD] =
          await Promise.all([
            getMonthlyTransactions(sparkInformation.identityPubKey, 'INCOMING'),
            getMonthlyTransactions(sparkInformation.identityPubKey, 'OUTGOING'),
            getMonthlyTransactions(
              sparkInformation.identityPubKey,
              'INCOMING',
              true,
            ),
            getMonthlyTransactions(
              sparkInformation.identityPubKey,
              'OUTGOING',
              true,
            ),
          ]);
        setInTxsBTC(incomingBTC);
        setOutTxsBTC(outgoingBTC);
        setInTxsUSD(incomingUSD);
        setOutTxsUSD(outgoingUSD);
        setDerived(
          deriveAnalytics(
            { incomingBTC, outgoingBTC, incomingUSD, outgoingUSD },
            poolInfoRef.currentPriceAInB,
          ),
        );

        const elapsed = Date.now() - startTime;
        const minDuration = 500;
        await new Promise(resolve =>
          setTimeout(resolve, Math.max(60, minDuration - elapsed)),
        );
      } catch (e) {
        console.error('AnalyticsArraysContext load error', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [txsHashKey, sparkInformation.identityPubKey]);

  const value = useMemo(
    () => ({
      inTxsBTC,
      outTxsBTC,
      inTxsUSD,
      outTxsUSD,
      ...derived,
      isLoading,
    }),
    [inTxsBTC, outTxsBTC, inTxsUSD, outTxsUSD, derived, isLoading],
  );

  return (
    <AnalyticsArraysContext.Provider value={value}>
      {children}
    </AnalyticsArraysContext.Provider>
  );
}

// --- Merged convenience hook: works for all call sites unchanged. Inside the
// analytics stack, arrays supplies the derived totals/counts/charts; spentTotal
// and isReloading pass through from the global numbers provider. ---
export function useAnalytics() {
  const numbers = useContext(AnalyticsNumbersContext);
  const arrays = useContext(AnalyticsArraysContext);
  if (!numbers)
    throw new Error('useAnalytics must be within AnalyticsNumbersProvider');
  // isLoading is true if either layer is still loading
  const isLoading = arrays
    ? numbers.isLoading || arrays.isLoading
    : numbers.isLoading;
  return { ...numbers, ...(arrays ?? {}), isLoading };
}
