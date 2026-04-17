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

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { sparkInformation } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const [inTxs, setInTxs] = useState([]);
  const [outTxs, setOutTxs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!sparkInformation.identityPubKey) return;
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
  }, [sparkInformation.identityPubKey, sparkInformation.transactions]);

  const incomeTotal = useMemo(
    () =>
      inTxs.reduce((sum, tx) => {
        try {
          return (
            sum + getSatsFromTx(tx, poolInfoRef.currentPriceAInB, 'INCOMING')
          );
        } catch {
          return sum;
        }
      }, 0),
    [inTxs],
  );

  const spentTotal = useMemo(
    () =>
      outTxs.reduce((sum, tx) => {
        try {
          return (
            sum + getSatsFromTx(tx, poolInfoRef.currentPriceAInB, 'OUTGOING')
          );
        } catch {
          return sum;
        }
      }, 0),
    [outTxs],
  );

  const cumulativeIncomeData = useMemo(
    () =>
      buildCumulativeData(
        inTxs,
        undefined,
        poolInfoRef.currentPriceAInB,
        'INCOMING',
      ),
    [inTxs],
  );

  const cumulativeSpentData = useMemo(
    () =>
      buildCumulativeData(
        outTxs,
        undefined,
        poolInfoRef.currentPriceAInB,
        'OUTGOING',
      ),
    [outTxs],
  );

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
