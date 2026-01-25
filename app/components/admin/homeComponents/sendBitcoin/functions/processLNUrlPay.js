// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import { SATSPERBITCOIN } from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { getLNAddressForLiquidPayment } from './payments';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { InputTypes, parseInput } from 'bitcoin-address-parser';
import { getBolt11InvoiceForContact } from '../../../../../functions/contacts';
import {
  getLightningPaymentQuote,
  USD_ASSET_ADDRESS,
} from '../../../../../functions/spark/flashnet';

export default async function processLNUrlPay(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    fiatStats,
    paymentInfo,
    currentWalletMnemoinc,
    t,
    sendWebViewRequest,
    fromPage,
    contactInfo,
    globalContactsInformation,
    usablePaymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    convertedSendAmount,
    min_usd_swap_amount,
  } = context;
  crashlyticsLogReport('Beiging decode LNURL pay');

  const [username, domain] = input.data.address?.split('@');

  if (
    username?.toLowerCase() ===
      globalContactsInformation.myProfile.uniqueName.toLowerCase() &&
    (domain === 'blitz-wallet.com' ||
      domain === 'blitzwalletapp.com' ||
      domain === 'blitzwallet.app')
  ) {
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.payingToSameAddress', {
        addressType: 'Lightning',
      }),
    );
  }

  const enteredAmount = enteredPaymentInfo.amount
    ? enteredPaymentInfo.amount * 1000
    : convertedSendAmount * 1000;

  const amountMsat =
    comingFromAccept || paymentInfo.sendAmount
      ? enteredAmount
      : input.data.minSendable;

  const fiatValue =
    Number(amountMsat / 1000) / (SATSPERBITCOIN / (fiatStats?.value || 65000));

  let swapPaymentQuote = {};
  let paymentFee = 0;
  let supportFee = 0;
  let invoice = '';
  const description =
    (fromPage === 'contacts'
      ? contactInfo?.payingContactMessage
      : enteredPaymentInfo.description) || '';

  const defaultLNURLDescription =
    JSON.parse(input.data.metadata)?.find(item => {
      const [tag, value] = item;
      if (tag === 'text/plain') return true;
    }) || [];

  if (comingFromAccept || paymentInfo.sendAmount) {
    // Generate invoice first (must be sequential with retries)
    let numberOfTries = 0;
    let maxRetries = 3;
    while (!invoice && numberOfTries < maxRetries) {
      try {
        numberOfTries += 1;
        let invoiceResponse;

        if (fromPage === 'contacts' && !contactInfo?.isLNURLPayment) {
          invoiceResponse = await getBolt11InvoiceForContact(
            contactInfo.uniqueName,
            Number(enteredAmount / 1000),
            description,
            true,
            undefined,
            masterInfoObject.uuid,
          );
        } else {
          invoiceResponse = await getLNAddressForLiquidPayment(
            input,
            Number(enteredAmount / 1000),
            description,
          );
        }

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

    // Now that we have the invoice, determine which fee estimates are needed
    const needUsdFee =
      (usablePaymentMethod === 'USD' ||
        ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
          dollarBalanceSat >= amountMsat / 1000)) &&
      amountMsat / 1000 >= min_usd_swap_amount;
    const needBtcFee =
      usablePaymentMethod === 'BTC' ||
      ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
        bitcoinBalance >= amountMsat / 1000);

    // Check if we have cached values
    const hasUsdQuote =
      typeof paymentInfo.swapPaymentQuote === 'object' &&
      Object.keys(paymentInfo.swapPaymentQuote).length;
    const hasBtcFee = !!paymentInfo.paymentFee;

    // Build parallel operations
    const promises = [];
    let usdPromiseIndex = -1;
    let btcPromiseIndex = -1;

    if (needUsdFee && !hasUsdQuote) {
      usdPromiseIndex = promises.length;
      promises.push(
        getLightningPaymentQuote(
          currentWalletMnemoinc,
          invoice,
          USD_ASSET_ADDRESS,
        ),
      );
    }

    if (needBtcFee && !hasBtcFee) {
      btcPromiseIndex = promises.length;
      const decoded = await parseInput(invoice);
      promises.push(
        sparkPaymenWrapper({
          getFee: true,
          address: invoice,
          amountSats: Number(enteredPaymentInfo.amount),
          paymentType: !!decoded.data.usingSparkAddress ? 'spark' : 'lightning',
          masterInfoObject,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        }),
      );
    }

    // Execute fee estimates in parallel
    if (promises.length > 0) {
      const results = await Promise.all(promises);

      // Process USD quote result
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
          paymentFee = paymentQuote.quote.fee;
          supportFee = 0;
        }
      }

      // Process BTC fee result
      if (btcPromiseIndex !== -1) {
        const fee = results[btcPromiseIndex];
        if (!fee.didWork) throw new Error(fee.error);
        paymentFee = fee.fee;
        supportFee = fee.supportFee;
      }
    } else {
      if (needUsdFee && hasUsdQuote) {
        paymentFee = paymentInfo.swapPaymentQuote.fee;
        supportFee = 0;
        swapPaymentQuote = paymentInfo.swapPaymentQuote;
      }
      if (needBtcFee && hasBtcFee) {
        paymentFee = paymentInfo.paymentFee;
        supportFee = paymentInfo.supportFee;
      }
    }
  }

  const canEditPayment = !invoice;

  const displayAmount =
    enteredPaymentInfo?.fromContacts || comingFromAccept
      ? enteredPaymentInfo.amount
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(amountMsat / 1000)
      : canEditPayment
      ? fiatValue
      : Math.round(amountMsat / 1000);

  return {
    data: enteredAmount
      ? {
          ...input.data,
          message: enteredPaymentInfo.description || defaultLNURLDescription[1],
          invoice: invoice,
        }
      : input.data,
    paymentFee,
    supportFee,
    swapPaymentQuote: swapPaymentQuote,
    type: InputTypes.LNURL_PAY,
    paymentNetwork: 'lightning',
    sendAmount: enteredAmount ? `${displayAmount}` : '',
    canEditPayment,
  };
}
