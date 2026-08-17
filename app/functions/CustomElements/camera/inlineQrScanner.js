import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import { useFocusEffect } from '@react-navigation/native';
import { BARCODE_FORMATS } from '../../../constants';
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
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const didScanRef = useRef(false);

  // Re-arm after the host flips to an error status so a re-scan can fire.
  useEffect(() => {
    didScanRef.current = false;
  }, [resetToken]);

  useFocusEffect(
    useCallback(() => {
      if (!hasPermission) {
        requestPermission();
      }
    }, [hasPermission, requestPermission]),
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

  const barcodeOutput = useBarcodeScannerOutput({
    barcodeFormats: BARCODE_FORMATS,
    onBarcodeScanned: handleBarcodeScanned,
    onError: err => crashlyticsRecordErrorReport(err),
  });

  if (!hasPermission) {
    return (
      <NoContentScreen
        iconName="Camera"
        titleText={t('wallet.cameraModal.noCamera')}
        subTitleText={t('wallet.cameraModal.settingsText')}
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
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
      />
    </View>
  );
}
