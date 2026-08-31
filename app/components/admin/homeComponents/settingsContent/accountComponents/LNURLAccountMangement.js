import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import QrCodeWrapper, {
  MAX_QR_SIZE,
} from '../../../../../functions/CustomElements/QrWrapper';
import { useNavigation } from '@react-navigation/native';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { shareMessage } from '../../../../../functions/handleShare';

export default function LNURLAccountMangement({ account, lnurlAddress }) {
  const { screenDimensions } = useAppStatus();
  const { showToast } = useToast();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { globalContactsInformation } = useGlobalContactsInfo();

  // Registry id for this account's LNURL entry; null for the main account
  // (no registry entry), which keeps the global currency behavior.
  const accountsLnurlId = useMemo(() => {
    const entry = Object.entries(masterInfoObject.accountsLnurl || {}).find(
      ([, v]) => v.uuid === account?.uuid,
    );
    return entry ? entry[0] : null;
  }, [masterInfoObject.accountsLnurl, account?.uuid]);

  const qrContainerSize = useMemo(
    () => Math.min(Math.round(screenDimensions.width * 0.75), MAX_QR_SIZE),
    [screenDimensions.width],
  );
  const qrInnerSize = useMemo(() => qrContainerSize - 25, [qrContainerSize]);

  const qrOuterContainerStyle = useMemo(
    () => ({ width: qrContainerSize, height: qrContainerSize }),
    [qrContainerSize],
  );
  const qrInnerContainerStyle = useMemo(
    () => ({ width: qrInnerSize, height: qrInnerSize }),
    [qrInnerSize],
  );

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
    <View style={styles.qrViewContainer}>
      <ScrollView
        contentContainerStyle={styles.qrViewScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[
            styles.qrCardTouchable,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}
          activeOpacity={0.8}
          onPress={handleCopy}
        >
          <QrCodeWrapper
            QRData={`${lnurlAddress}`}
            qrSize={qrInnerSize}
            outerContainerStyle={qrOuterContainerStyle}
            innerContainerStyle={qrInnerContainerStyle}
          />
          <View style={[styles.qrAddressRow, { width: qrInnerSize }]}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.qrViewAddressText}
              content={lnurlAddress}
            />
            <View style={styles.copyIconWrapper}>
              <ThemeIcon size={20} iconName={'Copy'} />
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <CustomButton
        buttonStyles={styles.mainButton}
        actionFunction={isMain ? handleShare : handleCopy}
        textContent={
          isMain
            ? t('wallet.halfModal.sharePaylink')
            : t('wallet.halfModal.copyAddress')
        }
      />
      <TouchableOpacity
        style={styles.changeCurrencyButton}
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'lnurlReceiveCurrencySelect',
            accountsLnurlId,
          })
        }
      >
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          styles={styles.changeCurrencyText}
          content={t('wallet.halfModal.changeReceiveCurrency')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  qrViewContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  qrViewScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  qrViewAddressText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
  mainButton: { width: '100%', marginTop: CONTENT_KEYBOARD_OFFSET },
  qrCardTouchable: {
    borderRadius: 16,
    paddingBottom: 12.5,
    overflow: 'hidden',
  },
  qrAddressRow: {
    flexDirection: 'row',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 10,
  },
  copyIconWrapper: {
    opacity: HIDDEN_OPACITY,
  },
  changeCurrencyButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  changeCurrencyText: {
    includeFontPadding: false,
  },
});
