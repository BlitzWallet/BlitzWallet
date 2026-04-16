import { useNavigation } from '@react-navigation/native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER } from '../../../../constants';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useState } from 'react';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import { useTranslation } from 'react-i18next';

export default function AnalyticsCreateBudgetPage() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { swapUSDPriceDollars } = useFlashnet();
  const { fiatStats } = useNodeContext();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const existingBudget = masterInfoObject?.monthlyBudget;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  const [amountValue, setAmountValue] = useState(
    existingBudget?.amount ? String(existingBudget.amount) : '',
  );
  const [inputDenomination, setInputDenomination] = useState(
    userBalanceDenomination === 'fiat' ? 'fiat' : 'sats',
  );

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: 'BTC',
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const localSatAmount = convertDisplayToSats(amountValue);

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

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
      />

      <View style={styles.contentContainer}>
        {/* Amount input */}
        <View style={styles.container}>
          <TouchableOpacity
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
        </View>
        {/* Keyboard */}
        <CustomNumberKeyboard
          usingForBalance={true}
          setInputValue={setAmountValue}
          showDot={primaryDisplay.denomination === 'fiat'}
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
