import { useEffect, createContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sparkTransactionsEventEmitter,
  SPARK_TX_UPDATE_ENVENT_NAME,
  ensureSparkDatabaseReady,
} from '../app/functions/spark/transactions';
import { SPEND_AND_REPLACE_STORAGE_KEY } from '../app/constants';
import { useGlobalContextProvider } from './context';
import { useSparkWallet } from './sparkContext';
import { useKeysContext } from './keys';
import { processSpendAndReplaceIntents } from '../app/functions/spark/spendAndReplace';

const SpendAndReplaceContext = createContext(null);

// Module-level so concurrent event fires share one lock. needsRerun captures
// events that land while a pass is running so they aren't dropped.
let isProcessing = false;
let needsRerun = false;

export function SpendAndReplaceProvider({ children }) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();

  useEffect(() => {
    const handleTransactionUpdate = async () => {
      if (!masterInfoObject[SPEND_AND_REPLACE_STORAGE_KEY]?.isEnabled) return;
      if (!sparkInformation?.identityPubKey) return;
      if (!sparkInformation?.sparkAddress) return;
      if (!accountMnemoinc) return;

      if (isProcessing) {
        needsRerun = true;
        return;
      }
      isProcessing = true;

      try {
        // Drain loop: rerun while events landed mid-pass, until a pass finds no
        // freshly-claimable rows.
        do {
          needsRerun = false;
          const db = await ensureSparkDatabaseReady();
          await processSpendAndReplaceIntents({
            db,
            accountId: sparkInformation.identityPubKey,
            mnemonic: accountMnemoinc,
            sparkAddress: sparkInformation.sparkAddress,
            t,
          });
        } while (needsRerun);
      } catch (err) {
        console.error('SpendAndReplace handler error:', err);
      } finally {
        isProcessing = false;
      }
    };

    sparkTransactionsEventEmitter.on(
      SPARK_TX_UPDATE_ENVENT_NAME,
      handleTransactionUpdate,
    );

    // Run once on mount to resume payments that confirmed while the app was
    // closed (discovered as unclaimed on next launch).
    handleTransactionUpdate();

    return () => {
      sparkTransactionsEventEmitter.off(
        SPARK_TX_UPDATE_ENVENT_NAME,
        handleTransactionUpdate,
      );
    };
  }, [masterInfoObject, sparkInformation, accountMnemoinc, t]);

  return (
    <SpendAndReplaceContext.Provider value={null}>
      {children}
    </SpendAndReplaceContext.Provider>
  );
}
