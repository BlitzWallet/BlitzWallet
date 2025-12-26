// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import { SATSPERBITCOIN } from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { InputTypes } from 'bitcoin-address-parser';
import hasAlredyPaidInvoice from './hasPaid';

export default async function processBolt11Invoice(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    fiatStats,
    paymentInfo,
    currentWalletMnemoinc,
    t,
    sendWebViewRequest,
  } = context;

  crashlyticsLogReport('Handling decode bolt11 invoices');
  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = input.data.timestamp + input.data.expiry;
  const isExpired = currentTime > expirationTime;
  if (isExpired)
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.expiredLightningInvoice'),
    );

  if (!paymentInfo.paymentFee && !paymentInfo.supportFee) {
    const didPay = await hasAlredyPaidInvoice({
      scannedAddress: input.data.address,
    });

    if (didPay)
      throw new Error(
        t('wallet.sendPages.sendPaymentScreen.alreadyPaidInvoiceError'),
      );
  }

  const amountMsat = comingFromAccept
    ? enteredPaymentInfo.amount * 1000
    : input.data.amountMsat || 0;
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
        address: input.data.address,
        amountSats: Math.round(amountMsat / 1000),
        paymentType: 'lightning',
        masterInfoObject,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
      });

      if (!fee.didWork) throw new Error(fee.error);
    }
  }

  return {
    data: { ...input, message: input.data.description },
    type: InputTypes.BOLT11,
    paymentNetwork: 'lightning',
    paymentFee: fee.fee,
    supportFee: fee.supportFee,
    address: input.data.address,
    usingZeroAmountInvoice: !input.data.amountMsat,
    sendAmount: !amountMsat
      ? ''
      : `${
          masterInfoObject.userBalanceDenomination != 'fiat'
            ? `${Math.round(amountMsat / 1000)}`
            : fiatValue
        }`,
    canEditPayment: comingFromAccept ? false : !amountMsat,
  };
}
