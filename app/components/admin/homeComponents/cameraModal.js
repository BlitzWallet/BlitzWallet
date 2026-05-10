import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BARCODE_FORMATS, COLORS, SIZES } from '../../../constants';
import { ThemeText, GlobalThemeView } from '../../../functions/CustomElements';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import { getImageFromLibrary } from '../../../functions/imagePickerWrapper';
import getClipboardText from '../../../functions/getClipboardText';
import { CameraPageNavBar } from '../../../functions/CustomElements/camera/cameraPageNavbar';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../functions/crashlyticsLogs';
import { useTranslation } from 'react-i18next';
import { detectQRCode } from '../../../functions/detectQrCode';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import { useGlobalThemeContext } from '../../../../context-store/theme';

export default function CameraModal(props) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { t } = useTranslation();
  const { topPadding, bottomPadding } = useGlobalInsets();
  const [isFocused, setIsFocused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const didScanRef = useRef(false);
  const didCallImagePicker = useRef(null);

  const containerWidth =
    props?.route?.params?.fromPage !== 'addContact' ? 210 : 140;
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

  const handleBarcodeScanned = useCallback(
    codes => {
      if (didScanRef.current || codes.length === 0) return;
      const [barcode] = codes;
      if (barcode.format === 'qr-code' && barcode.rawValue) {
        crashlyticsLogReport('handling scanned barcode');
        handleFinish(barcode.rawValue);
      }
    },
    [handleFinish],
  );

  const barcodeOutput = useBarcodeScannerOutput({
    barcodeFormats: BARCODE_FORMATS,
    onBarcodeScanned: handleBarcodeScanned,
    onError: err => crashlyticsRecordErrorReport(err),
  });

  const toggleFlash = useCallback(() => {
    if (!device?.hasTorch) {
      return;
    }
    setIsFlashOn(prev => !prev);
  }, [device]);

  const dataFromClipboard = useCallback(async () => {
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
  }, [navigate, handleFinish, t]);

  const getQRImage = useCallback(async () => {
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
  }, [navigate, handleFinish, t]);

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
    <View
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Camera
        outputs={[barcodeOutput]}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        torchMode={isFlashOn ? 'on' : 'off'}
      />

      <TouchableOpacity
        style={[
          styles.cornerBtn,
          styles.cornerBtnLeft,
          { top: topPadding + 10 },
        ]}
        onPress={() => {
          setIsClosing(true);
          navigate.goBack();
        }}
      >
        <ThemeIcon
          iconName="ArrowLeft"
          size={22}
          colorOverride={COLORS.darkModeText}
        />
      </TouchableOpacity>

      <View style={styles.qrCenter}>
        <View
          style={[
            styles.qrBoxOutline,
            {
              borderColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            },
          ]}
        />
        <ThemeText
          styles={styles.qrHintText}
          content={t('wallet.cameraModal.scanHint')}
        />
      </View>

      <View style={[styles.bottomOverlay, { paddingBottom: bottomPadding }]}>
        <View style={[styles.bottomPill, { width: containerWidth }]}>
          <TouchableOpacity onPress={getQRImage}>
            <ThemeIcon iconName="Image" colorOverride={COLORS.darkModeText} />
          </TouchableOpacity>
          {props?.route?.params?.fromPage !== 'addContact' && (
            <TouchableOpacity onPress={dataFromClipboard}>
              <ThemeIcon
                iconName="Clipboard"
                colorOverride={COLORS.darkModeText}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggleFlash}>
            <ThemeIcon
              iconName={isFlashOn ? 'Zap' : 'ZapOff'}
              colorOverride={COLORS.darkModeText}
            />
          </TouchableOpacity>
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
  bottomOverlay: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: 0,
  },
  qrCenter: { alignItems: 'center' },
  qrBoxOutline: {
    width: 300,
    height: 300,
    borderWidth: 3,
    borderRadius: 20,
  },
  qrHintText: {
    color: COLORS.darkModeText,
    marginTop: 14,
    fontSize: SIZES.smedium,
    textAlign: 'center',
    includeFontPadding: false,
  },
  bottomPill: {
    justifyContent: 'space-between',
    flexDirection: 'row',
    gap: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 50,
  },
  cornerBtn: {
    position: 'absolute',
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBtnLeft: { left: 16 },
});
