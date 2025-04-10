import formatBalanceAmount from '../formatNumber';
import {getSingleContact, updateMessage} from '../../../db';
import {SATSPERBITCOIN} from '../../constants';
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
}) {
  try {
    crashlyticsLogReport('Begining to publish contact message');
    const sendingObj = data;
    await updateMessage({
      newMessage: sendingObj,
      fromPubKey,
      toPubKey,
      onlySaveToLocal: isLNURLPayment,
    });

    if (isLNURLPayment) return;
    await sendPushNotification({
      selectedContactUsername: selectedContact.uniqueName,
      myProfile: globalContactsInformation.myProfile,
      data: data,
      fiatCurrencies: fiatCurrencies,
      privateKey,
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
}) {
  try {
    crashlyticsLogReport('Sending push notification');
    console.log(selectedContactUsername);
    const retrivedContact = await getSingleContact(
      selectedContactUsername.toLowerCase(),
    );

    if (retrivedContact.length === 0) return;
    const [selectedContact] = retrivedContact;

    const devicePushKey =
      selectedContact?.pushNotifications?.key?.encriptedText;
    const deviceType = selectedContact?.pushNotifications?.platform;
    const sendingContactFiatCurrency = selectedContact?.fiatCurrency || 'USD';
    const sendingContactDenominationType =
      selectedContact?.userBalanceDenomination || 'sats';

    const fiatValue = fiatCurrencies.filter(
      currency =>
        currency.coin.toLowerCase() ===
        sendingContactFiatCurrency.toLowerCase(),
    );
    const didFindCurrency = fiatValue.length >= 1;
    const fiatAmount =
      didFindCurrency &&
      (
        (fiatValue[0]?.value / SATSPERBITCOIN) *
        (data.amountMsat / 1000)
      ).toFixed(2);

    console.log(devicePushKey, deviceType);

    if (!devicePushKey || !deviceType) return;
    let message;
    if (data.isUpdate) {
      message = data.message;
    } else if (data.isRequest) {
      message = `${
        myProfile.name || myProfile.uniqueName
      } requested you ${formatBalanceAmount(
        sendingContactDenominationType != 'fiat' || !fiatAmount
          ? data.amountMsat / 1000
          : fiatAmount,
      )} ${
        sendingContactDenominationType != 'fiat' || !fiatAmount
          ? 'sats'
          : sendingContactFiatCurrency
      }`;
    } else {
      message = `${
        myProfile.name || myProfile.uniqueName
      } paid you ${formatBalanceAmount(
        sendingContactDenominationType != 'fiat' || !fiatAmount
          ? data.amountMsat / 1000
          : fiatAmount,
      )} ${
        sendingContactDenominationType != 'fiat' || !fiatAmount
          ? 'sats'
          : sendingContactFiatCurrency
      }`;
    }
    const requestData = {
      devicePushKey: devicePushKey,
      deviceType: deviceType,
      message: message,
      decryptPubKey: selectedContact.uuid,
    };

    console.log(JSON.stringify(requestData));

    const response = await fetchBackend(
      'contactsPushNotificationV3',
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
