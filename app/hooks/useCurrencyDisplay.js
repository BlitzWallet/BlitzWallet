import { useEffect, useMemo, useRef } from 'react';
import {
  RATE_MAX_INPUT_AGE_MS,
  fiatToSats,
  isFreshRate,
  satsToFiat,
} from '../functions/money';
import {
  SATS_DISPLAY_CURRENCY,
  normalizeDisplayCurrency,
} from '../functions/displayCurrency';

export default function useCurrencyDisplay({
  displayCurrency,
  fiatStats,
  usdFiatStats,
  currencyRates,
  masterInfoObject,
  isSendingPayment = false,
}) {
  const lockedDisplayRef = useRef({
    primary: null,
    secondary: null,
    conversionFiatStats: null,
  });
  const wasSendingPaymentRef = useRef(false);

  const deviceCurrency = (
    masterInfoObject?.fiatCurrency || 'USD'
  ).toUpperCase();
  const isDeviceCurrencyUSD = deviceCurrency === 'USD';
  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);

  // Only a fresh rate whose coin matches the code is ever used; otherwise null.
  const now = Date.now();
  const pickRate = code =>
    [
      code === 'USD' ? usdFiatStats : null,
      currencyRates?.[code],
      fiatStats,
    ].find(r => isFreshRate(r, code, now, RATE_MAX_INPUT_AGE_MS)) || null;

  const primaryCode =
    normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY
      ? null
      : normalizedDisplayCurrency;
  const primaryRate = primaryCode ? pickRate(primaryCode) : null;
  const secondaryRate = primaryCode === null ? pickRate(deviceCurrency) : null;
  const rateUnavailable = !!primaryCode && !primaryRate;

  const livePrimaryDisplay = useMemo(() => {
    if (!primaryCode || !primaryRate) {
      return {
        denomination: 'sats',
        forceCurrency: null,
        forceFiatStats: null,
      };
    }

    return {
      denomination: 'fiat',
      forceCurrency: primaryCode,
      forceFiatStats: primaryRate,
    };
  }, [primaryCode, primaryRate]);

  // SECONDARY DISPLAY - The converted amount shown below primary
  const liveSecondaryDisplay = useMemo(() => {
    if (normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY) {
      // Primary is sats → secondary shows the device fiat currency
      return {
        denomination: 'fiat',
        forceCurrency: deviceCurrency,
        forceFiatStats: secondaryRate,
      };
    }

    // Primary is fiat → secondary shows sats
    return {
      denomination: 'sats',
      forceCurrency: null,
      forceFiatStats: null,
    };
  }, [normalizedDisplayCurrency, deviceCurrency, secondaryRate]);

  const liveConversionFiatStats = livePrimaryDisplay.forceFiatStats;

  useEffect(() => {
    if (isSendingPayment && !wasSendingPaymentRef.current) {
      lockedDisplayRef.current = {
        primary: livePrimaryDisplay,
        secondary: liveSecondaryDisplay,
        conversionFiatStats: liveConversionFiatStats,
      };
    }

    if (!isSendingPayment && wasSendingPaymentRef.current) {
      lockedDisplayRef.current = {
        primary: null,
        secondary: null,
        conversionFiatStats: null,
      };
    }

    wasSendingPaymentRef.current = isSendingPayment;
  }, [
    isSendingPayment,
    livePrimaryDisplay,
    liveSecondaryDisplay,
    liveConversionFiatStats,
  ]);

  const primaryDisplay =
    isSendingPayment && lockedDisplayRef.current.primary
      ? lockedDisplayRef.current.primary
      : livePrimaryDisplay;

  const secondaryDisplay =
    isSendingPayment && lockedDisplayRef.current.secondary
      ? lockedDisplayRef.current.secondary
      : liveSecondaryDisplay;

  const conversionFiatStats =
    isSendingPayment && lockedDisplayRef.current.conversionFiatStats
      ? lockedDisplayRef.current.conversionFiatStats
      : liveConversionFiatStats;

  const convertToSats = inputAmount => {
    const numAmount = Number(inputAmount) || 0;

    if (primaryDisplay.denomination === 'fiat') {
      return fiatToSats(numAmount, conversionFiatStats) ?? 0;
    }
    return Math.round(numAmount);
  };

  const convertSatsToDisplay = satsAmount => {
    const numAmount = Number(satsAmount) || 0;

    if (primaryDisplay.denomination === 'fiat') {
      const fiat = satsToFiat(numAmount, conversionFiatStats);
      return fiat == null ? numAmount : fiat.toFixed(2);
    }
    return numAmount;
  };

  const convertDisplayToSats = convertToSats;

  const buildAmountSnapshot = enteredValue => {
    return {
      displayAmount: enteredValue == null ? '' : String(enteredValue),
      displayDenomination: primaryDisplay.denomination,
      displayCurrency:
        primaryDisplay.denomination === 'fiat'
          ? primaryDisplay.forceCurrency || deviceCurrency
          : null,
      sats: convertToSats(enteredValue),
    };
  };

  return {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    convertToSats,
    buildAmountSnapshot,
    showDot: primaryDisplay.denomination === 'fiat',
    deviceCurrency,
    isDeviceCurrencyUSD,
    rateUnavailable,
  };
}
