import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useCallback, useState } from 'react';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { HIDDEN_OPACITY, SIZES } from '../../../../../constants/theme';
import convertTextInputValue from '../../../../../functions/textInputConvertValue';
import usePaymentInputDisplay from '../../../../../hooks/usePaymentInputDisplay';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { ThemeText } from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

/**
 * PayLink Amount Input Sub-Component
 * Allows user to enter the amount for a paylink with number keyboard
 *
 * @param {Function} onContinue - Callback when user taps "Next" with amount
 * @param {Function} onSkip - Callback when user skips (no amount → ReceiveBTC with no amount)
 */
export default function PayLinkAmountInput({
  onContinue,
  onSkip,
  onBack,
  paymentMode = 'BTC',
  onSelectCurrency,
}) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [inputDenomination, setInputDenomination] = useState(null);

  const normalizedInputDenomination = inputDenomination
    ? inputDenomination
    : paymentMode === 'USD'
    ? 'fiat'
    : masterInfoObject.userBalanceDenomination !== 'fiat'
    ? 'sats'
    : 'fiat';

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode,
    inputDenomination: normalizedInputDenomination,
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

  const handleNext = useCallback(() => {
    if (!localSatAmount || Number(localSatAmount) === 0) {
      onSkip?.();
      return;
    }
    if (paymentMode === 'USD' && localSatAmount < swapLimits.bitcoin) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
          amount: displayCorrectDenomination({
            amount: swapLimits.bitcoin,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination:
                primaryDisplay.denomination === 'fiat' ? 'fiat' : 'sats',
            },
            forceCurrency: primaryDisplay.forceCurrency,
            fiatStats: conversionFiatStats,
          }),
        }),
      });
      return;
    }
    onContinue?.(Number(localSatAmount), amountValue);
  }, [localSatAmount, onContinue, onBack]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.amountScrollContainer}
      >
        <TouchableOpacity activeOpacity={1} onPress={handleDenominationToggle}>
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />

          <FormattedSatText
            containerStyles={{
              opacity: !amountValue ? HIDDEN_OPACITY : 1,
            }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'payLinkCurrencySelect',
            currentCurrency: paymentMode,
            onSelectCurrency: cur => {
              setAmountValue('');
              setInputDenomination(null);
              onSelectCurrency(cur);
            },
          })
        }
        style={[
          styles.currencyToggle,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        <ThemeText
          styles={styles.currencyToggleText}
          content={
            paymentMode === 'BTC'
              ? t('constants.bitcoin_upper')
              : t('constants.dollars_upper')
          }
        />
        <ThemeIcon
          colorOverride={textColor}
          size={18}
          iconName={'ChevronDown'}
        />
      </TouchableOpacity>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={{ ...CENTER }}
        actionFunction={handleNext}
        textContent={
          !localSatAmount ? t('constants.skip') : t('wallet.payLinks.next')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  currencyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    ...CENTER,
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 50,
  },
  currencyToggleText: {
    includeFontPadding: false,
  },
  amountScrollContainer: {
    justifyContent: 'center',
    marginTop: 20,
  },
  satValue: {
    textAlign: 'center',
  },
});
