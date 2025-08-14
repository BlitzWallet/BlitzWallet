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
  View,
} from 'react-native';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useToast} from '../../../../../../context-store/toastManager';
import GetThemeColors from '../../../../../hooks/themeColors';
import calculateSeedQR from '../seedQR';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {useTranslation} from 'react-i18next';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import {KeyContainer} from '../../../../login';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {copyToClipboard} from '../../../../../functions';

export default function ViewCustodyAccountPage({route}) {
  const {showToast} = useToast();
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
  const sliderWidth = 102;

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

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}>
        <ThemeText
          styles={{...styles.headerPhrase}}
          content={t('settings.seedPhrase.header')}
        />
        <ThemeText
          styles={{
            color:
              theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
            marginBottom: 50,
            fontSize: SIZES.large,
          }}
          content={t('settings.seedPhrase.headerDesc')}
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
                content={t('constants.words')}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.colorSchemeItemContainer}
              activeOpacity={1}
              onPress={() => {
                if (!canViewQrCode) {
                  navigate.navigate('InformationPopup', {
                    textContent: t(
                      'settings.accountComponents.viewAccountPage.informationMessage',
                    ),
                    buttonText: t('constants.understandText'),
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
                content={t('constants.qrCode')}
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
