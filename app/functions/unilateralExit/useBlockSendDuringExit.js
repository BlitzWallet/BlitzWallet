import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useKeysContext } from '../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { identityFor } from '../spark/walletRuntime';
import { hasActiveExit } from './exitStore';

// Fails open: a DB error must not lock the user out of sending.
export async function isSendBlocked({ isUsingAltAccount, mainIdentity }) {
  if (isUsingAltAccount || !mainIdentity) return false;
  try {
    return await hasActiveExit(mainIdentity);
  } catch {
    return false;
  }
}

export default function useBlockSendDuringExit() {
  const { accountMnemoinc } = useKeysContext();
  const { isUsingAltAccount } = useActiveCustodyAccount();
  const navigate = useNavigation();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const mainIdentity = accountMnemoinc
            ? await identityFor(accountMnemoinc)
            : '';
          if (cancelled) return;
          if (await isSendBlocked({ isUsingAltAccount, mainIdentity })) {
            if (cancelled) return;
            navigate.replace('ErrorScreen', {
              errorMessage: t('settings.unilateralExit.sendsBlocked'),
            });
          }
        } catch {}
      })();
      return () => {
        cancelled = true;
      };
    }, [accountMnemoinc, isUsingAltAccount]),
  );
}
