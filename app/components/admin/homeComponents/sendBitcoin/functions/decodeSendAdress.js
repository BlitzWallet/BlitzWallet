import {getLNAddressForLiquidPayment} from './payments';
import {
  InputTypeVariant,
  InputTypeVariant as LiquidTypeVarient,
  parse,
  parseInvoice,
} from '@breeztech/react-native-breez-sdk-liquid';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import processBitcoinAddress from './processBitcoinAddress';
import processBolt11Invoice from './processBolt11Invoice';
import processLNUrlAuth from './processLNUrlAuth';
import processLNUrlPay from './processLNUrlPay';
import processLNUrlWithdraw from './processLNUrlWithdrawl';
import processLiquidAddress from './processLiquidAddress';
// import getLiquidAddressFromSwap from '../../../../../functions/boltz/magicRoutingHints';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import processSparkAddress from './processSparkAddress';
import {decodeBip21SparkAddress} from '../../../../../functions/spark/handleBip21SparkAddress';
import {SATSPERBITCOIN} from '../../../../../constants';
import {decodeBip21Address} from '../../../../../functions/bip21AddressFormmating';
import {address} from 'liquidjs-lib';
import {decodeLNURL} from '../../../../../functions/lnurl/bench32Formmater';
import {formatLightningAddress} from '../../../../../functions/lnurl';
// import processBolt12Offer from './processBolt12Offer';

export default async function decodeSendAddress(props) {
  let {
    btcAdress,
    goBackFunction,
    setPaymentInfo,
    liquidNodeInformation,
    masterInfoObject,
    webViewRef,
    navigate,
    maxZeroConf,
    comingFromAccept,
    enteredPaymentInfo,
    setLoadingMessage,
    paymentInfo,
    parsedInvoice,
    fiatStats,
    fromPage,
    publishMessageFunc,
    sparkInformation,
  } = props;

  try {
    console.log(btcAdress, 'scanned address');
    if (typeof btcAdress !== 'string')
      throw new Error(
        'Addresses should be text only. Please check and try again.',
      );

    if (btcAdress.includes('cryptoqr.net')) {
      crashlyticsLogReport('Handling crypto qr code');
      try {
        const [username, domain] = btcAdress.split('@');
        const response = await fetch(
          `https://${domain}/.well-known/lnurlp/${username}`,
        );
        const data = await response.json();

        if (data.status === 'ERROR') {
          throw new Error(
            'Not able to get merchant payment information from invoice',
          );
        }

        const bolt11 = await getLNAddressForLiquidPayment(
          {data, type: InputTypeVariant.LN_URL_PAY},
          data.minSendable / 1000,
        );

        if (!bolt11) {
          throw new Error('Unable to parse invoice from merchant link');
        }

        // const parsedInvoice = await parseInvoice(bolt11);

        // if (parsedInvoice.amountMsat / 1000 >= maxZeroConf) {
        //   throw new Error(
        //     `Cannot send more than ${displayCorrectDenomination({
        //       amount: maxZeroConf,
        //       masterInfoObject,
        //       fiatStats,
        //     })} to a merchant`,
        //   );
        // }

        btcAdress = bolt11;
      } catch (err) {
        console.error('error getting cryptoQR', err);
        goBackFunction(
          err.message ||
            'There was a problem getting the invoice for this address',
        );
        return;
      }
    }

    crashlyticsLogReport('Parsing bitcoin address input');

    if (btcAdress.startsWith('spark:') || btcAdress.startsWith('sp1p')) {
      if (btcAdress.startsWith('spark:')) {
        const processedAddress = decodeBip21SparkAddress(btcAdress);
        parsedInvoice = {
          type: 'Spark',
          address: {
            address: processedAddress.address,
            message: processedAddress.options.message,
            label: processedAddress.options.label,
            network: 'Spark',
            amount: processedAddress.options.amount,
          },
        };
      } else {
        parsedInvoice = {
          type: 'Spark',
          address: {
            address: btcAdress,
            message: null,
            label: null,
            network: 'Spark',
            amount: null,
          },
        };
      }
    }

    if (
      btcAdress.toLowerCase().startsWith('lightning') ||
      btcAdress.toLowerCase().startsWith('bitcoin') ||
      btcAdress.toLowerCase().startsWith('lnurl')
    ) {
      const decodedAddress = btcAdress.toLowerCase().startsWith('lnurl')
        ? btcAdress
        : decodeBip21Address(
            btcAdress,
            btcAdress.toLowerCase().startsWith('lightning')
              ? 'lightning'
              : 'bitcoin',
          );
      const lnurl = btcAdress.toLowerCase().startsWith('lnurl')
        ? decodedAddress
        : btcAdress.toLowerCase().startsWith('lightning')
        ? decodedAddress.address.toUpperCase()
        : decodedAddress.options.lightning.toUpperCase();

      const decodedLNULR = decodeLNURL(lnurl);
      if (!decodedLNULR)
        throw new Error(
          'Not able to get lightning address from lightning link.',
        );

      const lightningAddress = formatLightningAddress(decodedLNULR);

      btcAdress = lightningAddress;
    }

    const chosenPath = parsedInvoice
      ? Promise.resolve(parsedInvoice)
      : parse(btcAdress);

    let input;
    try {
      input = await chosenPath;
    } catch (err) {
      console.log(err, 'parse error');
      return goBackFunction('Unable to parse address');
    }

    // if (input.type === InputTypeVariant.BOLT11) {
    //   crashlyticsLogReport('Checking if bolt11 contains magic routing hint');
    //   try {
    //     const isMagicRoutingHint = await getLiquidAddressFromSwap(
    //       input.invoice.bolt11,
    //     );
    //     if (isMagicRoutingHint) {
    //       const parsed = await parse(isMagicRoutingHint);
    //       input = parsed;
    //     }
    //   } catch (err) {
    //     return goBackFunction('Failed to resolve embedded liquid address');
    //   }
    // }

    let processedPaymentInfo;
    try {
      processedPaymentInfo = await processInputType(input, {
        fiatStats,
        liquidNodeInformation,
        masterInfoObject,
        navigate,
        goBackFunction,
        maxZeroConf,
        comingFromAccept,
        enteredPaymentInfo,
        setPaymentInfo,
        webViewRef,
        setLoadingMessage,
        paymentInfo,
        fromPage,
      });
    } catch (err) {
      return goBackFunction(err.message || 'Error processing payment info');
    }

    if (processedPaymentInfo) {
      if (
        comingFromAccept &&
        sparkInformation.balance <
          processedPaymentInfo.paymentFee +
            processedPaymentInfo.supportFee +
            enteredPaymentInfo.amount
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: `Sending amount is too low to cover the payment and fees. Maximum send amount is ${displayCorrectDenomination(
            {
              amount: Math.max(
                sparkInformation.balance -
                  (processedPaymentInfo.paymentFee +
                    processedPaymentInfo.supportFee),
                0,
              ),
              masterInfoObject,
              fiatStats,
            },
          )} `,
        });

        if (fromPage !== 'contacts') return;
      }
      setPaymentInfo({...processedPaymentInfo, decodedInput: input});
    } else {
      return goBackFunction('Unable to process input');
    }
  } catch (err) {
    console.error('Decoding send address error:', err);
    goBackFunction(err.message || 'Unknown decoding error occurred');
    return;
  }
}

async function processInputType(input, context) {
  const {setLoadingMessage} = context;
  setLoadingMessage('Getting invoice details');
  crashlyticsLogReport('Getting invoice detials');

  switch (input.type) {
    case InputTypeVariant.BITCOIN_ADDRESS:
      return await processBitcoinAddress(input, context);

    case InputTypeVariant.BOLT11:
      return await processBolt11Invoice(input, context);

    case InputTypeVariant.LN_URL_AUTH:
      return await processLNUrlAuth(input, context);

    case InputTypeVariant.LN_URL_PAY:
      return await processLNUrlPay(input, context);

    case InputTypeVariant.LN_URL_WITHDRAW:
      return await processLNUrlWithdraw(input, context);

    // case LiquidTypeVarient.LIQUID_ADDRESS:
    // return processLiquidAddress(input, context);

    // case LiquidTypeVarient.BOLT12_OFFER:
    //   return processBolt12Offer(input, context);

    case 'Spark':
      return await processSparkAddress(input, context);
    default:
      throw new Error('Not a valid address type');
  }
}
