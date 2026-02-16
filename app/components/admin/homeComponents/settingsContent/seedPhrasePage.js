import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { KeyContainer } from '../../../login';
import { useState } from 'react';
import { COLORS, FONT, SIZES, CENTER } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { useKeysContext } from '../../../../../context-store/keys';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import calculateSeedQR from './seedQR';
import { copyToClipboard } from '../../../../functions';
import { useToast } from '../../../../../context-store/toastManager';
import WordsQrToggle from '../../../../functions/CustomElements/wordsQrToggle';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function SeedPhrasePage({ extraData, route }) {
  const { showToast } = useToast();
  const { accountMnemoinc: contextMnemonic } = useKeysContext();

  const paramMnemonic =
    extraData?.mnemonic || route?.params?.extraData?.mnemonic;
  const mnemonicString = paramMnemonic || contextMnemonic;

  const mnemonic = mnemonicString.split(' ');
  const navigate = useNavigation();
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState();
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('words');
  const canViewQrCode = extraData?.canViewQrCode;
  const qrValue = calculateSeedQR(mnemonicString);

  const warningBorderColor =
    theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed;
  const warningAccentColor =
    theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed;
  const copyColor =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

  return (
    <View style={styles.globalContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}
      >
        {/* Warning Banner */}
        <View
          style={[
            styles.warningContainer,
            {
              backgroundColor: backgroundOffset,
              borderColor: warningBorderColor,
            },
          ]}
        >
          <View style={styles.warningHeader}>
            <ThemeIcon
              iconName="ShieldAlert"
              size={20}
              colorOverride={warningAccentColor}
            />
            <ThemeText
              styles={[styles.warningTitle, { color: warningAccentColor }]}
              content={t('settings.seedPhrase.header')}
            />
          </View>
          <ThemeText
            styles={[styles.warningDescription]}
            content={t('settings.seedPhrase.headerDesc')}
          />
        </View>

        {/* Phrase Grid or QR Code */}
        {selectedDisplayOption === 'qrcode' && canViewQrCode ? (
          <View
            style={[styles.contentContainer, { height: seedContainerHeight }]}
          >
            <QrCodeWrapper QRData={qrValue} />
          </View>
        ) : (
          <View
            onLayout={event => {
              setSeedContainerHeight(event.nativeEvent.layout.height);
            }}
            style={styles.seedContainer}
          >
            <KeyContainer keys={mnemonic} />
          </View>
        )}

        {/* Words/QR Toggle */}
        <WordsQrToggle
          setSelectedDisplayOption={setSelectedDisplayOption}
          selectedDisplayOption={selectedDisplayOption}
          canViewQrCode={canViewQrCode}
          qrNavigateFunc={() =>
            navigate.popTo('SettingsContentHome', {
              for: 'show seed phrase',
              extraData: { ...extraData, canViewQrCode: true },
            })
          }
        />

        {/* Copy (text-only, secondary) */}
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() =>
            copyToClipboard(
              selectedDisplayOption === 'words' ? mnemonicString : qrValue,
              showToast,
            )
          }
          activeOpacity={0.7}
        >
          <ThemeIcon iconName="Copy" size={16} colorOverride={copyColor} />
          <ThemeText
            styles={[styles.copyButtonText, { color: copyColor }]}
            content={t('constants.copy')}
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  scrollViewStyles: {
    width: INSET_WINDOW_WIDTH,
    flexGrow: 1,
    ...CENTER,
    alignItems: 'center',
    paddingTop: 20,
  },

  // Warning banner
  warningContainer: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    marginTop: 10,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningTitle: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Medium,
    flexShrink: 1,
    includeFontPadding: false,
  },
  warningDescription: {
    fontSize: SIZES.smedium,
    marginTop: 8,
    paddingLeft: 28,
  },

  // Seed / QR containers
  seedContainer: {
    marginBottom: 24,
    width: '100%',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
    gap: 6,
  },
  copyButtonText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Medium,
  },
});
