import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import { useNodeContext } from '../../../context-store/nodeContext';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../constants';
import CustomNumberKeyboard from './customNumberKeyboard';
import CustomButton from './button';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { satsToDollars } from '../spark/flashnet';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../displayCurrency';
import useDisplayCurrencyController from '../../hooks/useDisplayCurrencyController';
import useCurrencyDisplay from '../../hooks/useCurrencyDisplay';
import BudgetCurrencyButton from './redesign/CurrencyButton';
import AmountHero from './redesign/AmountHero';
import formatBalanceAmount from '../formatNumber';

export default function CustomInputHalfModal(props) {
  const {
    handleBackPressFunction,
    setContentHeight,
    message,
    type,
    returnLocation,
    forceUSD,
  } = props;
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const isUSDOnly = returnLocation === 'CreateSplitBill' && forceUSD;
  const fiatStats = useMemo(
    () =>
      forceUSD
        ? resolveUsdFiatStats(globalFiatStats, swapUSDPriceDollars)
        : globalFiatStats,
    [forceUSD, swapUSDPriceDollars, globalFiatStats],
  );

  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(globalFiatStats, swapUSDPriceDollars),
    [globalFiatStats, swapUSDPriceDollars],
  );

  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode: isUSDOnly ? 'USD' : 'BTC',
        masterInfoObject,
        fiatStats: globalFiatStats,
      }),
    [masterInfoObject, globalFiatStats],
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

  // Convert current keyboard input to sats (used only in custom step)
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
    [displayCurrency, navigate, selectCurrency],
  );

  const handleSubmit = () => {
    handleBackPressFunction(() => {
      if (props?.passedParams) {
        navigate.popTo(returnLocation, {
          ...(props?.passedParams?.accountID
            ? { accountID: props?.passedParams?.accountID }
            : {}),
          amount: !amountValue ? 0 : localSatAmount,
          type: type,
        });
      } else {
        navigate.popTo(
          returnLocation,
          {
            amount: !amountValue ? 0 : localSatAmount,
            amountValue:
              forceUSD &&
              primaryDisplay.denomination === 'fiat' &&
              primaryDisplay.forceCurrency === 'USD'
                ? amountValue
                : satsToDollars(
                    localSatAmount,
                    poolInfoRef.currentPriceAInB,
                  ).toFixed(2),
            type: props?.type,
          },
          {
            merge: true,
          },
        );
      }
    });
  };

  useEffect(() => {
    // Set content at fixed height
    setContentHeight(600);
  }, []);

  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <View style={styles.budgetButton}>
        <BudgetCurrencyButton
          label={isSats ? 'SAT' : normalizedDisplayCurrency}
          onPress={openPicker}
          disabled={isLoadingRate}
          accessibilityLabel={t('settings.nwc.createNWCAmount.changeCurrency')}
        />
      </View>

      <AmountHero
        amount={formatBalanceAmount(amountValue || 0, false, masterInfoObject)}
        convertAmount={false}
        fiatStats={primaryDisplay.forceFiatStats}
        forceCurrency={primaryDisplay.forceCurrency}
        masterInfoObject={{
          ...masterInfoObject,
          userBalanceDenomination: primaryDisplay.denomination,
        }}
        mutedValue={!amountValue}
      />

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
        redesign
      />
      <CustomButton
        actionFunction={handleSubmit}
        textContent={t('constants.save')}
        size={'regular'}
        buttonStyles={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  budgetButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginLeft: 'auto',
  },
  button: { marginTop: CONTENT_KEYBOARD_OFFSET },
});
