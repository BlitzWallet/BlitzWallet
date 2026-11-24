import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  AMOUNT_HERO_SIZE,
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useAmountInputConversion from '../../../../hooks/useAmountInputConversion';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import BudgetCurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import {
  normalizeDisplayCurrency,
  SATS_DISPLAY_CURRENCY,
} from '../../../../functions/displayCurrency';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import { satsToDollars } from '../../../../functions/spark/flashnet';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import GetThemeColors from '../../../../hooks/themeColors';

export default function SavingsGoalAmount(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { setSavingsGoal, savingsGoals } = useSavings();
  const { masterInfoObject } = useGlobalContextProvider();
  const { swapUSDPriceDollars } = useFlashnet();
  const { fiatStats } = useNodeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const goalId = props?.route?.params?.goalId;
  const selectedGoal = savingsGoals.find(goal => goal.id === goalId) || null;
  const [amountValue, setAmountValue] = useState('');
  const emoji = props?.route?.params?.emoji || selectedGoal?.emoji || '🎯';
  const goalName = props?.route?.params?.goalName || selectedGoal?.name || '';
  const mode = props?.route?.params?.mode || 'create';

  const [isSaving, setIsSaving] = useState(false);
  const { tokens } = GetThemeColors();

  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
  );
  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: 'USD',
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });
  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isUSD = normalizedDisplayCurrency === 'USD';
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;
  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    useCurrencyDisplay({
      displayCurrency,
      fiatStats,
      usdFiatStats,
      currencyRates,
      masterInfoObject,
    });
  const { exactSats } = useAmountInputConversion({
    amount: amountValue,
    setAmount: setAmountValue,
    primaryDisplay,
    conversionFiatStats,
  });
  const primaryMasterInfoObject = useMemo(
    () => ({
      ...(masterInfoObject || {}),
      userBalanceDenomination: primaryDisplay.denomination,
      fiatCurrency:
        primaryDisplay.forceCurrency || masterInfoObject?.fiatCurrency || 'USD',
    }),
    [masterInfoObject, primaryDisplay],
  );
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

  const showCurrentTarget =
    mode === 'update' && !amountValue && !!selectedGoal?.targetAmountMicros;

  const localSatAmount = exactSats ?? convertDisplayToSats(amountValue);

  // USD: the typed value is already dollars. Other currencies go via sats.
  const fiatAmount = isUSD
    ? Number(amountValue || 0).toFixed(2)
    : (satsToDollars(localSatAmount, swapUSDPriceDollars) / 100).toFixed(2);
  const showLiteralUsd = isUSD || showCurrentTarget;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={
            mode === 'update' ? goalName : t('savings.goalAmount.screenTitle')
          }
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
        <View style={styles.amountContainer}>
          <ThemeText
            variant={'body'}
            styles={[styles.goalLabel, { color: tokens.muted }]}
            content={`${emoji} ${goalName}`}
          />
          <AmountHero
            amount={
              showLiteralUsd
                ? showCurrentTarget
                  ? (selectedGoal.targetAmountMicros / 1e6).toFixed(2)
                  : Number(amountValue || 0).toFixed(2)
                : localSatAmount
            }
            fiatStats={showLiteralUsd ? usdFiatStats : conversionFiatStats}
            masterInfoObject={
              showLiteralUsd
                ? {
                    ...masterInfoObject,
                    userBalanceDenomination: 'fiat',
                  }
                : primaryMasterInfoObject
            }
            forceCurrency={showLiteralUsd ? 'USD' : undefined}
            convertAmount={!showLiteralUsd}
            mutedValue={showCurrentTarget}
            amountSize={AMOUNT_HERO_SIZE.primary}
          />
        </View>

        <CustomNumberKeyboard
          showDot={primaryDisplay.denomination === 'fiat'}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={conversionFiatStats}
          redesign
        />
        <CustomButton
          buttonStyles={[styles.primaryButton]}
          useLoading={isSaving}
          actionFunction={async () => {
            if (isSaving) return;
            if (fiatAmount <= 0) {
              navigate.goBack();
            } else {
              setIsSaving(true);
              const result = await setSavingsGoal({
                name: goalName || t('savings.goalAmount.goalFallbackName'),
                amount: fiatAmount,
                emoji,
                mode,
                goalId:
                  mode === 'update' ? goalId || selectedGoal?.id : undefined,
              });

              setIsSaving(false);
              if (!result?.didWork) {
                navigate.navigate('ErrorScreen', {
                  errorMessage:
                    result?.error ||
                    t('savings.goalAmount.errors.unableToSetGoal'),
                });
                return;
              }

              navigate.navigate('SavingsGoalSuccess', {
                amount: fiatAmount,
                emoji,
              });
            }
          }}
          textContent={
            fiatAmount <= 0
              ? t('constants.back')
              : mode === 'update'
              ? t('savings.updateGoal.updateButton')
              : t('constants.continue')
          }
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  amountContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 64,
  },
  goalLabel: {
    marginBottom: 4,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
