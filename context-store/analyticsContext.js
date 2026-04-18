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
import { getSatsFromTx } from '../app/functions/getSatsFromTx';
import { buildCumulativeData } from '../app/components/admin/homeComponents/analytics/cumulativeLineChartHelpers';
import { useAppStatus } from './appStatus';

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { sparkInformation } = useSparkWallet();
  const { didGetToHomepage } = useAppStatus();
  const { poolInfoRef } = useFlashnet();
  const [inTxs, setInTxs] = useState([]);
  const [outTxs, setOutTxs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!sparkInformation.identityPubKey && didGetToHomepage) return;
      setIsLoading(true);
      try {
        const startTime = Date.now();
        const [incoming, outgoing] = await Promise.all([
          getMonthlyTransactions(sparkInformation.identityPubKey, 'INCOMING'),
          getMonthlyTransactions(sparkInformation.identityPubKey, 'OUTGOING'),
        ]);
        setInTxs(incoming);
        setOutTxs(outgoing);
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
  }, [
    sparkInformation.identityPubKey,
    sparkInformation.transactions,
    didGetToHomepage,
  ]);

  const incomeTotal = useMemo(() => {
    try {
      return inTxs.reduce((sum, tx) => {
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
  }, [inTxs]);

  const spentTotal = useMemo(() => {
    try {
      return outTxs.reduce((sum, tx) => {
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
  }, [outTxs]);

  const cumulativeIncomeData = useMemo(() => {
    try {
      return buildCumulativeData(
        inTxs,
        undefined,
        poolInfoRef.currentPriceAInB,
        'INCOMING',
      );
    } catch (err) {
      console.log('error creating cumulative income data', err);
      return [];
    }
  }, [inTxs]);

  const cumulativeSpentData = useMemo(() => {
    try {
      return buildCumulativeData(
        outTxs,
        undefined,
        poolInfoRef.currentPriceAInB,
        'OUTGOING',
      );
    } catch (err) {
      console.log('error creating cumulative spend data', err);
      return [];
    }
  }, [outTxs]);

  return (
    <AnalyticsContext.Provider
      value={{
        inTxs,
        outTxs,
        incomeTotal,
        spentTotal,
        incomeTxCount: inTxs.length,
        spentTxCount: outTxs.length,
        cumulativeIncomeData,
        cumulativeSpentData,
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
