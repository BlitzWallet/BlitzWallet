import { useMemo } from 'react';
import { InputTypes } from 'bitcoin-address-parser';

import {
  MIN_USD_BTC_LIGHTNING_SWAP,
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
    const result = {
      isValid: false,
      canProceed: false,
      errors: [],
      needsUserChoice: false,
    };

    // ─── Phase 1: UI state guards (passthrough — not real validation) ──────────
    // These check whether the UI is ready to validate, not whether payment is valid.

    if (isDecoding || !Object.keys(paymentInfo || {}).length) {
      result.errors.push('DECODING');
      return result;
    }

    if (canEditAmount && !Number(paymentInfo?.sendAmount)) {
      result.errors.push('NO_AMOUNT');
      return result;
    }

    // ─── Shared derived values ─────────────────────────────────────────────────

    const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';
    const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
    const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';
    const isLNURLPayment = paymentInfo?.type === InputTypes.LNURL_PAY;

    const receiverExpectsCurrency =
      paymentInfo?.data?.expectedReceive || 'sats';
    const expectedToken = paymentInfo?.data?.expectedToken;
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

    // ─── Phase 2: LRC20 token payments (self-contained, early return) ──────────
    if (isUsingLRC20) {
      const tokenBalance = seletctedToken?.balance ?? 0;
      const tokenDecimals = seletctedToken?.tokenMetadata?.decimals ?? 0;
      const requiredTokenAmount = paymentInfo?.sendAmount * 10 ** tokenDecimals;

      if (tokenBalance < requiredTokenAmount) {
        result.errors.push('INSUFFICIENT_TOKEN_BALANCE');
        return result;
      }

      result.isValid = true;
      result.canProceed = true;
      return result;
    }

    // ─── Phase 3: Payment-type routing ────────────────────────────────────────
    // Each branch owns all checks specific to that payment type.
    // Direct payments (no swap) return early here.
    // Payments that need a swap fall through to Phase 4.

    // 3A. Lightning (BOLT11) — falls through to Phase 4 or 5
    if (isLightningPayment) {
      if (
        finalPaymentMethod === 'USD' &&
        paymentInfo?.decodedInput?.type === InputTypes.BOLT11 &&
        !paymentInfo?.decodedInput?.data?.amountMsat
      ) {
        result.errors.push('ZERO_AMOUNT_INVOICE_SWAP_ERROR');
        return result;
      }

      if (
        finalPaymentMethod === 'USD' &&
        convertedSendAmount < MIN_USD_BTC_LIGHTNING_SWAP
      ) {
        result.errors.push('BELOW_USD_BTC_LN_MINIMUM');
        return result;
      }
    }

    // 3B. On-chain Bitcoin — validates and returns early (no swap supported)
    if (isBitcoinPayment) {
      if (convertedSendAmount < SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT) {
        result.errors.push('BELOW_BITCOIN_MINIMUM');
        return result;
      }

      if (finalPaymentMethod === 'USD') {
        result.errors.push('NO_SWAP_FOR_BITCOIN_PAYMENTS');
        return result;
      }

      if (bitcoinBalance < convertedSendAmount) {
        result.errors.push('INSUFFICIENT_BALANCE');
        return result;
      }

      result.isValid = true;
      result.canProceed = true;
      return result;
    }

    // 3C. LNURL — validates bounds, then falls through to Phase 4 or 5
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

    // 3D. Spark — direct cases return early, swap cases fall through to Phase 4
    if (isSparkPayment) {
      // Case 1: BTC → sats (no swap needed)
      const isDirectBtcToSats =
        finalPaymentMethod === 'BTC' &&
        receiverExpectsCurrency === 'sats' &&
        expectedToken !== USDB_TOKEN_ID;

      // Case 4: USD → USDB tokens (no swap needed)
      const isDirectUsdToUsd =
        finalPaymentMethod === 'USD' && receiverExpectsCurrency === 'tokens';

      if (isDirectBtcToSats) {
        if (bitcoinBalance < totalCost) {
          result.errors.push('INSUFFICIENT_BALANCE');
          return result;
        }
        result.isValid = true;
        result.canProceed = true;
        return result;
      }

      if (isDirectUsdToUsd) {
        if (dollarBalanceSat < totalCost) {
          result.errors.push('INSUFFICIENT_BALANCE');
          return result;
        }
        result.isValid = true;
        result.canProceed = true;
        return result;
      }

      // Cases 2 & 3 need a Flashnet swap — fall through to Phase 4
    }

    // ─── Phase 4: Swap validation ──────────────────────────────────────────────
    // Runs for: Lightning USD→BTC, LNURL USD→BTC, Spark BTC→USDB, Spark USD→BTC

    const needsSwap =
      (finalPaymentMethod === 'USD' && receiverExpectsCurrency === 'sats') ||
      (finalPaymentMethod === 'BTC' && receiverExpectsCurrency === 'tokens') ||
      (isSparkPayment &&
        finalPaymentMethod === 'BTC' &&
        expectedToken === USDB_TOKEN_ID);

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
        // The sat-space totalCost underestimates what the AMM actually debits in USDB
        // tokens (estimatedAmmFee is taken from tokens, not from sats). Compare the
        // quote's authoritative token debit directly against dollarBalanceToken.
        const USDB_DECIMALS = 6;
        const tokenAmountRequired =
          paymentInfo?.swapPaymentQuote?.tokenAmountRequired; // lightning payments only
        const amountIn = paymentInfo?.swapPaymentQuote?.amountIn; // all manual swap calls
        const userDollarBalance =
          dollarBalanceToken * Math.pow(10, USDB_DECIMALS);

        const requiredDollarTokens = tokenAmountRequired
          ? Number(tokenAmountRequired)
          : amountIn
          ? Number(amountIn)
          : null;

        if (
          requiredDollarTokens !== null &&
          userDollarBalance < requiredDollarTokens
        ) {
          result.errors.push('INSUFFICIENT_BALANCE');
          return result;
        }
      } else if (finalPaymentMethod === 'BTC') {
        // BTC → USD swap
        const amountIn = paymentInfo?.swapPaymentQuote?.amountIn;

        if (amountIn !== null && bitcoinBalance < amountIn) {
          result.errors.push('INSUFFICIENT_BALANCE');
          return result;
        }

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

    // ─── Phase 5: Final direct balance check ───────────────────────────────────
    // Reaches here only for Lightning BTC and LNURL BTC (direct, no swap).
    // Spark exits early in Phase 3; swap paths exit in Phase 4.

    const hasSufficientBalance =
      finalPaymentMethod === 'USD'
        ? dollarBalanceSat >= totalCost
        : bitcoinBalance >= totalCost;

    if (!hasSufficientBalance) {
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
    dollarBalanceToken,
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
      BELOW_USD_BTC_LN_MINIMUM: t(
        'wallet.sendPages.acceptButton.swapMinimumError',
        {
          amount: displayCorrectDenomination({
            amount: MIN_USD_BTC_LIGHTNING_SWAP,
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
