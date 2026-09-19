// Covers the web scan loop's decode path: native BarcodeDetector is preferred,
// a broken detector demotes to jsqr, and a hit stops the loop.
//
// The shim's detector latch is module-level, so each test resets the registry
// and re-requires React, the renderer and the shim together — requiring only
// the shim fresh would give it a second copy of React ("invalid hook call").
const mockJsQR = jest.fn();
jest.mock('jsqr', () => ({ __esModule: true, default: mockJsQR }));

let React;
let act;
let ReactTestRenderer;
let Camera;

let frameCallback;
let fakeVideo;
let detect;

function setupGlobals() {
  frameCallback = undefined;
  detect = jest.fn();

  const track = { stop: jest.fn(), applyConstraints: jest.fn() };
  Object.defineProperty(global, 'navigator', {
    value: {
      mediaDevices: {
        getUserMedia: jest.fn(async () => ({ getTracks: () => [track] })),
      },
    },
    configurable: true,
    writable: true,
  });

  const ctx = {
    drawImage: jest.fn(),
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
  };
  global.document = {
    createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }),
  };
  global.window = {
    BarcodeDetector: function BarcodeDetector() {
      return { detect };
    },
  };

  fakeVideo = {
    srcObject: null,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
    play: jest.fn(async () => {}),
    requestVideoFrameCallback: jest.fn(cb => {
      frameCallback = cb;
      return 1;
    }),
    cancelVideoFrameCallback: jest.fn(),
  };
}

async function mountCamera(onBarcodeScanned) {
  await act(async () => {
    ReactTestRenderer.create(
      React.createElement(Camera, {
        isActive: true,
        outputs: [{ __isBarcodeOutput: true, onBarcodeScanned }],
      }),
      { createNodeMock: () => fakeVideo },
    );
  });
}

// Drive one frame through whatever callback the loop last scheduled.
// Returns false when the loop scheduled nothing, i.e. it has stopped.
async function pumpFrame(timestamp) {
  const cb = frameCallback;
  frameCallback = undefined;
  if (!cb) return false;
  await act(async () => {
    await cb(timestamp);
  });
  return true;
}

describe('vision-camera web scan loop', () => {
  beforeEach(() => {
    jest.resetModules();
    mockJsQR.mockReset();
    setupGlobals();
    React = require('react');
    ReactTestRenderer = require('react-test-renderer');
    act = ReactTestRenderer.act;
    Camera = require('../../web-shims/react-native-vision-camera').Camera;
  });

  it('prefers BarcodeDetector over jsqr', async () => {
    detect.mockResolvedValue([{ rawValue: 'lnbc1native' }]);
    const onBarcodeScanned = jest.fn();

    await mountCamera(onBarcodeScanned);
    await pumpFrame(1000);

    expect(onBarcodeScanned).toHaveBeenCalledWith([
      { format: 'qr-code', rawValue: 'lnbc1native' },
    ]);
    expect(mockJsQR).not.toHaveBeenCalled();
  });

  it('demotes to jsqr when the detector throws, decoding without inversion', async () => {
    detect.mockRejectedValue(new Error('not really supported'));
    mockJsQR.mockReturnValue({ data: 'lnbc1jsqr' });
    const onBarcodeScanned = jest.fn();

    await mountCamera(onBarcodeScanned);
    await pumpFrame(1000);

    expect(onBarcodeScanned).toHaveBeenCalledWith([
      { format: 'qr-code', rawValue: 'lnbc1jsqr' },
    ]);
    expect(mockJsQR).toHaveBeenLastCalledWith(expect.anything(), 1, 1, {
      inversionAttempts: 'dontInvert',
    });
  });

  it('stops decoding after a hit', async () => {
    detect.mockResolvedValue([{ rawValue: 'lnbc1native' }]);
    const onBarcodeScanned = jest.fn();

    await mountCamera(onBarcodeScanned);
    await pumpFrame(1000);

    expect(detect).toHaveBeenCalledTimes(1);
    // Nothing further was scheduled, so the loop is no longer burning CPU
    // while the consumer animates away.
    expect(await pumpFrame(2000)).toBe(false);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(onBarcodeScanned).toHaveBeenCalledTimes(1);
  });
});
