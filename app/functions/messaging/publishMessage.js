import formatBalanceAmount from '../formatNumber';
import { updateMessage } from '../../../db';
import { BITCOIN_SAT_TEXT, SATSPERBITCOIN } from '../../constants';
import fetchBackend from '../../../db/handleBackend';
import { crashlyticsLogReport } from '../crashlyticsLogs';
import loadNewFiatData from '../saveAndUpdateFiatData';

export async function publishMessage({
  toPubKey,
  fromPubKey,
  data,
  globalContactsInformation,
  selectedContact,
  isLNURLPayment,
  privateKey,
  retrivedContact,
  currentTime,
  masterInfoObject,
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
      privateKey,
      retrivedContact,
      masterInfoObject,
    });
  } catch (err) {
    console.log(err), 'pubishing message to server error';
  }
}

export async function sendPushNotification({
  selectedContactUsername,
  myProfile,
  data,
  privateKey,
  retrivedContact,
  masterInfoObject,
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

    const useNewNotifications = !!retrivedContact.isUsingNewNotifications;
    const devicePushKey =
      retrivedContact?.pushNotifications?.key?.encriptedText;
    const deviceType = retrivedContact?.pushNotifications?.platform;
    const sendingContactFiatCurrency = retrivedContact?.fiatCurrency || 'USD';
    const sendingContactDenominationType =
      retrivedContact?.userBalanceDenomination || 'sats';

    if (!devicePushKey || !deviceType) return;

    let requestData = {};

    if (useNewNotifications) {
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
        notificationData['paymentDenomination'] =
          data.paymentDenomination || 'BTC';
        notificationData['amountDollars'] = data.amountDollars;
      } else if (data.giftCardInfo) {
        notificationData['giftCardName'] = data.giftCardInfo.name;
        notificationData['type'] = 'giftCard';
      } else {
        notificationData['amountSat'] = data.amountMsat / 1000;
        notificationData['type'] = 'payment';
        notificationData['paymentDenomination'] =
          data.paymentDenomination || 'BTC';
        notificationData['amountDollars'] = data.amountDollars;
      }

      requestData = {
        devicePushKey: devicePushKey,
        deviceType: deviceType,
        notificationData,
        decryptPubKey: retrivedContact.uuid,
      };
    } else if (data.giftCardInfo) {
      const message = `${myProfile.name || myProfile.uniqueName} sent you a ${
        data.giftCardInfo.name
      } Gift Card.`;
      requestData = {
        devicePushKey: devicePushKey,
        deviceType: deviceType,
        message,
        decryptPubKey: retrivedContact.uuid,
      };
    } else {
      const fiatValue = await loadNewFiatData(
        sendingContactFiatCurrency,
        privateKey,
        myProfile.uuid,
        masterInfoObject,
      );
      const didFindCurrency = fiatValue?.didWork;
      const fiatAmount =
        didFindCurrency &&
        (
          (fiatValue?.value / SATSPERBITCOIN) *
          (data.amountMsat / 1000)
        ).toFixed(2);

      let message = '';
      if (data.isUpdate) {
        message = data.message;
      } else if (data.isRequest) {
        message = `${
          myProfile.name || myProfile.uniqueName
        } requested you ${formatBalanceAmount(
          sendingContactDenominationType != 'fiat' || !fiatAmount
            ? data.amountMsat / 1000
            : fiatAmount,
          undefined,
          { thousandsSeperator: 'space' },
        )} ${
          sendingContactDenominationType != 'fiat' || !fiatAmount
            ? BITCOIN_SAT_TEXT
            : sendingContactFiatCurrency
        }`;
      } else {
        message = `${
          myProfile.name || myProfile.uniqueName
        } paid you ${formatBalanceAmount(
          sendingContactDenominationType != 'fiat' || !fiatAmount
            ? data.amountMsat / 1000
            : fiatAmount,
          undefined,
          { thousandsSeperator: 'space' },
        )} ${
          sendingContactDenominationType != 'fiat' || !fiatAmount
            ? BITCOIN_SAT_TEXT
            : sendingContactFiatCurrency
        }`;
      }
      requestData = {
        devicePushKey: devicePushKey,
        deviceType: deviceType,
        message,
        decryptPubKey: retrivedContact.uuid,
      };
    }

    const response = await fetchBackend(
      `contactsPushNotificationV${useNewNotifications ? '4' : '3'}`,
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
