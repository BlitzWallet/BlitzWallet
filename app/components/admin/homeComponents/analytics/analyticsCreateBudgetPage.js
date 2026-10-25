import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useMemo, useState } from 'react';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import { useTranslation } from 'react-i18next';
import { numberConverter } from '../../../../functions';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../functions/displayCurrency';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import GetThemeColors from '../../../../hooks/themeColors';

export default function AnalyticsCreateBudgetPage() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { tokens } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const existingBudget = masterInfoObject?.monthlyBudget;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  const formattedPresetAmount =
    userBalanceDenomination === 'fiat'
      ? numberConverter(existingBudget?.amount || 0, 'fiat', 2, fiatStats)
      : existingBudget?.amount || 0;

  const [amountValue, setAmountValue] = useState(
    existingBudget?.amount ? String(formattedPresetAmount) : '',
  );
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

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    useCurrencyDisplay({
      displayCurrency,
      fiatStats,
      usdFiatStats,
      currencyRates,
      masterInfoObject,
    });

  const localSatAmount = convertDisplayToSats(amountValue);

  const openPicker = () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.9,
      currentCurrency: displayCurrency,
      onSelectCurrency: async code => {
        const response = await selectCurrency(code);
        if (response?.didWork) setAmountValue('');
        return response;
      },
    });

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
        <TopBar title={t('analytics.budget.monthlyBudget')} />
        {/* Amount input */}
        <View style={styles.container}>
          <AmountHero
            amount={amountValue}
            fiatStats={primaryDisplay.forceFiatStats}
            masterInfoObject={masterInfoObject}
            amountSize={60}
          />
          <ThemeText
            styles={[styles.resets, { color: tokens.muted }]}
            content={t('analytics.budget.resetsMonthly')}
          />
        </View>
        {/* Keyboard */}
        <CustomNumberKeyboard
          usingForBalance={true}
          setInputValue={setAmountValue}
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
  contentContainer: {
    flex: 1,
    alignSelf: 'center',
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
