import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import {
  convertToDecimals,
  satsToDollars,
} from '../../../../functions/spark/swapAmountUtils';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../../../../functions/displayCurrency';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import BudgetCurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import PaymentMethod from '../../../../functions/CustomElements/redesign/PaymentMethod';

export default function CreateGift(props) {
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const [amountValue, setAmountValue] = useState('');
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const determinePaymentMethod =
    props.route?.params?.selectedPaymentMethod || 'BTC';
  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode: determinePaymentMethod,
        masterInfoObject,
        fiatStats,
      }),
    [determinePaymentMethod, masterInfoObject, fiatStats],
  );
  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });

  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    useCurrencyDisplay({
      displayCurrency,
      fiatStats,
      usdFiatStats,
      currencyRates,
      masterInfoObject,
    });

  const localSatAmount = convertDisplayToSats(amountValue);
  const dollarAmount = satsToDollars(
    localSatAmount,
    poolInfoRef.currentPriceAInB,
  );

  const openPicker = () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.6,
      currentCurrency: displayCurrency,
      onSelectCurrency: async code => {
        const response = await selectCurrency(code);
        if (response?.didWork) setAmountValue('');
        return response;
      },
    });

  const handleSelectPaymentMethod = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectPaymentMethod',
      selectedPaymentMethod: determinePaymentMethod,
      fromPage: 'CreateGift',
    });
  }, [navigate, determinePaymentMethod]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.giftPages.createGift.header')}
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
          {/* AmountHero formats sats, so pass the converted amount (as in
              createNWCAmount), not the typed fiat string. */}
          <AmountHero
            amount={localSatAmount}
            fiatStats={conversionFiatStats}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: primaryDisplay.denomination,
              fiatCurrency:
                primaryDisplay.forceCurrency ||
                masterInfoObject?.fiatCurrency ||
                'USD',
              satDisplay: isSats ? 'text' : 'symbol',
            }}
          />
        </View>

        <PaymentMethod
          determinePaymentMethod={determinePaymentMethod}
          handleSelectPaymentMethod={handleSelectPaymentMethod}
          bitcoinBalance={bitcoinBalance}
          dollarBalanceToken={dollarBalanceToken}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
          t={t}
          containerStyles={styles.selectContainer}
        />

        <CustomNumberKeyboard
          showDot={primaryDisplay.denomination === 'fiat'}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={conversionFiatStats}
          redesign
        />

        <CustomButton
          disabled={localSatAmount <= 0}
          textContent={t('constants.continue')}
          actionFunction={() => {
            if (localSatAmount <= 0) return;
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'addGiftQuantity',
              amount: localSatAmount,
              dollarAmount: convertToDecimals(dollarAmount),
              amountValue,
              giftDenomination: determinePaymentMethod,
            });
          }}
          size={'regular'}
          buttonStyles={styles.button}
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
    justifyContent: 'center',
  },
  selectContainer: { marginBottom: CONTENT_KEYBOARD_OFFSET },
  button: { marginTop: CONTENT_KEYBOARD_OFFSET },
});
