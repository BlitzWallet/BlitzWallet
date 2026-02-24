import React, { useState, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import CustomButton from '../../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

import {
  CENTER,
  SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
} from '../../../../../constants';
import { InputTypes } from 'bitcoin-address-parser';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';

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
  // isLiquidPayment,
  fromPage,
  publishMessageFunc,
  // webViewRef,
  minLNURLSatAmount,
  maxLNURLSatAmount,
  sparkInformation,
  seletctedToken,
  isLRC20Payment,
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
  // usd_multiplier_coefiicent,
  min_usd_swap_amount,
  hasSufficientBalance,
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
  // const {minMaxLiquidSwapAmounts} = useAppStatus();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();

  // const isLiquidAmountValid = useMemo(() => {
  //   if (!isLiquidPayment) return true;
  //   return (
  //     convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
  //     convertedSendAmount <= minMaxLiquidSwapAmounts.max
  //   );
  // }, [isLiquidPayment, convertedSendAmount, minMaxLiquidSwapAmounts]);

  // const isLNURLAmountValid = useMemo(() => {
  //   if (paymentInfo?.type !== InputTypes.LNURL_PAY) return true;
  //   return (
  //     convertedSendAmount >= minLNURLSatAmount &&
  //     convertedSendAmount <= maxLNURLSatAmount
  //   );
  // }, [
  //   paymentInfo?.type,
  //   convertedSendAmount,
  //   minLNURLSatAmount,
  //   maxLNURLSatAmount,
  // ]);

  // const isBitcoinAmountValid = useMemo(() => {
  //   if (paymentInfo?.type !== InputTypes.BITCOIN_ADDRESS) return true;
  //   return convertedSendAmount >= SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT;
  // }, [paymentInfo?.type, convertedSendAmount]);

  // const showNoSwapAvailableForBitcoinError = useMemo(() => {
  //   if (paymentInfo?.type !== InputTypes.BITCOIN_ADDRESS) return false;

  //   return (
  //     dollarBalanceSat >= convertedSendAmount &&
  //     bitcoinBalance < convertedSendAmount
  //   );
  // }, [
  //   paymentInfo?.type,
  //   convertedSendAmount,
  //   dollarBalanceSat,
  //   bitcoinBalance,
  // ]);

  // const isLRC20Valid = useMemo(() => {
  //   if (!isLRC20Payment) return true;
  //   return (
  //     // sparkInformation.balance >= 10 &&
  //     seletctedToken?.balance >=
  //     paymentInfo?.sendAmount * 10 ** seletctedToken?.tokenMetadata?.decimals
  //   );
  // }, [isLRC20Payment, sparkInformation?.balance, seletctedToken, paymentInfo]);

  // const isBalanceFragmentationIssue = useMemo(() => {
  //   const hasSufficientTotalBalance =
  //     bitcoinBalance + dollarBalanceSat > convertedSendAmount;

  //   return hasSufficientTotalBalance && !hasSufficientBalance;
  // }, [
  //   bitcoinBalance,
  //   dollarBalanceSat,
  //   convertedSendAmount,
  //   selectedPaymentMethod,
  //   hasSufficientBalance,
  // ]);

  // const buttonOpacity = useMemo(() => {
  //   return canSendPayment &&
  //     // isLiquidAmountValid &&
  //     isLNURLAmountValid &&
  //     isBitcoinAmountValid &&
  //     isLRC20Valid
  //     ? 1
  //     : 0.5;
  // }, [
  //   canSendPayment,
  //   // isLiquidAmountValid,
  //   isLNURLAmountValid,
  //   isBitcoinAmountValid,
  //   isLRC20Valid,
  // ]);

  // const handleLiquidAmountError = () => {
  //   const isMinError = convertedSendAmount < minMaxLiquidSwapAmounts.min;
  //   const errorAmount = isMinError
  //     ? minMaxLiquidSwapAmounts.min
  //     : minMaxLiquidSwapAmounts.max;

  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t('wallet.sendPages.acceptButton.liquidError', {
  //       overFlowType: isMinError ? 'Minimum' : 'Maximum',
  //       amount: displayCorrectDenomination({
  //         amount: errorAmount,
  //         fiatStats,
  //         masterInfoObject,
  //       }),
  //     }),
  //   });
  // };

  // const handleBitcoinAmountError = () => {
  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t('wallet.sendPages.acceptButton.onchainError', {
  //       amount: displayCorrectDenomination({
  //         amount: SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
  //         fiatStats,
  //         masterInfoObject,
  //       }),
  //     }),
  //   });
  // };

  // const handleShowNoSwapAvailableForBitcoinError = () => {
  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t(
  //       'wallet.sendPages.acceptButton.noSwapForBTCPaymentsError',
  //     ),
  //   });
  // };

  // const handleBalanceFragmentationError = () => {
  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t(
  //       'wallet.sendPages.acceptButton.balanceFragmentationError',
  //       {
  //         amount: displayCorrectDenomination({
  //           amount:
  //             selectedPaymentMethod === 'BTC'
  //               ? min_usd_swap_amount
  //               : swapLimits.bitcoin,
  //           masterInfoObject,
  //           fiatStats,
  //         }),
  //       },
  //     ),
  //   });
  // };

  // const handleLNURLPayError = () => {
  //   const isMinError = convertedSendAmount < minLNURLSatAmount;
  //   const errorAmount = isMinError ? minLNURLSatAmount : maxLNURLSatAmount;

  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t('wallet.sendPages.acceptButton.lnurlPayError', {
  //       overFlowType: isMinError
  //         ? t('constants.minimum')
  //         : t('constants.maximum'),
  //       amount: displayCorrectDenomination({
  //         amount: errorAmount,
  //         fiatStats,
  //         masterInfoObject,
  //       }),
  //     }),
  //   });
  // };

  // const handleLRC20Error = () => {
  //   navigate.navigate('ErrorScreen', {
  //     errorMessage:
  //       sparkInformation.balance >= 10
  //         ? t('wallet.sendPages.acceptButton.balanceError')
  //         : t('wallet.sendPages.acceptButton.lrc20FeeError', {
  //             amount: displayCorrectDenomination({
  //               amount: 10,
  //               masterInfoObject,
  //               fiatStats,
  //             }),
  //             balance: displayCorrectDenomination({
  //               amount: sparkInformation.balance,
  //               masterInfoObject,
  //               fiatStats,
  //             }),
  //           }),
  //   });
  // };

  // const handleInsufficientBalanceError = () => {
  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t('wallet.sendPages.acceptButton.balanceError'),
  //   });
  // };

  // const handleNoSendAmountError = () => {
  //   navigate.navigate('ErrorScreen', {
  //     errorMessage: t('wallet.sendPages.acceptButton.noSendAmountError'),
  //   });
  // };

  // const validatePaymentAmount = () => {
  //   if (!paymentInfo?.sendAmount) {
  //     handleNoSendAmountError();
  //     return false;
  //   }

  //   // if (!isLiquidAmountValid) {
  //   //   handleLiquidAmountError();
  //   //   return false;
  //   // }

  //   if (!isBitcoinAmountValid) {
  //     handleBitcoinAmountError();
  //     return false;
  //   }

  //   if (showNoSwapAvailableForBitcoinError) {
  //     handleShowNoSwapAvailableForBitcoinError();
  //     return false;
  //   }

  //   if (paymentInfo?.type === InputTypes.LNURL_PAY && !isLNURLAmountValid) {
  //     handleLNURLPayError();
  //     return false;
  //   }

  //   if (!isLRC20Valid) {
  //     handleLRC20Error();
  //     return false;
  //   }

  //   if (selectedPaymentMethod === 'user-choice') {
  //     navigate.navigate('CustomHalfModal', {
  //       wantedContent: 'SelectPaymentMethod',
  //       convertedSendAmount,
  //     });
  //     return false;
  //   }

  //   if (isBalanceFragmentationIssue) {
  //     handleBalanceFragmentationError();
  //     return false;
  //   }

  //   if (!canSendPayment && !!paymentInfo?.sendAmount) {
  //     handleInsufficientBalanceError();
  //     return false;
  //   }

  //   return true;
  // };

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
        },
        paymentInfo,
        setLoadingMessage,
        parsedInvoice: paymentInfo.decodedInput,
        fromPage,
        publishMessageFunc,
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
