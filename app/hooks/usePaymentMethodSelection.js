import { useMemo } from 'react';

export default function usePaymentMethodSelection({
  // Payment info
  paymentInfo = {},

  // Balances
  bitcoinBalance = 0,
  dollarBalanceToken = 0,

  // Swap limits
  swapLimits = { bitcoin: 1000, usd: 1 },

  // Token info
  isUsingLRC20 = false,
  useFullTokensDisplay = false,

  // Pre-selected method (from navigation params)
  selectedPaymentMethod = '',
  didSelectPaymentMethod = false,

  // for swap validation
  sparkInformation,
}) {
  const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
  const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';
  const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';

  const hasBothUSDAndBitcoinBalance =
    Number(dollarBalanceToken) >= 0.01 && !!bitcoinBalance;

  const determinePaymentMethod = useMemo(() => {
    if (!paymentInfo || !Object.keys(paymentInfo).length) return undefined;

    // If using LRC20, payment method is not relevant
    if (isUsingLRC20) return 'BTC';

    // Bitcoin payments can only use BTC
    if (isBitcoinPayment) return 'BTC';

    if (selectedPaymentMethod) return selectedPaymentMethod;

    if (isSparkPayment && useFullTokensDisplay) return 'BTC';

    const hasBitcoinBalance = !!bitcoinBalance;
    const hasDollarBalance = Number(dollarBalanceToken) > 0.01;

    const bitcoinBalanceAboveSwapMinimum = bitcoinBalance > swapLimits.bitcoin;
    const dollarBalanceAboveSwapMinimum = dollarBalanceToken > swapLimits.usd;

    if (isLightningPayment) {
      if (
        hasBitcoinBalance &&
        hasDollarBalance &&
        dollarBalanceAboveSwapMinimum &&
        sparkInformation?.didConnectToFlashnet
      )
        return 'user-choice';

      if (hasBitcoinBalance) return 'BTC';

      if (
        hasDollarBalance &&
        dollarBalanceAboveSwapMinimum &&
        sparkInformation?.didConnectToFlashnet
      )
        return 'USD';

      return 'BTC';
    }

    if (isSparkPayment) {
      const userExpectsBTC = paymentInfo.data?.expectedReceive === 'sats';
      if (userExpectsBTC) {
        // BTC
        if (
          hasBitcoinBalance &&
          hasDollarBalance &&
          dollarBalanceAboveSwapMinimum &&
          sparkInformation?.didConnectToFlashnet
        )
          return 'user-choice';

        if (hasBitcoinBalance) return 'BTC';
        if (
          hasDollarBalance &&
          dollarBalanceAboveSwapMinimum &&
          sparkInformation?.didConnectToFlashnet
        )
          return 'USD';
        return 'BTC';
      } else {
        // USD
        if (
          hasDollarBalance &&
          hasBitcoinBalance &&
          bitcoinBalanceAboveSwapMinimum &&
          sparkInformation?.didConnectToFlashnet
        )
          return 'user-choice';

        if (hasDollarBalance) return 'USD';

        if (
          hasBitcoinBalance &&
          bitcoinBalanceAboveSwapMinimum &&
          sparkInformation?.didConnectToFlashnet
        )
          return 'BTC';
        return 'USD';
      }
    }
    return 'BTC'; // fallback for unhandled networks (liquid, etc.)
  }, [
    isUsingLRC20,
    isBitcoinPayment,
    isLightningPayment,
    isSparkPayment,
    selectedPaymentMethod,
    paymentInfo,
    dollarBalanceToken,
    swapLimits,
    useFullTokensDisplay,
    sparkInformation?.didConnectToFlashnet,
  ]);

  /**
   * Determines if user needs to make a payment method choice
   */
  const needsToChoosePaymentMethod = useMemo(() => {
    return (
      determinePaymentMethod === 'user-choice' &&
      !selectedPaymentMethod &&
      !useFullTokensDisplay &&
      !isUsingLRC20 &&
      hasBothUSDAndBitcoinBalance &&
      !didSelectPaymentMethod
    );
  }, [
    determinePaymentMethod,
    selectedPaymentMethod,
    useFullTokensDisplay,
    isUsingLRC20,
    hasBothUSDAndBitcoinBalance,
    didSelectPaymentMethod,
  ]);

  /**
   * Get the final payment method to use (resolves 'user-choice' to actual method)
   */
  const finalPaymentMethod = useMemo(() => {
    if (selectedPaymentMethod) return selectedPaymentMethod;
    if (determinePaymentMethod === 'user-choice') return undefined;
    return determinePaymentMethod;
  }, [determinePaymentMethod, selectedPaymentMethod]);

  return {
    determinePaymentMethod,
    needsToChoosePaymentMethod,
    finalPaymentMethod,
    hasBothUSDAndBitcoinBalance,
  };
}
