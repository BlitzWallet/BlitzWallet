// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {
  MIN_USD_BTC_LIGHTNING_SWAP,
  SATSPERBITCOIN,
} from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { getLNAddressForLiquidPayment } from './payments';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { InputTypes, parseInput } from 'bitcoin-address-parser';
import { getBolt11InvoiceForContact } from '../../../../../functions/contacts';
import {
  dollarsToSats,
  getLightningPaymentQuote,
  USD_ASSET_ADDRESS,
} from '../../../../../functions/spark/flashnet';
import { isBlitzLNURLAddress } from '../../../../../functions/lnurl';
import normalizeLNURLAddress from '../../../../../functions/lnurl/normalizeLNURLAddress';

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
    poolInfoRef,
  } = context;
  crashlyticsLogReport('Beiging decode LNURL pay');

  const [username, domain] = input.data.address?.split('@');
  console.log(username, domain);

  const nomralizedAddress = normalizeLNURLAddress(input.data.address);
  if (
    username?.toLowerCase() ===
      globalContactsInformation.myProfile.uniqueName.toLowerCase() &&
    isBlitzLNURLAddress(nomralizedAddress)
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

  let defaultLNURLDescription = [];
  try {
    const metadata =
      typeof input.data.metadata === 'string'
        ? JSON.parse(input.data.metadata)
        : input.data.metadata;

    if (Array.isArray(metadata)) {
      defaultLNURLDescription =
        metadata.find(item => item[0] === 'text/plain') ?? [];
    }
  } catch {
    // malformed JSON, default stays []
  }

  const preEstimatedInvoiceData = enteredPaymentInfo?.lnInvoiceData ?? null;
  const preEstimatedSwapQuote = enteredPaymentInfo?.swapQuote ?? null;
  const preEstimatedBtcFee = enteredPaymentInfo?.lnFeeEstimate ?? null;

  if (comingFromAccept || paymentInfo.sendAmount) {
    // Use invoice pre-fetched during fee estimation to avoid a duplicate network call.
    // The invoice is only valid for the exact amount sent from the contacts page.
    if (preEstimatedInvoiceData?.pr && comingFromAccept) {
      invoice = preEstimatedInvoiceData.pr;
      if (preEstimatedInvoiceData.successAction) {
        input.data.successAction = preEstimatedInvoiceData.successAction;
      }
    } else {
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

          if (invoiceResponse.pr) {
            invoice = invoiceResponse.pr;
            if (invoiceResponse.successAction) {
              input.data.successAction = invoiceResponse.successAction;
            }
            break;
          }
        } catch (err) {
          console.log(
            `Invoice generation attempt ${numberOfTries} failed:`,
            err,
          );
        }

        if (!invoice && numberOfTries < maxRetries) {
          console.log(
            `Waiting to retry invoice generation (attempt ${
              numberOfTries + 1
            })`,
          );
          await new Promise(res => setTimeout(res, 2000));
        }
      }

      if (!invoice)
        throw new Error(
          t('wallet.sendPages.handlingAddressErrors.lnurlPayNoInvoiceError'),
        );
    }

    // Now that we have the invoice, determine which fee estimates are needed
    const needUsdFee =
      (usablePaymentMethod === 'USD' ||
        ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
          dollarBalanceSat >= amountMsat / 1000)) &&
      amountMsat / 1000 >= MIN_USD_BTC_LIGHTNING_SWAP;
    const needBtcFee =
      usablePaymentMethod === 'BTC' ||
      ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
        bitcoinBalance >= amountMsat / 1000);

    // Check if we have cached values (from re-decode) or pre-estimated values (from contacts fee estimation)
    const hasUsdQuote =
      preEstimatedSwapQuote !== null ||
      (typeof paymentInfo.swapPaymentQuote === 'object' &&
        Object.keys(paymentInfo.swapPaymentQuote).length);
    const hasBtcFee = !!preEstimatedBtcFee || !!paymentInfo.paymentFee;

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
          const estimatedAmmFeeSat = Math.round(
            dollarsToSats(
              paymentQuote.quote.estimatedAmmFee / Math.pow(10, 6),
              poolInfoRef.currentPriceAInB,
            ),
          );
          paymentFee = paymentQuote.quote.fee + estimatedAmmFeeSat;
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
        const sourceQuote =
          preEstimatedSwapQuote || paymentInfo.swapPaymentQuote;
        swapPaymentQuote = {
          ...sourceQuote,
          bitcoinBalance,
          dollarBalanceSat,
        };
        paymentFee = sourceQuote.fee;
        supportFee = 0;
      }
      if (needBtcFee && hasBtcFee) {
        paymentFee = preEstimatedBtcFee || paymentInfo.paymentFee;
        supportFee = paymentInfo.supportFee || 0;
      }
    }
  }

  if (!input.data.maxSendable || !input.data.minSendable) {
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.lnurlPayInvalidFormat'),
    );
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
    amountSat: Math.round(amountMsat / 1000),
  };
}
