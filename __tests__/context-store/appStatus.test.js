/* eslint-env jest */
// ---------------------------------------------------------------------------
// N2 source test: appStatus.js flips didGetToHomepage back to false after a
// background stint longer than BACKGROUND_THRESHOLD_MS (8 min), via a 100ms-
// delayed setTimeout. Combined with a background WebView termination this
// leaves the bridge dead on foreground (see webViewContext.adversarial.test.js
// "background termination + didGetToHomepage=false"). This file pins the flag
// behavior and its racy 100ms delay.
// ---------------------------------------------------------------------------

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isInternetReachable: true })),
}));

jest.mock('../../app/functions/boltz/boltzSwapInfo', () => ({
  getBoltzSwapPairInformation: jest.fn(async () => ({})),
}));

jest.mock('../../app/functions/boltz/rootstock/swapLimits', () => ({
  buildRootstockSubmarineLimits: jest.fn(() => ({})),
  DEFAULT_ROOTSTOCK_SUBMARINE_PAIR: { limits: { minimal: 1, maximal: 1 } },
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

jest.mock('../../navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: {
    isReady: () => true,
    getRootState: () => ({ routes: [{ name: 'Home' }] }),
    addListener: jest.fn(() => () => {}),
  },
}));

let React;
let RTR;
let act;
let AppState;
let SUT;
let renderer;
let captured;

function Probe() {
  captured = SUT.useAppStatus();
  return null;
}

async function renderProvider() {
  jest.resetModules();
  React = require('react');
  RTR = require('react-test-renderer');
  act = RTR.act;
  AppState = require('react-native').AppState;
  AppState.currentState = 'active';
  SUT = require('../../context-store/appStatus');
  AppState.addEventListener.mockClear();

  await act(async () => {
    renderer = RTR.create(
      React.createElement(
        SUT.AppStatusProvider,
        null,
        React.createElement(Probe, null),
      ),
    );
  });
  return AppState.addEventListener.mock.calls.find(
    ([event]) => event === 'change',
  )?.[1];
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  if (renderer) {
    act(() => {
      renderer.unmount();
    });
    renderer = null;
  }
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('appStatus — didGetToHomepage background threshold (N2)', () => {
  test('background longer than 8 minutes flips didGetToHomepage to false — after a 100ms delayed timeout', async () => {
    const changeHandler = await renderProvider();
    expect(changeHandler).toBeTruthy();
    // The flag starts false; the Home flow sets it true on first visit.
    act(() => captured.toggleDidGetToHomepage(true));
    expect(captured.didGetToHomepage).toBe(true);

    // Background → foreground after > BACKGROUND_THRESHOLD_MS (8 * 60 * 1000).
    act(() => changeHandler('background'));
    act(() => {
      jest.advanceTimersByTime(9 * 60 * 1000);
    });
    act(() => changeHandler('active'));

    // The flip is deferred 100ms — the bridge-facing flag is still true for
    // that window (the race the adversarial review flagged).
    expect(captured.didGetToHomepage).toBe(true);
    act(() => {
      jest.advanceTimersByTime(101);
    });
    expect(captured.didGetToHomepage).toBe(false);
  });

  test('background shorter than the threshold never flips the flag', async () => {
    const changeHandler = await renderProvider();
    act(() => captured.toggleDidGetToHomepage(true));
    expect(captured.didGetToHomepage).toBe(true);

    act(() => changeHandler('background'));
    act(() => {
      jest.advanceTimersByTime(60 * 1000); // 1 minute
    });
    act(() => changeHandler('active'));
    act(() => {
      jest.advanceTimersByTime(101);
    });
    expect(captured.didGetToHomepage).toBe(true);
  });
});
