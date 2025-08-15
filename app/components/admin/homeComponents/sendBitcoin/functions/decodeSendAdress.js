import {getLNAddressForLiquidPayment} from './payments';
import {
  InputTypeVariant,
  parse,
} from '@breeztech/react-native-breez-sdk-liquid';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import processBitcoinAddress from './processBitcoinAddress';
import processBolt11Invoice from './processBolt11Invoice';
import processLNUrlAuth from './processLNUrlAuth';
import processLNUrlPay from './processLNUrlPay';
import processLNUrlWithdraw from './processLNUrlWithdrawl';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import processSparkAddress from './processSparkAddress';
import {decodeBip21SparkAddress} from '../../../../../functions/spark/handleBip21SparkAddress';
import {decodeBip21Address} from '../../../../../functions/bip21AddressFormmating';
import {decodeLNURL} from '../../../../../functions/lnurl/bench32Formmater';
import {formatLightningAddress} from '../../../../../functions/lnurl';
import {
  handleCryptoQRAddress,
  isSupportedPNPQR,
} from '../../../../../functions/sendBitcoin/getMerchantAddress';

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
    seletctedToken,
    currentWalletMnemoinc,
    t,
  } = props;

  try {
    console.log(btcAdress, 'scanned address');
    if (typeof btcAdress !== 'string')
      throw new Error(t('wallet.sendPages.handlingAddressErrors.invlidFormat'));

    if (isSupportedPNPQR(btcAdress)) {
      crashlyticsLogReport('Handling crypto qr code');
      btcAdress = await handleCryptoQRAddress(
        btcAdress,
        getLNAddressForLiquidPayment,
      );
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

    // handle bip21 qrs
    if (
      btcAdress.toLowerCase().startsWith('lightning') ||
      btcAdress.toLowerCase().startsWith('bitcoin')
    ) {
      const decodedAddress = decodeBip21Address(
        btcAdress,
        btcAdress.toLowerCase().startsWith('lightning')
          ? 'lightning'
          : 'bitcoin',
      );

      const lightningInvoice = btcAdress.toLowerCase().startsWith('lightning')
        ? decodedAddress.address.toUpperCase()
        : decodedAddress.options.lightning.toUpperCase();

      const decodedLNULR = decodeLNURL(lightningInvoice);

      if (!decodedLNULR) {
        btcAdress = decodedAddress.address;
      } else {
        const lightningAddress = formatLightningAddress(decodedLNULR);
        btcAdress = lightningAddress;
      }
    }

    const chosenPath = parsedInvoice
      ? Promise.resolve(parsedInvoice)
      : parse(btcAdress);

    let input;
    try {
      input = await chosenPath;
    } catch (err) {
      console.log(err, 'parse error');
      return goBackFunction(
        t('wallet.sendPages.handlingAddressErrors.parseError'),
      );
    }

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
        seletctedToken,
        currentWalletMnemoinc,
        t,
      });
    } catch (err) {
      return goBackFunction(
        err.message ||
          t('wallet.sendPages.handlingAddressErrors.paymentProcessingError'),
      );
    }

    if (processedPaymentInfo) {
      if (
        comingFromAccept &&
        (seletctedToken?.tokenMetadata?.tokenTicker === 'Bitcoin' ||
          seletctedToken?.tokenMetadata?.tokenTicker === undefined) &&
        sparkInformation.balance <
          processedPaymentInfo.paymentFee +
            processedPaymentInfo.supportFee +
            enteredPaymentInfo.amount
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'wallet.sendPages.handlingAddressErrors.tooLowSendingAmount',
            {
              amount: displayCorrectDenomination({
                amount: Math.max(
                  sparkInformation.balance -
                    (processedPaymentInfo.paymentFee +
                      processedPaymentInfo.supportFee),
                  0,
                ),
                masterInfoObject,
                fiatStats,
              }),
            },
          ),
        });

        if (fromPage !== 'contacts') return;
      }
      setPaymentInfo({...processedPaymentInfo, decodedInput: input});
    } else {
      return goBackFunction(
        t('wallet.sendPages.handlingAddressErrors.processInputError'),
      );
    }
  } catch (err) {
    console.error('Decoding send address error:', err);
    goBackFunction(
      err.message ||
        t('wallet.sendPages.handlingAddressErrors.unkonwDecodeError'),
    );
    return;
  }
}

async function processInputType(input, context) {
  const {setLoadingMessage, t} = context;
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

    case 'lnUrlError':
      throw new Error(input.data.reason);

    case 'Spark':
      return await processSparkAddress(input, context);
    default:
      throw new Error(
        t('wallet.sendPages.handlingAddressErrors.invalidInputType'),
      );
  }
}
