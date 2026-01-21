import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';

import { useCallback, useMemo, useRef, useState } from 'react';

import { CENTER, COLORS, ICONS, WEBSITE_REGEX } from '../../constants';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';

import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getQRImage } from '../../functions';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { backArrow } from '../../constants/styles';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { CameraPageNavBar } from '../../functions/CustomElements/camera/cameraPageNavbar';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import handlePreSendPageParsing from '../../functions/sendBitcoin/handlePreSendPageParsing';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import getClipboardText from '../../functions/getClipboardText';

const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);

export default function SendPaymentHome({ pageViewPage, from }) {
  console.log('SCREEN OPTIONS PAGE');
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { theme, darkModeType } = useGlobalThemeContext();
  const isPhotoeLibraryOpen = useRef(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const minZoom = device?.minZoom || 1;
  const maxZoom = device?.maxZoom || 100;
  const zoomOffset = useSharedValue(0);
  const zoom = useSharedValue(device?.neutralZoom || 1);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const didScanRef = useRef(false);
  const { t } = useTranslation();

  const screenDimensions = useMemo(() => Dimensions.get('screen'), []);
  const screenAspectRatio = useMemo(
    () => screenDimensions.height / screenDimensions.width,
    [screenDimensions],
  );
  const format = useCameraFormat(device?.formats?.length ? device : undefined, [
    { photoAspectRatio: screenAspectRatio },
  ]);

  const isCameraActive = useMemo(() => {
    const baseActive = navigate.canGoBack() ? isFocused : pageViewPage === 0;
    return baseActive && !isNavigatingAway;
  }, [isFocused, pageViewPage, navigate, isNavigatingAway]);

  const qrBoxOutlineStyle = useMemo(
    () => ({
      ...styles.qrBoxOutline,
      borderColor: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
    }),
    [theme, darkModeType],
  );

  const gesture = Gesture.Pinch()
    .onBegin(() => {
      zoomOffset.value = zoom.value;
    })
    .onUpdate(event => {
      let newZoom = zoomOffset.value * event.scale;

      newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));

      zoom.value = newZoom;
    });
  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }), [zoom]);

  useFocusEffect(
    useCallback(() => {
      crashlyticsLogReport('Loading camera model page');

      if (!hasPermission) {
        requestPermission();
      }

      return () => {
        didScanRef.current = false;
      };
    }, [hasPermission, requestPermission]),
  );

  const handleInvoice = useCallback(
    data => {
      setIsNavigatingAway(true);

      setTimeout(() => {
        const response = handlePreSendPageParsing(data);

        if (response.error) {
          navigate.navigate('ErrorScreen', { errorMessage: response.error });
          setIsNavigatingAway(false);
          return;
        }

        if (response.navigateToWebView) {
          navigate.navigate('CustomWebView', {
            headerText: '',
            webViewURL: response.webViewURL,
          });
          return;
        }

        if (from === 'home')
          navigate.navigate('ConfirmPaymentScreen', {
            btcAdress: response.btcAdress,
          });
        else
          navigate.replace('ConfirmPaymentScreen', {
            btcAdress: response.btcAdress,
          });
      }, 100);
    },
    [navigate, from],
  );

  const handleBarCodeScanned = useCallback(
    codes => {
      if (didScanRef.current || codes.length === 0 || isNavigatingAway) return;
      const [data] = codes;

      if (data.type !== 'qr') return;
      crashlyticsLogReport('Hanlding scanned baracode');
      didScanRef.current = true;
      handleInvoice(data.value);
    },
    [handleInvoice, isNavigatingAway],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleBarCodeScanned,
  });

  useFocusEffect(
    useCallback(() => {
      setIsNavigatingAway(false);
      didScanRef.current = false;
    }, []),
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
      crashlyticsLogReport('Getting photoe');
      isPhotoeLibraryOpen.current = true;
      const response = await getQRImage();
      const canGoBack = navigate.canGoBack();
      if (response.error) {
        if (canGoBack) {
          navigate.goBack();
          setTimeout(
            () => {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(response.error),
              });
            },
            Platform.OS === 'android' ? 350 : 50,
          );
          isPhotoeLibraryOpen.current = false;
          return;
        }

        navigate.navigate('ErrorScreen', {
          errorMessage: t(response.error),
        });
        isPhotoeLibraryOpen.current = false;
        return;
      }

      if (!response.didWork || !response.btcAdress) {
        isPhotoeLibraryOpen.current = false;
        return;
      }
      crashlyticsLogReport('Navigating to confirm payment screen');
      handleInvoice(response.btcAdress);
      isPhotoeLibraryOpen.current = false;
    } catch (err) {
      console.log('Error in getting QR image', err);
    }
  }, [navigate]);

  const handlePaste = useCallback(async () => {
    const response = await getClipboardText();

    if (!response.didWork) {
      navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
      return;
    }
    const clipboardData = response.data?.trim();
    handleInvoice(clipboardData);
  }, [navigate, handleInvoice]);

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        {from != 'home' && <CameraPageNavBar />}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
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
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill}>
        <ReanimatedCamera
          codeScanner={codeScanner}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isCameraActive}
          format={format}
          animatedProps={animatedProps}
          torch={isFlashOn ? 'on' : 'off'}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.overlay}>
            {from != 'home' && (
              <CameraPageNavBar useFullWidth={false} showWhiteImage={true} />
            )}
            <View style={styles.qrVerticalBackground}>
              <TouchableOpacity onPress={toggleFlash}>
                <Image
                  style={backArrow}
                  source={
                    isFlashOn
                      ? ICONS.FlashLightIcon
                      : ICONS.flashlightNoFillWhite
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isPhotoeLibraryOpen.current}
                onPress={getPhoto}
              >
                <ThemeIcon
                  colorOverride={COLORS.darkModeText}
                  iconName={'Image'}
                />
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
              onPress={handlePaste}
              style={styles.pasteBTN}
              activeOpacity={0.2}
            >
              <ThemeText
                styles={styles.pastBTNText}
                content={t('constants.paste')}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  errorText: { width: '80%', textAlign: 'center' },
  qrBoxOutline: {
    width: 250,
    height: 250,
    borderWidth: 3,
  },
  cameraOverlay: {
    position: 'absolute',
    zIndex: 1,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    flex: 1,
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
    borderColor: COLORS.darkModeText,
    marginTop: 10,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  pastBTNText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
    paddingHorizontal: 40,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
  },
});
