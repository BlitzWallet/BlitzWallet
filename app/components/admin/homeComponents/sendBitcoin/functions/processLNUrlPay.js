import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {SATSPERBITCOIN} from '../../../../../constants';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import {getLNAddressForLiquidPayment} from './payments';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';

export default async function processLNUrlPay(input, context) {
  const {masterInfoObject, comingFromAccept, enteredPaymentInfo, fiatStats} =
    context;

  crashlyticsLogReport('Beiging decode LNURL pay');
  const amountMsat = comingFromAccept
    ? enteredPaymentInfo.amount * 1000
    : input.data.minSendable;
  const fiatValue =
    Number(amountMsat / 1000) / (SATSPERBITCOIN / (fiatStats?.value || 65000));
  let paymentFee = 0;
  let supportFee = 0;
  let invoice = '';

  const defaultLNURLDescription =
    JSON.parse(input.data.metadataStr)?.find(item => {
      const [tag, value] = item;
      if (tag === 'text/plain') return true;
    }) || [];
  if (comingFromAccept) {
    invoice = await getLNAddressForLiquidPayment(
      input,
      Number(enteredPaymentInfo.amount),
      enteredPaymentInfo.description || '',
    );
    const fee = await sparkPaymenWrapper({
      getFee: true,
      address: invoice,
      amountSats: Number(enteredPaymentInfo.amount),
      paymentType: 'lightning',
      masterInfoObject,
    });

    if (!fee.didWork) throw new Error(fee.error);
    paymentFee = fee.fee;
    supportFee = fee.supportFee;
  }

  return {
    data: comingFromAccept
      ? {
          ...input.data,
          message: enteredPaymentInfo.description || defaultLNURLDescription[1],
          invoice: invoice,
        }
      : input.data,
    paymentFee,
    supportFee,
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
}
