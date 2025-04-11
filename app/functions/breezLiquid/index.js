import {
  lnurlPay,
  PayAmountVariant,
  AmountVariant,
  PaymentMethod,
  prepareLnurlPay,
  prepareReceivePayment,
  prepareSendPayment,
  receivePayment,
  sendPayment,
} from '@breeztech/react-native-breez-sdk-liquid';
import {BLITZ_DEFAULT_PAYMENT_DESCRIPTION} from '../../constants';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../crashlyticsLogs';

export async function breezLiquidReceivePaymentWrapper({
  sendAmount,
  paymentType,
  description,
}) {
  try {
    crashlyticsLogReport('Starting prpare receive payment process');
    console.log('Starting prepare receive payment process');
    // Set the amount you wish the payer to send via lightning, which should be within the above limits

    let optionalAmount;
    if (paymentType === 'liquid' && !sendAmount) {
      optionalAmount = undefined;
    } else {
      optionalAmount = {
        type: AmountVariant.BITCOIN,
        payerAmountSat: sendAmount,
      };
    }

    const prepareResponse = await prepareReceivePayment({
      paymentMethod:
        paymentType === 'lightning'
          ? PaymentMethod.LIGHTNING
          : paymentType === 'liquid'
          ? PaymentMethod.LIQUID_ADDRESS
          : PaymentMethod.BITCOIN_ADDRESS,
      amount: optionalAmount,
    });

    // If the fees are acceptable, continue to create the Receive Payment
    const receiveFeesSat = prepareResponse.feesSat;
    console.log(`Fees: ${receiveFeesSat} sats`);
    console.log('Starting receive payment');

    const res = await receivePayment({
      prepareResponse,
      description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
    });

    const destination = res.destination;
    return {destination, receiveFeesSat};
  } catch (err) {
    console.log(err);
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
export async function breezLiquidPaymentWrapper({
  paymentType,
  sendAmount,
  invoice,
  shouldDrain,
}) {
  try {
    crashlyticsLogReport('Starting liquid payment process');
    let optionalAmount;

    if (paymentType === 'bolt12') {
      optionalAmount = {
        type: AmountVariant.BITCOIN,
        receiverAmountSat: sendAmount,
      };
    } else if (paymentType === 'bip21Liquid' && shouldDrain) {
      optionalAmount = {
        type: PayAmountVariant.DRAIN,
      };
    } else optionalAmount = undefined;

    console.log('Starting prepare send payment process');
    const prepareResponse = await prepareSendPayment({
      destination: invoice,
      amount: optionalAmount ? optionalAmount : undefined,
    });

    // If the fees are acceptable, continue to create the Send Payment
    const sendFeesSat = prepareResponse.feesSat;
    console.log(`Fees: ${sendFeesSat} sats`);
    console.log('Sending payment');
    const sendResponse = await sendPayment({
      prepareResponse,
    });

    const payment = sendResponse.payment;
    return {payment, fee: sendFeesSat, didWork: true};
  } catch (err) {
    console.log(err);
    crashlyticsRecordErrorReport(err.message);
    return {error: err, didWork: false};
  }
}

export async function breezLiquidLNAddressPaymentWrapper({
  sendAmountSat,
  description,
  paymentInfo,
  shouldDrain,
}) {
  try {
    crashlyticsLogReport('Starting breez liquid ln address payment wrapper');
    const optionalComment = description;
    const optionalValidateSuccessActionUrl = true;
    console.log('Starting prepare LNURL pay payment process');

    let amount;
    if (shouldDrain) {
      amount = {
        type: PayAmountVariant.DRAIN,
      };
    } else
      amount = {
        type: AmountVariant.BITCOIN,
        receiverAmountSat: sendAmountSat,
      };

    const prepareResponse = await prepareLnurlPay({
      data: paymentInfo,
      amount,
      comment: optionalComment,
      validateSuccessActionUrl: optionalValidateSuccessActionUrl,
    });
    const feesSat = prepareResponse.feesSat;
    console.log(`Fees: ${feesSat} sats`);
    console.log('Sending LNURL pay');
    const result = await lnurlPay({
      prepareResponse,
    });
    result.data.payment;
    const payment = result.data.payment;
    return {payment, fee: feesSat, didWork: true};
  } catch (err) {
    console.log(err, 'BREEZ LIQUID TO LN ADDRESS PAYMENT WRAPPER');
    crashlyticsRecordErrorReport(err.message);
    return {error: err, didWork: false};
  }
}
