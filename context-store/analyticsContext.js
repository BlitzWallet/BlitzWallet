import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSparkWallet } from './sparkContext';
import { useFlashnet } from './flashnetContext';
import { getMonthlyTransactions } from '../app/functions/spark/transactions';
import {
  getSatsFromTx,
  getDollarsFromTx,
} from '../app/functions/analytics/index';
import { buildCumulativeData } from '../app/components/admin/homeComponents/analytics/cumulativeLineChartHelpers';
import { useAppStatus } from './appStatus';
import {
  convertToDecimals,
  dollarsToSats,
} from '../app/functions/spark/swapAmountUtils';

// --- Global numbers provider: computes scalars + chart arrays, never stores raw tx arrays ---
const AnalyticsNumbersContext = createContext(null);

const COMPUTED_DEFAULTS = {
  spentTotal: 0,
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

export function AnalyticsNumbersProvider({ children }) {
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const { didGetToHomepage } = useAppStatus();
  const { poolInfoRef } = useFlashnet();
  const [computed, setComputed] = useState(COMPUTED_DEFAULTS);
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

        const priceAInB = poolInfoRef.currentPriceAInB;

        const incomeTotalBTC = incomingBTC.reduce((sum, tx) => {
          try {
            return sum + getSatsFromTx(tx, priceAInB, 'INCOMING');
          } catch {
            return sum;
          }
        }, 0);

        const spentTotalBTC = outgoingBTC.reduce((sum, tx) => {
          try {
            return sum + getSatsFromTx(tx, priceAInB, 'OUTGOING');
          } catch {
            return sum;
          }
        }, 0);

        const incomeTotalUSD = convertToDecimals(
          incomingUSD.reduce((sum, tx) => {
            try {
              return sum + getDollarsFromTx(tx, priceAInB, 'INCOMING');
            } catch {
              return sum;
            }
          }, 0),
        );

        const spentTotalUSD = convertToDecimals(
          outgoingUSD.reduce((sum, tx) => {
            try {
              return sum + getDollarsFromTx(tx, priceAInB, 'OUTGOING');
            } catch {
              return sum;
            }
          }, 0),
        );

        const spentTotal = Math.round(
          spentTotalBTC + dollarsToSats(spentTotalUSD, priceAInB),
        );

        let cumulativeIncomeDataBTC = [];
        let cumulativeSpentDataBTC = [];
        let cumulativeIncomeDataUSD = [];
        let cumulativeSpentDataUSD = [];
        try {
          cumulativeIncomeDataBTC = buildCumulativeData(
            incomingBTC,
            undefined,
            priceAInB,
            'INCOMING',
          );
        } catch (err) {
          console.log('error creating cumulative income data', err);
        }
        try {
          cumulativeSpentDataBTC = buildCumulativeData(
            outgoingBTC,
            undefined,
            priceAInB,
            'OUTGOING',
          );
        } catch (err) {
          console.log('error creating cumulative spend data', err);
        }
        try {
          cumulativeIncomeDataUSD = buildCumulativeData(
            incomingUSD,
            undefined,
            priceAInB,
            'INCOMING',
            true,
          );
        } catch (err) {
          console.log('error creating cumulative income data', err);
        }
        try {
          cumulativeSpentDataUSD = buildCumulativeData(
            outgoingUSD,
            undefined,
            priceAInB,
            'OUTGOING',
            true,
          );
        } catch (err) {
          console.log('error creating cumulative spend data', err);
        }

        setComputed({
          spentTotal,
          incomeTotalBTC,
          spentTotalBTC,
          incomeTotalUSD,
          spentTotalUSD,
          incomeTxCountBTC: incomingBTC.length,
          spentTxCountBTC: outgoingBTC.length,
          incomeTxCountUSD: incomingUSD.length,
          spentTxCountUSD: outgoingUSD.length,
          cumulativeIncomeDataBTC,
          cumulativeSpentDataBTC,
          cumulativeIncomeDataUSD,
          cumulativeSpentDataUSD,
        });

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

  return (
    <AnalyticsNumbersContext.Provider
      value={{ ...computed, isLoading, isReloading }}
    >
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

// --- Local arrays provider: scoped to analytics stack, GC'd on unmount ---
const AnalyticsArraysContext = createContext(null);

export function AnalyticsArraysProvider({ children }) {
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const [inTxsBTC, setInTxsBTC] = useState([]);
  const [outTxsBTC, setOutTxsBTC] = useState([]);
  const [inTxsUSD, setInTxsUSD] = useState([]);
  const [outTxsUSD, setOutTxsUSD] = useState([]);
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

  return (
    <AnalyticsArraysContext.Provider
      value={{ inTxsBTC, outTxsBTC, inTxsUSD, outTxsUSD, isLoading }}
    >
      {children}
    </AnalyticsArraysContext.Provider>
  );
}

// --- Merged convenience hook: works for all call sites unchanged ---
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
