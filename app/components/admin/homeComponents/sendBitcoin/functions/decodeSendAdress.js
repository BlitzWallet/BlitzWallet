import {InputTypeVariant, parseInput} from '@breeztech/react-native-breez-sdk';
import {getLNAddressForLiquidPayment} from './payments';
import {
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
import getLiquidAddressFromSwap from '../../../../../functions/boltz/magicRoutingHints';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import processBolt12Offer from './processBolt12Offer';

export default async function decodeSendAddress(props) {
  let {
    nodeInformation,
    btcAdress,
    goBackFunction,
    setPaymentInfo,
    liquidNodeInformation,
    masterInfoObject,
    // setWebViewArgs,
    webViewRef,
    navigate,
    maxZeroConf,
    comingFromAccept,
    enteredPaymentInfo,
    setLoadingMessage,
    paymentInfo,
  } = props;

  try {
    // Handle cryptoqr.net special case
    if (btcAdress.includes('cryptoqr.net')) {
      crashlyticsLogReport('Handling crypto qr code');
      try {
        const [username, domain] = btcAdress.split('@');
        const response = await fetch(
          `https://${domain}/.well-known/lnurlp/${username}`,
        );
        const data = await response.json();

        if (data.status === 'ERROR') {
          goBackFunction(
            'Not able to get merchant payment information from invoice',
          );
          return;
        }

        const bolt11 = await getLNAddressForLiquidPayment(
          {data, type: InputTypeVariant.LN_URL_PAY},
          data.minSendable / 1000,
        );

        if (!bolt11) throw new Error('Not able to parse invoice');

        const parsedInvoice = await parseInvoice(bolt11);

        if (parsedInvoice.amountMsat / 1000 >= maxZeroConf) {
          goBackFunction(
            `Cannot send more than ${displayCorrectDenomination({
              amount: maxZeroConf,
              nodeInformation,
              masterInfoObject,
            })} to a merchant`,
          );
          return;
        }
        btcAdress = bolt11;
      } catch (err) {
        console.log('error getting cryptoQR', err);
        goBackFunction(
          `There was a problem getting the invoice for this address`,
        );
        return;
      }
    }

    crashlyticsLogReport('Parsing bitcoin address input');

    const input = await parse(btcAdress);

    if (input.type === InputTypeVariant.BOLT11) {
      crashlyticsLogReport(
        'Running check to see if bolt11 address contains liquid address',
      );
      const isMagicRoutingHint = await getLiquidAddressFromSwap(
        input.invoice.bolt11,
      );
      console.log(isMagicRoutingHint);
      if (isMagicRoutingHint) {
        btcAdress = isMagicRoutingHint;
        throw new Error('Pushing to liquid to pay');
      }
    }

    const processedPaymentInfo = await processInputType(input, {
      nodeInformation,
      liquidNodeInformation,
      masterInfoObject,
      navigate,
      goBackFunction,
      maxZeroConf,
      comingFromAccept,
      enteredPaymentInfo,
      setPaymentInfo,
      webViewRef,
      // setWebViewArgs,
      setLoadingMessage,
      paymentInfo,
    });

    if (processedPaymentInfo) {
      setPaymentInfo(processedPaymentInfo);
    } else {
      goBackFunction('Unable to to process input');
    }
  } catch (err) {
    console.log(err, 'Decoding send address erorr');
    goBackFunction(err.message);
    return;
  }
}

async function processInputType(input, context) {
  const {navigate, goBackFunction, setLoadingMessage} = context;
  setLoadingMessage('Getting invoice details');
  crashlyticsLogReport('Getting invoice detials');

  switch (input.type) {
    case InputTypeVariant.BITCOIN_ADDRESS:
      return await processBitcoinAddress(input, context);

    case InputTypeVariant.BOLT11:
      return processBolt11Invoice(input, context);

    case InputTypeVariant.LN_URL_AUTH:
      return await processLNUrlAuth(input, context);

    case InputTypeVariant.LN_URL_PAY:
      return processLNUrlPay(input, context);

    case InputTypeVariant.LN_URL_WITHDRAW:
      return await processLNUrlWithdraw(input, context);

    case LiquidTypeVarient.LIQUID_ADDRESS:
      return processLiquidAddress(input, context);

    case LiquidTypeVarient.BOLT12_OFFER:
      return processBolt12Offer(input, context);
    default:
      goBackFunction('Not a valid address type');
      return null;
  }
}
