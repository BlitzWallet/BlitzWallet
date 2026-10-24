import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';
import BudgetCurrencyButton from '../../../../../functions/CustomElements/redesign/CurrencyButton';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../../../../../functions/displayCurrency';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

// Keypad amount step shared by the create pool goal and the contribute
// "Other" amount: currency menu, 52 pt amount, one muted line under it,
// redesign keypad and a primary button. `subText(sats, format)` returns the
// line under the amount; `format(sats)` renders sats in the entry currency.
export default function PoolAmountKeypad({
  label,
  onBack,
  subText,
  buttonText,
  onContinue,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { swapUSDPriceDollars } = useFlashnet();
  const { tokens } = GetThemeColors();
  const [amountValue, setAmountValue] = useState('');

  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode: 'BTC',
        masterInfoObject,
        fiatStats,
      }),
    [masterInfoObject, fiatStats],
  );
  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });
  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;
  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
  } = useCurrencyDisplay({
    displayCurrency,
    fiatStats,
    usdFiatStats,
    currencyRates,
    masterInfoObject,
  });

  const sats = convertDisplayToSats(amountValue);
  const primaryMasterInfoObject = useMemo(
    () => ({
      ...(masterInfoObject || {}),
      userBalanceDenomination: primaryDisplay.denomination,
      fiatCurrency:
        primaryDisplay.forceCurrency || masterInfoObject?.fiatCurrency || 'USD',
      satDisplay: isSats ? 'text' : 'symbol',
    }),
    [masterInfoObject, primaryDisplay, isSats],
  );

  const format = useCallback(
    amount =>
      displayCorrectDenomination({
        amount,
        masterInfoObject: primaryMasterInfoObject,
        fiatStats: conversionFiatStats,
      }),
    [primaryMasterInfoObject, conversionFiatStats],
  );
  const formatSecondary = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: secondaryDisplay.denomination,
        satDisplay: 'text',
      },
      fiatStats: secondaryDisplay.forceFiatStats || fiatStats,
      forceCurrency: secondaryDisplay.forceCurrency,
    });

  const openPicker = useCallback(
    () =>
      navigate.push('CustomHalfModal', {
        wantedContent: 'displayCurrencySelect',
        sliderHight: 0.6,
        currentCurrency: displayCurrency,
        onSelectCurrency: async code => {
          const response = await selectCurrency(code);
          if (response?.didWork) setAmountValue('');
          return response;
        },
      }),
    [displayCurrency, navigate, selectCurrency],
  );

  const sub = subText ? subText(sats, format) : undefined;

  return (
    <>
      <TopBar
        onBack={onBack}
        showBack={!!onBack}
        right={
          <BudgetCurrencyButton
            label={isSats ? 'SAT' : normalizedDisplayCurrency}
            onPress={openPicker}
            disabled={isLoadingRate}
            accessibilityLabel={t(
              'settings.nwc.createNWCAmount.changeCurrency',
            )}
          />
        }
      />
      <View style={styles.amountSection}>
        {!!label && (
          <ThemeText
            content={label}
            styles={[styles.label, { color: tokens.muted }]}
          />
        )}
        <AmountHero
          amount={sats}
          fiatStats={conversionFiatStats}
          masterInfoObject={primaryMasterInfoObject}
          amountSize={52}
          mutedValue={!sats}
        />
        {!!sub && (
          <ThemeText
            content={sub}
            styles={[styles.sub, { color: tokens.muted }]}
          />
        )}
      </View>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
        redesign={true}
        bottomLeftEmpty={true}
      />

      <CustomButton
        buttonStyles={styles.button}
        textContent={buttonText(sats)}
        actionFunction={() => onContinue(sats)}
        size="regular"
      />
    </>
  );
}

const styles = StyleSheet.create({
  amountSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 2,
    includeFontPadding: false,
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  button: {
    width: '100%',
    marginTop: 12,
  },
});
