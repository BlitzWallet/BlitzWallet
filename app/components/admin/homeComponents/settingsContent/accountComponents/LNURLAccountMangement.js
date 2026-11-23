import { StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { useToast } from '../../../../../../context-store/toastManager';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { copyToClipboard } from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import QrCard from '../../../../../functions/CustomElements/redesign/QrCard';
import TextButton from '../../../../../functions/CustomElements/redesign/TextButton';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { shareMessage } from '../../../../../functions/handleShare';

export default function LNURLAccountMangement({
  account,
  lnurlAddress,
  setContentHeight,
}) {
  const { showToast } = useToast();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { globalContactsInformation } = useGlobalContactsInfo();

  // Registry id for this account's LNURL entry; null for the main account
  // (no registry entry), which keeps the global currency behavior.
  const accountsLnurlId = useMemo(() => {
    const entry = Object.entries(masterInfoObject.accountsLnurl || {}).find(
      ([, v]) => v.uuid === account?.uuid,
    );
    return entry ? entry[0] : null;
  }, [masterInfoObject.accountsLnurl, account?.uuid]);

  const isMain = !accountsLnurlId;

  const handleCopy = useCallback(() => {
    if (!lnurlAddress) return;
    copyToClipboard(lnurlAddress, showToast);
  }, [lnurlAddress, showToast]);

  const handleShare = useCallback(() => {
    if (!lnurlAddress) return;
    shareMessage({
      message: `https://blitzwalletapp.com/${globalContactsInformation?.myProfile?.uniqueName}`,
    });
  }, [lnurlAddress, globalContactsInformation?.myProfile?.uniqueName]);

  useEffect(() => {
    setContentHeight(500);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <QrCard
          value={lnurlAddress}
          onPress={handleCopy}
          accessibilityLabel={t('wallet.halfModal.copyAddress')}
        />
      </View>

      <CustomButton
        buttonStyles={styles.mainButton}
        actionFunction={isMain ? handleShare : handleCopy}
        textContent={
          isMain
            ? t('wallet.halfModal.sharePaylink')
            : t('wallet.halfModal.copyAddress')
        }
        size={'regular'}
      />
      <TextButton
        align="center"
        text={t('wallet.halfModal.changeReceiveCurrency')}
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'lnurlReceiveCurrencySelect',
            accountsLnurlId,
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  mainButton: { width: '100%', marginTop: CONTENT_KEYBOARD_OFFSET },
});
