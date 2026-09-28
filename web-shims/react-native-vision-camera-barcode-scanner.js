// Web shim for react-native-vision-camera-barcode-scanner. Returns a marker
// handle that the vision-camera web stub finds in <Camera outputs> and drives
// from its jsqr decode loop.
export function useBarcodeScannerOutput({ onBarcodeScanned, onError }) {
  return { __isBarcodeOutput: true, onBarcodeScanned, onError };
}
export default { useBarcodeScannerOutput };
