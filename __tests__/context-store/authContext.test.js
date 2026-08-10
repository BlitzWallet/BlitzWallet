/* eslint-env jest */
// ---------------------------------------------------------------------------
// authContext drives the long-background/logout reset: when the app returns to
// foreground with shouldResetStateRef set it bumps the reset counter AND resets
// navigation to SplashReload (login). The send screen's navigation guard relies
// on authResetkeyRef.current being incremented at that instant (before the
// SplashReload navigation unmounts consumers), so a payment that settles from
// the resulting bridge-cleanup does NOT navigate to the confirm/cancel screen.
// This pins that ref-increment + navigation behavior.
// ---------------------------------------------------------------------------

const mockAppStatus = {
  appState: 'background',
  shouldResetStateRef: { current: false },
};

jest.mock('../../context-store/appStatus', () => ({
  __esModule: true,
  useAppStatus: () => mockAppStatus,
}));

const mockReset = jest.fn();
jest.mock('../../navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: { current: { reset: (...a) => mockReset(...a) } },
}));

let React;
let RTR;
let act;
let SUT;
let renderer;
let captured;

function Probe() {
  captured = SUT.useAuthContext();
  return null;
}

async function render() {
  jest.resetModules();
  React = require('react');
  RTR = require('react-test-renderer');
  act = RTR.act;
  SUT = require('../../context-store/authContext');
  await act(async () => {
    renderer = RTR.create(
      React.createElement(
        SUT.AuthStatusProvider,
        null,
        React.createElement(Probe, null),
      ),
    );
  });
}

beforeEach(() => {
  mockAppStatus.appState = 'background';
  mockAppStatus.shouldResetStateRef = { current: false };
  mockReset.mockClear();
});

afterEach(() => {
  if (renderer) {
    act(() => renderer.unmount());
    renderer = null;
  }
});

test('a foreground reset increments authResetkeyRef and navigates to SplashReload', async () => {
  await render();
  expect(captured.authResetkeyRef.current).toBe(0);
  expect(captured.authResetkey).toBe(0);

  // Long background → foreground: appStatus has flagged a state reset.
  mockAppStatus.appState = 'active';
  mockAppStatus.shouldResetStateRef.current = true;
  await act(async () => {
    renderer.update(
      React.createElement(
        SUT.AuthStatusProvider,
        null,
        React.createElement(Probe, null),
      ),
    );
  });

  // The counter is bumped AND login navigation fired.
  expect(captured.authResetkeyRef.current).toBe(1);
  expect(captured.authResetkey).toBe(1);
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'SplashReload' }],
  });
});

test('no reset when shouldResetStateRef is false: counter stays put, no navigation', async () => {
  await render();
  mockAppStatus.appState = 'active';
  mockAppStatus.shouldResetStateRef.current = false;
  await act(async () => {
    renderer.update(
      React.createElement(
        SUT.AuthStatusProvider,
        null,
        React.createElement(Probe, null),
      ),
    );
  });

  expect(captured.authResetkeyRef.current).toBe(0);
  expect(captured.authResetkey).toBe(0);
  expect(mockReset).not.toHaveBeenCalled();
});
