import formatBalanceAmount from '../formatNumber';
import {updateMessage} from '../../../db';
import {BITCOIN_SAT_TEXT, SATSPERBITCOIN} from '../../constants';
import fetchBackend from '../../../db/handleBackend';
import {crashlyticsLogReport} from '../crashlyticsLogs';

export async function publishMessage({
  toPubKey,
  fromPubKey,
  data,
  globalContactsInformation,
  selectedContact,
  fiatCurrencies,
  isLNURLPayment,
  privateKey,
  retrivedContact,
  currentTime,
}) {
  try {
    crashlyticsLogReport('Begining to publish contact message');
    const sendingObj = data;
    await updateMessage({
      newMessage: sendingObj,
      fromPubKey,
      toPubKey,
      onlySaveToLocal: isLNURLPayment,
      retrivedContact,
      privateKey,
      currentTime,
    });

    if (isLNURLPayment) return;
    sendPushNotification({
      selectedContactUsername: selectedContact.uniqueName,
      myProfile: globalContactsInformation.myProfile,
      data: data,
      fiatCurrencies: fiatCurrencies,
      privateKey,
      retrivedContact,
    });
  } catch (err) {
    console.log(err), 'pubishing message to server error';
  }
}

export async function sendPushNotification({
  selectedContactUsername,
  myProfile,
  data,
  fiatCurrencies,
  privateKey,
  retrivedContact,
}) {
  try {
    crashlyticsLogReport('Sending push notification');
    console.log(selectedContactUsername);

    // Check if there is a selected contact
    if (!retrivedContact) return;
    const pushNotificationData = retrivedContact.pushNotifications;

    // check if the person has a push token saved
    if (!pushNotificationData?.key?.encriptedText) return;

    // If a user has updated thier settings and they have chosen to not receive notification for contact payments
    if (
      pushNotificationData?.enabledServices?.contactPayments !== undefined &&
      !pushNotificationData?.enabledServices?.contactPayments
    )
      return;

    const devicePushKey =
      retrivedContact?.pushNotifications?.key?.encriptedText;
    const deviceType = retrivedContact?.pushNotifications?.platform;
    // const sendingContactFiatCurrency = retrivedContact?.fiatCurrency || 'USD';
    // const sendingContactDenominationType =
    //   retrivedContact?.userBalanceDenomination || 'sats';

    // const fiatValue = fiatCurrencies.filter(
    //   currency =>
    //     currency.coin.toLowerCase() ===
    //     sendingContactFiatCurrency.toLowerCase(),
    // );
    // const didFindCurrency = fiatValue.length >= 1;
    // const fiatAmount =
    //   didFindCurrency &&
    //   (
    //     (fiatValue[0]?.value / SATSPERBITCOIN) *
    //     (data.amountMsat / 1000)
    //   ).toFixed(2);

    console.log(devicePushKey, deviceType);

    if (!devicePushKey || !deviceType) return;
    let notificationData = {
      name: myProfile.name || myProfile.uniqueName,
    };

    if (data.isUpdate) {
      notificationData['option'] =
        data.option === 'paid' ? 'paidLower' : 'declinedLower';
      notificationData['type'] = 'updateMessage';
    } else if (data.isRequest) {
      notificationData['amountSat'] = data.amountMsat / 1000;
      notificationData['type'] = 'request';
    } else {
      notificationData['amountSat'] = data.amountMsat / 1000;
      notificationData['type'] = 'payment';
    }

    const requestData = {
      devicePushKey: devicePushKey,
      deviceType: deviceType,
      notificationData,
      decryptPubKey: retrivedContact.uuid,
    };

    const response = await fetchBackend(
      'contactsPushNotificationV4',
      requestData,
      privateKey,
      myProfile.uuid,
    );
    console.log(response, 'contacts push notification response');
    return true;
  } catch (err) {
    console.log('publish message error', err);
    return false;
  }
}
