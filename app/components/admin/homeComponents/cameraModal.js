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
  const [isFlashOn, setIsFlashOn] = useState(false);
  const didScanRef = useRef(false);
  const didCallImagePicker = useRef(null);

  useFocusEffect(
    useCallback(() => {
      crashlyticsLogReport('Loading camera model page');

      if (!hasPermission) {
        requestPermission();
      }

      setIsFocused(true);

      return () => {
        setIsFocused(false);
        didScanRef.current = false;
      };
    }, [hasPermission, requestPermission]),
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      codes => {
        if (didScanRef.current) return;
        const [data] = codes;
        if (data.type !== 'qr') return;

        didScanRef.current = true;
        crashlyticsLogReport('handling scanned barcode');
        navigate.goBack();

        setTimeout(() => {
          props.route.params.updateBitcoinAdressFunc(data.value);
        }, 150);
      },
      [navigate, props.route.params],
    ),
  });

  const format = useCameraFormat(device?.formats?.length ? device : undefined, [
    { photoAspectRatio: screenAspectRatio },
  ]);

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CameraPageNavBar />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
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
        isActive={isFocused}
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
            style={{
              ...styles.qrBoxOutline,
              borderColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            }}
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
  function toggleFlash() {
    if (!device?.hasTorch) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.cameraModal.noFlash'),
      });
      return;
    }
    setIsFlashOn(prev => !prev);
  }

  async function dataFromClipboard() {
    try {
      const response = await getClipboardText();
      if (!response.didWork) {
        navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
        return;
      }
      crashlyticsLogReport('handling data from clipboard');
      navigate.goBack();
      props.route.params.updateBitcoinAdressFunc(response.data);
    } catch (err) {
      console.log(err);
    }
  }

  async function getQRImage() {
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
      navigate.goBack();
      setTimeout(
        () => {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(error),
          });
        },
        Platform.OS === 'android' ? 350 : 50,
      );
      didCallImagePicker.current = false;
      return;
    }

    try {
      const response = await detectQRCode(imgURL.uri);
      if (!response) throw new Error('Error detecting invoice');

      if (response.type != 'QRCode') {
        navigate.goBack();
        setTimeout(() => {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('wallet.cameraModal.sanningResponse'),
          });
        }, 150);
      }
      if (!response.values.length) {
        navigate.goBack();
        setTimeout(() => {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('wallet.cameraModal.qrDecodeError'),
          });
        }, 150);
        return;
      }
      crashlyticsLogReport('handling code from qr code');
      navigate.goBack();
      setTimeout(() => {
        props.route.params.updateBitcoinAdressFunc(response.values[0]);
      }, 150);
    } catch (err) {
      console.log(err);
      navigate.goBack();
      setTimeout(() => {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('wallet.cameraModal.qrDecodeError'),
        });
      }, 150);
    } finally {
      didCallImagePicker.current = false;
    }
  }
}

const styles = StyleSheet.create({
  errorText: { width: '80%', textAlign: 'center' },
  backArrow: {
    width: 30,
    height: 30,
  },
  qrBoxOutline: {
    width: 250,
    height: 250,
    borderWidth: 3,
  },
  qrLine: {
    width: '100%',
    height: 10,
    position: 'absolute',
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
  cameraOverlay: {
    position: 'absolute',
    zIndex: 1,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    flex: 1,
  },

  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  pastBTNText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
    paddingHorizontal: 40,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
  },
});
