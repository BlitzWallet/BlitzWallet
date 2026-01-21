import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CENTER, COLORS, ICONS } from '../../../constants';
import { ThemeText, GlobalThemeView } from '../../../functions/CustomElements';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import { backArrow } from '../../../constants/styles';
import { getImageFromLibrary } from '../../../functions/imagePickerWrapper';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import getClipboardText from '../../../functions/getClipboardText';
import { CameraPageNavBar } from '../../../functions/CustomElements/camera/cameraPageNavbar';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../functions/crashlyticsLogs';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../../context-store/appStatus';
import { detectQRCode } from '../../../functions/detectQrCode';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';

export default function CameraModal(props) {
  console.log('SCREEN OPTIONS PAGE');
  const navigate = useNavigation();
  const { screenDimensions } = useAppStatus();
  const screenAspectRatio = screenDimensions.height / screenDimensions.width;
  const { theme, darkModeType } = useGlobalThemeContext();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const didScanRef = useRef(false);
  const didCallImagePicker = useRef(null);

  const isCameraActive = isFocused && !isClosing;

  useFocusEffect(
    useCallback(() => {
      crashlyticsLogReport('Loading camera model page');
      if (!hasPermission) {
        requestPermission();
      }

      setIsFocused(true);
      setIsClosing(false);
      didScanRef.current = false;

      return () => {
        setIsFocused(false);
      };
    }, [hasPermission, requestPermission]),
  );

  const handleFinish = useCallback(
    data => {
      if (didScanRef.current) return;
      didScanRef.current = true;

      setIsClosing(true);

      setTimeout(() => {
        if (navigate.canGoBack()) {
          navigate.goBack();
          setTimeout(() => {
            props.route.params.updateBitcoinAdressFunc(data);
          }, 100);
        }
      }, 100);
    },
    [navigate, props.route.params],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (didScanRef.current || isClosing || codes.length === 0) return;
      const [data] = codes;
      if (data.type === 'qr' && data.value) {
        crashlyticsLogReport('handling scanned barcode');
        handleFinish(data.value);
      }
    },
  });

  const format = useCameraFormat(device?.formats?.length ? device : undefined, [
    { photoAspectRatio: screenAspectRatio },
  ]);

  const toggleFlash = useCallback(() => {
    if (!device?.hasTorch) {
      return;
    }
    setIsFlashOn(prev => !prev);
  }, [device]);

  const dataFromClipboard = async () => {
    try {
      const response = await getClipboardText();
      if (!response.didWork) {
        navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
        return;
      }
      handleFinish(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const getQRImage = async () => {
    if (didCallImagePicker.current) return;
    didCallImagePicker.current = true;

    const imagePickerResponse = await getImageFromLibrary();
    const { didRun, error, imgURL } = imagePickerResponse;

    if (!didRun) {
      didCallImagePicker.current = false;
      return;
    }

    if (error) {
      crashlyticsRecordErrorReport(error);
      didCallImagePicker.current = false;
      navigate.navigate('ErrorScreen', { errorMessage: t(error) });
      return;
    }

    try {
      const response = await detectQRCode(imgURL.uri);
      if (response?.values?.length > 0) {
        handleFinish(response.values[0]);
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('wallet.cameraModal.qrDecodeError'),
        });
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.cameraModal.qrDecodeError'),
      });
    } finally {
      didCallImagePicker.current = false;
    }
  };

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CameraPageNavBar />
        <View style={styles.centeredContainer}>
          <ThemeText
            styles={styles.errorText}
            content={t('wallet.cameraModal.noCamera')}
          />
          <ThemeText
            styles={styles.errorText}
            content={t('wallet.cameraModal.settingsText')}
          />
        </View>
      </GlobalThemeView>
    );
  }

  if (device == null) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CameraPageNavBar />
        <FullLoadingScreen
          showLoadingIcon={false}
          text={t('wallet.cameraModal.noCameraDevice')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        format={format}
        torch={isFlashOn ? 'on' : 'off'}
      />

      <View style={styles.cameraOverlay}>
        <View style={styles.topOverlay}>
          <CameraPageNavBar useFullWidth={false} showWhiteImage={true} />
          <View style={styles.qrVerticalBackground}>
            <TouchableOpacity onPress={toggleFlash}>
              <Image
                style={backArrow}
                source={
                  isFlashOn ? ICONS.FlashLightIcon : ICONS.flashlightNoFillWhite
                }
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={getQRImage}>
              <ThemeIcon
                size={30}
                colorOverride={COLORS.darkModeText}
                iconName={'Image'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View
            style={[
              styles.qrBoxOutline,
              {
                borderColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
          />
          <View style={styles.sideOverlay} />
        </View>

        <View style={styles.bottomOverlay}>
          {props?.route?.params?.fromPage !== 'addContact' && (
            <TouchableOpacity
              onPress={dataFromClipboard}
              style={styles.pasteBTN}
              activeOpacity={0.2}
            >
              <ThemeText
                styles={styles.pastBTNText}
                content={t('constants.paste')}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { width: '80%', textAlign: 'center' },
  qrBoxOutline: { width: 250, height: 250, borderWidth: 3 },
  qrVerticalBackground: {
    width: 250,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginTop: 'auto',
    ...CENTER,
  },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  middleRow: { flexDirection: 'row' },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  pasteBTN: {
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
    borderColor: COLORS.darkModeText,
    marginTop: 10,
  },
  pastBTNText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
    paddingHorizontal: 40,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
  },
});
