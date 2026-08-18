/* eslint-env jest */
// ---------------------------------------------------------------------------
// InlineQrScanner — the embeddable full-bleed camera for the child-account QR
// pairing path. Vision-camera + barcode-scanner are mocked; the tests drive
// the captured onBarcodeScanned callback and assert the contract the host
// screens rely on:
//   - single-fire: many barcode events for one QR → exactly one onScan
//   - resetToken bump re-arms the guard (error re-scan)
//   - only 'qr-code' formats with a rawValue ever reach onScan
//   - isActive is passed through to the Camera so the feed stops off-tab
//   - permission is requested on focus; denied → NoContentScreen fallback
//     copy; no device → noCameraDevice NoContentScreen copy
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import InlineQrScanner from '../../../../app/functions/CustomElements/camera/inlineQrScanner';

let mockHasPermission = true;
let mockDevice = { id: 'back-device' };
const mockRequestPermission = jest.fn();
const mockUseBarcodeScannerOutput = jest.fn(options => {
  mockScannerOptions = options;
  return {};
});
let mockScannerOptions = null;

jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  return {
    Camera: props => R.createElement('MockCamera', props),
    useCameraDevice: jest.fn(() => mockDevice),
    useCameraPermission: jest.fn(() => ({
      hasPermission: mockHasPermission,
      requestPermission: mockRequestPermission,
    })),
  };
});

jest.mock('react-native-vision-camera-barcode-scanner', () => ({
  useBarcodeScannerOutput: (...args) => mockUseBarcodeScannerOutput(...args),
}));

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useFocusEffect: effect => {
      useEffect(effect, [effect]);
    },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../../../../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { width: 390 } }),
}));

jest.mock('../../../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

jest.mock('../../../../app/constants', () => ({
  BARCODE_FORMATS: ['qr-code'],
  COLORS: { darkModeText: '#fff', lightsOutBackground: '#000' },
  SIZES: { smedium: 14 },
}));

jest.mock('../../../../app/functions/CustomElements/noContentScreen', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: props => R.createElement('MockNoContentScreen', props),
  };
});

const mockOnScan = jest.fn();

function renderScanner(props = {}) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <InlineQrScanner onScan={mockOnScan} {...props} />,
    );
  });
  return renderer;
}

function fireBarcode(barcode) {
  const options = mockScannerOptions;
  expect(options).toBeTruthy();
  act(() => {
    options.onBarcodeScanned([barcode]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission = true;
  mockDevice = { id: 'back-device' };
  mockScannerOptions = null;
});

describe('inlineQrScanner — scan dispatch', () => {
  test('fires onScan exactly once per QR regardless of duplicate barcode events', () => {
    renderScanner();

    fireBarcode({ format: 'qr-code', rawValue: '{"t":"childPair"}' });
    fireBarcode({ format: 'qr-code', rawValue: '{"t":"childPair"}' });
    fireBarcode({ format: 'qr-code', rawValue: '{"t":"childPair"}' });

    expect(mockOnScan).toHaveBeenCalledTimes(1);
    expect(mockOnScan).toHaveBeenCalledWith('{"t":"childPair"}');
  });

  test('a resetToken bump re-arms the single-fire guard (error re-scan)', async () => {
    const renderer = renderScanner();

    fireBarcode({ format: 'qr-code', rawValue: 'first' });
    expect(mockOnScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.update(<InlineQrScanner onScan={mockOnScan} resetToken={1} />);
    });

    fireBarcode({ format: 'qr-code', rawValue: 'second' });
    expect(mockOnScan).toHaveBeenCalledTimes(2);
    expect(mockOnScan).toHaveBeenLastCalledWith('second');
  });

  test('ignores non-QR formats and empty rawValues', () => {
    renderScanner();

    fireBarcode({ format: 'ean-13', rawValue: '123456789012' });
    fireBarcode({ format: 'qr-code', rawValue: '' });
    fireBarcode({ format: 'qr-code', rawValue: null });
    fireBarcode({});

    expect(mockOnScan).not.toHaveBeenCalled();
  });

  test('an empty barcode list never fires', () => {
    renderScanner();
    act(() => {
      mockScannerOptions.onBarcodeScanned([]);
    });
    expect(mockOnScan).not.toHaveBeenCalled();
  });
});

describe('inlineQrScanner — camera wiring', () => {
  test('renders the camera with the given isActive value', async () => {
    const renderer = renderScanner({ isActive: false });
    expect(renderer.root.findByType('MockCamera').props.isActive).toBe(false);

    await act(async () => {
      renderer.update(<InlineQrScanner onScan={mockOnScan} isActive={true} />);
    });
    expect(renderer.root.findByType('MockCamera').props.isActive).toBe(true);
  });
});

describe('inlineQrScanner — permission fallbacks', () => {
  test('requests permission on focus when it is not granted', () => {
    mockHasPermission = false;
    renderScanner();
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  test('permission denied renders the no-camera NoContentScreen copy', () => {
    mockHasPermission = false;
    const renderer = renderScanner();

    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens).toHaveLength(1);
    expect(screens[0].props.titleText).toBe('wallet.cameraModal.noCamera');
    expect(screens[0].props.subTitleText).toBe(
      'wallet.cameraModal.settingsText',
    );
  });

  test('no back device renders the noCameraDevice NoContentScreen', () => {
    mockDevice = null;
    const renderer = renderScanner();

    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens).toHaveLength(1);
    expect(screens[0].props.titleText).toBe('wallet.cameraPage.noCameraDevice');
  });
});
