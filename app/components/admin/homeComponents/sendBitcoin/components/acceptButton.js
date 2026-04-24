import React, { useState, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../constants';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';

export default function AcceptButtonSendPage({
  decodeSendAddress,
  errorMessageNavigation,
  btcAdress,
  paymentInfo,
  convertedSendAmount,
  paymentDescription,
  setPaymentInfo,
  setLoadingMessage,
  fromPage,
  sparkInformation,
  seletctedToken,
  useAltLayout,
  sendWebViewRequest,
  globalContactsInformation,
  canUseFastPay,
  selectedPaymentMethod,
  bitcoinBalance,
  dollarBalanceSat,
  isDecoding,
  poolInfoRef,
  swapLimits,
  min_usd_swap_amount,
  inputDenomination,
  paymentValidation,
  setDidSelectPaymentMethod,
  conversionFiatStats,
  primaryDisplay,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const { masterInfoObject } = useGlobalContextProvider();
  const { liquidNodeInformation, fiatStats } = useNodeContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();

  const handleEnterSendAmount = async () => {
    if (!paymentValidation.isValid) {
      const errorMessage = paymentValidation.getErrorMessage(
        paymentValidation.primaryError,
      );

      navigate.navigate('ErrorScreen', { errorMessage });
      return;
    }

    setIsGeneratingInvoice(true);
    setDidSelectPaymentMethod(true);

    try {
      await decodeSendAddress({
        fiatStats,
        btcAdress,
        goBackFunction: errorMessageNavigation,
        setPaymentInfo,
        liquidNodeInformation,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: inputDenomination,
        },
        navigate,
        // maxZeroConf:
        //   minMaxLiquidSwapAmounts?.submarineSwapStats?.limits?.maximalZeroConf,
        comingFromAccept: true,
        enteredPaymentInfo: {
          amount: convertedSendAmount,
          description: paymentDescription,
          lnInvoiceData: paymentInfo?.data?.invoice
            ? {
                pr: paymentInfo.data.invoice,
                successAction: paymentInfo.data.successAction,
              }
            : null,
        },
        paymentInfo,
        setLoadingMessage,
        parsedInvoice: paymentInfo.decodedInput,
        fromPage,
        // webViewRef,
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
        sendWebViewRequest,
        globalContactsInformation,
        usablePaymentMethod: selectedPaymentMethod || 'BTC',
        bitcoinBalance,
        dollarBalanceSat,
        convertedSendAmount: convertedSendAmount,
        poolInfoRef,
        swapLimits,
        // usd_multiplier_coefiicent,
        min_usd_swap_amount,
        conversionFiatStats,
        primaryDisplay,
      });
    } catch (error) {
      console.log('Accept button error:', error);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const memorizedStyles = useMemo(() => {
    return {
      borderRadius: useAltLayout ? 30 : 8,
      height: useAltLayout ? 50 : 'unset',
      flexShrink: useAltLayout ? 1 : 0,
      width: useAltLayout ? '100%' : 'auto',
      opacity: paymentValidation.isValid ? 1 : HIDDEN_OPACITY,
      ...CENTER,
    };
  }, [useAltLayout, paymentValidation]);

  return (
    <CustomButton
      buttonStyles={memorizedStyles}
      useLoading={isGeneratingInvoice || isDecoding}
      actionFunction={handleEnterSendAmount}
      textContent={
        canUseFastPay ? t('constants.confirm') : t('constants.review')
      }
    />
  );
}
