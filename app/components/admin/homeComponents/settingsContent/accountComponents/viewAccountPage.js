import { useNavigation } from '@react-navigation/native';
import { CENTER, COLORS, SIZES } from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useToast } from '../../../../../../context-store/toastManager';
import calculateSeedQR from '../seedQR';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import { KeyContainer } from '../../../../login';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { copyToClipboard } from '../../../../../functions';
import WordsQrToggle from '../../../../../functions/CustomElements/wordsQrToggle';

export default function ViewCustodyAccountPage({ route }) {
  const { showToast } = useToast();
  const { account } = route.params;
  const { extraData } = route.params;
  const mnemoinc = account.mnemoinc;
  const { t } = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState(0);
  const navigate = useNavigation();
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('words');
  const canViewQrCode = extraData?.canViewQrCode;
  const qrValue = calculateSeedQR(mnemoinc);
  const { theme, darkModeType } = useGlobalThemeContext();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
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
            <KeyContainer keys={mnemoinc.split(' ')} />
          </View>
        )}
        <WordsQrToggle
          setSelectedDisplayOption={setSelectedDisplayOption}
          selectedDisplayOption={selectedDisplayOption}
          canViewQrCode={canViewQrCode}
          qrNavigateFunc={() =>
            navigate.popTo(
              'ViewCustodyAccount',
              {
                extraData: { canViewQrCode: true },
              },
              {
                merge: true,
              },
            )
          }
        />

        <CustomButton
          buttonStyles={{ marginTop: 10 }}
          actionFunction={() =>
            copyToClipboard(
              selectedDisplayOption === 'words' ? mnemoinc : qrValue,
              showToast,
            )
          }
          textContent={t('constants.copy')}
        />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
  },

  // slider contianer
  sliderContainer: {
    width: 200,
    paddingVertical: 5,
    borderRadius: 40,
    marginTop: 20,
  },
  colorSchemeContainer: {
    height: 'auto',
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  colorSchemeItemContainer: {
    width: '50%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  colorSchemeText: {
    width: '100%',
    includeFontPadding: false,
    textAlign: 'center',
  },
  activeSchemeStyle: {
    backgroundColor: COLORS.primary,
    position: 'absolute',
    height: '100%',
    width: 95,
    top: -3,
    left: 0,

    zIndex: -1,
    borderRadius: 30,
  },
});
