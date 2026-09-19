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

const fakeStream = () => ({ getTracks: () => [{ stop: jest.fn() }] });
const nodeMock = () => ({ play: async () => {}, srcObject: null });

// Mirrors how sendBtcPage / cameraModal / inlineQrScanner use the API.
function Screen({ shim, onRender }) {
  const { hasPermission, requestPermission } = shim.useCameraPermission();
  onRender?.(hasPermission);
  React.useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);
  if (!hasPermission) return 'no-access';
  return React.createElement(shim.Camera, {
    device: shim.useCameraDevice(),
    isActive: true,
  });
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
  delete global.document;
});

test('does not render the no-access screen before permission resolves', async () => {
  const shim = loadShim(jest.fn(async () => fakeStream()));
  const renders = [];
  const tree = await mount(shim, v => renders.push(v));
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
