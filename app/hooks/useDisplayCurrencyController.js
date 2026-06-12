import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useKeysContext } from '../../context-store/keys';
import loadNewFiatData from '../functions/saveAndUpdateFiatData';
import { SATS_DISPLAY_CURRENCY, normalizeDisplayCurrency } from '../functions/displayCurrency';

export default function useDisplayCurrencyController({
  initialCurrency,
  fiatStats,
  usdFiatStats,
  masterInfoObject,
}) {
  const navigate = useNavigation();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const normalizedInitialCurrency = normalizeDisplayCurrency(initialCurrency);
  const deviceCurrency = (masterInfoObject?.fiatCurrency || 'USD').toUpperCase();
  const hasUserSelectedRef = useRef(false);

  const seededRates = useMemo(() => {
    const rates = {};
    if (fiatStats?.coin) rates[fiatStats.coin.toUpperCase()] = fiatStats;
    if (usdFiatStats?.coin) rates.USD = usdFiatStats;
    else if (fiatStats?.coin?.toUpperCase() === 'USD') rates.USD = fiatStats;
    return rates;
  }, [fiatStats, usdFiatStats]);

  const [displayCurrency, setDisplayCurrency] = useState(
    normalizedInitialCurrency,
  );
  const [currencyRates, setCurrencyRates] = useState(seededRates);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  useEffect(() => {
    setCurrencyRates(prev => ({ ...prev, ...seededRates }));
  }, [seededRates]);

  useEffect(() => {
    if (hasUserSelectedRef.current) return;
    setDisplayCurrency(normalizedInitialCurrency);
  }, [normalizedInitialCurrency]);

  const resetDisplayCurrency = useCallback(
    nextCurrency => {
      hasUserSelectedRef.current = false;
      setDisplayCurrency(normalizeDisplayCurrency(nextCurrency));
    },
    [],
  );

  const selectCurrency = useCallback(
    async code => {
      const normalizedCode = normalizeDisplayCurrency(code);
      hasUserSelectedRef.current = true;

      if (
        normalizedCode === SATS_DISPLAY_CURRENCY ||
        normalizedCode === 'USD' ||
        normalizedCode === deviceCurrency ||
        currencyRates[normalizedCode]
      ) {
        setDisplayCurrency(normalizedCode);
        return { didWork: true };
      }

      try {
        setIsLoadingRate(true);
        const response = await loadNewFiatData(
          normalizedCode,
          contactsPrivateKey,
          publicKey,
          masterInfoObject,
        );

        if (!response.didWork) throw new Error('error loading fiat data');

        setCurrencyRates(prev => ({
          ...prev,
          [normalizedCode]: response.fiatRateResponse,
        }));
        setDisplayCurrency(normalizedCode);
        return response;
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Unable to load currency rate',
        });
        return { didWork: false, error: err.message };
      } finally {
        setIsLoadingRate(false);
      }
    },
    [
      contactsPrivateKey,
      publicKey,
      masterInfoObject,
      deviceCurrency,
      currencyRates,
      navigate,
    ],
  );

  return {
    displayCurrency,
    currencyRates,
    isLoadingRate,
    selectCurrency,
    resetDisplayCurrency,
    hasUserSelectedDisplayCurrency: hasUserSelectedRef.current,
  };
}
