import { useMemo } from 'react';
import { InputTypes } from 'bitcoin-address-parser';

import {
  SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
  USDB_TOKEN_ID,
} from '../../../../../constants';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

export default function usePaymentValidation({
  // Payment info
  paymentInfo,
  convertedSendAmount,
  paymentFee,
  determinePaymentMethod,
  selectedPaymentMethod,

  // Balances
  bitcoinBalance,
  dollarBalanceSat,
  dollarBalanceToken,

  // Swap limits
  min_usd_swap_amount,
  swapLimits,

  // Token info (for LRC20)
  isUsingLRC20,
  seletctedToken,

  // LNURL limits
  minLNURLSatAmount,
  maxLNURLSatAmount,

  // UI state
  isDecoding,
  canEditAmount,

  // Translation function
  t,

  // formatting amounts
  masterInfoObject,
  fiatStats,
  inputDenomination,
  primaryDisplay,
  conversionFiatStats,

  //can perform swap
  sparkInformation,
}) {
  const validation = useMemo(() => {
    // Initialize validation result
    const result = {
      isValid: false,
      canProceed: false,
      errors: [],
      needsUserChoice: false,
    };

    // Early return if still decoding or no payment info
    if (isDecoding || !Object.keys(paymentInfo || {}).length) {
      result.errors.push('DECODING');
      return result;
    }

    // Check if amount is provided when editing
    if (canEditAmount && !Number(paymentInfo?.sendAmount)) {
      result.errors.push('NO_AMOUNT');
      return result;
    }

    // Payment type checks
    const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';
    const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
    const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';
    const isLNURLPayment = paymentInfo?.type === InputTypes.LNURL_PAY;

    // Get receiver's expected currency
    const receiverExpectsCurrency =
      paymentInfo?.data?.expectedReceive || 'sats';
    const totalCost = convertedSendAmount + paymentFee;

    const finalPaymentMethod =
      !selectedPaymentMethod && determinePaymentMethod === 'BTC'
        ? 'BTC'
        : determinePaymentMethod;

    console.log(
      finalPaymentMethod,
      determinePaymentMethod,
      selectedPaymentMethod,
      receiverExpectsCurrency,
      'payment methods',
    );

    if (isUsingLRC20) {
      const tokenBalance = seletctedToken?.balance ?? 0;
      const tokenDecimals = seletctedToken?.tokenMetadata?.decimals ?? 0;
      const requiredTokenAmount = paymentInfo?.sendAmount * 10 ** tokenDecimals;

      // Check if user has enough token balance
      if (tokenBalance < requiredTokenAmount) {
        result.errors.push('INSUFFICIENT_TOKEN_BALANCE');
        return result;
      }

      // LRC20 validation passed
      result.isValid = true;
      result.canProceed = true;
      return result;
    }

    if (isLightningPayment) {
      // zero amount invoices do not support swaps
      if (
        finalPaymentMethod === 'USD' &&
        paymentInfo?.decodedInput?.type === InputTypes.BOLT11 &&
        !paymentInfo?.decodedInput?.data?.amountMsat
      ) {
        result.errors.push('ZERO_AMOUNT_INVOICE_SWAP_ERROR');
        return result;
      }
    }

    if (isBitcoinPayment) {
      // Check minimum on-chain amount
      if (convertedSendAmount < SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT) {
        result.errors.push('BELOW_BITCOIN_MINIMUM');
        return result;
      }

      if (
        dollarBalanceSat + bitcoinBalance > totalCost &&
        dollarBalanceSat >= totalCost &&
        bitcoinBalance < totalCost
      ) {
        result.errors.push('NO_SWAP_FOR_BITCOIN_PAYMENTS');
        return result;
      }

      if (
        dollarBalanceSat + bitcoinBalance > totalCost &&
        bitcoinBalance < totalCost
      ) {
        result.errors.push('BALANCE_FRAGMENTATION');
        return result;
      }

      // Check if user has sufficient BTC balance
      if (bitcoinBalance < totalCost) {
        result.errors.push('INSUFFICIENT_BALANCE');
        return result;
      }

      // Bitcoin validation passed
      result.isValid = true;
      result.canProceed = true;
      return result;
    }

    if (isLNURLPayment) {
      if (convertedSendAmount < minLNURLSatAmount) {
        result.errors.push('BELOW_LNURL_MINIMUM');
        return result;
      }

      if (convertedSendAmount > maxLNURLSatAmount) {
        result.errors.push('ABOVE_LNURL_MAXIMUM');
        return result;
      }
    }

    const needsSwap =
      (finalPaymentMethod === 'USD' && receiverExpectsCurrency === 'sats') ||
      (finalPaymentMethod === 'BTC' && receiverExpectsCurrency === 'tokens') ||
      (isSparkPayment &&
        finalPaymentMethod === 'BTC' &&
        paymentInfo?.data?.expectedToken === USDB_TOKEN_ID);

    console.log(
      needsSwap,
      'needs swap',
      finalPaymentMethod,
      receiverExpectsCurrency,
    );

    if (needsSwap) {
      if (finalPaymentMethod === 'USD') {
        // USD → BTC swap
        if (convertedSendAmount < min_usd_swap_amount) {
          result.errors.push('BELOW_USD_SWAP_MINIMUM');
          return result;
        }
      } else if (finalPaymentMethod === 'BTC') {
        // BTC → USD swap
        if (convertedSendAmount < swapLimits.bitcoin) {
          result.errors.push('BELOW_BTC_SWAP_MINIMUM');
          return result;
        }
      }
      if (!sparkInformation?.didConnectToFlashnet) {
        result.errors.push('FLASHNET_NOT_INITIALIZED');
        return result;
      }
    }

    const hasSufficientBalance =
      finalPaymentMethod === 'USD'
        ? dollarBalanceSat >= totalCost
        : bitcoinBalance >= totalCost;

    if (!hasSufficientBalance) {
      // Check for balance fragmentation
      const hasSufficientTotalBalance =
        bitcoinBalance + dollarBalanceSat >= totalCost;

      if (hasSufficientTotalBalance) {
        result.errors.push('BALANCE_FRAGMENTATION');
        return result;
      }

      result.errors.push('INSUFFICIENT_BALANCE');
      return result;
    }

    result.isValid = true;
    result.canProceed = true;
    return result;
  }, [
    paymentInfo,
    convertedSendAmount,
    paymentFee,
    determinePaymentMethod,
    selectedPaymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    min_usd_swap_amount,
    swapLimits,
    isUsingLRC20,
    seletctedToken,
    minLNURLSatAmount,
    maxLNURLSatAmount,
    isDecoding,
    canEditAmount,
    sparkInformation?.didConnectToFlashnet,
  ]);

  /**
   * Get user-friendly error message for a given error code
   */
  const getErrorMessage = errorCode => {
    const errorMessages = {
      DECODING: t('wallet.sendPages.sendPaymentScreen.decodingPayment'),
      NO_AMOUNT: t('wallet.sendPages.acceptButton.noSendAmountError'),
      NEEDS_PAYMENT_METHOD_SELECTION: t(
        'wallet.sendPages.sendPaymentScreen.selectPaymentMethod',
      ),
      INSUFFICIENT_TOKEN_BALANCE: t(
        'wallet.sendPages.acceptButton.balanceError',
      ),
      INSUFFICIENT_LRC20_FEE_BALANCE: t(
        'wallet.sendPages.acceptButton.lrc20FeeError',
        {
          amount: displayCorrectDenomination({
            amount: 10,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: inputDenomination,
            },
            fiatStats: conversionFiatStats,
            forceCurrency: primaryDisplay.forceCurrency,
          }),
          balance: bitcoinBalance,
        },
      ),
      BELOW_BITCOIN_MINIMUM: t('wallet.sendPages.acceptButton.onchainError', {
        amount: displayCorrectDenomination({
          amount: SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: inputDenomination,
          },
          fiatStats: conversionFiatStats,
          forceCurrency: primaryDisplay.forceCurrency,
        }),
      }),
      NO_SWAP_FOR_BITCOIN_PAYMENTS: t(
        'wallet.sendPages.acceptButton.noSwapForBTCPaymentsError',
      ),
      BELOW_LNURL_MINIMUM: t('wallet.sendPages.acceptButton.lnurlPayError', {
        overFlowType: t('constants.minimum'),
        amount: displayCorrectDenomination({
          amount: minLNURLSatAmount,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: inputDenomination,
          },
          fiatStats: conversionFiatStats,
          forceCurrency: primaryDisplay.forceCurrency,
        }),
      }),
      ABOVE_LNURL_MAXIMUM: t('wallet.sendPages.acceptButton.lnurlPayError', {
        overFlowType: t('constants.maximum'),
        amount: displayCorrectDenomination({
          amount: maxLNURLSatAmount,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: inputDenomination,
          },
          fiatStats: conversionFiatStats,
          forceCurrency: primaryDisplay.forceCurrency,
        }),
      }),
      BELOW_USD_SWAP_MINIMUM: t(
        'wallet.sendPages.acceptButton.swapMinimumError',
        {
          amount: displayCorrectDenomination({
            amount: min_usd_swap_amount,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: inputDenomination,
            },
            fiatStats: conversionFiatStats,
            forceCurrency: primaryDisplay.forceCurrency,
          }),
          currency1: t('constants.dollars_upper'),
          currency2: t('constants.bitcoin_upper'),
        },
      ),
      BELOW_BTC_SWAP_MINIMUM: t(
        'wallet.sendPages.acceptButton.swapMinimumError',
        {
          amount: displayCorrectDenomination({
            amount: swapLimits.bitcoin,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: inputDenomination,
            },
            fiatStats: conversionFiatStats,
            forceCurrency: primaryDisplay.forceCurrency,
          }),
          currency1: t('constants.bitcoin_upper'),
          currency2: t('constants.dollars_upper'),
        },
      ),
      BALANCE_FRAGMENTATION: t(
        'wallet.sendPages.acceptButton.balanceFragmentationError',
      ),
      INSUFFICIENT_BALANCE: t('wallet.sendPages.acceptButton.balanceError'),
      ZERO_AMOUNT_INVOICE_SWAP_ERROR: t(
        'wallet.sendPages.sendPaymentScreen.zeroAmountInvoiceDollarPayments',
      ),
      FLASHNET_NOT_INITIALIZED: t(
        'wallet.sendPages.acceptButton.flashnetOffineError',
      ),
    };

    return errorMessages[errorCode] || errorCode;
  };

  return {
    ...validation,
    getErrorMessage,
    // Helper methods
    primaryError: validation.errors[0],
  };
}
