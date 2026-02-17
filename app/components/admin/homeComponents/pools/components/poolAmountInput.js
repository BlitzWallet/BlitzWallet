import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useCallback, useState } from 'react';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';
import convertTextInputValue from '../../../../../functions/textInputConvertValue';
import usePaymentInputDisplay from '../../../../../hooks/usePaymentInputDisplay';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';

/**
 * Pool Amount Input Sub-Component
 * Allows user to enter the goal amount for a pool with number keyboard
 *
 * @param {Function} onContinue - Callback when user taps "Add Description" with amount
 * @param {Function} onBack - Callback when user cancels/goes back
 */
export default function PoolAmountInput({ onContinue, onBack }) {
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const { t } = useTranslation();

  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination !== 'fiat' ? 'sats' : 'fiat',
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

  const handleNext = useCallback(() => {
    if (!localSatAmount || Number(localSatAmount) === 0) {
      onBack?.();
      return;
    }

    onContinue?.(Number(localSatAmount));
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

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={{
          ...CENTER,
        }}
        actionFunction={handleNext}
        textContent={
          !localSatAmount
            ? t('constants.back')
            : t('wallet.pools.addDescription')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  amountScrollContainer: {
    justifyContent: 'center',
    marginTop: 20,
  },
  satValue: {
    textAlign: 'center',
  },
});
