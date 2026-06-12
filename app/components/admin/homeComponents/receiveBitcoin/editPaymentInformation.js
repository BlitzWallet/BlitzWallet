import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CENTER, MIN_BTC_USD_AMOUNT_RECEIVEPAGE } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useMemo, useState } from 'react';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../../constants/theme';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import customUUID from '../../../../functions/customUUID';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { getDefaultDisplayCurrency } from '../../../../functions/displayCurrency';
import CurrencySwitchButton from '../../../../functions/CustomElements/currencySwitchButton';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const fromPage = props.route.params.from;
  const receiveType = props.route.params.receiveType;
  const initialDescription = props.route.params.description || '';
  const [paymentDescription, setPaymentDescription] =
    useState(initialDescription);

  const endReceiveType = props.route.params.endReceiveType;
  const userReceiveAmount = Number(props.route.params.userReceiveAmount) || 0;

  const isUSDReceiveMode = endReceiveType === 'USD';
  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode: endReceiveType,
        masterInfoObject,
        fiatStats,
      }),
    [endReceiveType, masterInfoObject, fiatStats],
  );

  const {
    displayCurrency,
    currencyRates,
    isLoadingRate,
    selectCurrency,
  } = useDisplayCurrencyController({
    initialCurrency: initialDisplayCurrency,
    fiatStats,
    usdFiatStats,
    masterInfoObject,
  });

  const {
    primaryDisplay,
    conversionFiatStats,
    convertSatsToDisplay,
    convertDisplayToSats,
  } = useCurrencyDisplay({
    displayCurrency,
    fiatStats,
    usdFiatStats,
    currencyRates,
    masterInfoObject,
  });

  // Calculate sat amount based on which fiat we're using
  const localSatAmount = convertDisplayToSats(amountValue);
  const hasAmountInput = amountValue !== '';
  const requestedSatAmount = hasAmountInput
    ? Number(localSatAmount) || 0
    : userReceiveAmount;
  const amountChanged =
    hasAmountInput && requestedSatAmount !== userReceiveAmount;
  const previousAmountDisplayValue = userReceiveAmount
    ? convertSatsToDisplay(userReceiveAmount)
    : '';
  const descriptionChanged = paymentDescription !== initialDescription;
  const requestChanged = amountChanged || descriptionChanged;
  const finalDescription = paymentDescription;

  const cannotRequest =
    receiveType.toLowerCase() === 'lightning' &&
    endReceiveType === 'USD' &&
    requestedSatAmount > 0 &&
    requestedSatAmount < MIN_BTC_USD_AMOUNT_RECEIVEPAGE;

  const handleEmoji = newDescription => {
    setPaymentDescription(newDescription);
  };

  const openPicker = useCallback(() => {
    if (isKeyboardFocused) return;

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.9,
      currentCurrency: displayCurrency,
      onSelectCurrency: async code => {
        const response = await selectCurrency(code);
        if (response?.didWork) setAmountValue('');
      },
    });
  }, [displayCurrency, isKeyboardFocused, navigate, selectCurrency]);

  const handleSubmit = useCallback(() => {
    const sendAmount = Number(requestedSatAmount) || 0;
    crashlyticsLogReport(`Running in edit payment information submit function`);

    if (!requestChanged) {
      navigate.goBack();
      return;
    }

    if (cannotRequest) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
          amount: displayCorrectDenomination({
            amount: MIN_BTC_USD_AMOUNT_RECEIVEPAGE,
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

    if (fromPage === 'homepage') {
      navigate.replace('ReceiveBTC', {
        receiveAmount: sendAmount,
        description: finalDescription,
        endReceiveType,
        uuid: customUUID(),
      });
    } else {
      navigate.popTo(
        'ReceiveBTC',
        {
          receiveAmount: sendAmount,
          description: finalDescription,
          endReceiveType: endReceiveType,
          uuid: customUUID(),
        },
        { merge: true },
      );
    }
  }, [
    requestedSatAmount,
    navigate,
    cannotRequest,
    masterInfoObject,
    primaryDisplay,
    conversionFiatStats,
    fromPage,
    endReceiveType,
    finalDescription,
    requestChanged,
    t,
  ]);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: isKeyboardFocused ? 0 : bottomPadding,
    };
  }, [bottomPadding, isKeyboardFocused]);

  return (
    <CustomKeyboardAvoidingView globalThemeViewStyles={memorizedKeyboardStyle}>
      <View style={styles.replacementContainer}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={t('wallet.receivePages.editPaymentInfo.editAmount')}
          rightContent={
            <CurrencySwitchButton
              displayCurrency={displayCurrency}
              onPress={openPicker}
              disabled={isLoadingRate}
            />
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.amountScrollContainer,
            { opacity: isKeyboardFocused ? HIDDEN_OPACITY : 1 },
          ]}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            placeholderAmountValue={previousAmountDisplayValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />
        </ScrollView>

        <CustomSearchInput
          setInputText={setPaymentDescription}
          placeholderText={t('constants.paymentDescriptionPlaceholder')}
          inputText={paymentDescription}
          textInputStyles={styles.textInputStyles}
          containerStyles={styles.descriptionInputContainer}
          onFocusFunction={() => setIsKeyboardFocused(true)}
          onBlurFunction={() => setIsKeyboardFocused(false)}
          textInputMultiline={true}
          textAlignVertical={'center'}
          maxLength={150}
        />

        {!isKeyboardFocused && (
          <>
            <CustomNumberKeyboard
              showDot={primaryDisplay.denomination === 'fiat'}
              setInputValue={setAmountValue}
              usingForBalance={true}
              fiatStats={conversionFiatStats}
            />

            <CustomButton
              buttonStyles={{
                ...CENTER,
                opacity: cannotRequest ? HIDDEN_OPACITY : 1,
              }}
              actionFunction={handleSubmit}
              textContent={
                requestChanged ? t('constants.request') : t('constants.back')
              }
            />
          </>
        )}
      </View>
      {isKeyboardFocused && (
        <EmojiQuickBar
          description={paymentDescription}
          onEmojiSelect={handleEmoji}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  replacementContainer: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  globalContainer: {
    flex: 1,
  },
  amountScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  satValue: {
    textAlign: 'center',
  },
  descriptionInputContainer: {
    width: '90%',
    maxWidth: 350,
  },
  textInputStyles: {
    width: '100%',
    includeFontPadding: false,
  },
});
