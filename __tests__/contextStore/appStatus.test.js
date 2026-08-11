/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Dimensions, Text } from 'react-native';
import { AppStatusProvider } from '../../context-store/appStatus';

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
