import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
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

  const [inputDenomination] = useState('fiat');
  const [isSaving, setIsSaving] = useState(false);
  const { tokens } = GetThemeColors();

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    usePaymentInputDisplay({
      paymentMode: 'USD',
      inputDenomination,
      fiatStats,
      usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
      masterInfoObject,
    });

  const localSatAmount = convertDisplayToSats(amountValue);

  const fiatAmount = (
    satsToDollars(localSatAmount, swapUSDPriceDollars) / 100
  ).toFixed(2);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={
            mode === 'update' ? goalName : t('savings.goalAmount.screenTitle')
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
              primaryDisplay.denomination === 'fiat'
                ? Number(amountValue || 0).toFixed(2)
                : amountValue || 0
            }
            fiatStats={primaryDisplay.forceFiatStats}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: primaryDisplay.denomination,
            }}
            forceCurrency={primaryDisplay.forceCurrency}
            convertAmount={false}
            amountSize={60}
          />
        </View>

        <CustomNumberKeyboard
          showDot={false}
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
