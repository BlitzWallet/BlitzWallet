import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {CENTER, SATSPERBITCOIN} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useState} from 'react';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';

export default function AcceptButtonSendPage({
  canSendPayment,
  decodeSendAddress,
  errorMessageNavigation,
  btcAdress,
  paymentInfo,
  convertedSendAmount,
  paymentDescription,
  setPaymentInfo,
  isSendingSwap,
  canUseLightning,
  canUseLiquid,
  setLoadingMessage,
  minSendAmount,
  maxSendAmount,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const navigate = useNavigation();
  return (
    <CustomButton
      buttonStyles={{
        opacity:
          canSendPayment &&
          !(
            isSendingSwap &&
            paymentInfo?.data?.invoice?.amountMsat === null &&
            !canUseLightning
          ) &&
          !(
            paymentInfo.type === 'Bitcoin' &&
            (convertedSendAmount < paymentInfo.data.limits.minSat ||
              convertedSendAmount > paymentInfo.data.limits.maxSat)
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
    if (
      paymentInfo.type === 'Bitcoin' &&
      (convertedSendAmount < paymentInfo.data.limits.minSat ||
        convertedSendAmount > paymentInfo.data.limits.maxSat)
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `${
          convertedSendAmount <= paymentInfo.data.limits.minSat
            ? 'Minimum'
            : 'Maximum'
        } send amount ${displayCorrectDenomination({
          amount:
            paymentInfo.data.limits[
              convertedSendAmount <= paymentInfo.data.limits.minSat
                ? 'minSat'
                : 'maxSat'
            ],
          nodeInformation,
          masterInfoObject,
        })}`,
      });
      return;
    }
    if (
      isSendingSwap &&
      paymentInfo?.data?.invoice?.amountMsat === null &&
      !canUseLightning
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Cannot send to zero amount invoice from the bank',
      });
      return;
    }
    if (
      (!canSendPayment && paymentInfo?.sendAmount < minSendAmount) ||
      paymentInfo?.sendAmount > maxSendAmount
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `${
          paymentInfo?.sendAmount < minSendAmount ? 'Minimum' : 'Maximum'
        } send amount ${displayCorrectDenomination({
          amount:
            paymentInfo?.sendAmount < minSendAmount
              ? minSendAmount
              : maxSendAmount,
          nodeInformation,
          masterInfoObject,
        })}`,
      });
      return;
    }
    if (
      !canSendPayment &&
      paymentInfo?.type === InputTypeVariant.BOLT12_OFFER
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'You can only send to Bolt12 offers from Liquid',
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
        nodeInformation,
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
          from: canUseLiquid ? 'liquid' : 'lightning',
        },
        paymentInfo,
        setLoadingMessage,
        parsedInvoice: paymentInfo.decodedInput,
      });
    } catch (err) {
      console.log('accecpt button error', err);
    }
  }
}
