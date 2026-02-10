import { ScrollView, StyleSheet, View } from 'react-native';
import { KeyContainer } from '../../../login';
import { useEffect, useRef, useState } from 'react';
import { COLORS, SIZES, SHADOWS, CENTER } from '../../../../constants';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useGlobalContextProvider } from '../../../../../context-store/context';

export default function SeedPhrasePage({ extraData }) {
  const { toggleMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { showToast } = useToast();
  const fadeAnim = useSharedValue(0);
  const { screenDimensions } = useAppStatus();
  const { accountMnemoinc } = useKeysContext();
  const isInitialRender = useRef(true);
  const mnemonic = accountMnemoinc.split(' ');
  const [showSeed, setShowSeed] = useState(false);
  const navigate = useNavigation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState();
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('words');
  const canViewQrCode = extraData?.canViewQrCode;
  const qrValue = calculateSeedQR(accountMnemoinc);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (showSeed) {
      fadeout();
    }
  }, [showSeed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fadeAnim.value }],
    backgroundColor: backgroundColor,
  }));

  function fadeout() {
    fadeAnim.value = withTiming(screenDimensions.height * 2, {
      duration: 500,
    });
  }

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
              for: 'Backup wallet',
              extraData: { canViewQrCode: true },
            })
          }
        />
        <CustomButton
          buttonStyles={{ marginTop: 10 }}
          actionFunction={() =>
            copyToClipboard(
              selectedDisplayOption === 'words' ? accountMnemoinc : qrValue,
              showToast,
            )
          }
          textContent={t('constants.copy')}
        />
      </ScrollView>

      <Animated.View style={[styles.confirmPopup, animatedStyle]}>
        <View style={styles.confirmPopupInnerContainer}>
          <ThemeText
            styles={{ ...styles.confirmPopupTitle }}
            content={t('settings.seedPhrase.showSeedWarning')}
          />
          <View style={styles.confirmationContainer}>
            <CustomButton
              buttonStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
                marginRight: 20,
              }}
              textStyles={{ color: COLORS.darkModeText }}
              textContent={t('constants.yes')}
              actionFunction={() => {
                if (!masterInfoObject.didViewSeedPhrase)
                  toggleMasterInfoObject({ didViewSeedPhrase: true });
                setShowSeed(true);
              }}
            />
            <CustomButton
              textContent={t('constants.no')}
              actionFunction={navigate.goBack}
            />
          </View>
        </View>
      </Animated.View>
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

  confirmPopup: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
  },
  confirmationContainer: {
    flexDirection: 'row',
    marginTop: 50,
    width: '100%',
    justifyContent: 'center',
  },
  confirmPopupInnerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPopupTitle: {
    fontSize: SIZES.large,
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
  confirmBTN: {
    flex: 1,
    maxWidth: '45%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    ...SHADOWS.small,
  },
  confirmBTNText: {
    color: 'white',
    paddingVertical: 10,
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
    flexShrink: 1,
    paddingHorizontal: 5,
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
