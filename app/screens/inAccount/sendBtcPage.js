import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {CENTER, COLORS, ICONS, WEBSITE_REGEX} from '../../constants';
import {useIsFocused, useNavigation} from '@react-navigation/native';

import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {navigateToSendUsingClipboard, getQRImage} from '../../functions';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import {backArrow} from '../../constants/styles';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import {useTranslation} from 'react-i18next';
import {convertMerchantQRToLightningAddress} from '../../functions/sendBitcoin/getMerchantAddress';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {CameraPageNavBar} from '../../functions/CustomElements/camera/cameraPageNavbar';

export default function SendPaymentHome({pageViewPage, from}) {
  console.log('SCREEN OPTIONS PAGE');
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const {theme, darkModeType} = useGlobalThemeContext();
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
  const format = useCameraFormat(device?.formats?.length ? device : undefined, [
    {photoAspectRatio: screenAspectRatio},
  ]);
  const isCameraActive = useMemo(
    () => (navigate.canGoBack() ? isFocused : pageViewPage === 0),
    [navigate, isFocused, pageViewPage],
  );

  const qrBoxOutlineStyle = useMemo(
    () => ({
      ...styles.qrBoxOutline,
      borderColor: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
    }),
    [theme, darkModeType],
  );
  useHandleBackPressNew();

  useEffect(() => {
    (async () => {
      try {
        await requestPermission();
      } catch (err) {
        console.log(err);
      }
    })();
  }, []);

  const handleBarCodeScanned = codes => {
    if (didScanRef.current || codes.length === 0) return;
    const [data] = codes;

    if (data.type !== 'qr') return;
    didScanRef.current = true;
    if (WEBSITE_REGEX.test(data.value)) {
      navigate.navigate('CustomWebView', {
        headerText: '',
        webViewURL: data.value,
      });
      return;
    }

    const merchantLNAddress = convertMerchantQRToLightningAddress({
      qrContent: data.value,
      network: process.env.BOLTZ_ENVIRONMENT,
    });
    if (from === 'home')
      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: merchantLNAddress || data.value,
      });
    else
      navigate.replace('ConfirmPaymentScreen', {
        btcAdress: merchantLNAddress || data.value,
      });
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleBarCodeScanned,
  });

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
      if (from === 'home')
        navigate.navigate('ConfirmPaymentScreen', {
          btcAdress: response.btcAdress,
        });
      else
        navigate.replace('ConfirmPaymentScreen', {
          btcAdress: response.btcAdress,
        });
    } catch (err) {
      console.log('Error in getting QR image', err);
    } finally {
      isPhotoeLibraryOpen.current = false;
    }
  }, [navigate]);

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        {from != 'home' && <CameraPageNavBar />}
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
        {from != 'home' && <CameraPageNavBar />}
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
            <CameraPageNavBar useFullWidth={false} showWhiteImage={true} />
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
              navigateToSendUsingClipboard(navigate, 'sendBTCPage', from);
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
