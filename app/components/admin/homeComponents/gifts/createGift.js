import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import ChoosePaymentMethod from '../sendBitcoin/components/choosePaymentMethodContainer';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import {
  convertToDecimals,
  satsToDollars,
} from '../../../../functions/spark/swapAmountUtils';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../functions/displayCurrency';
import CurrencySwitchButton from '../../../../functions/CustomElements/currencySwitchButton';

export default function CreateGift(props) {
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const [amountValue, setAmountValue] = useState('');
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
      <CustomSettingsTopBar
        label={t('screens.inAccount.giftPages.createGift.header')}
        rightContent={
          <CurrencySwitchButton
            displayCurrency={displayCurrency}
            onPress={openPicker}
            disabled={isLoadingRate}
          />
        }
      />
      <View style={{ width: INSET_WINDOW_WIDTH, ...CENTER }}>
        <ThemeText
          styles={styles.title}
          content={t('screens.inAccount.giftPages.createGift.amountPageHeader')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('screens.inAccount.giftPages.createGift.amountPageDesc')}
        />
      </View>

      <View style={styles.container}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={primaryDisplay.denomination}
          forceCurrency={primaryDisplay.forceCurrency}
          forceFiatStats={primaryDisplay.forceFiatStats}
        />
      </View>

      <ChoosePaymentMethod
        theme={theme}
        darkModeType={darkModeType}
        determinePaymentMethod={determinePaymentMethod}
        handleSelectPaymentMethod={handleSelectPaymentMethod}
        bitcoinBalance={bitcoinBalance}
        dollarBalanceToken={dollarBalanceToken}
        masterInfoObject={masterInfoObject}
        fiatStats={fiatStats}
        t={t}
        hideBalance={true}
      />

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={[
          styles.buttonContainer,
          { opacity: localSatAmount <= 0 ? HIDDEN_OPACITY : 1 },
        ]}
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
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },

  buttonContainer: {
    width: 'auto',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
