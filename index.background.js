/**
 * Background notification handler
 * This file contains ONLY what's needed for background processing
 * NO App component, NO context providers
 */

import { Platform } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
  onMessage,
} from '@react-native-firebase/messaging';
import * as TaskManager from 'expo-task-manager';
import { formatBalanceAmount, getLocalStorageItem } from './app/functions';
import displayCorrectDenomination from './app/functions/displayCorrectDenomination';
import { pushInstantNotification } from './app/functions/notifications';
import handleNWCBackgroundEvent from './app/functions/nwc/backgroundNofifications';
import i18next from 'i18next';
import { registerTaskAsync } from 'expo-notifications';
console.log('INITIALIZING BACKGROUND NOTIFIACTIONS');

const firebaseMessaging = getMessaging();

// Background notification formatting function
async function formatPushNotification(data) {
  const [selectedLanguage, satDisplay, thousandsSeperator] = await Promise.all([
    getLocalStorageItem('userSelectedLanguage').then(
      data => JSON.parse(data) || 'en',
    ),
    getLocalStorageItem('satDisplay').then(
      data => JSON.parse(data) || 'symbol',
    ),
    getLocalStorageItem('thousandsSeperator').then(
      data => JSON.parse(data) || 'space',
    ),
  ]);

  if (selectedLanguage !== i18next.language) {
    i18next.changeLanguage(selectedLanguage);
  }

  let message = '';
  let formattedAmount;

  if (
    data.notificationType === 'contacts' &&
    data.paymentDenomination === 'USD'
  ) {
    formattedAmount = displayCorrectDenomination({
      amount: formatBalanceAmount(data.amountDollars, false, {
        thousandsSeperator,
      }),
      masterInfoObject: {
        userBalanceDenomination: 'fiat',
        satDisplay: satDisplay,
        thousandsSeperator,
      },
      convertAmount: false,
      forceCurrency: 'USD',
    });
  } else {
    const [bitcoinPrice, userBalanceDenomination] = await Promise.all([
      getLocalStorageItem('cachedBitcoinPrice').then(
        data => JSON.parse(data) || { coin: 'USD', value: 100_000 },
      ),
      getLocalStorageItem('userBalanceDenomination').then(
        data => JSON.parse(data) || 'sats',
      ),
    ]);

    formattedAmount = data.amountSat
      ? displayCorrectDenomination({
          amount: data.amountSat,
          masterInfoObject: {
            userBalanceDenomination: userBalanceDenomination,
            satDisplay: satDisplay,
            thousandsSeperator,
            fiatCurrency: bitcoinPrice.coin?.toUpperCase(),
          },
          fiatStats: bitcoinPrice,
        })
      : '';
  }

  if (data.notificationType === 'POS') {
    message = i18next.t('pushNotifications.POS', {
      totalAmount: formattedAmount,
    });
  } else if (data.notificationType === 'LNURL') {
    message = i18next.t('pushNotifications.LNURL.' + data.type, {
      totalAmount: formattedAmount,
    });
  } else if (data.notificationType === 'contacts') {
    if (data.type === 'updateMessage') {
      message = i18next.t('pushNotifications.contacts.updateMessage', {
        name: data.name,
        option: i18next.t('transactionLabelText.' + data.option),
      });
    } else if (data.type === 'giftCard') {
      message = i18next.t('pushNotifications.contacts.giftCard', {
        name: data.name,
        giftCardName: data.giftCardName,
      });
    } else {
      message = i18next.t('pushNotifications.contacts.' + data.type, {
        name: data.name,
        amount: formattedAmount,
      });
    }
  }

  pushInstantNotification(message);
}

// Routes an FCM remoteMessage to either the display-only formatter or the NWC
// event handler. Shared by the Android background handler and the cross-platform
// foreground handler (both receive the same firebase remoteMessage shape).
async function handleRemoteMessage(remoteMessage) {
  if (!remoteMessage) return;
  const data = remoteMessage.data;
  let parsedData;

  try {
    parsedData = JSON.parse(data.body);
  } catch (err) {
    parsedData = data.body;
  }

  if (parsedData?.format) {
    await formatPushNotification(parsedData);
    return;
  }

  await handleNWCBackgroundEvent(remoteMessage);
}

// ANDROID: Firebase background message handler (fires only when backgrounded/quit)
if (Platform.OS === 'android') {
  setBackgroundMessageHandler(firebaseMessaging, async remoteMessage => {
    console.log('Background message received (Android):', remoteMessage);
    try {
      await handleRemoteMessage(remoteMessage);
    } catch (error) {
      console.error('Background handler error:', error);
    }
  });
}

// FOREGROUND: fires on both platforms while the app is active. Background
// handlers above do not run in the foreground, so without this an incoming push
// is received by the OS but never processed. NWC events are deduped by the event
// ledger, so this cannot double-process anything a background handler already did.
onMessage(firebaseMessaging, async remoteMessage => {
  console.log('Foreground message received:', remoteMessage);
  try {
    await handleRemoteMessage(remoteMessage);
  } catch (error) {
    console.error('Foreground handler error:', error);
  }
});

// iOS: TaskManager background task
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

if (
  Platform.OS === 'ios' &&
  !TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)
) {
  TaskManager.defineTask(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ data, error }) => {
      console.log('Background task running (iOS):', data, error);

      if (error) {
        console.error('Background task error:', error);
        return;
      }

      if (data) {
        if (data.data.body?.format) {
          await formatPushNotification(data.data.body);
          return;
        }
        await handleNWCBackgroundEvent(data);
      }
    },
  );
  registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    .then(data => console.log('iOS background task registered'))
    .catch(err => {
      console.log('iOS background task not registered', err);
    });
}
