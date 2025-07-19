import React, {createContext, useContext, useEffect, useRef} from 'react';
import {Alert, Platform, View} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'react-native-quick-crypto';
import * as TaskManager from 'expo-task-manager';
import {getMessaging} from '@react-native-firebase/messaging';
import {encriptMessage} from '../app/functions/messaging/encodingAndDecodingMessages';
import {useGlobalContextProvider} from './context';
import {useKeysContext} from './keys';
import {checkGooglePlayServices} from '../app/functions/checkGoogleServices';
import DeviceInfo from 'react-native-device-info';
import handleNWCBackgroundEvent from '../app/functions/nwc/backgroundNofifications';

// Create the context
const PushNotificationContext = createContext({});

// Provider component
export const PushNotificationProvider = ({children}) => {
  const {masterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey} = useKeysContext();
  const pushNotificationData = masterInfoObject?.pushNotifications;

  // const {didGetToHomepage} = useAppStatus();
  // const {globalContactsInformation} = useGlobalContacts();
  // const didRunRef = useRef(false);

  // useEffect(() => {
  //   if (!didGetToHomepage || didRunRef.current) return;
  //   didRunRef.current = true;

  //   async function initNotification() {
  //     try {
  //       const hasGooglePlayServics = checkGooglePlayServices();
  //       console.log('has google play store services', hasGooglePlayServics);
  //       if (!hasGooglePlayServics) return;
  //     } catch (err) {
  //       console.log(err, 'error registering webhook for ln notifications');
  //     }

  //     const {status} = await Notifications.requestPermissionsAsync();
  //     console.log('notifications permission', status);
  //     if (status !== 'granted') {
  //       console.log('Notification permission denied');
  //       return;
  //     }

  //     console.log('clearing notification badge');
  //     if (Platform.OS === 'ios') Notifications.setBadgeCountAsync(0);

  //     console.log('retrieving device token');
  //     const deviceToken = await registerForPushNotificationsAsync();

  //     if (deviceToken) {
  //       await checkAndSavePushNotificationToDatabase(deviceToken);
  //     } else {
  //       return;
  //     }

  //     registerNotificationHandlers();
  //   }
  //   setTimeout(initNotification, 1000);
  // }, [didGetToHomepage]);

  useEffect(() => {
    if (!pushNotificationData?.isEnabled) return;
    registerNotificationHandlers();
    if (Platform.OS === 'ios') Notifications.setBadgeCountAsync(0);
  }, [pushNotificationData]);

  const getCurrentPushNotifiicationPermissions = async () => {
    try {
      const permissionsResult = await Notifications.getPermissionsAsync();

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
        const hashedPushKey = Crypto.default
          .createHash('sha256')
          .update(deviceToken)
          .digest('hex');
        console.log(
          'saved notification token hash',
          pushNotificationData?.hash,
        );
        console.log('current notification token hash', hashedPushKey);

        if (pushNotificationData?.hash === hashedPushKey)
          return {shouldUpdate: false, error: '', didWork: true};
      }

      const response = await savePushNotificationToDatabase(deviceToken);
      if (!response.didWork) throw new Error(response.error);

      return {shouldUpdate: true, didWork: true, data: response.data};
    } catch (error) {
      console.error('Error in checkAndSavePushNotificationToDatabase', error);
      return {shouldUpdate: false, error: error.message, didWork: false};
    }
  };

  const savePushNotificationToDatabase = async pushKey => {
    try {
      const hashedPushKey = Crypto.default
        .createHash('sha256')
        .update(pushKey)
        .digest('hex');

      const encriptedPushKey = encriptMessage(
        contactsPrivateKey,
        process.env.BACKEND_PUB_KEY,
        pushKey,
      );

      return {
        data: {
          platform: Platform.OS,
          key: {encriptedText: encriptedPushKey},
          hash: hashedPushKey,
        },
        didWork: true,
      };
    } catch (error) {
      console.error('Error saving push notification to database', error);
      return {didWork: false, error: error.message};
    }
  };

  const registerNotificationHandlers = () => {
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground', notification);
    });

    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification opened by device user', response.notification);
    });
  };

  return (
    <PushNotificationContext.Provider
      value={{
        checkAndSavePushNotificationToDatabase,
        registerNotificationHandlers,
        registerBackgroundNotificationTask,
        registerForPushNotificationsAsync,
        getCurrentPushNotifiicationPermissions,
      }}>
      <View style={{flex: 1}}>{children}</View>
    </PushNotificationContext.Provider>
  );
};

async function registerForPushNotificationsAsync() {
  try {
    const hasGooglePlayServics = checkGooglePlayServices();
    if (!hasGooglePlayServics)
      throw new Error(
        'Google Play Services are required to receive notifications.',
      );

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'blitzWalletNotifications',
        {
          name: 'blitzWalletNotifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        },
      );
    }

    if (DeviceInfo.isEmulatorSync()) {
      throw new Error('Must use physical device for Push Notifications');
    }

    const permissionsResult = await Notifications.getPermissionsAsync();
    let finalStatus = permissionsResult.status;

    if (finalStatus !== 'granted' && permissionsResult.canAskAgain) {
      const requestResult = await Notifications.requestPermissionsAsync();
      finalStatus = requestResult.status;
    }

    if (finalStatus !== 'granted') {
      throw new Error(
        'Blitz doesn’t have notification permissions. Enable them in settings to use notifications.',
      );
    }

    let options = {projectId: process.env.EXPO_PROJECT_ID};
    if (Platform.OS === 'ios') {
      if (!getMessaging().isDeviceRegisteredForRemoteMessages)
        await getMessaging().registerDeviceForRemoteMessages();
      const token = await getMessaging().getAPNSToken();
      options.devicePushToken = {type: 'ios', data: token};
    }

    const pushToken = await Notifications.getExpoPushTokenAsync(options);
    return {didWork: true, token: pushToken.data};
  } catch (err) {
    console.error('UNEXPECTED ERROR IN FUNCTION', err);
    return {didWork: false, error: err.message};
  }
}

// Background task registration
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({data, error}) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }
  if (data) {
    await handleNWCBackgroundEvent(data);
    console.log(data, 'RUNNING IN BACKGROUND');
  }
});

export async function registerBackgroundNotificationTask() {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (error) {
    console.error('Task registration failed:', error);
  }
}

// --- Export hook to use the context --- //
export const usePushNotification = () => useContext(PushNotificationContext);
