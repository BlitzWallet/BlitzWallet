import {SATSPERBITCOIN} from '../../../../../constants';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';
import bip39LiquidAddressDecode from './bip39LiquidAddressDecode';

export default function processLiquidAddress(input, context) {
  const {
    btcAddress,
    setPaymentInfo,
    liquidNodeInformation,
    nodeInformation,
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
  } = context;
  try {
    crashlyticsLogReport('Handling decode liquid address');
    let addressInfo = bip39LiquidAddressDecode(
      btcAddress,
      liquidNodeInformation,
    );
    if (comingFromAccept) {
      addressInfo.amount = enteredPaymentInfo.amount;
      addressInfo.label = enteredPaymentInfo.description;
      addressInfo.isBip21 = true;
      const shouldDrain =
        liquidNodeInformation.userBalance - addressInfo.amount < 10
          ? true
          : false;
      addressInfo.shouldDrain = shouldDrain;
    }

    const amountSat = addressInfo.amount;
    const fiatValue =
      Number(amountSat) /
      (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));

    return {
      data: addressInfo,
      type: 'liquid',
      paymentNetwork: 'liquid',
      sendAmount: !addressInfo.amount
        ? ''
        : `${
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? `${amountSat}`
              : fiatValue < 0.01
              ? ''
              : `${fiatValue.toFixed(2)}`
          }`,
      canEditPayment: !addressInfo.isBip21,
    };
  } catch (err) {
    console.log('process liquid invoice error', err);
    crashlyticsRecordErrorReport(err.message);
  }
}
