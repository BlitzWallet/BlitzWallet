import {useNavigation} from '@react-navigation/native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useToast} from '../../../../../../context-store/toastManager';
import GetThemeColors from '../../../../../hooks/themeColors';
import calculateSeedQR from '../seedQR';
import {INSET_WINDOW_WIDTH, SHADOWS} from '../../../../../constants/theme';
import {useTranslation} from 'react-i18next';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import {KeyContainer} from '../../../../login';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {copyToClipboard} from '../../../../../functions';

export default function ViewCustodyAccountPage({route}) {
  const {showToast} = useToast();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isInitialRender = useRef(true);
  const dimentions = useWindowDimensions();
  const [showSeed, setShowSeed] = useState(false);
  const {account} = route.params;
  const {extraData} = route.params;
  const mnemoinc = account.mnemoinc;
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const {t} = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState(0);
  const navigate = useNavigation();
  const sliderAnimation = useRef(new Animated.Value(3)).current;
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('words');
  const canViewQrCode = extraData?.canViewQrCode;
  const qrValue = calculateSeedQR(mnemoinc);
  const {theme, darkModeType} = useGlobalThemeContext();

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

  useEffect(() => {
    if (!canViewQrCode) return;
    setSelectedDisplayOption('qrcode');
    handleSlide('qrcode');
  }, [canViewQrCode]);
  const sliderWidth = 102;

  function fadeout() {
    Animated.timing(fadeAnim, {
      toValue: dimentions.height * 2,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <View>
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
              <KeyContainer keys={mnemoinc.split(' ')} />
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
                        navigate.popTo(
                          'ViewCustodyAccount',
                          {
                            extraData: {canViewQrCode: true},
                          },
                          {
                            merge: true,
                          },
                        ),
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
                selectedDisplayOption === 'words' ? mnemoinc : qrValue,
                showToast,
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
              backgroundColor,
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
    </GlobalThemeView>
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
