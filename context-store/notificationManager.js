import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Platform, View } from 'react-native';
import {
  getAPNSToken,
  getMessaging,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import { encriptMessage } from '../app/functions/messaging/encodingAndDecodingMessages';
import { useGlobalContextProvider } from './context';
import { useKeysContext } from './keys';
import { checkGooglePlayServices } from '../app/functions/checkGoogleServices';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setBadgeCountAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import sha256Hash from '../app/functions/hash';

const firebaseMessaging = getMessaging();

// Create the context
const PushNotificationContext = createContext({});

// Provider component
export const PushNotificationProvider = ({ children }) => {
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey } = useKeysContext();
  const pushNotificationData = masterInfoObject?.pushNotifications;

  const getCurrentPushNotifiicationPermissions = useCallback(async () => {
    try {
      const permissionsResult = await getPermissionsAsync();

      let finalStatus = permissionsResult.status;
      return finalStatus;
    } catch (err) {
      console.log('Error getting pussh notification settings', err);
      return false;
    }
  }, []);

  const savePushNotificationToDatabase = useCallback(
    async pushKey => {
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
    },
    [contactsPrivateKey],
  );

  const checkAndSavePushNotificationToDatabase = useCallback(
    async deviceToken => {
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
    },
    [pushNotificationData, savePushNotificationToDatabase],
  );

  // const registerNotificationHandlers = useCallback(() => {
  //   const receivedSubscription = addNotificationReceivedListener(() => {});
  //   const responseSubscription = addNotificationResponseReceivedListener(
  //     () => {},
  //   );
  //   return [receivedSubscription, responseSubscription];
  // }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') setBadgeCountAsync(0);
    // if (!pushNotificationData?.isEnabled) return;
    // const subscriptions = registerNotificationHandlers();
    // notificationListenersRef.current = subscriptions;

    // return () => {
    //   notificationListenersRef.current.forEach(subscription =>
    //     subscription?.remove(),
    //   );
    //   notificationListenersRef.current = [];
    // };
  }, [
    pushNotificationData,
    // registerNotificationHandlers
  ]);

  const contextValue = useMemo(
    () => ({
      checkAndSavePushNotificationToDatabase,
      // registerNotificationHandlers,
      registerForPushNotificationsAsync,
      getCurrentPushNotifiicationPermissions,
    }),
    [
      checkAndSavePushNotificationToDatabase,
      // registerNotificationHandlers,
      registerForPushNotificationsAsync,
      getCurrentPushNotifiicationPermissions,
    ],
  );

  return (
    <PushNotificationContext.Provider value={contextValue}>
      {children}
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
    return { didWork: true, token: pushToken.data };
  } catch (err) {
    console.error('UNEXPECTED ERROR IN FUNCTION', err);
    return { didWork: false, error: err.message };
  }
}

// --- Export hook to use the context --- //
export const usePushNotification = () => useContext(PushNotificationContext);

export { PushNotificationContext };
