import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import { BARCODE_FORMATS } from '../constants';

// Android uses ML Kit; Metro selects useQrScannerOutput.ios.js on iOS.
export default function useQrScannerOutput({ onBarcodeScanned, onError }) {
  return useBarcodeScannerOutput({
    barcodeFormats: BARCODE_FORMATS,
    onBarcodeScanned,
    onError,
  });
}
