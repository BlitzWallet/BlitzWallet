/**
 * Background notification handler
 * This file contains ONLY what's needed for background processing
 * NO App component, NO context providers
 */

import { Platform } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
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
    getLocalStorageItem('satDisplay').then(data => JSON.parse(data) || 'word'),
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
      getLocalStorageItem('userBalanceDenomination').then(
        data => JSON.parse(data) || 'sats',
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

// ANDROID: Firebase background message handler
if (Platform.OS === 'android') {
  setBackgroundMessageHandler(firebaseMessaging, async remoteMessage => {
    console.log('Background message received (Android):', remoteMessage);
    try {
      if (remoteMessage) {
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
    } catch (error) {
      console.error('Background handler error:', error);
    }
  });
}

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
