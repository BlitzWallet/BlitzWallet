import React, {useEffect, useRef} from 'react';
import {Alert, Platform, View} from 'react-native';
import * as Notifications from 'expo-notifications';
import WebView from 'react-native-webview';
import handleWebviewClaimMessage from '../app/functions/boltz/handle-webview-claim-message';
import {addDataToCollection} from '../db';
import {useGlobalContextProvider} from './context';
import * as Crypto from 'react-native-quick-crypto';

import * as TaskManager from 'expo-task-manager';

import {getMessaging} from '@react-native-firebase/messaging';
import {encriptMessage} from '../app/functions/messaging/encodingAndDecodingMessages';
import {useGlobalContacts} from './globalContacts';
import {getPublicKey} from 'nostr-tools';
import {useAppStatus} from './appStatus';
import {useKeysContext} from './keys';
import {checkGooglePlayServices} from '../app/functions/checkGoogleServices';
import DeviceInfo from 'react-native-device-info';

const PushNotificationManager = ({children}) => {
  const {masterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey} = useKeysContext();
  const {didGetToHomepage} = useAppStatus();
  const {globalContactsInformation} = useGlobalContacts();

  const webViewRef = useRef(null);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (!didGetToHomepage || didRunRef.current) return;
    didRunRef.current = true;

    async function initNotification() {
      try {
        const hasGooglePlayServics = checkGooglePlayServices();
        console.log('has google play store services', hasGooglePlayServics);
        if (!hasGooglePlayServics) return;
      } catch (err) {
        console.log(err, 'error regerstering webhook for ln notifications');
      }

      const {status} = await Notifications.requestPermissionsAsync();
      console.log('notifications permission', status);
      if (status !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      console.log('clearing notification badge');
      if (Platform.OS === 'ios') Notifications.setBadgeCountAsync(0);

      console.log('retriving device token');
      const deviceToken = await registerForPushNotificationsAsync();

      if (deviceToken) {
        await checkAndSavePushNotificationToDatabase(deviceToken);
      } else {
        return;
        // Alert.alert('No device token generated');
      }

      registerNotificationHandlers();
    }
    setTimeout(initNotification, 1000);
  }, [didGetToHomepage]);

  const checkAndSavePushNotificationToDatabase = async deviceToken => {
    try {
      if (
        masterInfoObject?.pushNotifications?.hash &&
        typeof masterInfoObject?.pushNotifications?.key.encriptedText ===
          'string'
      ) {
        const hashedPushKey = Crypto.default
          .createHash('sha256')
          .update(deviceToken)
          .digest('hex');
        console.log(
          'saved noticication token hash',
          masterInfoObject?.pushNotifications?.hash,
        );
        console.log('current notifiaction token hash', hashedPushKey);

        if (masterInfoObject?.pushNotifications?.hash === hashedPushKey) return;
      }

      savePushNotificationToDatabase(deviceToken);
    } catch (error) {
      // Alert.alert('Error checking push notification', JSON.stringify(error));
      console.error('Error in checkAndSavePushNotificationToDatabase', error);
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
      const publicKey = getPublicKey(contactsPrivateKey);
      await addDataToCollection(
        {
          pushNotifications: {
            platform: Platform.OS,
            key: {encriptedText: encriptedPushKey},
            hash: hashedPushKey,
          },
        },
        'blitzWalletUsers',
        publicKey,
      );
    } catch (error) {
      console.error('Error saving push notification to database', error);
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
    <View style={{flex: 1}}>
      <WebView
        domStorageEnabled
        javaScriptEnabled
        ref={webViewRef}
        containerStyle={{position: 'absolute', top: 1000, left: 1000}}
        source={
          Platform.OS === 'ios'
            ? require('boltz-swap-web-context')
            : {uri: 'file:///android_asset/boltzSwap.html'}
        }
        originWhitelist={['*']}
        onMessage={event =>
          handleWebviewClaimMessage(null, event, 'savedClaimInformation', null)
        }
      />
      {children}
    </View>
  );
};

async function registerForPushNotificationsAsync() {
  try {
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
      Alert.alert('Must use physical device for Push Notifications');
      return;
    }

    const permissionsResult = await Notifications.getPermissionsAsync();

    let finalStatus = permissionsResult.status;

    if (finalStatus !== 'granted') {
      const requestResult = await Notifications.requestPermissionsAsync();

      finalStatus = requestResult.status;
    }

    if (finalStatus !== 'granted') {
      console.log('PERMISSIONS NOT GRANTED');
      return false;
    }

    let options = {
      projectId: process.env.EXPO_PROJECT_ID,
    };
    if (Platform.OS === 'ios') {
      if (!getMessaging().isDeviceRegisteredForRemoteMessages)
        await getMessaging().registerDeviceForRemoteMessages();
      const token = await getMessaging().getAPNSToken();
      options.devicePushToken = {type: 'ios', data: token};
    }

    const pushToken = await Notifications.getExpoPushTokenAsync(options);

    return pushToken.data;
  } catch (err) {
    console.error('UNEXPECTED ERROR IN FUNCTION', err);
    return false;
  }
}

// Define the task name
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// Register background task
TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({data, error, executionInfo}) => {
    if (error) {
      console.error('Background task error:', error);
      return;
    }
    console.log('RUNNING IN BACKGROUHND');
    if (data) {
      console.log(data, 'RUNNING IN BACKGROUHND');
    }
  },
);

// Register the background notification task
export async function registerBackgroundNotificationTask() {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (error) {
    console.error('Task registration failed:', error);
  }
}

export default PushNotificationManager;
