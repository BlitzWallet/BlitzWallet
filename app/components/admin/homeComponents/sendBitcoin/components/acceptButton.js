import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {CENTER, SATSPERBITCOIN} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useState} from 'react';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

export default function AcceptButtonSendPage({
  isUsingSwapWithZeroInvoice,
  canSendPayment,
  decodeSendAddress,
  errorMessageNavigation,
  btcAdress,
  paymentInfo,
  convertedSendAmount,
  paymentDescription,
  setPaymentInfo,
  setLoadingMessage,
  isLiquidPayment,
  fromPage,
  publishMessageFunc,
  webViewRef,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {liquidNodeInformation, fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const navigate = useNavigation();
  return (
    <CustomButton
      buttonStyles={{
        opacity:
          canSendPayment &&
          !(paymentInfo?.data?.invoice?.amountMsat === null) &&
          !(
            isLiquidPayment &&
            (convertedSendAmount < minMaxLiquidSwapAmounts.min ||
              convertedSendAmount > minMaxLiquidSwapAmounts.max)
          )
            ? 1
            : 0.5,
        width: 'auto',
        ...CENTER,
        marginTop: 15,
      }}
      useLoading={isGeneratingInvoice}
      actionFunction={handleEnterSendAmount}
      textContent={'Accept'}
    />
  );

  async function handleEnterSendAmount() {
    if (!paymentInfo?.sendAmount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Please enter a send amount',
      });
      return;
    }
    if (isUsingSwapWithZeroInvoice) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Cannot send payment to a 0 amount lightning invoice.',
      });
      return;
    }
    if (
      isLiquidPayment &&
      (convertedSendAmount < minMaxLiquidSwapAmounts.min ||
        convertedSendAmount > minMaxLiquidSwapAmounts.max)
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `${
          convertedSendAmount < minMaxLiquidSwapAmounts.min
            ? 'Minimum'
            : 'Maximum'
        } send amount ${displayCorrectDenomination({
          amount:
            convertedSendAmount < minMaxLiquidSwapAmounts.min
              ? minMaxLiquidSwapAmounts.min
              : minMaxLiquidSwapAmounts.max,
          fiatStats,
          masterInfoObject,
        })}`,
      });
      return;
    }

    if (!canSendPayment && !!paymentInfo?.sendAmount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Not enough funds to cover fees',
      });
      return;
    }
    setIsGeneratingInvoice(true);
    try {
      await decodeSendAddress({
        fiatStats,
        btcAdress: btcAdress,
        goBackFunction: errorMessageNavigation,
        setPaymentInfo,
        liquidNodeInformation,
        masterInfoObject,
        navigate,
        maxZeroConf:
          minMaxLiquidSwapAmounts?.submarineSwapStats?.limits?.maximalZeroConf,
        comingFromAccept: true,
        enteredPaymentInfo: {
          amount: convertedSendAmount,
          description: paymentDescription,
        },
        paymentInfo,
        setLoadingMessage,
        parsedInvoice: paymentInfo.decodedInput,
        fromPage,
        publishMessageFunc,
        webViewRef,
      });
    } catch (err) {
      console.log('accecpt button error', err);
    }
  }
}
