// Loaded per test inside the isolated registry so shim and renderer share React.
let React, ReactTestRenderer, act;

// The shim reads navigator.mediaDevices at module load and keeps permission
// state module-wide, so each test loads a fresh copy against its own mock.
function loadShim(getUserMedia) {
  global.navigator.mediaDevices = { getUserMedia };
  // The decode loop re-schedules itself forever; the tests only need startup.
  global.requestAnimationFrame = jest.fn();
  global.document = {
    createElement: () => ({ getContext: () => ({}) }),
    visibilityState: 'visible',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  let shim;
  jest.isolateModules(() => {
    React = require('react');
    ReactTestRenderer = require('react-test-renderer');
    act = ReactTestRenderer.act;
    shim = require('../web-shims/react-native-vision-camera');
  });
  return shim;
}

const fakeStream = () => ({
  getTracks: () => [
    {
      stop: jest.fn(),
      readyState: 'live',
      muted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  ],
});
const nodeMock = () => ({ play: async () => {}, srcObject: null });

// Mirrors how sendBtcPage / cameraModal / inlineQrScanner use the API.
function Screen({ shim, onRender }) {
  const {
    hasPermission,
    requestPermission,
    canRequestPermission,
    hasAttemptedPermission,
  } = shim.useCameraPermission();
  const device = shim.useCameraDevice();
  onRender?.({
    hasPermission,
    canRequestPermission,
    hasAttemptedPermission,
    requestPermission,
  });
  const canAutoRequestPermission = !hasPermission && !hasAttemptedPermission;
  React.useEffect(() => {
    if (canAutoRequestPermission) requestPermission();
  }, [canAutoRequestPermission, requestPermission]);
  if (!hasPermission) return 'no-access';
  return React.createElement(shim.Camera, { device, isActive: true });
}

async function mount(shim, onRender) {
  let tree;
  await act(async () => {
    tree = ReactTestRenderer.create(
      React.createElement(Screen, { shim, onRender }),
      { createNodeMock: nodeMock },
    );
  });
  return tree;
}

afterEach(() => {
  delete global.navigator.mediaDevices;
  delete global.navigator.permissions;
  delete global.document;
});

test('does not render the no-access screen before permission resolves', async () => {
  const shim = loadShim(jest.fn(async () => fakeStream()));
  const renders = [];
  const tree = await mount(shim, v => renders.push(v.hasPermission));
  expect(renders[0]).toBe(true);
  act(() => tree.unmount());
});

test('opens the camera only once when access is granted', async () => {
  const getUserMedia = jest.fn(async () => fakeStream());
  const shim = loadShim(getUserMedia);
  const tree = await mount(shim);
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(tree.toJSON()).not.toBe('no-access');
  act(() => tree.unmount());
});

test('falls back to the no-access screen when access is denied', async () => {
  const shim = loadShim(
    jest.fn(async () => {
      throw new Error('NotAllowedError');
    }),
  );
  const tree = await mount(shim);
  expect(tree.toJSON()).toBe('no-access');
  act(() => tree.unmount());
});

test('a dismissed prompt does not trigger a second getUserMedia', async () => {
  const err = new Error('permission dismissed');
  err.name = 'NotAllowedError';
  const getUserMedia = jest.fn(async () => {
    throw err;
  });
  const shim = loadShim(getUserMedia);
  // Browsers leave the permission state at 'prompt' when the dialog is
  // dismissed without a choice; 'denied' means an explicit Block.
  global.navigator.permissions = { query: async () => ({ state: 'prompt' }) };

  let latest;
  const tree = await mount(shim, v => (latest = v));
  expect(latest.hasPermission).toBe(false);
  expect(latest.canRequestPermission).toBe(true);
  expect(latest.hasAttemptedPermission).toBe(true);
  expect(tree.toJSON()).toBe('no-access');
  // <Camera>'s own getUserMedia opened the prompt; the focus effect must not
  // re-probe and open a second one.
  expect(getUserMedia).toHaveBeenCalledTimes(1);

  // The no-access screen's retry button resets to 'unknown', which re-mounts
  // <Camera>; its own getUserMedia asks again.
  await act(async () => {
    await latest.requestPermission();
  });
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});

// Reads the hook without mounting <Camera>, so a getUserMedia call can only
// come from the hook itself.
function PermissionProbe({ shim, onRender }) {
  const { status, requestPermission } = shim.useCameraPermission();
  onRender?.({ status, requestPermission });
  return null;
}

test('requestPermission resets to unknown instead of probing for a stream', async () => {
  const err = new Error('permission dismissed');
  err.name = 'NotAllowedError';
  const getUserMedia = jest.fn(async () => {
    throw err;
  });
  const shim = loadShim(getUserMedia);
  global.navigator.permissions = { query: async () => ({ state: 'prompt' }) };
  // Drive the store to 'prompt-dismissed' through the static probe.
  await shim.requestCameraPermission();
  expect(getUserMedia).toHaveBeenCalledTimes(1);

  let latest;
  await act(async () => {
    ReactTestRenderer.create(
      React.createElement(PermissionProbe, {
        shim,
        onRender: v => (latest = v),
      }),
    );
  });
  expect(latest.status).toBe('prompt-dismissed');

  await act(async () => {
    await latest.requestPermission();
  });
  expect(latest.status).toBe('unknown');
  // The retry itself must not open a camera; <Camera> does that on mount.
  expect(getUserMedia).toHaveBeenCalledTimes(1);
});

test('a blocked camera reports that it cannot request again', async () => {
  const err = new Error('blocked');
  err.name = 'NotAllowedError';
  const getUserMedia = jest.fn(async () => {
    throw err;
  });
  const shim = loadShim(getUserMedia);
  global.navigator.permissions = { query: async () => ({ state: 'denied' }) };

  let latest;
  const tree = await mount(shim, v => (latest = v));
  expect(latest.hasPermission).toBe(false);
  expect(latest.canRequestPermission).toBe(false);
  expect(latest.hasAttemptedPermission).toBe(true);
  expect(tree.toJSON()).toBe('no-access');
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

// Mirrors the device branch of cameraModal / inlineQrScanner / sendBtcPage.
function DeviceScreen({ shim, onRender }) {
  const { status, hasPermission } = shim.useCameraPermission();
  const device = shim.useCameraDevice();
  onRender?.({
    status,
    hasPermission,
    hasDevice: device != null,
    hasTorch: device?.hasTorch,
  });
  if (!hasPermission) return 'no-access';
  if (device == null) return 'no-device';
  return React.createElement(shim.Camera, { device, isActive: true });
}

async function mountDeviceScreen(shim, onRender) {
  let tree;
  await act(async () => {
    tree = ReactTestRenderer.create(
      React.createElement(DeviceScreen, { shim, onRender }),
      { createNodeMock: nodeMock },
    );
  });
  return tree;
}

test('reports a missing camera as no device, not a permission failure', async () => {
  const err = new Error('no camera attached');
  err.name = 'NotFoundError';
  const shim = loadShim(
    jest.fn(async () => {
      throw err;
    }),
  );
  let latest;
  const tree = await mountDeviceScreen(shim, v => (latest = v));
  expect(latest).toEqual({
    status: 'nodevice',
    hasPermission: true,
    hasDevice: false,
  });
  expect(tree.toJSON()).toBe('no-device');
  act(() => tree.unmount());
});

test('reports a busy camera without claiming access was denied', async () => {
  const err = new Error('camera in use');
  err.name = 'NotReadableError';
  const shim = loadShim(
    jest.fn(async () => {
      throw err;
    }),
  );
  let latest;
  const tree = await mountDeviceScreen(shim, v => (latest = v));
  expect(latest).toEqual({
    status: 'busy',
    hasPermission: true,
    hasDevice: true,
  });
  act(() => tree.unmount());
});

test('exposes hasTorch from the live track to the device object', async () => {
  const track = {
    stop: jest.fn(),
    readyState: 'live',
    muted: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getCapabilities: () => ({ torch: true }),
  };
  const shim = loadShim(jest.fn(async () => ({ getTracks: () => [track] })));
  const seen = [];
  const tree = await mountDeviceScreen(shim, v => seen.push(v.hasTorch));
  // Unknown until the stream starts, then the cameraModal/sendBtcPage flash
  // button is allowed to toggle instead of no-oping or erroring.
  expect(seen[0]).toBeUndefined();
  expect(seen[seen.length - 1]).toBe(true);
  act(() => tree.unmount());
});

test('reports hasTorch false when the track lacks the capability', async () => {
  const shim = loadShim(jest.fn(async () => fakeStream()));
  const seen = [];
  const tree = await mountDeviceScreen(shim, v => seen.push(v.hasTorch));
  expect(seen[seen.length - 1]).toBe(false);
  expect(seen).not.toContain(true);
  act(() => tree.unmount());
});
