import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import useQrScannerOutput from '../../../hooks/useQrScannerOutput';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getImageFromLibrary } from '../../../functions/imagePickerWrapper';
import getClipboardText from '../../../functions/getClipboardText';
import CameraUnavailable from '../../../functions/CustomElements/camera/cameraUnavailable';
import ScannerView from '../../../functions/CustomElements/camera/scannerView';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../functions/crashlyticsLogs';
import { useTranslation } from 'react-i18next';
import { detectQRCode } from '../../../functions/detectQrCode';

export default function CameraModal(props) {
  const navigate = useNavigation();
  const {
    status,
    hasPermission,
    requestPermission,
    canRequestPermission,
    hasAttemptedPermission,
  } = useCameraPermission();
  const device = useCameraDevice('back');
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const didScanRef = useRef(false);
  const didCallImagePicker = useRef(null);

  const isCameraActive = isFocused && !isClosing;
  // hasAttemptedPermission is web-only (undefined on native), where <Camera>'s
  // own getUserMedia is the prompt. Once an attempt has failed the focus effect
  // must not probe again — that is a second prompt in the same visit, and
  // Chrome hard-blocks the origin after a few. The no-access screen's button
  // re-requests on demand.
  const canAutoRequestPermission = !hasPermission && !hasAttemptedPermission;
  // Only reachable alongside !hasPermission below: a dismissed web prompt or
  // an Android denial that can still be re-prompted. A hard block shows the
  // settings copy instead.
  const showPermissionRetry = canRequestPermission;

  useFocusEffect(
    useCallback(() => {
      crashlyticsLogReport('Loading camera model page');
      if (canAutoRequestPermission) {
        requestPermission();
      }

      setIsFocused(true);
      setIsClosing(false);
      didScanRef.current = false;

      return () => {
        setIsFocused(false);
      };
    }, [canAutoRequestPermission, requestPermission]),
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

  const barcodeOutput = useQrScannerOutput({
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
      <CameraUnavailable
        title={t('wallet.cameraModal.noCamera')}
        sub={
          showPermissionRetry
            ? t('wallet.cameraModal.permissionDismissed')
            : t('wallet.cameraModal.settingsText')
        }
        buttonText={
          showPermissionRetry ? t('wallet.cameraModal.allowCamera') : ''
        }
        onPress={requestPermission}
      />
    );
  }

  // The camera is held by another app or tab. Retrying re-mounts <Camera>,
  // whose getUserMedia asks again.
  if (status === 'busy') {
    return (
      <CameraUnavailable
        title={t('wallet.cameraModal.cameraBusy')}
        sub={t('wallet.cameraModal.cameraBusySub')}
        buttonText={t('constants.tryAgain')}
        onPress={requestPermission}
      />
    );
  }

  if (device == null) {
    return (
      <CameraUnavailable
        title={t('wallet.cameraPage.noCameraDevice')}
        sub={t('wallet.cameraPage.noCameraDeviceSub')}
      />
    );
  }

  const actions = [
    {
      icon: 'Image',
      label: 'wallet.cameraModal.chooseImage',
      onPress: getQRImage,
    },
    props?.route?.params?.fromPage !== 'addContact' && {
      icon: 'Clipboard',
      label: 'wallet.cameraModal.pasteClipboard',
      onPress: dataFromClipboard,
    },
    {
      icon: isFlashOn ? 'Zap' : 'ZapOff',
      label: 'wallet.cameraModal.flash',
      onPress: toggleFlash,
    },
  ].filter(Boolean);

  return (
    <ScannerView
      onBack={() => {
        setIsClosing(true);
        navigate.goBack();
      }}
      actions={actions}
      hint={t('wallet.cameraModal.scanHint')}
    >
      <Camera
        outputs={[barcodeOutput]}
        onError={crashlyticsRecordErrorReport}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        torchMode={isFlashOn ? 'on' : 'off'}
      />
    </ScannerView>
  );
}
