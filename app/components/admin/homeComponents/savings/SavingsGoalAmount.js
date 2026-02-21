import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSavings } from '../../../../../context-store/savingsContext';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../../constants/theme';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { satsToDollars } from '../../../../functions/spark/flashnet';

export default function SavingsGoalAmount(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { setSavingsGoal, savingsGoals } = useSavings();
  const { masterInfoObject } = useGlobalContextProvider();
  const { swapUSDPriceDollars } = useFlashnet();
  const { fiatStats } = useNodeContext();
  const goalId = props?.route?.params?.goalId;
  const selectedGoal = savingsGoals.find(goal => goal.id === goalId) || null;
  const [amountValue, setAmountValue] = useState('');
  const emoji = props?.route?.params?.emoji || selectedGoal?.emoji || '🎯';
  const goalName = props?.route?.params?.goalName || selectedGoal?.name || '';
  const mode = props?.route?.params?.mode || 'create';

  const [inputDenomination, setInputDenomination] = useState('fiat');

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
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

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('savings.goalAmount.screenTitle')} />
      <View style={styles.container}>
        <TouchableOpacity
          style={{ marginTop: 'auto' }}
          activeOpacity={1}
          onPress={handleDenominationToggle}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />

          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>

        <CustomNumberKeyboard
          showDot={false}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={conversionFiatStats}
        />

        <CustomButton
          buttonStyles={[styles.primaryButton]}
          actionFunction={async () => {
            if (fiatAmount <= 0) {
              navigate.goBack();
            } else {
              const result = await setSavingsGoal({
                name: goalName || t('savings.goalAmount.goalFallbackName'),
                amount: fiatAmount,
                emoji,
                mode,
                goalId:
                  mode === 'update' ? goalId || selectedGoal?.id : undefined,
              });

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
              });
            }
          }}
          textContent={
            fiatAmount <= 0 ? t('constants.back') : t('constants.continue')
          }
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
    justifyContent: 'space-between',
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 20,
  },
  inputWrap: {
    marginTop: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: COLORS.black,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: {
    minWidth: 120,
    fontSize: 42,
    color: COLORS.lightModeText,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
  satValue: {
    textAlign: 'center',
  },
});
