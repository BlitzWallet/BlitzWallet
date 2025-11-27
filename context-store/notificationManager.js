import React, { createContext, useContext, useEffect } from 'react';
import { Platform, View } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import {
  getAPNSToken,
  getMessaging,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { encriptMessage } from '../app/functions/messaging/encodingAndDecodingMessages';
import { useGlobalContextProvider } from './context';
import { useKeysContext } from './keys';
import { checkGooglePlayServices } from '../app/functions/checkGoogleServices';
import { isEmulatorSync } from 'react-native-device-info';
import handleNWCBackgroundEvent from '../app/functions/nwc/backgroundNofifications';
import i18n from 'i18next';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  registerTaskAsync,
  requestPermissionsAsync,
  setBadgeCountAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import sha256Hash from '../app/functions/hash';
import { getLocalStorageItem } from '../app/functions';
import { pushInstantNotification } from '../app/functions/notifications';
import displayCorrectDenomination from '../app/functions/displayCorrectDenomination';

const firebaseMessaging = getMessaging();

// Create the context
const PushNotificationContext = createContext({});

// Provider component
export const PushNotificationProvider = ({ children }) => {
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey } = useKeysContext();
  const pushNotificationData = masterInfoObject?.pushNotifications;

  useEffect(() => {
    if (Platform.OS === 'ios') setBadgeCountAsync(0);
    if (!pushNotificationData?.isEnabled) return;
    registerNotificationHandlers();
  }, [pushNotificationData]);

  const getCurrentPushNotifiicationPermissions = async () => {
    try {
      const permissionsResult = await getPermissionsAsync();

      let finalStatus = permissionsResult.status;
      return finalStatus;
    } catch (err) {
      console.log('Error getting pussh notification settings', err);
      return false;
    }
  };
  const checkAndSavePushNotificationToDatabase = async deviceToken => {
    try {
      if (
        pushNotificationData?.hash &&
        typeof pushNotificationData?.key.encriptedText === 'string'
      ) {
        const hashedPushKey = sha256Hash(deviceToken);

        console.log(
          'saved notification token hash',
          pushNotificationData?.hash,
        );
        console.log('current notification token hash', hashedPushKey);

        if (pushNotificationData?.hash === hashedPushKey)
          return { shouldUpdate: false, error: '', didWork: true };
      }

      const response = await savePushNotificationToDatabase(deviceToken);
      if (!response.didWork) throw new Error(response.error);

      return { shouldUpdate: true, didWork: true, data: response.data };
    } catch (error) {
      console.error('Error in checkAndSavePushNotificationToDatabase', error);
      return { shouldUpdate: false, error: error.message, didWork: false };
    }
  };

  const savePushNotificationToDatabase = async pushKey => {
    try {
      const hashedPushKey = sha256Hash(pushKey);

      const encriptedPushKey = encriptMessage(
        contactsPrivateKey,
        process.env.BACKEND_PUB_KEY,
        pushKey,
      );

      return {
        data: {
          platform: Platform.OS,
          key: { encriptedText: encriptedPushKey },
          hash: hashedPushKey,
        },
        didWork: true,
      };
    } catch (error) {
      console.error('Error saving push notification to database', error);
      return { didWork: false, error: error.message };
    }
  };

  const registerNotificationHandlers = () => {
    addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground', notification);
    });

    addNotificationResponseReceivedListener(response => {
      console.log('Notification opened by device user', response.notification);
    });
  };

  return (
    <PushNotificationContext.Provider
      value={{
        checkAndSavePushNotificationToDatabase,
        registerNotificationHandlers,
        registerForPushNotificationsAsync,
        getCurrentPushNotifiicationPermissions,
      }}
    >
      <View style={{ flex: 1 }}>{children}</View>
    </PushNotificationContext.Provider>
  );
};

async function registerForPushNotificationsAsync() {
  try {
    const hasGooglePlayServics = checkGooglePlayServices();
    if (!hasGooglePlayServics) throw new Error('errormessages.noGooglePlay');

    if (Platform.OS === 'android') {
      console.log('Registering notification channel on android');
      await setNotificationChannelAsync('blitzWalletNotifications', {
        name: 'blitzWalletNotifications',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
        bypassDnd: false,
      });
    }

    // if (isEmulatorSync()) {
    //   throw new Error('Must use physical device for Push Notifications');
    // }

    const permissionsResult = await getPermissionsAsync();
    let finalStatus = permissionsResult.status;

    if (finalStatus !== 'granted' && permissionsResult.canAskAgain) {
      const requestResult = await requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true, // iOS 12+
        },
      });
      finalStatus = requestResult.status;
    }

    if (finalStatus !== 'granted') {
      throw new Error('errormessages.noNotificationPermission');
    }

    let options = { projectId: process.env.EXPO_PROJECT_ID };
    if (Platform.OS === 'ios') {
      const isRegisted = isDeviceRegisteredForRemoteMessages(firebaseMessaging);
      if (!isRegisted) await registerDeviceForRemoteMessages(firebaseMessaging);
      const token = await getAPNSToken(firebaseMessaging);
      options.devicePushToken = { type: 'ios', data: token };
    }

    const pushToken = await getExpoPushTokenAsync(options);
    console.log(pushToken);
    return { didWork: true, token: pushToken.data };
  } catch (err) {
    console.error('UNEXPECTED ERROR IN FUNCTION', err);
    return { didWork: false, error: err.message };
  }
}

// --- Export hook to use the context --- //
export const usePushNotification = () => useContext(PushNotificationContext);
