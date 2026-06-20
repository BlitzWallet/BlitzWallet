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
  additionalRates,
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
    if (additionalRates) {
      for (const [code, rate] of Object.entries(additionalRates)) {
        if (rate?.value) rates[code.toUpperCase()] = rate;
      }
    }
    return rates;
  }, [fiatStats, usdFiatStats, additionalRates]);

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

  // Shared fetch-and-set used by both the user-facing picker (selectCurrency) and
  // the programmatic phone-payment default (loadAndSetCurrency). `isUserSelection`
  // controls whether the choice is locked against the initialCurrency reset effect.
  const fetchAndSetCurrency = useCallback(
    async (code, isUserSelection) => {
      const normalizedCode = normalizeDisplayCurrency(code);
      if (isUserSelection) hasUserSelectedRef.current = true;

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
        if (isUserSelection) {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Unable to load currency rate',
          });
        }
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

  const selectCurrency = useCallback(
    code => fetchAndSetCurrency(code, true),
    [fetchAndSetCurrency],
  );

  // Programmatic default (no navigation on failure). Loads the internal rate and
  // sets it as the display currency, locking it so the initialCurrency reset
  // effect can't stomp it; the user can still re-pick via the picker.
  const loadAndSetCurrency = useCallback(
    async code => {
      const response = await fetchAndSetCurrency(code, false);
      if (response.didWork) hasUserSelectedRef.current = true;
      return response;
    },
    [fetchAndSetCurrency],
  );

  // Injects an externally-derived rate (e.g. from an LNURL multiplier) into the
  // rate map without a backend fetch. When setAsDisplay is true and the user
  // hasn't already overridden the currency, also switches the display to it and
  // locks the choice.
  const injectRate = useCallback((code, rate, { setAsDisplay = false } = {}) => {
    const normalizedCode = normalizeDisplayCurrency(code);
    if (rate?.value) {
      setCurrencyRates(prev => ({ ...prev, [normalizedCode]: rate }));
    }
    if (setAsDisplay && !hasUserSelectedRef.current) {
      setDisplayCurrency(normalizedCode);
      hasUserSelectedRef.current = true;
    }
  }, []);

  return {
    displayCurrency,
    currencyRates,
    isLoadingRate,
    selectCurrency,
    loadAndSetCurrency,
    injectRate,
    resetDisplayCurrency,
    hasUserSelectedDisplayCurrency: hasUserSelectedRef.current,
  };
}
