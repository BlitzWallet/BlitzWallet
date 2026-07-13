import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { CENTER } from '../../../../constants';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useMemo, useState } from 'react';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import { useTranslation } from 'react-i18next';
import { numberConverter } from '../../../../functions';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../functions/displayCurrency';
import CurrencySwitchButton from '../../../../functions/CustomElements/currencySwitchButton';

export default function AnalyticsCreateBudgetPage() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { fiatStats } = useNodeContext();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

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

  const {
    displayCurrency,
    currencyRates,
    isLoadingRate,
    selectCurrency,
  } = useDisplayCurrencyController({
    initialCurrency: initialDisplayCurrency,
    fiatStats,
    usdFiatStats,
    masterInfoObject,
  });

  const {
    primaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
  } = useCurrencyDisplay({
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
      <CustomSettingsTopBar
        label={
          existingBudget
            ? t('analytics.budget.editBudget')
            : t('analytics.budget.createBudget')
        }
        rightContent={
          <CurrencySwitchButton
            displayCurrency={displayCurrency}
            onPress={openPicker}
            disabled={isLoadingRate}
          />
        }
      />

      <View style={styles.contentContainer}>
        {/* Amount input */}
        <View style={styles.container}>
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />
        </View>
        {/* Keyboard */}
        <CustomNumberKeyboard
          usingForBalance={true}
          setInputValue={setAmountValue}
          showDot={primaryDisplay.denomination === 'fiat'}
          fiatStats={conversionFiatStats}
        />
        {/* Save button */}
        <CustomButton
          buttonStyles={[
            styles.saveButton,
            {
              opacity:
                !localSatAmount || localSatAmount <= 0 ? HIDDEN_OPACITY : 1,
            },
          ]}
          textContent={t('constants.save')}
          actionFunction={handleSave}
          useLoading={isLoading}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },

  saveButton: {
    alignSelf: 'center',
  },
});
