// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {SATSPERBITCOIN} from '../../../../../constants';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import {getLNAddressForLiquidPayment} from './payments';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {InputTypes} from 'bitcoin-address-parser';

export default async function processLNUrlPay(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    fiatStats,
    paymentInfo,
    currentWalletMnemoinc,
    t,
  } = context;

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
    JSON.parse(input.data.metadata)?.find(item => {
      const [tag, value] = item;
      if (tag === 'text/plain') return true;
    }) || [];
  if (comingFromAccept) {
    let numberOfTries = 0;
    let maxRetries = 3;
    while (!invoice && numberOfTries < maxRetries) {
      try {
        numberOfTries += 1;

        const invoiceResponse = await getLNAddressForLiquidPayment(
          input,
          Number(enteredPaymentInfo.amount),
          enteredPaymentInfo.description || '',
        );

        if (invoiceResponse) {
          invoice = invoiceResponse;
          break;
        }
      } catch (err) {
        console.log(`Invoice generation attempt ${numberOfTries} failed:`, err);
      }

      if (!invoice && numberOfTries < maxRetries) {
        console.log(
          `Waiting to retry invoice generation (attempt ${numberOfTries + 1})`,
        );
        await new Promise(res => setTimeout(res, 2000));
      }
    }

    if (!invoice)
      throw new Error(
        t('wallet.sendPages.handlingAddressErrors.lnurlPayInvoiceError'),
      );
    if (paymentInfo.paymentFee && paymentInfo.supportFee) {
      paymentFee = paymentInfo.paymentFee;
      supportFee = paymentInfo.supportFee;
    } else {
      const fee = await sparkPaymenWrapper({
        getFee: true,
        address: invoice,
        amountSats: Number(enteredPaymentInfo.amount),
        paymentType: 'lightning',
        masterInfoObject,
        mnemonic: currentWalletMnemoinc,
      });

      if (!fee.didWork) throw new Error(fee.error);
      paymentFee = fee.fee;
      supportFee = fee.supportFee;
    }
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
    type: InputTypes.LNURL_PAY,
    paymentNetwork: 'lightning',
    sendAmount: comingFromAccept
      ? `${
          masterInfoObject.userBalanceDenomination != 'fiat'
            ? `${Math.round(amountMsat / 1000)}`
            : fiatValue < 0.01
            ? ''
            : `${fiatValue.toFixed(2)}`
        }`
      : '',
    canEditPayment: !comingFromAccept,
  };
}
