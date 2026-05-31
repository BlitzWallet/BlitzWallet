import { useEffect, createContext, useRef } from 'react';
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
import { useFlashnet } from './flashnetContext';

const SpendAndReplaceContext = createContext(null);

export function SpendAndReplaceProvider({ children }) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const { poolInfoRef } = useFlashnet();
  const isProcessingRef = useRef(false);
  const needsRerunRef = useRef(false);
  const latestAccountRef = useRef({
    accountId: '',
    sparkAddress: '',
    mnemonic: '',
  });

  useEffect(() => {
    latestAccountRef.current = {
      accountId: sparkInformation?.identityPubKey || '',
      sparkAddress: sparkInformation?.sparkAddress || '',
      mnemonic: accountMnemoinc || '',
    };
  }, [
    sparkInformation?.identityPubKey,
    sparkInformation?.sparkAddress,
    accountMnemoinc,
  ]);

  useEffect(() => {
    const handleTransactionUpdate = async () => {
      if (!masterInfoObject[SPEND_AND_REPLACE_STORAGE_KEY]?.isEnabled) return;

      const accountSnapshot = {
        accountId: sparkInformation?.identityPubKey || '',
        sparkAddress: sparkInformation?.sparkAddress || '',
        mnemonic: accountMnemoinc || '',
      };
      if (
        !accountSnapshot.accountId ||
        !accountSnapshot.sparkAddress ||
        !accountSnapshot.mnemonic
      ) {
        return;
      }

      const isSameActiveAccount = () => {
        const latestAccount = latestAccountRef.current;
        return (
          latestAccount.accountId === accountSnapshot.accountId &&
          latestAccount.sparkAddress === accountSnapshot.sparkAddress &&
          latestAccount.mnemonic === accountSnapshot.mnemonic
        );
      };

      if (!isSameActiveAccount()) return;

      if (isProcessingRef.current) {
        needsRerunRef.current = true;
        return;
      }
      isProcessingRef.current = true;

      try {
        // Drain loop: rerun while events landed mid-pass, until a pass finds no
        // freshly-claimable rows.
        do {
          needsRerunRef.current = false;
          if (!isSameActiveAccount()) return;
          const db = await ensureSparkDatabaseReady();
          await processSpendAndReplaceIntents({
            db,
            accountId: accountSnapshot.accountId,
            mnemonic: accountSnapshot.mnemonic,
            sparkAddress: accountSnapshot.sparkAddress,
            t,
            poolInfoRef,
            isSameActiveAccount,
          });
        } while (needsRerunRef.current && isSameActiveAccount());
      } catch (err) {
        console.error('SpendAndReplace handler error:', err);
      } finally {
        isProcessingRef.current = false;
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
