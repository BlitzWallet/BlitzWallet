import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import { useNodeContext } from '../../../context-store/nodeContext';
import { CENTER, SATSPERBITCOIN } from '../../constants';
import FormattedBalanceInput from './formattedBalanceInput';
import CustomNumberKeyboard from './customNumberKeyboard';
import CustomButton from './button';
import { ScrollView, StyleSheet } from 'react-native';
import ThemeText from './textTheme';
import { useTranslation } from 'react-i18next';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { satsToDollars } from '../spark/flashnet';
import CurrencySwitchButton from './currencySwitchButton';
import { getDefaultDisplayCurrency } from '../displayCurrency';
import useDisplayCurrencyController from '../../hooks/useDisplayCurrencyController';
import useCurrencyDisplay from '../../hooks/useCurrencyDisplay';

export default function CustomInputHalfModal(props) {
  const {
    handleBackPressFunction,
    setContentHeight,
    message,
    type,
    returnLocation,
    forceUSD,
    setBackNav,
  } = props;
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const isUSDOnly = returnLocation === 'CreateSplitBill' && forceUSD;
  const fiatStats = useMemo(
    () =>
      forceUSD ? { value: swapUSDPriceDollars, coin: 'USD' } : globalFiatStats,
    [forceUSD, swapUSDPriceDollars, globalFiatStats],
  );

  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
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
        },
      }),
    [displayCurrency, navigate, selectCurrency],
  );

  const handleSubmit = () => {
    handleBackPressFunction(() => {
      if (props?.passedParams) {
        navigate.popTo(returnLocation, {
          ...props?.passedParams,
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

  useEffect(() => {
    if (!setBackNav) return;
    if (isUSDOnly) return;
    setBackNav({
      title: '',
      rightElement:
        returnLocation !== 'CreateSplitBill' ||
        (returnLocation === 'CreateSplitBill' && !forceUSD) ? (
          <CurrencySwitchButton
            displayCurrency={displayCurrency}
            onPress={openPicker}
            disabled={isLoadingRate}
          />
        ) : null,
    });
    return () => setBackNav(null);
  }, [
    setBackNav,
    displayCurrency,
    openPicker,
    isLoadingRate,
    returnLocation,
    forceUSD,
  ]);

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {message && (
        <ThemeText
          styles={{
            textAlign: 'center',
            width: '80%',
            ...CENTER,
            marginBottom: 10,
          }}
          content={message}
        />
      )}
      <FormattedBalanceInput
        maxWidth={0.9}
        amountValue={amountValue}
        inputDenomination={primaryDisplay.denomination}
        forceCurrency={primaryDisplay.forceCurrency}
        forceFiatStats={primaryDisplay.forceFiatStats}
        customTextInputContainerStyles={{ marginTop: isUSDOnly ? 20 : 10 }}
      />

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
        actionFunction={handleSubmit}
        textContent={t('constants.save')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  popupContainer: {
    flex: 1,
  },
  satValue: {
    textAlign: 'center',
    marginBottom: 50,
  },
});
