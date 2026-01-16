import { useMemo } from 'react';

export default function usePaymentMethodSelection({
  // Payment info
  paymentInfo = {},
  convertedSendAmount = 0,
  paymentFee = 0,

  // Balances
  sparkBalance = 0,
  bitcoinBalance = 0,
  dollarBalanceSat = 0,
  dollarBalanceToken = 0,

  // Swap limits
  min_usd_swap_amount = 0,
  swapLimits = { bitcoin: 0 },

  // Token info
  isUsingLRC20 = false,
  useFullTokensDisplay = false,

  // Pre-selected method (from navigation params)
  selectedPaymentMethod = '',
  didSelectPaymentMethod = false,
}) {
  const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
  const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';

  const hasBothUSDAndBitcoinBalance =
    Number(dollarBalanceToken) > 0.01 && !!bitcoinBalance;

  const determinePaymentMethod = useMemo(() => {
    // If using LRC20, payment method is not relevant
    if (isUsingLRC20) return 'BTC';

    // Bitcoin payments can only use BTC
    if (isBitcoinPayment) return 'BTC';

    // If user already selected a method, use it
    if (selectedPaymentMethod) return selectedPaymentMethod;

    // Check user balances
    const hasBTCBalance = sparkBalance >= convertedSendAmount + paymentFee;
    const hasUSDBalance = dollarBalanceSat >= convertedSendAmount + paymentFee;

    // Check swap limits
    const meetsUSDMinimum = convertedSendAmount >= min_usd_swap_amount;
    const meetsBTCMinimum = convertedSendAmount >= swapLimits.bitcoin;

    if (!Object.keys(paymentInfo).length) return undefined;

    // If payment is Spark
    if (isSparkPayment) {
      // If using full token display (multiple tokens), always use BTC
      if (useFullTokensDisplay) return 'BTC';

      // Receiver expects BTC
      if (paymentInfo.data?.expectedReceive === 'sats') {
        // BTC → BTC Spark (no swap needed)
        const canPayBTCtoBTC = hasBTCBalance;

        // USD → BTC Spark (requires swap, check minimums)
        const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

        if (canPayBTCtoBTC && canPayUSDtoBTC) {
          return 'user-choice';
        }
        return canPayBTCtoBTC ? 'BTC' : canPayUSDtoBTC ? 'USD' : 'BTC';
      }
      // Receiver expects USD
      else {
        // USD → USD Spark (no swap needed)
        const canPayUSDtoUSD = hasUSDBalance;

        // BTC → USD Spark (requires swap, check minimums)
        const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;

        if (canPayUSDtoUSD && canPayBTCtoUSD) {
          return 'user-choice';
        }
        return canPayUSDtoUSD ? 'USD' : canPayBTCtoUSD ? 'BTC' : 'USD';
      }
    }

    // Lightning payments (always receive as BTC)
    // BTC → BTC (no swap)
    const canPayBTCtoBTC = hasBTCBalance;

    // USD → BTC (requires swap, check minimums)
    const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

    if (canPayBTCtoBTC && canPayUSDtoBTC) {
      return 'user-choice';
    }

    if (!hasBothUSDAndBitcoinBalance) {
      return Number(dollarBalanceToken) > 0.01 ? 'USD' : 'BTC';
    }

    return canPayBTCtoBTC ? 'BTC' : canPayUSDtoBTC ? 'USD' : 'BTC';
  }, [
    isUsingLRC20,
    isBitcoinPayment,
    selectedPaymentMethod,
    paymentInfo,
    sparkBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    convertedSendAmount,
    paymentFee,
    min_usd_swap_amount,
    swapLimits,
    useFullTokensDisplay,
    hasBothUSDAndBitcoinBalance,
    isSparkPayment,
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
