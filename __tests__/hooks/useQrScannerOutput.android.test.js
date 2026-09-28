import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useQrScannerOutput from '../../app/hooks/useQrScannerOutput.js';

let mockOptions;
jest.mock('react-native-vision-camera-barcode-scanner', () => ({
  useBarcodeScannerOutput: options => {
    mockOptions = options;
    return {};
  },
}));

jest.mock('../../app/constants', () => ({ BARCODE_FORMATS: ['qr-code'] }));

test('keeps Android QR scanning and error reporting on ML Kit', () => {
  const onBarcodeScanned = jest.fn();
  const onError = jest.fn();
  function TestHost() {
    useQrScannerOutput({ onBarcodeScanned, onError });
    return null;
  }

  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<TestHost />);
  });

  expect(mockOptions.barcodeFormats).toEqual(['qr-code']);
  const codes = [{ format: 'qr-code', rawValue: 'lightning:lnbc123' }];
  const error = new Error('Barcode scanner failed');
  act(() => {
    mockOptions.onBarcodeScanned(codes);
    mockOptions.onError(error);
  });
  expect(onBarcodeScanned).toHaveBeenCalledWith(codes);
  expect(onError).toHaveBeenCalledWith(error);

  act(() => renderer.unmount());
});
