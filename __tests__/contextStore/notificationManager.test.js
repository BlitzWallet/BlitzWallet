/* eslint-env jest */
import React, { useContext } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import {
  PushNotificationContext,
  PushNotificationProvider,
} from '../../context-store/notificationManager';

let mockMasterInfoObject = { pushNotifications: { isEnabled: true } };
let mockContactsPrivateKey = 'test-private-key';

jest.mock('../../context-store/context', () => ({
  useGlobalContextProvider: () => ({ masterInfoObject: mockMasterInfoObject }),
}));

jest.mock('../../context-store/keys', () => ({
  useKeysContext: () => ({ contactsPrivateKey: mockContactsPrivateKey }),
}));

const mockAddReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddResponseListener = jest.fn(() => ({ remove: jest.fn() }));
const mockSetBadgeCountAsync = jest.fn(async () => {});

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: (...args) =>
    mockAddReceivedListener(...args),
  addNotificationResponseReceivedListener: (...args) =>
    mockAddResponseListener(...args),
  setBadgeCountAsync: (...args) => mockSetBadgeCountAsync(...args),
  AndroidImportance: { MAX: 5 },
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'token' })),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(),
  registerTaskAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));

jest.mock('../../app/functions/messaging/encodingAndDecodingMessages', () => ({
  encriptMessage: jest.fn(() => 'encrypted'),
}));

jest.mock('../../app/functions/checkGoogleServices', () => ({
  checkGooglePlayServices: jest.fn(() => true),
}));

jest.mock('react-native-device-info', () => ({
  isEmulatorSync: jest.fn(() => false),
}));

jest.mock('../../app/functions/nwc/backgroundNofifications', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../app/functions/hash', () => ({
  __esModule: true,
  default: jest.fn(value => `hash:${value}`),
}));

jest.mock('../../app/functions', () => ({
  getLocalStorageItem: jest.fn(async () => null),
}));

jest.mock('../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(),
}));

jest.mock('../../app/functions/displayCorrectDenomination', () => ({
  __esModule: true,
  default: jest.fn(),
}));

let capturedValue = null;
function Consumer() {
  capturedValue = useContext(PushNotificationContext);
  return <Text>consumer</Text>;
}

function renderProvider() {
  return ReactTestRenderer.create(
    <PushNotificationProvider>
      <Consumer />
    </PushNotificationProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedValue = null;
  mockMasterInfoObject = { pushNotifications: { isEnabled: true } };
});

describe('PushNotificationProvider value stability', () => {
  it('keeps the provider value identity stable across unrelated re-renders', async () => {
    let renderer;
    await act(async () => {
      renderer = renderProvider();
    });

    const firstValue = capturedValue;
    expect(firstValue).not.toBeNull();

    // Re-render the provider while keeping pushNotificationData referentially
    // equal (only an unrelated field changes). A fresh inline object would
    // force every consumer to re-render for nothing.
    await act(async () => {
      mockMasterInfoObject = {
        pushNotifications: mockMasterInfoObject.pushNotifications,
        unrelatedField: Date.now(),
      };
      renderer.update(
        <PushNotificationProvider>
          <Consumer />
        </PushNotificationProvider>,
      );
    });

    expect(capturedValue).toBe(firstValue);
    expect(mockAddReceivedListener).toHaveBeenCalledTimes(1);
  });

  it('changes the value identity only when push notification data changes', async () => {
    let renderer;
    await act(async () => {
      renderer = renderProvider();
    });
    const firstValue = capturedValue;

    await act(async () => {
      mockMasterInfoObject = {
        pushNotifications: { isEnabled: true, hash: 'new-hash' },
      };
      renderer.update(
        <PushNotificationProvider>
          <Consumer />
        </PushNotificationProvider>,
      );
    });

    expect(capturedValue).not.toBe(firstValue);
  });
});

describe('PushNotificationProvider listener lifecycle', () => {
  it('removes the previous notification listeners before registering new ones', async () => {
    let renderer;
    await act(async () => {
      renderer = renderProvider();
    });

    expect(mockAddReceivedListener).toHaveBeenCalledTimes(1);
    const firstReceivedSubscription =
      mockAddReceivedListener.mock.results[0].value;
    const firstResponseSubscription =
      mockAddResponseListener.mock.results[0].value;

    await act(async () => {
      mockMasterInfoObject = {
        pushNotifications: { isEnabled: true, hash: 'updated' },
      };
      renderer.update(
        <PushNotificationProvider>
          <Consumer />
        </PushNotificationProvider>,
      );
    });

    expect(mockAddReceivedListener).toHaveBeenCalledTimes(2);
    expect(firstReceivedSubscription.remove).toHaveBeenCalled();
    expect(firstResponseSubscription.remove).toHaveBeenCalled();
  });

  it('removes all notification listeners on unmount', async () => {
    let renderer;
    await act(async () => {
      renderer = renderProvider();
    });

    const receivedSubscription = mockAddReceivedListener.mock.results[0].value;
    const responseSubscription = mockAddResponseListener.mock.results[0].value;

    await act(async () => {
      renderer.unmount();
    });

    expect(receivedSubscription.remove).toHaveBeenCalled();
    expect(responseSubscription.remove).toHaveBeenCalled();
  });

  it('does not register listeners when push notifications are disabled', async () => {
    mockMasterInfoObject = { pushNotifications: { isEnabled: false } };
    let renderer;
    await act(async () => {
      renderer = renderProvider();
    });

    expect(mockAddReceivedListener).not.toHaveBeenCalled();
    expect(mockAddResponseListener).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });
});
