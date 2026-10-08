import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Platform, View } from 'react-native';
import { getBundleId } from 'react-native-device-info';
import {
  getAPNSToken,
  getMessaging,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import { encriptMessage } from '../app/functions/messaging/encodingAndDecodingMessages';
import { useGlobalContextProvider } from './context';
import { useKeysContext } from './keys';
import { useAppStatus } from './appStatus';
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
import { getLocalStorageItem } from '../app/functions';
import displayCorrectDenomination from '../app/functions/displayCorrectDenomination';

const firebaseMessaging = getMessaging();

export const NOTIFICATION_SERVICES = [
  'contactPayments',
  'lnurlPayments',
  'nostrPayments',
  'NWC',
  'pointOfSale',
];

const REGISTER_TIMEOUT_MS = 15000;

const PERMISSION_REQUEST = {
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
    allowCriticalAlerts: true, // iOS 12+
  },
};

// Create the context
const PushNotificationContext = createContext({});

// Provider component
export const PushNotificationProvider = ({ children }) => {
  const { masterInfoObject, toggleMasterInfoObject, toggleNWCInformation } =
    useGlobalContextProvider();
  const { contactsPrivateKey } = useKeysContext();
  const { appState, didGetToHomepage } = useAppStatus();
  const isSyncingRef = useRef(false);
  const [isRegisteringPush, setIsRegisteringPush] = useState(false);
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

  // Saves push settings and mirrors the copy the NWC backend gates on.
  const savePushNotificationSettings = useCallback(
    newObject => {
      toggleMasterInfoObject({ pushNotifications: newObject });

      const nwcPushEnabled = !!(
        newObject.isEnabled && newObject.enabledServices?.NWC
      );
      const nwcPush = masterInfoObject.NWC?.pushNotifications;
      // No token yet (new account, permission not granted): nothing to mirror.
      if (!newObject.hash) return;
      if (
        newObject.hash !== nwcPush?.hash ||
        nwcPushEnabled !== nwcPush?.isEnabled
      ) {
        toggleNWCInformation({
          pushNotifications: {
            hash: newObject.hash,
            platform: newObject.platform,
            key: newObject.key,
            isEnabled: nwcPushEnabled,
          },
        });
      }
    },
    [masterInfoObject.NWC, toggleMasterInfoObject, toggleNWCInformation],
  );

  // The OS notification permission is the master switch: isEnabled mirrors
  // it so backends stop sending when the user turns notifications off.
  const syncPushNotificationPermission = useCallback(async () => {
    if (Platform.OS === 'web' || !pushNotificationData || !contactsPrivateKey)
      return { didWork: true };
    if (isSyncingRef.current) return { didWork: true };
    isSyncingRef.current = true;
    try {
      // Read directly so a failed read throws instead of turning push off.
      const granted = (await getPermissionsAsync()).status === 'granted';
      const newObject = {
        ...pushNotificationData,
        isEnabled: granted,
        permissionSynced: true,
      };

      if (
        granted &&
        (!pushNotificationData.isEnabled || !pushNotificationData.hash)
      ) {
        // Usually ~1s (APNs/FCM token + one POST to Expo). Expo's fetch has no
        // timeout, so cap it: a hung request would keep the screen loading and
        // block every later sync behind isSyncingRef.
        setIsRegisteringPush(true);
        let timer;
        const response = await Promise.race([
          registerForPushNotificationsAsync(),
          new Promise(resolve => {
            timer = setTimeout(
              () =>
                resolve({
                  didWork: false,
                  error: 'errormessages.genericError',
                }),
              REGISTER_TIMEOUT_MS,
            );
          }),
        ]).finally(() => clearTimeout(timer));
        if (!response.didWork) return response;
        const checkResponse = await checkAndSavePushNotificationToDatabase(
          response.token,
        );
        if (!checkResponse.didWork) return checkResponse;
        if (checkResponse.shouldUpdate) {
          const { hash, key, platform } = checkResponse.data;
          Object.assign(newObject, { hash, key, platform });
        }

        // Before the OS permission was the master switch, users could turn
        // notifications off in-app while the OS allowed them. Keep that
        // choice by starting them with every service off.
        const wasOptedOutInApp =
          !pushNotificationData.permissionSynced &&
          pushNotificationData.isEnabled === false &&
          !!pushNotificationData.hash;
        newObject.enabledServices = { ...newObject.enabledServices };
        NOTIFICATION_SERVICES.forEach(service => {
          newObject.enabledServices[service] = wasOptedOutInApp
            ? false
            : newObject.enabledServices[service] ?? true;
        });
      }

      if (JSON.stringify(newObject) !== JSON.stringify(pushNotificationData))
        savePushNotificationSettings(newObject);
      return { didWork: true };
    } catch (err) {
      console.log('Error syncing push notification permission', err);
      return { didWork: false, error: 'errormessages.genericError' };
    } finally {
      isSyncingRef.current = false;
      setIsRegisteringPush(false);
    }
  }, [
    pushNotificationData,
    contactsPrivateKey,
    checkAndSavePushNotificationToDatabase,
    savePushNotificationSettings,
  ]);

  // Re-sync on every foreground; covers returning from the OS settings app.
  const syncRef = useRef(syncPushNotificationPermission);
  syncRef.current = syncPushNotificationPermission;
  useEffect(() => {
    if (!didGetToHomepage || appState !== 'active') return;
    syncRef.current();
  }, [didGetToHomepage, appState]);

  // Opens the OS notification settings for this app, to turn push on or
  // off. While off, two exceptions: already granted (just sync), and iOS
  // never asked, where Settings has no Notifications row until the app
  // requests permission once.
  const openPushNotificationSettings = useCallback(async () => {
    try {
      if (!pushNotificationData?.isEnabled) {
        const { status } = await getPermissionsAsync();
        if (status === 'granted') return await syncPushNotificationPermission();
        if (Platform.OS === 'ios' && status === 'undetermined') {
          const requestResult = await requestPermissionsAsync(
            PERMISSION_REQUEST,
          );
          if (requestResult.status !== 'granted') return { didWork: true };
          return await syncPushNotificationPermission();
        }
      }

      if (Platform.OS === 'android') {
        try {
          await Linking.sendIntent(
            'android.settings.APP_NOTIFICATION_SETTINGS',
            [
              {
                key: 'android.provider.extra.APP_PACKAGE',
                value: getBundleId(),
              },
            ],
          );
          return { didWork: true };
        } catch (err) {
          console.log('Error opening notification settings', err);
        }
      }
      if (Platform.OS === 'ios') {
        try {
          // Value of UIApplication.openNotificationSettingsURLString (iOS
          // 15.4+; app min is 17.4): lands on this app's Notifications page.
          await Linking.openURL('app-settings:notifications');
          return { didWork: true };
        } catch (err) {
          console.log('Error opening notification settings', err);
        }
      }
      await Linking.openSettings();
      return { didWork: true };
    } catch (err) {
      console.log('Error enabling push notifications', err);
      return { didWork: false, error: 'errormessages.genericError' };
    }
  }, [pushNotificationData?.isEnabled, syncPushNotificationPermission]);

  const contextValue = useMemo(
    () => ({
      checkAndSavePushNotificationToDatabase,
      // registerNotificationHandlers,
      registerForPushNotificationsAsync,
      getCurrentPushNotifiicationPermissions,
      savePushNotificationSettings,
      openPushNotificationSettings,
      isRegisteringPush,
    }),
    [
      checkAndSavePushNotificationToDatabase,
      // registerNotificationHandlers,
      registerForPushNotificationsAsync,
      getCurrentPushNotifiicationPermissions,
      savePushNotificationSettings,
      openPushNotificationSettings,
      isRegisteringPush,
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
      const requestResult = await requestPermissionsAsync(PERMISSION_REQUEST);
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
    const isTranslationKey = err.message?.startsWith('errormessages.');
    return {
      didWork: false,
      error: isTranslationKey ? err.message : 'errormessages.genericError',
    };
  }
}

// --- Export hook to use the context --- //
export const usePushNotification = () => useContext(PushNotificationContext);

export { PushNotificationContext };
