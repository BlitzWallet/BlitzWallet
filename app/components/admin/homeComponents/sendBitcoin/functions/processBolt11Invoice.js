import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {SATSPERBITCOIN} from '../../../../../constants';

export default function processBolt11Invoice(input, context) {
  const {
    nodeInformation,
    masterInfoObject,
    navigate,
    goBackFunction,
    comingFromAccept,
    enteredPaymentInfo,
  } = context;
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = input.invoice.timestamp + input.invoice.expiry;
    const isExpired = currentTime > expirationTime;
    if (isExpired) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Invoice is expired',
        customNavigator: () => goBackFunction(),
      });
      return;
    }

    const amountMsat = comingFromAccept
      ? enteredPaymentInfo.amount * 1000
      : input.invoice.amountMsat;
    const fiatValue =
      !!amountMsat &&
      Number(amountMsat / 1000) /
        (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));

    return {
      data: input,
      type: InputTypeVariant.BOLT11,
      paymentNetwork: 'lightning',
      sendAmount: !amountMsat
        ? ''
        : `${
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? `${Math.round(amountMsat / 1000)}`
              : fiatValue < 0.01
              ? ''
              : `${fiatValue.toFixed(2)}`
          }`,
      canEditPayment: comingFromAccept ? false : !amountMsat,
    };
  } catch (err) {
    console.log('process bolt11 invoice error', err);
  }
}
