import { ScrollView, StyleSheet, View } from 'react-native';
import { CENTER } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { useNavigation } from '@react-navigation/native';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../../functions/displayCurrency';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';

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
  setBackNav,
  onHeaderBack,
}) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const { t } = useTranslation();
  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode,
        masterInfoObject,
        fiatStats,
      }),
    [paymentMode, masterInfoObject, fiatStats],
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
        },
      }),
    [navigate, displayCurrency, selectCurrency],
  );

  // While mounted, own the half-modal header: parent back arrow on the left and
  // the currency switch button on the right.
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
    if (paymentMode === 'USD') {
      if (localSatAmount < swapLimits.bitcoin) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
            amount: displayCorrectDenomination({
              amount: swapLimits.bitcoin + 20,
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
    } else {
      if (!localSatAmount || Number(localSatAmount) === 0) {
        onSkip?.();
        return;
      }
    }
    onContinue?.(Number(localSatAmount), {
      displayCurrency,
      displayFiatStats: conversionFiatStats,
      // Carry the verbatim fiat value the user typed so the receive page shows
      // exactly that (e.g. $100) rather than re-deriving it from sats. Only
      // meaningful for fiat entries; sats entries have no fiat literal.
      displayAmount: primaryDisplay.denomination === 'fiat' ? amountValue : '',
    });
  }, [
    paymentMode,
    localSatAmount,
    swapLimits.bitcoin,
    navigate,
    t,
    masterInfoObject,
    primaryDisplay,
    conversionFiatStats,
    onSkip,
    onContinue,
    displayCurrency,
    amountValue,
  ]);

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
          opacity:
            paymentMode === 'USD' && localSatAmount < swapLimits.bitcoin
              ? 0.5
              : 1,
        }}
        actionFunction={handleNext}
        textContent={
          paymentMode === 'USD'
            ? t('wallet.payLinks.next')
            : !localSatAmount
            ? t('constants.skip')
            : t('wallet.payLinks.next')
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
