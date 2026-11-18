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
import { computeSpentTotal } from '../app/functions/analytics/deriveAnalytics';
import { useAppStatus } from './appStatus';

// --- Global numbers provider: always mounted. Computes ONLY the current
// month's spend total and transaction count: the budget hooks need them outside
// the analytics stack. Historical analytics is read on demand by the analytics
// page's own range hook, so no timeframe work runs while analytics is closed. ---
const AnalyticsNumbersContext = createContext(null);

export function AnalyticsNumbersProvider({ children }) {
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const { didGetToHomepage } = useAppStatus();
  const { poolInfoRef } = useFlashnet();
  const [spentTotal, setSpentTotal] = useState(0);
  const [spentTxCount, setSpentTxCount] = useState(0);
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
        setSpentTxCount(outgoingBTC.length + outgoingUSD.length);

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
    () => ({ spentTotal, spentTxCount, isLoading, isReloading }),
    [spentTotal, spentTxCount, isLoading, isReloading],
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
