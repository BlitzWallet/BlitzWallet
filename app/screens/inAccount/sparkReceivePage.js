import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SIZES } from '../../constants';
import { useRef } from 'react';
import { copyToClipboard } from '../../functions';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import QrCodeWrapper from '../../functions/CustomElements/QrWrapper';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { shareMessage } from '../../functions/handleShare';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useToast } from '../../../context-store/toastManager';

export default function SparkReceivePage() {
  const { sparkInformation } = useSparkWallet();
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();
  const { showToast } = useToast();
  const isSharingRef = useRef(false);
  const sparkAddress = sparkInformation?.sparkAddress || '';

  const handleShare = async () => {
    if (isSharingRef.current) return;
    try {
      isSharingRef.current = true;
      await shareMessage({ message: sparkAddress });
    } finally {
      isSharingRef.current = false;
    }
  };

  const handleCopy = () => {
    if (!sparkAddress) return;
    copyToClipboard(sparkAddress, showToast);
  };

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <CustomSettingsTopBar
        showLeftImage={true}
        iconNew="Share"
        leftImageFunction={handleShare}
        label={t('screens.inAccount.sparkReceivePage.header')}
        containerStyles={{ marginBottom: 0 }}
      />
      <ScrollView
        contentContainerStyle={{
          justifyContent: 'center',
          alignItems: 'center',
          flexGrow: 1,
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity activeOpacity={0.8} onPress={handleCopy}>
          <QrCodeWrapper
            outerContainerStyle={{ backgroundColor: 'transparent' }}
            QRData={sparkAddress || ' '}
          />
        </TouchableOpacity>
        <ThemeText
          styles={styles.addressText}
          content={
            sparkAddress
              ? sparkAddress.slice(0, 10) + '...' + sparkAddress.slice(-10)
              : ''
          }
        />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  addressText: {
    marginTop: 12,
    fontSize: SIZES.small,
    opacity: 0.6,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
