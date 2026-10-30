import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  MIN_BTC_USD_AMOUNT_RECEIVEPAGE,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useMemo, useState } from 'react';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import BudgetCurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import formatBalanceAmount from '../../../../functions/formatNumber';
import { useTheme } from '../../../../../context-store/theme';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import customUUID from '../../../../functions/customUUID';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../../../../functions/displayCurrency';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { isUsingAltAccount } = useActiveCustodyAccount();
  const fromPage = props.route.params.from;
  const receiveType = props.route.params.receiveType;
  const initialDescription = props.route.params.description || '';
  const [paymentDescription, setPaymentDescription] =
    useState(initialDescription);

  const endReceiveType = props.route.params.endReceiveType;
  const userReceiveAmount = Number(props.route.params.userReceiveAmount) || 0;
  const incomingDisplayCurrency = props.route.params.paymentDisplayCurrency;
  const incomingDisplayFiatStats = props.route.params.paymentDisplayFiatStats;
  const incomingDisplayAmount = props.route.params.paymentDisplayAmount;

  const isUSDReceiveMode = endReceiveType === 'USD';
  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  // Open the editor in the currency the amount was originally entered in (if
  // one was passed through), otherwise fall back to the device-based default.
  const initialDisplayCurrency = useMemo(
    () =>
      incomingDisplayCurrency ||
      getDefaultDisplayCurrency({
        paymentMode: endReceiveType,
        masterInfoObject,
        fiatStats,
      }),
    [incomingDisplayCurrency, endReceiveType, masterInfoObject, fiatStats],
  );
  const additionalRates = useMemo(
    () =>
      incomingDisplayCurrency && incomingDisplayFiatStats?.value
        ? { [incomingDisplayCurrency]: incomingDisplayFiatStats }
        : undefined,
    [incomingDisplayCurrency, incomingDisplayFiatStats],
  );

  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
      additionalRates,
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
  // Show the verbatim fiat amount the user originally typed as the placeholder
  // (so it reads $100, not a sats-reconverted $100.1) whenever the editor is
  // still in that same fiat currency. If they switch currencies the literal no
  // longer applies, so fall back to converting the locked sats.
  const placeholderMatchesEnteredCurrency =
    !!incomingDisplayAmount &&
    primaryDisplay.denomination === 'fiat' &&
    normalizeDisplayCurrency(primaryDisplay.forceCurrency) ===
      normalizeDisplayCurrency(incomingDisplayCurrency);
  const previousAmountDisplayValue = !userReceiveAmount
    ? ''
    : placeholderMatchesEnteredCurrency
    ? incomingDisplayAmount
    : convertSatsToDisplay(userReceiveAmount);
  const descriptionChanged = paymentDescription !== initialDescription;
  const requestChanged = amountChanged || descriptionChanged;
  const finalDescription = paymentDescription;

  // Under the swap minimum the invoice page falls back to the any-amount
  // Lightning address, which only works without a note on the main account.
  const cannotRequest =
    receiveType.toLowerCase() === 'lightning' &&
    endReceiveType === 'USD' &&
    requestedSatAmount > 0 &&
    requestedSatAmount < MIN_BTC_USD_AMOUNT_RECEIVEPAGE &&
    (!!paymentDescription || isUsingAltAccount);

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
        return response;
      },
    });
  }, [displayCurrency, isKeyboardFocused, navigate, selectCurrency]);

  const handleSubmit = useCallback(() => {
    const sendAmount = Number(requestedSatAmount) || 0;
    crashlyticsLogReport(`Running in edit payment information submit function`);

    // From Receive, an untouched $0 still creates an any-amount invoice.
    if (!requestChanged && fromPage !== 'homepage') {
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

    // When only the description changed, keep the original entry-time currency,
    // rate, and the verbatim fiat amount so the receive page keeps showing what
    // the user first typed (the live rate may have moved since then). When the
    // amount changed, carry the new verbatim fiat value (only meaningful when the
    // user typed in a fiat currency; sats entries have no fiat literal).
    const enteredFiatLiteral =
      primaryDisplay.denomination === 'fiat' ? amountValue : '';
    const outgoingDisplayCurrency = amountChanged
      ? displayCurrency
      : incomingDisplayCurrency || displayCurrency;
    const outgoingDisplayFiatStats = amountChanged
      ? conversionFiatStats
      : incomingDisplayFiatStats || conversionFiatStats;
    const outgoingDisplayAmount = amountChanged
      ? enteredFiatLiteral
      : incomingDisplayAmount ?? enteredFiatLiteral;

    if (fromPage === 'homepage') {
      navigate.replace('ReceiveBTC', {
        receiveAmount: sendAmount,
        description: finalDescription,
        endReceiveType,
        uuid: customUUID(),
        paymentDisplayCurrency: outgoingDisplayCurrency,
        paymentDisplayFiatStats: outgoingDisplayFiatStats,
        paymentDisplayAmount: outgoingDisplayAmount,
      });
    } else {
      navigate.popTo(
        'ReceiveBTC',
        {
          receiveAmount: sendAmount,
          description: finalDescription,
          endReceiveType: endReceiveType,
          uuid: customUUID(),
          paymentDisplayCurrency: outgoingDisplayCurrency,
          paymentDisplayFiatStats: outgoingDisplayFiatStats,
          paymentDisplayAmount: outgoingDisplayAmount,
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
    displayCurrency,
    amountChanged,
    amountValue,
    incomingDisplayCurrency,
    incomingDisplayFiatStats,
    incomingDisplayAmount,
    t,
  ]);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: isKeyboardFocused
        ? CONTENT_KEYBOARD_OFFSET
        : bottomPadding,
    };
  }, [bottomPadding, isKeyboardFocused]);

  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isFiat = primaryDisplay.denomination === 'fiat';
  const shownAmount = amountValue || previousAmountDisplayValue || 0;
  // The other denomination under the amount (sats under fiat, fiat under sats).
  const secondaryLine = displayCorrectDenomination({
    amount: requestedSatAmount,
    masterInfoObject: {
      ...masterInfoObject,
      userBalanceDenomination: isFiat ? 'sats' : 'fiat',
    },
    fiatStats,
  });

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      globalThemeViewStyles={memorizedKeyboardStyle}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          shouldDismissKeyboard={true}
          title={t(
            fromPage === 'homepage'
              ? 'receive.createInvoice'
              : 'wallet.receivePages.editPaymentInfo.editAmount',
          )}
          right={
            <BudgetCurrencyButton
              label={
                normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY
                  ? 'SAT'
                  : normalizedDisplayCurrency
              }
              onPress={openPicker}
              disabled={isLoadingRate}
              accessibilityLabel={t(
                'settings.nwc.createNWCAmount.changeCurrency',
              )}
            />
          }
        />

        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.amountScrollContainer,
            { opacity: isKeyboardFocused ? HIDDEN_OPACITY : 1 },
          ]}
        >
          <AmountHero
            amount={formatBalanceAmount(shownAmount, false, masterInfoObject)}
            convertAmount={false}
            fiatStats={primaryDisplay.forceFiatStats}
            forceCurrency={primaryDisplay.forceCurrency}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: primaryDisplay.denomination,
            }}
            mutedValue={!amountValue}
          />
          {!!requestedSatAmount && (
            <ThemeText
              styles={[styles.secondary, { color: tokens.muted }]}
              content={secondaryLine}
            />
          )}
        </CustomScrollView>

        <View style={styles.note}>
          <UserInput
            value={paymentDescription}
            onChangeText={setPaymentDescription}
            placeholder={t('receive.whatFor')}
            onFocus={() => setIsKeyboardFocused(true)}
            onBlur={() => setIsKeyboardFocused(false)}
            maxLength={150}
          />
        </View>

        {!isKeyboardFocused && (
          <>
            <CustomNumberKeyboard
              redesign
              showDot={isFiat}
              setInputValue={setAmountValue}
              usingForBalance={true}
              fiatStats={conversionFiatStats}
            />

            <CustomButton
              size="regular"
              buttonStyles={{
                marginTop: CONTENT_KEYBOARD_OFFSET,
                opacity: cannotRequest ? HIDDEN_OPACITY : 1,
              }}
              actionFunction={handleSubmit}
              textContent={t(
                fromPage === 'homepage' || requestChanged
                  ? 'receive.createInvoice'
                  : 'constants.back',
              )}
            />
          </>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  amountScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  note: { marginBottom: 12 },
  secondary: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
