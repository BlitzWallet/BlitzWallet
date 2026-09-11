/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Dimensions, Platform, Text } from 'react-native';
import { AppStatusProvider, useAppStatus } from '../../context-store/appStatus';

const mockRemove = jest.fn();
let addListenerSpy = null;

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isInternetReachable: true })),
}));

jest.mock('../../app/functions/boltz/boltzSwapInfo', () => ({
  getBoltzSwapPairInformation: jest.fn(async () => ({})),
}));

jest.mock('../../app/functions/boltz/rootstock/swapLimits', () => ({
  buildRootstockSubmarineLimits: jest.fn(() => ({})),
  DEFAULT_ROOTSTOCK_SUBMARINE_PAIR: { limits: { minimal: 2500, maximal: 25 } },
}));

jest.mock('../../navigation/navigationService', () => ({
  navigationRef: { addListener: jest.fn(() => () => {}) },
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

let renderer;
function renderProvider() {
  return ReactTestRenderer.create(
    <AppStatusProvider>
      <Text>child</Text>
    </AppStatusProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  addListenerSpy?.mockRestore();
  addListenerSpy = jest
    .spyOn(Dimensions, 'addEventListener')
    .mockImplementation(() => ({ remove: mockRemove }));
  renderer = null;
});

describe('AppStatusProvider subscription lifecycle', () => {
  it('subscribes to dimension changes on mount', async () => {
    await act(async () => {
      renderer = renderProvider();
    });

    expect(addListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes the dimension listener on unmount', async () => {
    await act(async () => {
      renderer = renderProvider();
    });

    await act(async () => {
      renderer.unmount();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('does not leak duplicate dimension subscriptions across remounts', async () => {
    await act(async () => {
      renderer = renderProvider();
    });
    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      renderer = renderProvider();
    });

    expect(addListenerSpy).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});

describe('AppStatusProvider screenDimensions', () => {
  // On react-native-web, 'screen' is window.screen: the physical monitor.
  const MONITOR = { width: 1512, height: 982, scale: 2, fontScale: 1 };
  const BROWSER_WINDOW = { width: 420, height: 700, scale: 2, fontScale: 1 };

  async function renderAndRead() {
    let latest;
    function Probe() {
      latest = useAppStatus().screenDimensions;
      return null;
    }
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <AppStatusProvider>
          <Probe />
        </AppStatusProvider>,
      );
    });
    return () => latest;
  }

  it('sizes against the browser window on web and follows its resizes', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    const get = jest
      .spyOn(Dimensions, 'get')
      .mockImplementation(key => (key === 'window' ? BROWSER_WINDOW : MONITOR));
    try {
      const read = await renderAndRead();
      expect(read().width).toBe(420);

      const onChange = addListenerSpy.mock.calls[0][1];
      await act(async () => {
        onChange({
          window: { ...BROWSER_WINDOW, width: 380 },
          screen: MONITOR,
        });
      });
      expect(read().width).toBe(380);
    } finally {
      os.restore();
      get.mockRestore();
    }
  });

  it('keeps the device screen on native', async () => {
    const get = jest
      .spyOn(Dimensions, 'get')
      .mockImplementation(key => (key === 'window' ? BROWSER_WINDOW : MONITOR));
    try {
      const read = await renderAndRead();
      expect(read().width).toBe(1512);
    } finally {
      get.mockRestore();
    }
  });
});
