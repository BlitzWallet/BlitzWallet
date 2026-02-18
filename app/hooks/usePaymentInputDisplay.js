import { useMemo } from 'react';
import { SATSPERBITCOIN } from '../constants';

/**
 * Unified hook for payment input display logic across send/receive pages
 *
 * @param {Object} params
 * @param {string} params.paymentMode - 'USD' or 'BTC' - determines if user is paying/receiving in USD or Bitcoin
 * @param {string} params.inputDenomination - 'sats', 'fiat', or 'hidden' - current input denomination
 * @param {Object} params.fiatStats - Device currency fiat stats { coin: string, value: number }
 * @param {Object} params.usdFiatStats - USD fiat stats { coin: 'USD', value: number }
 * @param {Object} params.masterInfoObject - Master info with userBalanceDenomination
 *
 * @returns {Object} Display configuration and helper functions
 */
export default function usePaymentInputDisplay({
  paymentMode = 'BTC', // 'USD' or 'BTC'
  inputDenomination,
  fiatStats,
  usdFiatStats,
  masterInfoObject,
}) {
  const deviceCurrency = masterInfoObject?.fiatCurrency || 'USD';
  const isDeviceCurrencyUSD = deviceCurrency === 'USD';
  const isUSDMode = paymentMode === 'USD';

  // PRIMARY DISPLAY - What the user is actively typing/viewing
  const primaryDisplay = useMemo(() => {
    if (isUSDMode) {
      if (inputDenomination === 'fiat') {
        // In USD mode, showing fiat = showing USD
        return {
          denomination: 'fiat',
          forceCurrency: 'USD',
          forceFiatStats: usdFiatStats,
        };
      } else {
        // In USD mode, showing sats/hidden = showing device currency (or sats if device is USD)
        if (isDeviceCurrencyUSD) {
          return {
            denomination: 'sats',
            forceCurrency: null,
            forceFiatStats: null,
          };
        } else {
          return {
            denomination: 'fiat',
            forceCurrency: deviceCurrency,
            forceFiatStats: fiatStats,
          };
        }
      }
    } else {
      // In BTC mode: standard behavior - just use inputDenomination directly
      return {
        denomination: inputDenomination,
        forceCurrency: null,
        forceFiatStats: null,
      };
    }
  }, [
    isUSDMode,
    inputDenomination,
    usdFiatStats,
    isDeviceCurrencyUSD,
    deviceCurrency,
    fiatStats,
  ]);

  // SECONDARY DISPLAY - The converted amount shown below primary
  const secondaryDisplay = useMemo(() => {
    if (isUSDMode) {
      if (inputDenomination === 'fiat') {
        // Showing USD, secondary shows device currency or sats
        if (isDeviceCurrencyUSD) {
          return {
            denomination: 'sats',
            forceCurrency: null,
            forceFiatStats: null,
          };
        } else {
          return {
            denomination: 'fiat',
            forceCurrency: deviceCurrency,
            forceFiatStats: fiatStats,
          };
        }
      } else {
        // Showing device currency/sats, secondary shows USD
        return {
          denomination: 'fiat',
          forceCurrency: 'USD',
          forceFiatStats: usdFiatStats,
        };
      }
    } else {
      // In BTC mode: toggle between sats and fiat
      const nextDenomination =
        inputDenomination === 'sats' || inputDenomination === 'hidden'
          ? 'fiat'
          : 'sats';
      const nextIsUSDDisplay = nextDenomination === 'fiat' && isDeviceCurrencyUSD;

      return {
        denomination: nextDenomination,
        forceCurrency: nextIsUSDDisplay ? 'USD' : null,
        forceFiatStats: nextIsUSDDisplay ? usdFiatStats : null,
      };
    }
  }, [
    isUSDMode,
    inputDenomination,
    isDeviceCurrencyUSD,
    deviceCurrency,
    fiatStats,
    usdFiatStats,
  ]);

  // CONVERSION STATS - Which fiat stats to use for conversions
  const conversionFiatStats = useMemo(() => {
    const isDisplayingUSD =
      primaryDisplay.denomination === 'fiat' &&
      (primaryDisplay.forceCurrency === 'USD' ||
        (!primaryDisplay.forceCurrency && isDeviceCurrencyUSD));

    if (isDisplayingUSD) {
      // Keep USD conversions stable across BTC/USD payment mode switches.
      return usdFiatStats || fiatStats;
    }

    return fiatStats;
  }, [
    primaryDisplay.denomination,
    primaryDisplay.forceCurrency,
    isDeviceCurrencyUSD,
    usdFiatStats,
    fiatStats,
  ]);

  /**
   * Convert input amount to satoshis
   * @param {string|number} inputAmount - The amount in current denomination
   * @returns {number} Amount in satoshis
   */
  const convertToSats = inputAmount => {
    const numAmount = Number(inputAmount) || 0;

    if (primaryDisplay.denomination === 'fiat') {
      // Converting from fiat to sats
      const fiatValue = conversionFiatStats?.value || 65000;
      return Math.round((SATSPERBITCOIN / fiatValue) * numAmount);
    } else {
      // Already in sats
      return Math.round(numAmount);
    }
  };

  /**
   * Convert sats to display amount (for FIXED amounts from invoices)
   * @param {number} satsAmount - The amount in satoshis
   * @returns {number|string} Amount in the current display denomination
   */
  const convertSatsToDisplay = satsAmount => {
    const numAmount = Number(satsAmount) || 0;

    if (primaryDisplay.denomination === 'fiat') {
      // Convert sats to fiat for display
      const fiatValue = conversionFiatStats?.value || 65000;
      return ((numAmount * fiatValue) / SATSPERBITCOIN).toFixed(2);
    } else {
      // Already in sats
      return numAmount;
    }
  };

  /**
   * Convert display amount to sats (for USER-ENTERED amounts)
   * @param {string|number} displayAmount - The amount in current display denomination
   * @returns {number} Amount in satoshis
   */
  const convertDisplayToSats = displayAmount => {
    const numAmount = Number(displayAmount) || 0;

    if (primaryDisplay.denomination === 'fiat') {
      // Converting from fiat to sats
      const fiatValue = conversionFiatStats?.value || 65000;
      return Math.round((SATSPERBITCOIN / fiatValue) * numAmount);
    } else {
      // Already in sats
      return Math.round(numAmount);
    }
  };

  /**
   * Get the next denomination when toggling
   * @returns {string} Next denomination
   */
  const getNextDenomination = () => {
    if (inputDenomination === 'sats' || inputDenomination === 'hidden') {
      return 'fiat';
    } else {
      return 'sats';
    }
  };

  /**
   * Convert current amount for display in new denomination
   * Used when toggling between denominations
   * @param {string|number} currentAmount - Current amount value
   * @param {function} convertTextInputValue - Your existing conversion function
   * @returns {string} Converted amount
   */
  const convertForToggle = (currentAmount, convertTextInputValue) => {
    if (isUSDMode && !isDeviceCurrencyUSD) {
      // Special case: USD mode with different device currency
      // Need to convert using the secondary display's fiat stats
      const satsAmount = convertToSats(currentAmount);
      return (
        convertTextInputValue(
          satsAmount,
          secondaryDisplay.forceFiatStats || conversionFiatStats,
          'sats',
        ) || ''
      );
    } else {
      const toggleFiatStats =
        inputDenomination === 'sats' || inputDenomination === 'hidden'
          ? secondaryDisplay.forceFiatStats || conversionFiatStats
          : conversionFiatStats;

      // Standard toggle
      return (
        convertTextInputValue(
          currentAmount,
          toggleFiatStats,
          inputDenomination,
        ) || ''
      );
    }
  };

  return {
    // Display configurations
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,

    // Helper functions
    convertSatsToDisplay,
    convertDisplayToSats,
    convertToSats,
    getNextDenomination,
    convertForToggle,

    // Utility flags
    isUSDMode,
    isDeviceCurrencyUSD,
    deviceCurrency,
  };
}
