// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import { SATSPERBITCOIN } from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { InputTypes } from 'bitcoin-address-parser';
import hasAlredyPaidInvoice from './hasPaid';
import {
  dollarsToSats,
  getLightningPaymentQuote,
  USD_ASSET_ADDRESS,
} from '../../../../../functions/spark/flashnet';

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
    usablePaymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    min_usd_swap_amount,
    convertedSendAmount,
    poolInfoRef,
  } = context;

  crashlyticsLogReport('Handling decode bolt11 invoices');
  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = input.data.timestamp + input.data.expiry;
  const isExpired = currentTime > expirationTime;
  const isZeroAmountInvoice = !input.data.amountMsat;
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

  if (usablePaymentMethod === 'USD' && isZeroAmountInvoice) {
    throw new Error(
      t('wallet.sendPages.sendPaymentScreen.zeroAmountInvoiceDollarPayments'),
    );
  }

  const enteredAmount = enteredPaymentInfo.amount
    ? enteredPaymentInfo.amount * 1000
    : convertedSendAmount * 1000;

  const amountMsat =
    comingFromAccept || paymentInfo.sendAmount
      ? enteredAmount
      : input.data.amountMsat || 0;

  const fiatValue =
    !!amountMsat &&
    Number(amountMsat / 1000) / (SATSPERBITCOIN / (fiatStats?.value || 65000));
  let fee = {};
  let swapPaymentQuote = {};

  if (amountMsat) {
    const needUsdFee =
      (usablePaymentMethod === 'USD' ||
        ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
          dollarBalanceSat >= amountMsat / 1000)) &&
      amountMsat / 1000 >= min_usd_swap_amount &&
      !isZeroAmountInvoice;
    const needBtcFee =
      usablePaymentMethod === 'BTC' ||
      ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
        bitcoinBalance >= amountMsat / 1000);

    const hasUsdQuote =
      typeof paymentInfo.swapPaymentQuote === 'object' &&
      Object.keys(paymentInfo.swapPaymentQuote).length;
    const hasBtcFee = !!paymentInfo.paymentFee;

    const promises = [];
    let usdPromiseIndex = -1;
    let btcPromiseIndex = -1;

    if (needUsdFee && !hasUsdQuote) {
      usdPromiseIndex = promises.length;
      promises.push(
        getLightningPaymentQuote(
          currentWalletMnemoinc,
          input.data.address,
          USD_ASSET_ADDRESS,
        ),
      );
    }

    if (needBtcFee && !hasBtcFee) {
      btcPromiseIndex = promises.length;
      promises.push(
        sparkPaymenWrapper({
          getFee: true,
          address: input.data.address,
          amountSats: Math.round(amountMsat / 1000),
          paymentType: !!input.data.usingSparkAddress ? 'spark' : 'lightning',
          masterInfoObject,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        }),
      );
    }

    if (promises.length > 0) {
      const results = await Promise.all(promises);

      if (usdPromiseIndex !== -1) {
        const paymentQuote = results[usdPromiseIndex];
        if (!paymentQuote.didWork && !needBtcFee)
          throw new Error(paymentQuote.error);
        if (paymentQuote.didWork) {
          swapPaymentQuote = {
            ...paymentQuote.quote,
            bitcoinBalance,
            dollarBalanceSat,
          };
          const estimatedAmmFeeSat = Math.round(
            dollarsToSats(
              paymentQuote.quote.estimatedAmmFee / Math.pow(10, 6),
              poolInfoRef.currentPriceAInB,
            ),
          );
          fee = {
            fee: paymentQuote.quote.fee + estimatedAmmFeeSat,
            supportFee: 0,
          };
        }
      }

      if (btcPromiseIndex !== -1) {
        const btcFee = results[btcPromiseIndex];
        if (!btcFee.didWork) throw new Error(btcFee.error);
        fee = {
          fee: btcFee.fee,
          supportFee: btcFee.supportFee,
        };
      }
    } else {
      if (needUsdFee && hasUsdQuote) {
        swapPaymentQuote = paymentInfo.swapPaymentQuote;
        fee = {
          fee: paymentInfo.swapPaymentQuote.fee,
          supportFee: 0,
        };
      }
      if (needBtcFee && hasBtcFee) {
        fee = {
          fee: paymentInfo.paymentFee,
          supportFee: paymentInfo.supportFee,
        };
      }
    }
  }

  const canEditPayment = comingFromAccept ? false : !amountMsat;

  const displayAmount =
    enteredPaymentInfo?.fromContacts || comingFromAccept
      ? enteredPaymentInfo.amount
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(amountMsat / 1000)
      : canEditPayment
      ? fiatValue
      : Math.round(amountMsat / 1000);

  return {
    data: { ...input, message: input.data.description },
    type: InputTypes.BOLT11,
    paymentNetwork: 'lightning',
    paymentFee: fee.fee,
    supportFee: fee.supportFee,
    address: input.data.address,
    usingZeroAmountInvoice: !input.data.amountMsat,
    swapPaymentQuote: swapPaymentQuote,
    sendAmount: !amountMsat ? '' : `${displayAmount}`,
    canEditPayment,
  };
}
