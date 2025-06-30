import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {KeyContainer} from '../../../login';
import {useEffect, useRef, useState} from 'react';
import {COLORS, FONT, SIZES, SHADOWS, CENTER} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH, WINDOWWIDTH} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useTranslation} from 'react-i18next';
import {useKeysContext} from '../../../../../context-store/keys';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import calculateSeedQR from './seedQR';
import {copyToClipboard} from '../../../../functions';

export default function SeedPhrasePage({extraData}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {accountMnemoinc} = useKeysContext();
  const isInitialRender = useRef(true);
  const dimentions = useWindowDimensions();
  const mnemonic = accountMnemoinc.split(' ');
  const [showSeed, setShowSeed] = useState(false);
  const navigate = useNavigation();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {t} = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState();
  const sliderAnimation = useRef(new Animated.Value(0)).current;
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

  function handleSlide(type) {
    Animated.timing(sliderAnimation, {
      toValue: type === 'words' ? 3 : sliderWidth,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  const sliderWidth = 102;
  return (
    <View style={styles.globalContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}>
        <ThemeText
          styles={{...styles.headerPhrase}}
          content={t('settings.seedphrase.text1')}
        />
        <ThemeText
          styles={{
            color:
              theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
            marginBottom: 50,
            fontSize: SIZES.large,
          }}
          content={t('settings.seedphrase.text2')}
        />
        {selectedDisplayOption === 'qrcode' && canViewQrCode ? (
          <View
            style={{
              height: seedContainerHeight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <QrCodeWrapper QRData={qrValue} />
          </View>
        ) : (
          <View
            onLayout={event => {
              setSeedContainerHeight(event.nativeEvent.layout.height);
            }}
            style={styles.scrollViewContainer}>
            <KeyContainer keys={mnemonic} />
          </View>
        )}
        <View
          style={[
            styles.sliderContainer,
            {
              backgroundColor: backgroundOffset,
              alignItems: 'center',
            },
          ]}>
          <View style={styles.colorSchemeContainer}>
            <TouchableOpacity
              style={styles.colorSchemeItemContainer}
              activeOpacity={1}
              onPress={() => {
                setSelectedDisplayOption('words');
                handleSlide('words');
              }}>
              <ThemeText
                styles={{
                  ...styles.colorSchemeText,
                  color:
                    selectedDisplayOption === 'words'
                      ? COLORS.darkModeText
                      : theme
                      ? COLORS.darkModeText
                      : COLORS.lightModeText,
                }}
                content={'Words'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.colorSchemeItemContainer}
              activeOpacity={1}
              onPress={() => {
                if (!canViewQrCode) {
                  navigate.navigate('InformationPopup', {
                    textContent: `Are you sure you want to show this QR Code?\n\nScanning your seed is convenient, but be sure you're using a secure and trusted device. This helps keep your wallet safe.`,
                    buttonText: 'I understand',
                    customNavigation: () =>
                      navigate.popTo('SettingsContentHome', {
                        for: 'Backup wallet',
                        extraData: {canViewQrCode: true},
                      }),
                  });
                  return;
                }
                setSelectedDisplayOption('qrcode');
                handleSlide('qrcode');
              }}>
              <ThemeText
                styles={{
                  ...styles.colorSchemeText,
                  color:
                    selectedDisplayOption === 'qrcode'
                      ? COLORS.darkModeText
                      : theme
                      ? COLORS.darkModeText
                      : COLORS.lightModeText,
                }}
                content={'QR Code'}
              />
            </TouchableOpacity>
            <Animated.View
              style={[
                styles.activeSchemeStyle,

                {
                  transform: [{translateX: sliderAnimation}, {translateY: 3}],
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : COLORS.primary,
                },
              ]}
            />
          </View>
        </View>
        <CustomButton
          buttonStyles={{marginTop: 10}}
          actionFunction={() =>
            copyToClipboard(
              selectedDisplayOption === 'words' ? accountMnemoinc : qrValue,
              navigate,
            )
          }
          textContent={'Copy'}
        />
      </ScrollView>

      <Animated.View
        style={[
          styles.confirmPopup,
          {
            transform: [{translateY: fadeAnim}],
            backgroundColor: backgroundColor,
          },
        ]}>
        <View style={styles.confirmPopupInnerContainer}>
          <ThemeText
            styles={{...styles.confirmPopupTitle}}
            content={t('settings.seedphrase.text3')}
          />
          <View style={styles.confirmationContainer}>
            <CustomButton
              buttonStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
                marginRight: 20,
              }}
              textStyles={{color: COLORS.darkModeText}}
              textContent={t('constants.yes')}
              actionFunction={() => setShowSeed(true)}
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

  function fadeout() {
    Animated.timing(fadeAnim, {
      toValue: dimentions.height * 2,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }
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
