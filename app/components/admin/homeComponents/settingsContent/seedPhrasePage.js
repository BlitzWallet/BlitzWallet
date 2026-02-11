import { ScrollView, StyleSheet, View } from 'react-native';
import { KeyContainer } from '../../../login';
import { useState } from 'react';
import { COLORS, SIZES, CENTER } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
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
export default function SeedPhrasePage({ extraData, route }) {
  const { showToast } = useToast();
  const { accountMnemoinc: contextMnemonic } = useKeysContext();

  const paramMnemonic =
    extraData?.mnemonic || route?.params?.extraData?.mnemonic;
  const mnemonicString = paramMnemonic || contextMnemonic;

  const mnemonic = mnemonicString.split(' ');
  const navigate = useNavigation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState();
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('words');
  const canViewQrCode = extraData?.canViewQrCode;
  const qrValue = calculateSeedQR(mnemonicString);

  return (
    <View style={styles.globalContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}
      >
        <ThemeText
          styles={{ ...styles.headerPhrase }}
          content={t('settings.seedPhrase.header')}
        />
        <ThemeText
          styles={{
            color:
              theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
            marginBottom: 50,

            textAlign: 'center',
          }}
          content={t('settings.seedPhrase.headerDesc')}
        />
        {selectedDisplayOption === 'qrcode' && canViewQrCode ? (
          <View
            style={{
              height: seedContainerHeight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <QrCodeWrapper QRData={qrValue} />
          </View>
        ) : (
          <View
            onLayout={event => {
              setSeedContainerHeight(event.nativeEvent.layout.height);
            }}
            style={styles.scrollViewContainer}
          >
            <KeyContainer keys={mnemonic} />
          </View>
        )}
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
        <CustomButton
          buttonStyles={{ marginTop: 10 }}
          actionFunction={() =>
            copyToClipboard(
              selectedDisplayOption === 'words' ? mnemonicString : qrValue,
              showToast,
            )
          }
          textContent={t('constants.copy')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  headerPhrase: {
    marginBottom: 15,
    fontSize: SIZES.xLarge,
    textAlign: 'center',
  },
  scrollViewContainer: {},
  scrollViewStyles: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 40,
    paddingBottom: 10,
    alignItems: 'center',
  },
});
