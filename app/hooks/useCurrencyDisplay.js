import { useEffect, useMemo, useRef } from 'react';
import { SATSPERBITCOIN } from '../constants';
import { SATS_DISPLAY_CURRENCY, normalizeDisplayCurrency } from '../functions/displayCurrency';

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
    conversionFiatStats: null,
  });
  const wasSendingPaymentRef = useRef(false);

  const deviceCurrency = (masterInfoObject?.fiatCurrency || 'USD').toUpperCase();
  const isDeviceCurrencyUSD = deviceCurrency === 'USD';
  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);

  const livePrimaryDisplay = useMemo(() => {
    if (normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY) {
      return {
        denomination: 'sats',
        forceCurrency: null,
        forceFiatStats: null,
      };
    }

    if (normalizedDisplayCurrency === 'USD') {
      return {
        denomination: 'fiat',
        forceCurrency: 'USD',
        forceFiatStats: usdFiatStats || fiatStats,
      };
    }

    const rate =
      currencyRates?.[normalizedDisplayCurrency] ||
      (normalizedDisplayCurrency === fiatStats?.coin?.toUpperCase()
        ? fiatStats
        : null);

    return {
      denomination: 'fiat',
      forceCurrency: normalizedDisplayCurrency,
      forceFiatStats: rate,
    };
  }, [normalizedDisplayCurrency, usdFiatStats, fiatStats, currencyRates]);

  const liveConversionFiatStats = useMemo(() => {
    const isDisplayingUSD =
      livePrimaryDisplay.denomination === 'fiat' &&
      (livePrimaryDisplay.forceCurrency === 'USD' ||
        (!livePrimaryDisplay.forceCurrency && isDeviceCurrencyUSD));

    if (isDisplayingUSD) {
      return usdFiatStats || fiatStats;
    }

    return livePrimaryDisplay.forceFiatStats || fiatStats;
  }, [
    livePrimaryDisplay.denomination,
    livePrimaryDisplay.forceCurrency,
    livePrimaryDisplay.forceFiatStats,
    isDeviceCurrencyUSD,
    usdFiatStats,
    fiatStats,
  ]);

  useEffect(() => {
    if (isSendingPayment && !wasSendingPaymentRef.current) {
      lockedDisplayRef.current = {
        primary: livePrimaryDisplay,
        conversionFiatStats: liveConversionFiatStats,
      };
    }

    if (!isSendingPayment && wasSendingPaymentRef.current) {
      lockedDisplayRef.current = {
        primary: null,
        conversionFiatStats: null,
      };
    }

    wasSendingPaymentRef.current = isSendingPayment;
  }, [isSendingPayment, livePrimaryDisplay, liveConversionFiatStats]);

  const primaryDisplay =
    isSendingPayment && lockedDisplayRef.current.primary
      ? lockedDisplayRef.current.primary
      : livePrimaryDisplay;

  const conversionFiatStats =
    isSendingPayment && lockedDisplayRef.current.conversionFiatStats
      ? lockedDisplayRef.current.conversionFiatStats
      : liveConversionFiatStats;

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

  return {
    primaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    convertToSats,
    showDot: primaryDisplay.denomination === 'fiat',
    deviceCurrency,
    isDeviceCurrencyUSD,
  };
}
