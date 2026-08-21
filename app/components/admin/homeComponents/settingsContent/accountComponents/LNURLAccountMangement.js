import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useToast } from '../../../../../../context-store/toastManager';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { copyToClipboard } from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { CENTER, SIZES } from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import { useNavigation } from '@react-navigation/native';

export default function LNURLAccountMangement({ account, lnurlAddress }) {
  const { bottomPadding } = useGlobalInsets();
  const { screenDimensions } = useAppStatus();
  const { showToast } = useToast();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const navigate = useNavigation();

  // Registry id for this account's LNURL entry; null for the main account
  // (no registry entry), which keeps the global currency behavior.
  const accountsLnurlId = useMemo(() => {
    const entry = Object.entries(masterInfoObject.accountsLnurl || {}).find(
      ([, v]) => v.uuid === account?.uuid,
    );
    return entry ? entry[0] : null;
  }, [masterInfoObject.accountsLnurl, account?.uuid]);

  const qrContainerSize = Math.round(screenDimensions.width * 0.75);
  const qrInnerSize = qrContainerSize - 25;

  const handleCopy = () => {
    if (!lnurlAddress) return;
    copyToClipboard(lnurlAddress, showToast);
  };

  return (
    <View style={styles.qrViewContainer}>
      <ScrollView
        contentContainerStyle={styles.qrViewScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity activeOpacity={0.8} onPress={handleCopy}>
          <QrCodeWrapper
            QRData={`${lnurlAddress}`}
            qrSize={qrInnerSize}
            outerContainerStyle={{
              width: qrContainerSize,
              height: qrContainerSize,
            }}
            innerContainerStyle={{
              width: qrInnerSize,
              height: qrInnerSize,
            }}
          />
          <ThemeText
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
            styles={styles.qrViewAddressText}
            content={lnurlAddress}
          />
        </TouchableOpacity>
      </ScrollView>

      <CustomButton
        buttonStyles={{ width: '100%' }}
        actionFunction={handleCopy}
        textContent={t('wallet.halfModal.copyAddress')}
      />
      <TouchableOpacity
        style={[styles.changeCurrencyButton, { marginBottom: bottomPadding }]}
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
    marginTop: 12,
    includeFontPadding: false,
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
