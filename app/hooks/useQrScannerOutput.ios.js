import { useCallback } from 'react';
import { isScannedCode, useObjectOutput } from 'react-native-vision-camera';

const QR_OBJECT_TYPES = ['qr'];

// Use Apple's native metadata output so iOS does not link ML Kit.
// Native session errors are handled by the Camera's onError callback.
export default function useQrScannerOutput({ onBarcodeScanned }) {
  const onObjectsScanned = useCallback(
    objects => {
      const codes = objects
        .filter(
          object =>
            object.type === 'qr' && isScannedCode(object) && object.value,
        )
        .map(object => ({ format: 'qr-code', rawValue: object.value }));
      onBarcodeScanned(codes);
    },
    [onBarcodeScanned],
  );

  return useObjectOutput({
    types: QR_OBJECT_TYPES,
    onObjectsScanned,
  });
}
