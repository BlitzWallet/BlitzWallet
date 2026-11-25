import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  AMOUNT_HERO_SIZE,
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import useAmountInputConversion from '../../../../hooks/useAmountInputConversion';
import BudgetCurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import { useTranslation } from 'react-i18next';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  SATS_DISPLAY_CURRENCY,
} from '../../../../functions/displayCurrency';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import GetThemeColors from '../../../../hooks/themeColors';
import useDisplayUsdRate from '../../../../hooks/useDisplayUsdRate';

export default function AnalyticsCreateBudgetPage() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { tokens } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const usdFiatStats = useDisplayUsdRate();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const existingBudget = masterInfoObject?.monthlyBudget;
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
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    rateUnavailable,
  } = useCurrencyDisplay({
    displayCurrency,
    fiatStats,
    usdFiatStats,
    currencyRates,
    masterInfoObject,
  });

  // Prefilled in the input's own unit (same hook), not the stored denomination.
  const [prefill] = useState(() =>
    existingBudget?.amount > 0
      ? {
          displayValue: String(convertSatsToDisplay(existingBudget.amount)),
          sats: existingBudget.amount,
        }
      : null,
  );
  const [amountValue, setAmountValue] = useState(prefill?.displayValue ?? '');
  // Set on the first keypad press; a currency switch alone doesn't count.
  const editedRef = useRef(false);
  const setTypedAmount = useCallback(value => {
    editedRef.current = true;
    setAmountValue(value);
  }, []);

  const { exactSats } = useAmountInputConversion({
    amount: amountValue,
    setAmount: setAmountValue,
    primaryDisplay,
    conversionFiatStats,
  });

  const localSatAmount =
    prefill &&
    amountValue !== '' &&
    (!editedRef.current || prefill.displayValue === amountValue)
      ? prefill.sats
      : exactSats ?? convertDisplayToSats(amountValue);

  const openPicker = useCallback(
    () =>
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'displayCurrencySelect',
        sliderHight: 0.6,
        currentCurrency: displayCurrency,
        onSelectCurrency: code => selectCurrency(code),
      }),
    [displayCurrency, navigate, selectCurrency],
  );

  async function handleSave() {
    if (!localSatAmount || localSatAmount <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('analytics.budget.noAmount'),
      });
      return;
    }
    setIsLoading(true);
    await toggleMasterInfoObject({ monthlyBudget: { amount: localSatAmount } });
    navigate.goBack();
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <TopBar
          title={t('analytics.budget.monthlyBudget')}
          right={
            <BudgetCurrencyButton
              label={
                isSats || rateUnavailable ? 'SAT' : normalizedDisplayCurrency
              }
              onPress={openPicker}
              disabled={isLoadingRate}
              accessibilityLabel={t(
                'settings.nwc.createNWCAmount.changeCurrency',
              )}
            />
          }
        />
        {/* Amount input */}
        <View style={styles.container}>
          {/* AmountHero formats sats, so pass the converted amount, not the
              typed value (a fiat entry was being read as sats). */}
          <AmountHero
            amount={localSatAmount}
            fiatStats={conversionFiatStats}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: primaryDisplay.denomination,
              fiatCurrency:
                primaryDisplay.forceCurrency ||
                masterInfoObject?.fiatCurrency ||
                'USD',
            }}
            amountSize={AMOUNT_HERO_SIZE.primary}
            mutedValue={!localSatAmount}
          />
          <ThemeText
            styles={[styles.resets, { color: tokens.muted }]}
            content={t('analytics.budget.resetsMonthly')}
          />
        </View>
        {/* Keyboard */}
        <CustomNumberKeyboard
          usingForBalance={true}
          setInputValue={setTypedAmount}
          showDot={primaryDisplay.denomination === 'fiat'}
          fiatStats={conversionFiatStats}
          redesign
        />
        {/* Save button */}
        <CustomButton
          disabled={!localSatAmount || localSatAmount <= 0}
          buttonStyles={[styles.saveButton]}
          textContent={t('constants.save')}
          actionFunction={handleSave}
          useLoading={isLoading}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 64,
  },
  resets: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },

  saveButton: {
    alignSelf: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
