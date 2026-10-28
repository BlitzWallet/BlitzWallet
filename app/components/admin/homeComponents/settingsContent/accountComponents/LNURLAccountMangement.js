import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useCallback, useMemo } from 'react';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useToast } from '../../../../../../context-store/toastManager';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { copyToClipboard } from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
} from '../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import QrCard from '../../../../../functions/CustomElements/redesign/QrCard';
import TextButton from '../../../../../functions/CustomElements/redesign/TextButton';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import { SheetTitle } from '../../savings/savingsSheetParts';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { shareMessage } from '../../../../../functions/handleShare';

export default function LNURLAccountMangement({ account, lnurlAddress }) {
  const { screenDimensions } = useAppStatus();
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

  const qrSize = Math.min(Math.round(screenDimensions.width * 0.5), 216);

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

  return (
    <View style={styles.container}>
      <SheetTitle
        title={t(
          'settings.accountComponents.editAccountPage.lightningAddressLabel',
        )}
        first={true}
      />
      <CustomScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <QrCard
          value={lnurlAddress}
          size={qrSize}
          badge={<Disc icon={'Zap'} tone="primary" size={40} />}
          onPress={handleCopy}
          accessibilityLabel={t('wallet.halfModal.copyAddress')}
        >
          <View style={[styles.addressRow, { width: qrSize }]}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={[styles.addressText, { color: COLORS.lightModeText }]}
              content={lnurlAddress}
            />
            <ThemeIcon
              redesign
              size={16}
              iconName={'Copy'}
              colorOverride={COLORS.lightModeText}
            />
          </View>
        </QrCard>
      </CustomScrollView>

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
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  addressText: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
    includeFontPadding: false,
  },
  mainButton: { width: '100%', marginTop: CONTENT_KEYBOARD_OFFSET },
});
