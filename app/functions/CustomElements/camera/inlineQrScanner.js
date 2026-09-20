import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import useQrScannerOutput from '../../../hooks/useQrScannerOutput';
import { useFocusEffect } from '@react-navigation/native';
import NoContentScreen from '../noContentScreen';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../crashlyticsLogs';
import { useTranslation } from 'react-i18next';

// Embeddable, full-bleed QR scanner for screens that own the camera in-page
// (the child-account QR pairing path). A slim copy of cameraModal.js without
// the navigation coupling (goBack + route params), back button, or the bottom
// image/clipboard/flash pill. The host drives it:
//   onScan     — single-fire callback for valid QR rawValues
//   isActive   — camera runs only while focused AND the Scan tab is selected
//   resetToken — bump to re-arm the single-fire guard (error re-scan)
//   hintText   — the overlay hint line (defaults to the camera-modal copy)
export default function InlineQrScanner({
  onScan,
  isActive = true,
  resetToken = 0,
}) {
  const { t } = useTranslation();
  const {
    status,
    hasPermission,
    requestPermission,
    canRequestPermission,
    hasAttemptedPermission,
  } = useCameraPermission();
  const device = useCameraDevice('back');
  const didScanRef = useRef(false);
  // hasAttemptedPermission is web-only (undefined on native), where <Camera>'s
  // own getUserMedia is the prompt. Once an attempt has failed the focus effect
  // must not probe again — that is a second prompt in the same visit, and
  // Chrome hard-blocks the origin after a few. The no-access screen's button
  // re-requests on demand.
  const canAutoRequestPermission = !hasPermission && !hasAttemptedPermission;
  // Only reachable alongside !hasPermission above: a dismissed web prompt or
  // an Android denial that can still be re-prompted. A hard block shows the
  // settings copy instead.
  const showPermissionRetry = canRequestPermission;

  // Re-arm after the host flips to an error status so a re-scan can fire.
  useEffect(() => {
    didScanRef.current = false;
  }, [resetToken]);

  useFocusEffect(
    useCallback(() => {
      if (canAutoRequestPermission) {
        requestPermission();
      }
    }, [canAutoRequestPermission, requestPermission]),
  );

  const handleBarcodeScanned = useCallback(
    codes => {
      if (didScanRef.current || codes.length === 0) return;
      const [barcode] = codes;
      if (barcode.format === 'qr-code' && barcode.rawValue) {
        didScanRef.current = true;
        crashlyticsLogReport('inline QR scanner — handling scanned barcode');
        onScan(barcode.rawValue);
      }
    },
    [onScan],
  );

  const barcodeOutput = useQrScannerOutput({
    onBarcodeScanned: handleBarcodeScanned,
    onError: err => crashlyticsRecordErrorReport(err),
  });

  if (!hasPermission) {
    return (
      <NoContentScreen
        iconName="Camera"
        titleText={t('wallet.cameraModal.noCamera')}
        subTitleText={
          showPermissionRetry
            ? t('wallet.cameraModal.permissionDismissed')
            : t('wallet.cameraModal.settingsText')
        }
        showButton={showPermissionRetry}
        buttonText={t('wallet.cameraModal.allowCamera')}
        buttonFunction={requestPermission}
      />
    );
  }

  // The camera is held by another app or tab. Retrying re-mounts <Camera>,
  // whose getUserMedia asks again.
  if (status === 'busy') {
    return (
      <NoContentScreen
        iconName="Camera"
        titleText={t('wallet.cameraModal.cameraBusy')}
        subTitleText={t('wallet.cameraModal.cameraBusySub')}
        showButton={true}
        buttonText={t('constants.tryAgain')}
        buttonFunction={requestPermission}
      />
    );
  }

  if (device == null) {
    return (
      <NoContentScreen
        iconName="Camera"
        titleText={t('wallet.cameraPage.noCameraDevice')}
        subTitleText={t('wallet.cameraPage.noCameraDeviceSub')}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        outputs={[barcodeOutput]}
        onError={crashlyticsRecordErrorReport}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
      />
    </View>
  );
}
