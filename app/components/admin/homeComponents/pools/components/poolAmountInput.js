import { ScrollView, StyleSheet, View } from 'react-native';
import { CENTER } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { getDefaultDisplayCurrency } from '../../../../../functions/displayCurrency';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';

/**
 * Pool Amount Input Sub-Component
 * Allows user to enter the goal amount for a pool with number keyboard
 *
 * @param {Function} onContinue - Callback when user taps "Add Description" with amount
 * @param {Function} onBack - Callback when user cancels/goes back
 */
export default function PoolAmountInput({
  onContinue,
  onBack,
  from,
  setBackNav,
  onHeaderBack,
}) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const { t } = useTranslation();
  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
  );
  const isInReceiveModal = from === 'halfModalReceiveOptions';
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
    [navigate, displayCurrency, selectCurrency],
  );

  // While this amount step is mounted, own the half-modal header: the parent's
  // back arrow (if any) on the left and the currency switch button on the right.
  useEffect(() => {
    if (!setBackNav) return;
    setBackNav({
      onPress: onHeaderBack ?? null,
      title: '',
      rightElement: (
        <CurrencySwitchButton
          displayCurrency={displayCurrency}
          onPress={openPicker}
          disabled={isLoadingRate}
        />
      ),
    });
    return () => setBackNav(null);
  }, [setBackNav, onHeaderBack, displayCurrency, openPicker, isLoadingRate]);

  const handleNext = useCallback(() => {
    if (!localSatAmount || Number(localSatAmount) === 0) {
      if (!isInReceiveModal) {
        onBack?.();
      }
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
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={primaryDisplay.denomination}
          forceCurrency={primaryDisplay.forceCurrency}
          forceFiatStats={primaryDisplay.forceFiatStats}
        />
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
          opacity: amountValue ? 1 : isInReceiveModal ? HIDDEN_OPACITY : 1,
        }}
        disabled={!amountValue && isInReceiveModal}
        actionFunction={handleNext}
        textContent={
          !localSatAmount && !isInReceiveModal
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
