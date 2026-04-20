import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
import { dollarsToSats } from '../app/functions/spark/swapAmountUtils';

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { sparkInformation } = useSparkWallet();
  const { didGetToHomepage } = useAppStatus();
  const { poolInfoRef } = useFlashnet();
  const [inTxsBTC, setInTxsBTC] = useState([]);
  const [outTxsBTC, setOutTxsBTC] = useState([]);
  const [inTxsUSD, setInTxsUSD] = useState([]);
  const [outTxsUSD, setOutTxsUSD] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const txUpdateKey = useMemo(() => {
    if (sparkInformation.transactions.length) {
      const latestTx = sparkInformation.transactions[0];
      return `${latestTx?.sparkId}-${latestTx.paymentStatus}`;
    } else {
      return 'no-txs';
    }
  }, [sparkInformation.transactions]);

  useEffect(() => {
    async function load() {
      if (!sparkInformation.identityPubKey || !didGetToHomepage) return;
      setIsLoading(true);
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
        console.error('AnalyticsContext load error', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [sparkInformation.identityPubKey, txUpdateKey, didGetToHomepage]);

  const incomeTotalBTC = useMemo(() => {
    try {
      return inTxsBTC.reduce((sum, tx) => {
        try {
          return (
            sum + getSatsFromTx(tx, poolInfoRef.currentPriceAInB, 'INCOMING')
          );
        } catch {
          return sum;
        }
      }, 0);
    } catch (err) {
      console.log('eror calcuating total', err);
      return 0;
    }
  }, [inTxsBTC]);

  const spentTotalBTC = useMemo(() => {
    try {
      return outTxsBTC.reduce((sum, tx) => {
        try {
          return (
            sum + getSatsFromTx(tx, poolInfoRef.currentPriceAInB, 'OUTGOING')
          );
        } catch {
          return sum;
        }
      }, 0);
    } catch (err) {
      console.log('error calcuating spent', err);
      return 0;
    }
  }, [outTxsBTC]);

  const incomeTotalUSD = useMemo(() => {
    try {
      return inTxsUSD.reduce((sum, tx) => {
        try {
          return (
            sum + getDollarsFromTx(tx, poolInfoRef.currentPriceAInB, 'INCOMING')
          );
        } catch {
          return sum;
        }
      }, 0);
    } catch (err) {
      console.log('eror calcuating total', err);
      return 0;
    }
  }, [inTxsUSD]);

  const spentTotalUSD = useMemo(() => {
    try {
      return outTxsUSD.reduce((sum, tx) => {
        try {
          return (
            sum + getDollarsFromTx(tx, poolInfoRef.currentPriceAInB, 'OUTGOING')
          );
        } catch {
          return sum;
        }
      }, 0);
    } catch (err) {
      console.log('error calcuating spent', err);
      return 0;
    }
  }, [outTxsUSD]);

  const cumulativeIncomeDataBTC = useMemo(() => {
    try {
      return buildCumulativeData(
        inTxsBTC,
        undefined,
        poolInfoRef.currentPriceAInB,
        'INCOMING',
      );
    } catch (err) {
      console.log('error creating cumulative income data', err);
      return [];
    }
  }, [inTxsBTC]);

  const cumulativeSpentDataBTC = useMemo(() => {
    try {
      return buildCumulativeData(
        outTxsBTC,
        undefined,
        poolInfoRef.currentPriceAInB,
        'OUTGOING',
      );
    } catch (err) {
      console.log('error creating cumulative spend data', err);
      return [];
    }
  }, [outTxsBTC]);

  const cumulativeIncomeDataUSD = useMemo(() => {
    try {
      return buildCumulativeData(
        inTxsUSD,
        undefined,
        poolInfoRef.currentPriceAInB,
        'INCOMING',
        true,
      );
    } catch (err) {
      console.log('error creating cumulative income data', err);
      return [];
    }
  }, [inTxsUSD]);

  const cumulativeSpentDataUSD = useMemo(() => {
    try {
      return buildCumulativeData(
        outTxsUSD,
        undefined,
        poolInfoRef.currentPriceAInB,
        'OUTGOING',
        true,
      );
    } catch (err) {
      console.log('error creating cumulative spend data', err);
      return [];
    }
  }, [outTxsUSD]);

  const spentTotal = useMemo(() => {
    try {
      return Math.round(
        spentTotalBTC +
          dollarsToSats(spentTotalUSD, poolInfoRef.currentPriceAInB),
      );
    } catch (err) {
      console.log('spent total error', err);
      return 0;
    }
  }, [spentTotalBTC, spentTotalUSD]);

  return (
    <AnalyticsContext.Provider
      value={{
        spentTotal,
        inTxsBTC,
        outTxsBTC,
        inTxsUSD,
        outTxsUSD,
        incomeTotalBTC,
        incomeTotalUSD,
        spentTotalBTC,
        spentTotalUSD,
        incomeTxCountBTC: inTxsBTC.length,
        spentTxCountBTC: outTxsBTC.length,
        incomeTxCountUSD: inTxsUSD.length,
        spentTxCountUSD: outTxsUSD.length,
        cumulativeIncomeDataBTC,
        cumulativeSpentDataBTC,
        cumulativeIncomeDataUSD,
        cumulativeSpentDataUSD,
        isLoading,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx)
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  return ctx;
}
