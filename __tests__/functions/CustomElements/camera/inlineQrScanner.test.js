/* eslint-env jest */
// ---------------------------------------------------------------------------
// InlineQrScanner — the embeddable full-bleed camera for the child-account QR
// pairing path. VisionCamera’s native object output is mocked; the tests drive
// the captured onObjectsScanned callback and assert the contract the host
// screens rely on:
//   - single-fire: many barcode events for one QR → exactly one onScan
//   - resetToken bump re-arms the guard (error re-scan)
//   - only 'qr' objects with a value ever reach onScan
//   - isActive is passed through to the Camera so the feed stops off-tab
//   - permission is requested on focus; denied → NoContentScreen fallback
//     copy; no device → noCameraDevice NoContentScreen copy
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import InlineQrScanner from '../../../../app/functions/CustomElements/camera/inlineQrScanner';
import { crashlyticsRecordErrorReport } from '../../../../app/functions/crashlyticsLogs';

let mockHasPermission = true;
let mockCanRequestPermission = true;
let mockHasAttemptedPermission = false;
let mockStatus = 'unknown';
let mockDevice = { id: 'back-device' };
const mockRequestPermission = jest.fn();
const mockUseObjectOutput = jest.fn(options => {
  mockScannerOptions = options;
  return {};
});
let mockScannerOptions = null;

jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  return {
    Camera: props => R.createElement('MockCamera', props),
    useObjectOutput: (...args) => mockUseObjectOutput(...args),
    isScannedCode: object => 'value' in object,
    useCameraDevice: jest.fn(() => mockDevice),
    useCameraPermission: jest.fn(() => ({
      status: mockStatus,
      hasPermission: mockHasPermission,
      requestPermission: mockRequestPermission,
      canRequestPermission: mockCanRequestPermission,
      hasAttemptedPermission: mockHasAttemptedPermission,
    })),
  };
});

jest.mock('react-native-vision-camera-barcode-scanner', () => {
  throw new Error('ML Kit must not be imported on iOS');
});

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
    options.onObjectsScanned([barcode]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission = true;
  mockCanRequestPermission = true;
  mockHasAttemptedPermission = false;
  mockStatus = 'unknown';
  mockDevice = { id: 'back-device' };
  mockScannerOptions = null;
});

describe('inlineQrScanner — scan dispatch', () => {
  test('fires onScan exactly once per QR regardless of duplicate barcode events', () => {
    renderScanner();

    fireBarcode({ type: 'qr', value: '{"t":"childPair"}' });
    fireBarcode({ type: 'qr', value: '{"t":"childPair"}' });
    fireBarcode({ type: 'qr', value: '{"t":"childPair"}' });

    expect(mockOnScan).toHaveBeenCalledTimes(1);
    expect(mockOnScan).toHaveBeenCalledWith('{"t":"childPair"}');
  });

  test('a resetToken bump re-arms the single-fire guard (error re-scan)', async () => {
    const renderer = renderScanner();

    fireBarcode({ type: 'qr', value: 'first' });
    expect(mockOnScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.update(<InlineQrScanner onScan={mockOnScan} resetToken={1} />);
    });

    fireBarcode({ type: 'qr', value: 'second' });
    expect(mockOnScan).toHaveBeenCalledTimes(2);
    expect(mockOnScan).toHaveBeenLastCalledWith('second');
  });

  test('ignores non-QR objects and empty values', () => {
    renderScanner();

    fireBarcode({ type: 'ean-13', value: '123456789012' });
    fireBarcode({ type: 'qr', value: '' });
    fireBarcode({ type: 'qr', value: null });
    fireBarcode({});

    expect(mockOnScan).not.toHaveBeenCalled();
  });

  test('an empty barcode list never fires', () => {
    renderScanner();
    act(() => {
      mockScannerOptions.onObjectsScanned([]);
    });
    expect(mockOnScan).not.toHaveBeenCalled();
  });
});

describe('inlineQrScanner — camera wiring', () => {
  test('reports native camera session errors', () => {
    const renderer = renderScanner();
    const error = new Error('Camera session failed');
    act(() => renderer.root.findByType('MockCamera').props.onError(error));
    expect(crashlyticsRecordErrorReport).toHaveBeenCalledWith(error);
  });

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

  test('does not auto-request again after a failed attempt', () => {
    mockHasPermission = false;
    mockCanRequestPermission = true;
    mockHasAttemptedPermission = true;
    renderScanner();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  test('a dismissed prompt shows an Allow camera button that re-requests', () => {
    mockHasPermission = false;
    mockCanRequestPermission = true;
    mockHasAttemptedPermission = true;
    const renderer = renderScanner();

    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens).toHaveLength(1);
    expect(screens[0].props.showButton).toBe(true);
    expect(screens[0].props.buttonText).toBe('wallet.cameraModal.allowCamera');
    expect(screens[0].props.subTitleText).toBe(
      'wallet.cameraModal.permissionDismissed',
    );

    act(() => screens[0].props.buttonFunction());
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  test('a native re-prompt keeps the retry button without an attempted probe', () => {
    // Android reports canRequestPermission true after a plain denial and
    // hasAttemptedPermission is undefined on native, so the button must only
    // depend on canRequestPermission.
    mockHasPermission = false;
    mockCanRequestPermission = true;
    mockHasAttemptedPermission = undefined;
    const renderer = renderScanner();

    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens[0].props.showButton).toBe(true);
    expect(screens[0].props.buttonText).toBe('wallet.cameraModal.allowCamera');
  });

  test('a busy camera renders a retry screen instead of a dead preview', () => {
    mockHasPermission = true;
    mockStatus = 'busy';
    const renderer = renderScanner();

    expect(renderer.root.findAllByType('MockCamera')).toHaveLength(0);
    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens).toHaveLength(1);
    expect(screens[0].props.titleText).toBe('wallet.cameraModal.cameraBusy');
    expect(screens[0].props.subTitleText).toBe(
      'wallet.cameraModal.cameraBusySub',
    );
    expect(screens[0].props.showButton).toBe(true);
    expect(screens[0].props.buttonText).toBe('constants.tryAgain');

    act(() => screens[0].props.buttonFunction());
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  test('permission denied renders the no-camera NoContentScreen copy', () => {
    mockHasPermission = false;
    mockCanRequestPermission = false;
    mockHasAttemptedPermission = true;
    const renderer = renderScanner();

    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens).toHaveLength(1);
    expect(screens[0].props.titleText).toBe('wallet.cameraModal.noCamera');
    expect(screens[0].props.subTitleText).toBe(
      'wallet.cameraModal.settingsText',
    );
    expect(screens[0].props.showButton).toBe(false);
  });

  test('no back device renders the noCameraDevice NoContentScreen', () => {
    mockDevice = null;
    const renderer = renderScanner();

    const screens = renderer.root.findAllByType('MockNoContentScreen');
    expect(screens).toHaveLength(1);
    expect(screens[0].props.titleText).toBe('wallet.cameraPage.noCameraDevice');
  });
});
