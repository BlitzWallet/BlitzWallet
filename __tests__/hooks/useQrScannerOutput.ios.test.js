import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useQrScannerOutput from '../../app/hooks/useQrScannerOutput.ios';

let mockOptions;
const mockOutput = {};

jest.mock('react-native-vision-camera', () => ({
  useObjectOutput: options => {
    mockOptions = options;
    return mockOutput;
  },
  isScannedCode: object => 'value' in object,
}));

// The iOS bundle must work without the ML Kit native module installed.
jest.mock('react-native-vision-camera-barcode-scanner', () => {
  throw new Error('ML Kit must not be imported on iOS');
});

let renderer;
let output;
function TestHost({ onBarcodeScanned }) {
  output = useQrScannerOutput({ onBarcodeScanned });
  return null;
}

function renderScanner(onBarcodeScanned) {
  act(() => {
    renderer = ReactTestRenderer.create(
      <TestHost onBarcodeScanned={onBarcodeScanned} />,
    );
  });
}

afterEach(() => {
  act(() => renderer?.unmount());
});

test('delivers native iOS QR values in the format used by the camera screens', () => {
  const onBarcodeScanned = jest.fn();
  renderScanner(onBarcodeScanned);

  expect(output).toBe(mockOutput);
  expect(mockOptions.types).toEqual(['qr']);

  act(() => {
    mockOptions.onObjectsScanned([
      { type: 'qr', value: 'lightning:lnbc123' },
      { type: 'qr', value: '{"t":"childPair"}' },
    ]);
  });

  expect(onBarcodeScanned).toHaveBeenCalledWith([
    { format: 'qr-code', rawValue: 'lightning:lnbc123' },
    { format: 'qr-code', rawValue: '{"t":"childPair"}' },
  ]);
});

test('filters non-QR objects and unreadable codes before dispatch', () => {
  const onBarcodeScanned = jest.fn();
  renderScanner(onBarcodeScanned);

  act(() => {
    mockOptions.onObjectsScanned([
      { type: 'face', faceID: 1 },
      { type: 'ean-13', value: '1234567890123' },
      { type: 'qr' },
      { type: 'qr', value: undefined },
      { type: 'qr', value: '' },
      { type: 'qr', value: 'bitcoin:bc1qexample' },
    ]);
  });

  expect(onBarcodeScanned).toHaveBeenCalledWith([
    { format: 'qr-code', rawValue: 'bitcoin:bc1qexample' },
  ]);
});

test('uses the latest callback while keeping object types stable across renders', () => {
  const previousCallback = jest.fn();
  const nextCallback = jest.fn();
  renderScanner(previousCallback);
  const types = mockOptions.types;

  act(() => renderer.update(<TestHost onBarcodeScanned={nextCallback} />));
  expect(mockOptions.types).toBe(types);

  act(() => mockOptions.onObjectsScanned([]));
  expect(previousCallback).not.toHaveBeenCalled();
  expect(nextCallback).toHaveBeenCalledWith([]);
});
