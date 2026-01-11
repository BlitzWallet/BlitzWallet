import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../../../../../constants/theme';
import { CENTER } from '../../../../../constants/styles';
import QRCode from 'react-native-qrcode-svg';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { ICONS } from '../../../../../constants';

export default function POSInstructionsPath() {
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const posURL = `https://pay.blitzwalletapp.com/${masterInfoObject.posSettings.storeName}`;

  return (
    <GlobalThemeView
      useStandardWidth={true}
      globalContainerStyles={{ backgroundColor: COLORS.white }}
    >
      <CustomSettingsTopBar
        label={t('settings.posPath.posInstructionsPath.title')}
        customBackColor={COLORS.lightModeText}
      />
      <ThemeText
        styles={[styles.headingText, { marginTop: 'auto' }]}
        content={t('settings.posPath.posInstructionsPath.head1')}
      />
      <ThemeText
        styles={styles.headingText}
        content={t('settings.posPath.posInstructionsPath.head2')}
      />

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          copyToClipboard(posURL, showToast);
        }}
        style={styles.qrCodeContainer}
      >
        <View style={styles.qrCodeBorder}>
          <QRCode
            size={250}
            quietZone={15}
            value={posURL}
            color={COLORS.white}
            backgroundColor={COLORS.lightModeText}
          />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          copyToClipboard(posURL, showToast);
        }}
      >
        <ThemeText
          styles={{
            textAlign: 'center',
            marginTop: 10,
            color: COLORS.lightModeText,
          }}
          content={posURL}
        />
      </TouchableOpacity>
      <ScrollView
        style={{ marginTop: 'auto', marginBottom: 'auto', maxHeight: 200 }}
      >
        <ThemeText
          styles={styles.lineItem}
          content={t('settings.posPath.posInstructionsPath.step1')}
        />
        <ThemeText
          styles={styles.lineItem}
          content={t('settings.posPath.posInstructionsPath.step2')}
        />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  headingText: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },
  qrCodeContainer: {
    width: 275,
    height: 275,
    borderRadius: 20,
    ...CENTER,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeBorder: {
    width: 250,
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
  },
  lineItem: {
    textAlign: 'center',
    marginVertical: 10,
    color: COLORS.lightModeText,
  },
});
