import React, {useState, useMemo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';

import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';

import CustomButton from '../../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

import {
  CENTER,
  SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
} from '../../../../../constants';

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
  // webViewRef,
  minLNURLSatAmount,
  maxLNURLSatAmount,
  sparkInformation,
  seletctedToken,
  isLRC20Payment,
  useAltLayout,
}) {
  const navigate = useNavigation();
  const {t} = useTranslation();
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const {masterInfoObject} = useGlobalContextProvider();
  const {liquidNodeInformation, fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();

  const isLiquidAmountValid = useMemo(() => {
    if (!isLiquidPayment) return true;
    return (
      convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
      convertedSendAmount <= minMaxLiquidSwapAmounts.max
    );
  }, [isLiquidPayment, convertedSendAmount, minMaxLiquidSwapAmounts]);

  const isLNURLAmountValid = useMemo(() => {
    if (paymentInfo?.type !== 'lnUrlPay') return true;
    return (
      convertedSendAmount >= minLNURLSatAmount &&
      convertedSendAmount <= maxLNURLSatAmount
    );
  }, [
    paymentInfo?.type,
    convertedSendAmount,
    minLNURLSatAmount,
    maxLNURLSatAmount,
  ]);

  const isBitcoinAmountValid = useMemo(() => {
    if (paymentInfo?.type !== 'Bitcoin') return true;
    return convertedSendAmount >= SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT;
  }, [paymentInfo?.type, convertedSendAmount]);

  const isLRC20Valid = useMemo(() => {
    if (!isLRC20Payment) return true;
    return sparkInformation.balance >= 10;
  }, [isLRC20Payment, sparkInformation?.balance]);

  const buttonOpacity = useMemo(() => {
    return canSendPayment &&
      isLiquidAmountValid &&
      isLNURLAmountValid &&
      isBitcoinAmountValid &&
      isLRC20Valid
      ? 1
      : 0.5;
  }, [
    canSendPayment,
    isLiquidAmountValid,
    isLNURLAmountValid,
    isBitcoinAmountValid,
    isLRC20Valid,
  ]);

  const handleLiquidAmountError = () => {
    const isMinError = convertedSendAmount < minMaxLiquidSwapAmounts.min;
    const errorAmount = isMinError
      ? minMaxLiquidSwapAmounts.min
      : minMaxLiquidSwapAmounts.max;

    navigate.navigate('ErrorScreen', {
      errorMessage: t('wallet.sendPages.acceptButton.liquidError', {
        overFlowType: isMinError ? 'Minimum' : 'Maximum',
        amount: displayCorrectDenomination({
          amount: errorAmount,
          fiatStats,
          masterInfoObject,
        }),
      }),
    });
  };

  const handleBitcoinAmountError = () => {
    navigate.navigate('ErrorScreen', {
      errorMessage: t('wallet.sendPages.acceptButton.onchainError', {
        amount: displayCorrectDenomination({
          amount: SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
          fiatStats,
          masterInfoObject,
        }),
      }),
    });
  };

  const handleLNURLPayError = () => {
    const isMinError = convertedSendAmount < minLNURLSatAmount;
    const errorAmount = isMinError ? minLNURLSatAmount : maxLNURLSatAmount;

    navigate.navigate('ErrorScreen', {
      errorMessage: t('wallet.sendPages.acceptButton.lnurlPayError', {
        overFlowType: isMinError ? 'Minimum' : 'Maximum',
        amount: displayCorrectDenomination({
          amount: errorAmount,
          fiatStats,
          masterInfoObject,
        }),
      }),
    });
  };

  const handleLRC20Error = () => {
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
  };

  const handleInsufficientBalanceError = () => {
    navigate.navigate('ErrorScreen', {
      errorMessage: t('wallet.sendPages.acceptButton.balanceError'),
    });
  };

  const handleNoSendAmountError = () => {
    navigate.navigate('ErrorScreen', {
      errorMessage: t('wallet.sendPages.acceptButton.noSendAmountError'),
    });
  };

  const validatePaymentAmount = () => {
    if (!paymentInfo?.sendAmount) {
      handleNoSendAmountError();
      return false;
    }

    if (!isLiquidAmountValid) {
      handleLiquidAmountError();
      return false;
    }

    if (!isBitcoinAmountValid) {
      handleBitcoinAmountError();
      return false;
    }

    if (
      paymentInfo?.type === InputTypeVariant.LN_URL_PAY &&
      !isLNURLAmountValid
    ) {
      handleLNURLPayError();
      return false;
    }

    if (!isLRC20Valid) {
      handleLRC20Error();
      return false;
    }

    if (!canSendPayment && !!paymentInfo?.sendAmount) {
      handleInsufficientBalanceError();
      return false;
    }

    return true;
  };

  const handleEnterSendAmount = async () => {
    if (!validatePaymentAmount()) {
      return;
    }

    setIsGeneratingInvoice(true);

    try {
      await decodeSendAddress({
        fiatStats,
        btcAdress,
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
        // webViewRef,
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
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
      ...CENTER,
    };
  }, [useAltLayout]);

  return (
    <CustomButton
      buttonStyles={memorizedStyles}
      useLoading={isGeneratingInvoice}
      actionFunction={handleEnterSendAmount}
      textContent={t('constants.accept')}
    />
  );
}
