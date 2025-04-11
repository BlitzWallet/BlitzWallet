import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {SATSPERBITCOIN} from '../../../../../constants';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export default async function processLNUrlPay(input, context) {
  const {
    nodeInformation,
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
  } = context;
  try {
    crashlyticsLogReport('Beiging decode LNURL pay');
    const amountMsat = comingFromAccept
      ? enteredPaymentInfo.amount * 1000
      : input.data.minSendable;
    const fiatValue =
      Number(amountMsat / 1000) /
      (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));

    console.log(fiatValue, 'FIAT VALUE');
    return {
      data: comingFromAccept
        ? {...input.data, message: enteredPaymentInfo.description}
        : input.data,
      type: InputTypeVariant.LN_URL_PAY,
      paymentNetwork: 'lightning',
      sendAmount: `${
        masterInfoObject.userBalanceDenomination != 'fiat'
          ? `${Math.round(amountMsat / 1000)}`
          : fiatValue < 0.01
          ? ''
          : `${fiatValue.toFixed(2)}`
      }`,
      canEditPayment: !comingFromAccept,
    };
  } catch (err) {
    console.log('error processing lnurl pay');
    crashlyticsRecordErrorReport(err.message);
  }
}
