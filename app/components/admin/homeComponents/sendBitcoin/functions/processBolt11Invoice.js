import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {SATSPERBITCOIN} from '../../../../../constants';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';

export default async function processBolt11Invoice(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    fiatStats,
    paymentInfo,
  } = context;

  crashlyticsLogReport('Handling decode bolt11 invoices');
  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = input.invoice.timestamp + input.invoice.expiry;
  const isExpired = currentTime > expirationTime;
  if (isExpired) throw new Error('This lightning invoice has expired');

  const amountMsat = comingFromAccept
    ? enteredPaymentInfo.amount * 1000
    : input.invoice.amountMsat || 0;
  const fiatValue =
    !!amountMsat &&
    Number(amountMsat / 1000) / (SATSPERBITCOIN / (fiatStats?.value || 65000));
  let fee = {};
  if (amountMsat) {
    if (paymentInfo.paymentFee && paymentInfo.supportFee) {
      fee = {
        fee: paymentInfo.paymentFee,
        supportFee: paymentInfo.supportFee,
      };
    } else {
      fee = await sparkPaymenWrapper({
        getFee: true,
        address: input.invoice.bolt11,
        amountSats: Math.round(amountMsat / 1000),
        paymentType: 'lightning',
        masterInfoObject,
      });

      if (!fee.didWork) throw new Error(fee.error);
    }
  }

  return {
    data: {...input, message: input.invoice.description},
    type: InputTypeVariant.BOLT11,
    paymentNetwork: 'lightning',
    paymentFee: fee.fee,
    supportFee: fee.supportFee,
    address: input.invoice.bolt11,
    usingZeroAmountInvoice: !input.invoice.amountMsat,
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
}
