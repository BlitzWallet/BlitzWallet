import {fetchOnchainLimits} from '@breeztech/react-native-breez-sdk-liquid';
import {sendBitcoinPayment} from './payments';
import {SATSPERBITCOIN} from '../../../../../constants';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export default async function processBitcoinAddress(input, context) {
  const {
    nodeInformation,
    liquidNodeInformation,
    masterInfoObject,
    navigate,
    goBackFunction,
    comingFromAccept,
    enteredPaymentInfo,
    paymentInfo,
  } = context;
  try {
    crashlyticsLogReport('Begining decode Bitcoin address');
    const choosingLimit = paymentInfo?.data?.limits
      ? Promise.resolve({send: paymentInfo?.data?.limits})
      : fetchOnchainLimits();
    const currentLimits = await choosingLimit;

    const amountSat = comingFromAccept
      ? enteredPaymentInfo.amount
      : input.address.amountSat || 0;

    const fromNetwork = comingFromAccept
      ? enteredPaymentInfo.from
      : liquidNodeInformation.userBalance > amountSat
      ? 'liquid'
      : nodeInformation.userBalance > amountSat
      ? 'lightning'
      : 'none';

    const shouldDrain =
      fromNetwork === 'liquid'
        ? liquidNodeInformation.userBalance - amountSat < 500
        : nodeInformation.userBalance - amountSat < 500;

    const fiatValue =
      Number(amountSat) /
      (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));
    let newPaymentInfo = {
      address: input.address.address,
      amount: amountSat,
      label: input.address.label || '',
      limits: currentLimits.send,
      shouldDrain,
    };
    let paymentFee = 0;
    if (amountSat) {
      const paymentFeeResponse = await sendBitcoinPayment({
        paymentInfo: {data: newPaymentInfo},
        sendingValue: amountSat,
        onlyPrepare: true,
        from: fromNetwork,
      });
      if (paymentFeeResponse.didWork) {
        paymentFee = paymentFeeResponse.fees;
      } else {
        goBackFunction(`Sending amount is above your balance`);
        return;
      }
    }
    newPaymentInfo = {
      ...newPaymentInfo,
      fee: paymentFee,
    };

    return {
      data: newPaymentInfo,
      type: 'Bitcoin',
      paymentNetwork: 'Bitcoin',
      sendAmount: !amountSat
        ? ''
        : `${
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? `${amountSat}`
              : fiatValue < 0.01
              ? ''
              : `${fiatValue.toFixed(2)}`
          }`,
      canEditPayment:
        comingFromAccept || input.address.amountSat ? false : true,
    };
  } catch (err) {
    console.log('process bitcoin address error', err);
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
