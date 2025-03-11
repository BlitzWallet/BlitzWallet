import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {
  CENTER,
  COLORS,
  FONT,
  ICONS,
  SIZES,
  WEBSITE_REGEX,
} from '../../constants';
import {useIsFocused, useNavigation} from '@react-navigation/native';

import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {useIsForeground} from '../../hooks/isAppForground';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getClipboardText, getQRImage} from '../../functions';
import openWebBrowser from '../../functions/openWebBrowser';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import {WINDOWWIDTH} from '../../constants/theme';
import {ANDROIDSAFEAREA, backArrow} from '../../constants/styles';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import {useTranslation} from 'react-i18next';
import {convertMerchantQRToLightningAddress} from '../../functions/sendBitcoin/getMerchantAddress';
import {useGlobalThemeContext} from '../../../context-store/theme';
import handleBackPressNew from '../../hooks/handleBackPressNew';

export default function SendPaymentHome({pageViewPage, from}) {
  console.log('SCREEN OPTIONS PAGE');
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const isForeground = useIsForeground();
  const {theme, darkModeType} = useGlobalThemeContext();
  const insets = useSafeAreaInsets();
  const isPhotoeLibraryOpen = useRef(false);
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const didScanRef = useRef(false);
  const {t} = useTranslation();

  const screenDimensions = useMemo(() => Dimensions.get('screen'), []);
  const screenAspectRatio = useMemo(
    () => screenDimensions.height / screenDimensions.width,
    [screenDimensions],
  );
  const format = useCameraFormat(device, [
    {photoAspectRatio: screenAspectRatio},
  ]);
  const isCameraActive = useMemo(
    () =>
      navigate.canGoBack() ? isFocused && isForeground : pageViewPage === 0,
    [navigate, isFocused, isForeground, pageViewPage],
  );
  const topPadding = useMemo(
    () =>
      Platform.select({
        ios: insets.top,
        android: ANDROIDSAFEAREA,
      }),
    [insets],
  );

  const qrBoxOutlineStyle = useMemo(
    () => ({
      ...styles.qrBoxOutline,
      borderColor: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
    }),
    [theme, darkModeType],
  );
  handleBackPressNew();

  useEffect(() => {
    (async () => {
      try {
        await requestPermission();
      } catch (err) {
        console.log(err);
      }
    })();
  }, []);

  const handleBarCodeScanned = useCallback(
    async codes => {
      if (didScanRef.current) return;
      const [data] = codes;
      if (!data.type.includes('qr')) return;

      if (WEBSITE_REGEX.test(data.value)) {
        openWebBrowser({navigate, link: data.value});
        return;
      }

      didScanRef.current = true;
      const merchantLNAddress = convertMerchantQRToLightningAddress({
        qrContent: data.value,
        network: process.env.BOLTZ_ENVIRONMENT,
      });

      navigate.reset({
        index: 0,
        routes: [
          {name: 'HomeAdmin', params: {screen: 'Home'}},
          {
            name: 'ConfirmPaymentScreen',
            params: {btcAdress: merchantLNAddress || data.value},
          },
        ],
      });
    },
    [navigate],
  );
  const codeScanner = useMemo(
    () => ({
      codeTypes: ['qr'],
      onCodeScanned: handleBarCodeScanned,
    }),
    [handleBarCodeScanned],
  );

  const toggleFlash = useCallback(() => {
    if (!device?.hasTorch) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.cameraPage.error1'),
      });
      return;
    }
    setIsFlashOn(prev => !prev);
  }, [device, navigate, t]);

  const getPhoto = useCallback(async () => {
    try {
      if (isPhotoeLibraryOpen.current) return;
      isPhotoeLibraryOpen.current = true;
      const response = await getQRImage(navigate, 'modal');
      const canGoBack = navigate.canGoBack();
      if (response.error) {
        if (canGoBack) {
          navigate.goBack();
          setTimeout(
            () => {
              navigate.navigate('ErrorScreen', {
                errorMessage: response.error,
              });
            },
            Platform.OS === 'android' ? 350 : 50,
          );
          return;
        }

        navigate.navigate('ErrorScreen', {
          errorMessage: response.error,
        });
        return;
      }

      if (!response.didWork || !response.btcAdress) return;
      if (Platform.OS === 'android') {
        navigate.navigate('ConfirmPaymentScreen', {
          btcAdress: response.btcAdress,
          fromPage: '',
        });
      } else {
        navigate.reset({
          index: 0,
          routes: [
            {
              name: 'HomeAdmin',
              params: {
                screen: 'Home',
              },
            },
            {
              name: 'ConfirmPaymentScreen',
              params: {
                btcAdress: response.btcAdress,
              },
            },
          ],
        });
      }
    } catch (err) {
      console.log('Error in getting QR image', err);
    } finally {
      isPhotoeLibraryOpen.current = false;
    }
  }, [navigate]);

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        {from != 'home' && (
          <TouchableOpacity
            style={[
              styles.topBar,
              {position: 'absolute', zIndex: 99, top: topPadding},
            ]}
            activeOpacity={0.5}
            onPress={() => {
              navigate.goBack();
            }}>
            <Image
              source={ICONS.smallArrowLeft}
              style={[backArrow]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ThemeText
            styles={styles.errorText}
            content={t('wallet.cameraPage.noCameraAccess')}
          />
          <ThemeText
            styles={styles.errorText}
            content={t('wallet.cameraPage.settingsText')}
          />
        </View>
      </GlobalThemeView>
    );
  }
  if (device == null) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        {from != 'home' && (
          <TouchableOpacity
            style={[
              styles.topBar,
              {position: 'absolute', zIndex: 99, top: topPadding},
            ]}
            activeOpacity={0.5}
            onPress={() => {
              navigate.goBack();
            }}>
            <Image
              source={ICONS.smallArrowLeft}
              style={[backArrow]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
        <FullLoadingScreen
          showLoadingIcon={false}
          text={t('wallet.cameraPage.noCameraDevice')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <View style={{flex: 1}}>
      <Camera
        codeScanner={codeScanner}
        style={{
          flex: 1,
        }}
        device={device}
        isActive={isCameraActive}
        format={format}
        torch={isFlashOn ? 'on' : 'off'}
      />
      <View
        style={{
          position: 'absolute',
          zIndex: 1,
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          flex: 1,
        }}>
        <View style={styles.overlay}>
          {from != 'home' && (
            <TouchableOpacity
              style={{
                ...styles.topBar,
                paddingTop: topPadding,
              }}
              activeOpacity={0.5}
              onPress={() => {
                if (!navigate.canGoBack()) return;
                navigate.goBack();
              }}>
              <Image
                source={ICONS.arrow_small_left_white}
                style={[backArrow]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          <View style={styles.qrVerticalBackground}>
            <TouchableOpacity onPress={toggleFlash}>
              <Image
                style={backArrow}
                source={
                  isFlashOn ? ICONS.FlashLightIcon : ICONS.flashlightNoFillWhite
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isPhotoeLibraryOpen.current}
              onPress={getPhoto}>
              <Image style={backArrow} source={ICONS.ImagesIcon} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.middleRow}>
          <View style={styles.overlay} />
          <View style={qrBoxOutlineStyle} />
          <View style={styles.overlay} />
        </View>
        <View style={styles.overlay}>
          <TouchableOpacity
            onPress={() => {
              getClipboardText(navigate, 'sendBTCPage');
            }}
            style={{
              ...styles.pasteBTN,
              borderColor: COLORS.darkModeText,
              marginTop: 10,
            }}
            activeOpacity={0.2}>
            <ThemeText
              styles={{
                color: COLORS.darkModeText,
                includeFontPadding: false,
                paddingHorizontal: 40,
                paddingVertical: Platform.OS === 'ios' ? 8 : 5,
              }}
              content={'Paste'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: WINDOWWIDTH,

    ...CENTER,
  },
  errorText: {width: '80%', textAlign: 'center'},
  qrBoxOutline: {
    width: 250,
    height: 250,
    borderWidth: 3,
  },

  qrVerticalBackground: {
    width: 250,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginTop: 'auto',
    ...CENTER,
  },
  pasteBTN: {
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
});
