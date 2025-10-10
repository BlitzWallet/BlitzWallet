import { SATSPERBITCOIN } from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';

import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';

export default async function processSparkAddress(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    paymentInfo,
    fiatStats,
    seletctedToken,
    currentWalletMnemoinc,
    sendWebViewRequest,
  } = context;
  crashlyticsLogReport('Handling decode spark payment');

  const isLRC20 =
    seletctedToken?.tokenMetadata?.tokenTicker !== undefined &&
    seletctedToken?.tokenMetadata?.tokenTicker !== 'Bitcoin';

  let addressInfo = JSON.parse(JSON.stringify(input?.address));

  if (comingFromAccept) {
    addressInfo.amount = enteredPaymentInfo.amount;
    addressInfo.label =
      enteredPaymentInfo.description || input?.address?.label || '';
    addressInfo.message =
      enteredPaymentInfo.description || input?.address?.message || '';
    addressInfo.isBip21 = true;
  }

  const amountMsat = isLRC20
    ? addressInfo.amount || 0
    : comingFromAccept
    ? enteredPaymentInfo.amount * 1000
    : addressInfo.amount * 1000;
  const fiatValue =
    !!amountMsat &&
    Number(amountMsat / 1000) / (SATSPERBITCOIN / (fiatStats?.value || 65000));

  if ((!paymentInfo.paymentFee || paymentInfo?.supportFee) && !!amountMsat) {
    if (paymentInfo.paymentFee && paymentInfo.supportFee) {
      addressInfo.paymentFee = paymentInfo.paymentFee;
      addressInfo.supportFee = paymentInfo.supportFee;
    } else {
      const fee = await sparkPaymenWrapper({
        getFee: true,
        address: addressInfo.address,
        paymentType: isLRC20 ? 'lrc20' : 'spark',
        amountSats: Math.round(amountMsat / (isLRC20 ? 1 : 1000)),
        masterInfoObject,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
      });
      if (!fee.didWork) throw new Error(fee.error);

      addressInfo.paymentFee = fee.fee;
      addressInfo.supportFee = fee.supportFee;
    }
  }

  return {
    data: addressInfo,
    type: 'spark',
    paymentNetwork: 'spark',
    paymentFee: addressInfo.paymentFee,
    supportFee: addressInfo.supportFee,
    sendAmount: !amountMsat
      ? ''
      : isLRC20
      ? amountMsat
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
