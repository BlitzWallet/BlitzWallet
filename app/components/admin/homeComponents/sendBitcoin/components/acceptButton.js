import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {
  CENTER,
  SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useState} from 'react';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';

export default function AcceptButtonSendPage({
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
  minLNURLSatAmount,
  maxLNURLSatAmount,
  sparkInformation,
  seletctedToken,
  isLRC20Payment,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {liquidNodeInformation, fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {t} = useTranslation();
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const navigate = useNavigation();
  return (
    <CustomButton
      buttonStyles={{
        opacity:
          canSendPayment &&
          !(
            isLiquidPayment &&
            (convertedSendAmount < minMaxLiquidSwapAmounts.min ||
              convertedSendAmount > minMaxLiquidSwapAmounts.max)
          ) &&
          !(
            paymentInfo?.type === 'lnUrlPay' &&
            (convertedSendAmount < minLNURLSatAmount ||
              convertedSendAmount > maxLNURLSatAmount)
          ) &&
          !(
            paymentInfo?.type === 'Bitcoin' &&
            convertedSendAmount < SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT
          ) &&
          !(isLRC20Payment && sparkInformation.balance < 10)
            ? 1
            : 0.5,
        width: 'auto',
        ...CENTER,
      }}
      useLoading={isGeneratingInvoice}
      actionFunction={handleEnterSendAmount}
      textContent={t('constants.accept')}
    />
  );

  async function handleEnterSendAmount() {
    if (!paymentInfo?.sendAmount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.noSendAmountError'),
      });
      return;
    }

    if (
      isLiquidPayment &&
      (convertedSendAmount < minMaxLiquidSwapAmounts.min ||
        convertedSendAmount > minMaxLiquidSwapAmounts.max)
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.liquidError', {
          overFlowType:
            convertedSendAmount < minMaxLiquidSwapAmounts.min
              ? 'Minimum'
              : 'Maximum',
          amount: displayCorrectDenomination({
            amount:
              convertedSendAmount < minMaxLiquidSwapAmounts.min
                ? minMaxLiquidSwapAmounts.min
                : minMaxLiquidSwapAmounts.max,
            fiatStats,
            masterInfoObject,
          }),
        }),
      });
      return;
    }
    if (
      paymentInfo?.type === 'Bitcoin' &&
      convertedSendAmount < SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.onchainError', {
          amount: displayCorrectDenomination({
            amount: SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
            fiatStats,
            masterInfoObject,
          }),
        }),
      });
      return;
    }
    if (
      paymentInfo?.type === InputTypeVariant.LN_URL_PAY &&
      (convertedSendAmount < minLNURLSatAmount ||
        convertedSendAmount > maxLNURLSatAmount)
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.lnurlPayError', {
          overFlowType:
            convertedSendAmount < minLNURLSatAmount ? 'Minimum' : 'Maximum',
          amount: displayCorrectDenomination({
            amount:
              convertedSendAmount < minLNURLSatAmount
                ? minLNURLSatAmount
                : maxLNURLSatAmount,
            fiatStats,
            masterInfoObject,
          }),
        }),
      });
      return;
    }

    if (isLRC20Payment && sparkInformation.balance < 10) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.lrc20FeeError', {
          amount: displayCorrectDenomination({
            amount: 10,
            masterInfoObject,
            fiatStats,
          }),
          balance: displayCorrectDenomination({
            amount: sparkInformation.balance,
            masterInfoObject,
            fiatStats,
          }),
        }),
      });
      return;
    }

    if (!canSendPayment && !!paymentInfo?.sendAmount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.balanceError'),
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
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
      });
      setIsGeneratingInvoice(false);
    } catch (err) {
      console.log('accecpt button error', err);
    }
  }
}
