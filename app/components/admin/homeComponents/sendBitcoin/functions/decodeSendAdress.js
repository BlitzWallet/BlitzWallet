import {InputTypeVariant, parseInput} from '@breeztech/react-native-breez-sdk';
import {decodeLiquidAddress} from '../../../../../functions/liquidWallet/decodeLiquidAddress';
import {getLNAddressForLiquidPayment} from './payments';
import {
  InputTypeVariant as LiquidTypeVarient,
  parseInvoice,
} from '@breeztech/react-native-breez-sdk-liquid';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import processBitcoinAddress from './processBitcoinAddress';
import processBolt11Invoice from './processBolt11Invoice';
import processLNUrlAuth from './processLNUrlAuth';
import processLNUrlPay from './processLNUrlPay';
import processLNUrlWithdraw from './processLNUrlWithdrawl';
import processLiquidAddress from './processLiquidAddress';

export default async function decodeSendAddress(props) {
  let {
    nodeInformation,
    btcAdress,
    goBackFunction,
    setPaymentInfo,
    liquidNodeInformation,
    masterInfoObject,
    setWebViewArgs,
    webViewRef,
    navigate,
    maxZeroConf,
    comingFromAccept,
    enteredPaymentInfo,
    setLoadingMessage,
  } = props;

  try {
    // Handle cryptoqr.net special case
    if (btcAdress.includes('cryptoqr.net')) {
      const [username, domain] = btcAdress.split('@');
      const response = await fetch(
        `https://${domain}/.well-known/lnurlp/${username}`,
      );
      const data = await response.json();

      if (data.status === 'ERROR') {
        return navigateToErrorScreen(
          navigate,
          'Not able to get merchant payment information',
          goBackFunction,
        );
      }

      const bolt11 = await getLNAddressForLiquidPayment(
        {data, type: InputTypeVariant.LN_URL_PAY},
        data.minSendable / 1000,
      );
      const parsedInvoice = await parseInvoice(bolt11);

      if (parsedInvoice.amountMsat / 1000 >= maxZeroConf) {
        return navigateToErrorScreen(
          navigate,
          `Cannot send more than ${displayCorrectDenomination({
            amount: maxZeroConf,
            nodeInformation,
            masterInfoObject,
          })} to a merchant`,
          goBackFunction,
        );
      }
      btcAdress = bolt11;
    }

    const input = await parseInput(btcAdress);
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
      setWebViewArgs,
      setLoadingMessage,
    });

    if (processedPaymentInfo) {
      setPaymentInfo(processedPaymentInfo);
    }
  } catch (err) {
    console.log(err, 'LIGHTNING ERROR');

    try {
      const rawLiquidAddress = btcAdress.startsWith(
        process.env.BOLTZ_ENVIRONMENT === 'testnet'
          ? 'liquidtestnet:'
          : 'liquidnetwork:',
      )
        ? btcAdress.split('?')[0].split(':')[1]
        : btcAdress;

      const input = decodeLiquidAddress(rawLiquidAddress);

      if (input) {
        const processedLiquidInfo = await processInputType(
          {...input, type: 'liquidAddress'},
          {
            btcAddress: btcAdress,
            liquidNodeInformation,
            nodeInformation,
            masterInfoObject,
            navigate,
            goBackFunction,
            comingFromAccept,
            enteredPaymentInfo,
            setLoadingMessage,
          },
        );

        setPaymentInfo(processedLiquidInfo);
      } else {
        navigateToErrorScreen(
          navigate,
          'Error getting liquid address',
          goBackFunction,
        );
      }
    } catch (err) {
      console.log('error parsing liquid address', err);
      navigateToErrorScreen(navigate, 'Not a valid Address', goBackFunction);
    }
  }
}

async function processInputType(input, context) {
  const {navigate, goBackFunction, setLoadingMessage} = context;
  setLoadingMessage('Getting invoice details');

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

    default:
      navigateToErrorScreen(navigate, 'Not a valid Address', goBackFunction);
      return null;
  }
}

function navigateToErrorScreen(navigate, message, goBackFunction) {
  navigate.navigate('ErrorScreen', {
    errorMessage: message,
    customNavigator: () => goBackFunction(),
  });
}
