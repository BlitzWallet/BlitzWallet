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
import {
  normalizeLNURLCurrency,
  lnurlCurrencyToRate,
} from '../../../../../functions/sendBitcoin/lnurlCurrencyRate';
import {
  getPhonePaymentCountry,
  PROVIDER_COUNTRY_CURRENCY,
} from '../../../../../functions/sendBitcoin/getPhonePaymentAddress';
import loadNewFiatData from '../../../../../functions/saveAndUpdateFiatData';

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
    contactsPrivateKey,
    publicKey,
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

  // LUD-18: stamp the user's own Lightning Address onto the parsed data so the eventual
  // callback fetch can pass it as a refund address when the service advertises payerData.
  // This rides on `...input.data` in the return value, reaching the send screen / send-max
  // invoice fetches without threading it through every call site.
  const myUniqueName = globalContactsInformation?.myProfile?.uniqueName;
  if (myUniqueName) {
    input.data.refundLightningAddress = `${myUniqueName}@blitzwalletapp.com`;
  }

  const enteredAmount = enteredPaymentInfo.amount
    ? enteredPaymentInfo.amount * 1000
    : convertedSendAmount * 1000;

  const amountMsat =
    comingFromAccept || paymentInfo.sendAmount
      ? enteredAmount
      : input.data.minSendable;
  const amountSat = Math.round(amountMsat / 1000);

  const fiatValue =
    !!amountMsat && amountSat / (SATSPERBITCOIN / (fiatStats?.value || 65000));

  let swapPaymentQuote = {};
  let paymentFee = 0;
  let supportFee = 0;
  let usdPaymentFee = 0;
  let usdSupportFee = 0;
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

  // Surface any LNURL-advertised currency + the phone-payment provider country so
  // the send screen can default the amount input to the local fiat currency.
  const lnurlCurrency = normalizeLNURLCurrency(input.data);
  const phonePaymentCountry = getPhonePaymentCountry(input.data.address);

  // For phone-number payments whose LNURL advertises no usable rate, the send
  // screen switches the input to the provider country's local fiat currency and
  // fetches that rate, surfacing a loading state on the input page. Warm the
  // fiat-rate cache in parallel here (during decode, behind the decode spinner)
  // so the screen's later fetch resolves from cache with no visible hitch.
  const prefetchLocalRate =
    phonePaymentCountry &&
    contactsPrivateKey &&
    publicKey &&
    !lnurlCurrencyToRate(lnurlCurrency)
      ? loadNewFiatData(
          PROVIDER_COUNTRY_CURRENCY[phonePaymentCountry],
          contactsPrivateKey,
          publicKey,
          masterInfoObject,
        ).catch(() => {})
      : null;

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
          dollarBalanceSat >= amountSat)) &&
      amountSat >= MIN_USD_BTC_LIGHTNING_SWAP;
    const needBtcFee =
      usablePaymentMethod === 'BTC' ||
      ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
        bitcoinBalance >= amountSat);

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
      const lnurlQuoteTimeout = new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              didWork: false,
              error: 'Lightning payment quote timed out',
            }),
          25000,
        ),
      );
      promises.push(
        Promise.race([
          getLightningPaymentQuote(
            currentWalletMnemoinc,
            invoice,
            USD_ASSET_ADDRESS,
            undefined,
            undefined,
            { amountSats: amountSat },
          ),
          lnurlQuoteTimeout,
        ]),
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
          usdPaymentFee =
            paymentQuote.quote.estimatedLightningFee + estimatedAmmFeeSat;
          usdSupportFee = 0;
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
        usdPaymentFee = paymentInfo.usdPaymentFee ?? sourceQuote.fee;
        usdSupportFee = 0;
      }
      if (needBtcFee && hasBtcFee) {
        paymentFee = preEstimatedBtcFee || paymentInfo.paymentFee;
        supportFee = paymentInfo.supportFee || 0;
      }
    }

    // If only USD path ran, fall back paymentFee to usdPaymentFee
    if (!paymentFee && usdPaymentFee) {
      paymentFee = usdPaymentFee;
      supportFee = usdSupportFee;
    }
  }

  if (!input.data.maxSendable || !input.data.minSendable) {
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.lnurlPayInvalidFormat'),
    );
  }

  const canEditPayment = !invoice;

  // Make sure the local fiat rate is cached before the send screen reads it.
  if (prefetchLocalRate) await prefetchLocalRate;

  const displayAmount =
    enteredPaymentInfo?.fromContacts || comingFromAccept
      ? enteredPaymentInfo.amount
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? amountSat
      : canEditPayment
      ? fiatValue
      : amountSat;

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
    usdPaymentFee,
    usdSupportFee,
    swapPaymentQuote: swapPaymentQuote,
    type: InputTypes.LNURL_PAY,
    paymentNetwork: 'lightning',
    sendAmount: enteredAmount ? `${displayAmount}` : '',
    canEditPayment,
    amountSat: amountSat,
    enteredDisplayAmount: enteredPaymentInfo?.displayAmount ?? null,
    enteredDisplayDenomination: enteredPaymentInfo?.displayDenomination ?? null,
    lnurlCurrency,
    phonePaymentCountry,
  };
}
