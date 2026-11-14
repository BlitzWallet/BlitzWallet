import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  QUICK_PAY_STORAGE_KEY,
} from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../functions/CustomElements/button';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import CurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import PaymentMethod from '../../../../functions/CustomElements/redesign/PaymentMethod';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { normalizeDisplayCurrency } from '../../../../functions/displayCurrency';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useBudgetWarning } from '../../../../hooks/useBudgetWarning';
import { lnurlCurrencyToRate } from '../../../../functions/sendBitcoin/lnurlCurrencyRate';
import { PROVIDER_COUNTRY_CURRENCY } from '../../../../functions/sendBitcoin/getPhonePaymentAddress';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import NumberInputSendPage from './components/numberInput';
import useSendPaymentDetails from './hooks/useSendPaymentDetails';
import { buildNextParams, descriptionAvailable } from './functions/sendFlow';
import {
  formatAmountText,
  formatSecondaryText,
} from './functions/formatSendText';
import { getTokenIcon } from '../../../../functions/lrc20/utils';

// Route SendAmount: typed amount, what pays and the display currency. Next
// fetches the real fee or quote, so an unpayable amount stops here.
export default function SendAmountScreen(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const params = props.route.params;
  const {
    paymentInfo: entryPaymentInfo,
    lockedAmount,
    validationError,
    enteredPaymentInfo = {},
    masterTokenInfo = {},
    selectedPaymentMethod = '',
    contactInfo,
    paymentDisplayCurrency,
    paymentDisplayFiatStats,
  } = params;

  const [draft, setDraft] = useState(entryPaymentInfo);
  // The pass 2 result, held for one render so validation sees its real fee.
  const [prepared, setPrepared] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  // This amount was refused once its real fee was known. Next stays off until
  // it's edited or what pays changes.
  const [isBlocked, setIsBlocked] = useState(false);
  const details = useSendPaymentDetails({
    paymentInfo: prepared?.paymentInfo || draft,
    params: prepared
      ? {
          ...params,
          selectedPaymentMethod: prepared.method,
          preSelectedPaymentMethod: undefined,
        }
      : params,
  });
  const {
    paymentValidation,
    resolvedPaymentMethod,
    useFullTokensDisplay,
    enabledLRC20,
    isUsingLRC20,
    convertedSendAmount,
    primaryDisplay,
    conversionFiatStats,
    masterInfoObject,
    fiatStats,
    bitcoinBalance,
    dollarBalanceToken,
    seletctedToken,
    selectedLRC20Asset,
    displayCurrency,
    hasUserSelectedDisplayCurrency,
    injectRate,
    loadAndSetCurrency,
  } = details;
  const { tokens } = useGlobalThemeContext();
  const { tokensImageCache } = useSparkWallet();
  const { bottomPadding } = useGlobalInsets();
  const contentWidth = useContentWidth();
  const { shouldWarn } = useBudgetWarning(convertedSendAmount);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  // Tracks the decoded address we've already applied a local-currency default for,
  // so the phone-payment currency default runs once per address (not every render).
  const appliedLocalCurrencyRef = useRef(null);
  const prevSelection = useRef({
    selectedPaymentMethod,
    tokenName: masterTokenInfo?.tokenName,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Any change to the amount or what pays makes an in-flight Next stale.
  const invalidateNext = useCallback(() => {
    requestIdRef.current += 1;
    setIsPreparing(false);
    setIsBlocked(false);
  }, []);

  const updateDraft = useCallback(
    updater => {
      invalidateNext();
      setDraft(updater);
    },
    [invalidateNext],
  );

  useEffect(() => {
    if (
      prevSelection.current.selectedPaymentMethod === selectedPaymentMethod &&
      prevSelection.current.tokenName === masterTokenInfo?.tokenName
    )
      return;
    prevSelection.current = {
      selectedPaymentMethod,
      tokenName: masterTokenInfo?.tokenName,
    };
    invalidateNext();
    if (lockedAmount) return;
    setDraft(prev => ({
      ...prev,
      sendAmount: '',
      feeQuote: undefined,
      swapPaymentQuote: undefined,
      paymentFee: 0,
      supportFee: 0,
    }));
  }, [
    selectedPaymentMethod,
    masterTokenInfo?.tokenName,
    invalidateNext,
    lockedAmount,
  ]);

  const blockAmount = useCallback(
    errorMessage => {
      setIsBlocked(true);
      navigate.navigate('ErrorScreen', { errorMessage });
    },
    [navigate],
  );

  // Sent back from the description page when its re-check failed.
  useEffect(() => {
    if (!validationError) return;
    blockAmount(validationError);
    navigate.setParams({ validationError: undefined });
  }, [validationError, navigate, blockAmount]);

  // After an LNURL pay decode, default the amount input to the payment location's
  // local fiat currency for phone-number payments, and seed any LNURL-advertised
  // rate so a manual switch to that currency uses the provided rate. Runs once per
  // decoded address and never overrides a manual currency selection.
  useEffect(() => {
    const country = draft?.phonePaymentCountry;
    const descriptor = draft?.lnurlCurrency || null;

    // Nothing to do for non-phone pays that don't advertise a currency.
    if (paymentDisplayCurrency && paymentDisplayFiatStats) return;
    if (!country && !descriptor) return;
    if (hasUserSelectedDisplayCurrency) return;

    const address = draft?.data?.address;
    if (appliedLocalCurrencyRef.current === address) return;

    const code = (
      descriptor?.code ||
      (country ? PROVIDER_COUNTRY_CURRENCY[country] : '') ||
      ''
    ).toUpperCase();
    if (!code || !fiatCurrencies.some(c => c.id === code)) return;

    appliedLocalCurrencyRef.current = address;

    const rate = lnurlCurrencyToRate(descriptor);
    if (rate) {
      // Phone pay: seed the rate and switch to it. Non-phone: seed only, so the
      // provided rate is used if the user manually switches to this currency.
      injectRate(code, rate, { setAsDisplay: !!country });
    } else if (country) {
      // Phone pay with no usable LNURL rate: fall back to our internal rate. If
      // that fails, the existing BTC/device-currency default stays.
      loadAndSetCurrency(code);
    }
  }, [draft, hasUserSelectedDisplayCurrency, injectRate, loadAndSetCurrency]);

  const isFastPayEligible =
    details.sparkInformation.didConnect &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.isFastPayEnabled &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.fastPayThresholdSats >=
      convertedSendAmount &&
    !isUsingLRC20 &&
    !shouldWarn;
  const hasDescriptionStep = descriptionAvailable(draft, contactInfo);

  const goForward = useCallback(
    (paymentInfo, method, extra = {}) => {
      navigate.navigate(
        hasDescriptionStep && !lockedAmount ? 'SendDescription' : 'SendReview',
        buildNextParams(params, {
          paymentInfo,
          selectedPaymentMethod: method,
          preSelectedPaymentMethod: undefined,
          isFastPayEligible,
          ...extra,
        }),
      );
    },
    [navigate, hasDescriptionStep, lockedAmount, params, isFastPayEligible],
  );

  // Validation has now run against the real fee for the prepared payment.
  useEffect(() => {
    if (!prepared) return;
    setPrepared(null);
    setIsPreparing(false);
    if (!paymentValidation.isValid) {
      blockAmount(
        paymentValidation.getErrorMessage(paymentValidation.primaryError),
      );
      return;
    }
    goForward(prepared.paymentInfo, prepared.method, prepared.extra);
  }, [prepared]);

  const handleNext = useCallback(async () => {
    if (isPreparing) return;
    if (!paymentValidation.isValid) {
      navigate.navigate('ErrorScreen', {
        errorMessage: paymentValidation.getErrorMessage(
          paymentValidation.primaryError,
        ),
      });
      return;
    }

    if (lockedAmount) {
      goForward(draft, resolvedPaymentMethod);
      return;
    }

    const requestId = ++requestIdRef.current;
    const method = resolvedPaymentMethod || 'BTC';
    const snapshot = details.buildAmountSnapshot(draft.sendAmount);
    const entered = {
      ...enteredPaymentInfo,
      amount: convertedSendAmount,
      description: details.combinedPaymentDescription,
      displayAmount: snapshot?.displayAmount,
      displayDenomination: snapshot?.displayDenomination,
      displayCurrency: snapshot?.displayCurrency,
      lnInvoiceData: null,
    };
    setIsPreparing(true);

    let outcome;
    try {
      outcome = await details.decodePayment({
        basePaymentInfo: draft,
        comingFromAccept: true,
        entered,
        usablePaymentMethod: method,
        amountSat: convertedSendAmount,
        navigate,
      });
    } catch (err) {
      outcome = { error: err?.message };
    }
    if (!isMountedRef.current || requestId !== requestIdRef.current) return;

    if (!outcome.decoded) {
      setIsPreparing(false);
      navigate.navigate('ErrorScreen', {
        errorMessage:
          outcome.error ||
          t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage'),
      });
      return;
    }
    setPrepared({
      paymentInfo: outcome.decoded,
      method,
      extra: {
        basePaymentInfo: draft,
        preparedEntry: entered,
        paymentDisplayCurrency: displayCurrency,
        paymentDisplayFiatStats: conversionFiatStats,
      },
    });
  }, [
    isPreparing,
    paymentValidation,
    lockedAmount,
    goForward,
    draft,
    resolvedPaymentMethod,
    details,
    enteredPaymentInfo,
    convertedSendAmount,
    navigate,
    displayCurrency,
    conversionFiatStats,
    t,
  ]);

  const handleSelectPaymentMethod = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectPaymentMethod',
      selectedPaymentMethod: resolvedPaymentMethod,
      fromPage: 'SendAmount',
    });
  }, [navigate, resolvedPaymentMethod]);

  const handleSelectTokenPress = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectLRC20Token',
      fromPage: 'SendAmount',
    });
  }, [navigate]);

  const openCurrencyPicker = () => {
    if (isUsingLRC20) return;

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.6,
      currentCurrency: displayCurrency,
      onSelectCurrency: async code => {
        const response = await details.selectCurrency(code);
        if (!response?.didWork) return response;
        updateDraft(prev => ({
          ...prev,
          sendAmount: '',
          feeQuote: undefined,
          swapPaymentQuote: undefined,
          paymentFee: 0,
          supportFee: 0,
        }));
        return response;
      },
    });
  };

  const memorizedKeyboardStyle = useMemo(
    () => ({ paddingBottom: bottomPadding }),
    [bottomPadding],
  );

  const showTokenSelector =
    enabledLRC20 &&
    draft.type === 'spark' &&
    draft.canEditPayment === true &&
    useFullTokensDisplay;
  const isEmpty = !lockedAmount && !Number(draft.sendAmount);
  const isNextDisabled = isEmpty || isBlocked;
  const buttonLabel =
    hasDescriptionStep && !lockedAmount
      ? t('constants.next')
      : isFastPayEligible
      ? t('constants.confirm')
      : t('constants.review');

  const currencyCode = normalizeDisplayCurrency(displayCurrency);
  const amountText = formatAmountText(
    lockedAmount ? details.displayAmount : draft.sendAmount || 0,
    details,
  );
  const secondaryText = isEmpty
    ? ''
    : formatSecondaryText(convertedSendAmount, details);
  // Pay with for a token send: Bitcoin keeps the shared card, a token gets
  // its own row with the token image and balance.
  const isTokenSelected = showTokenSelector && selectedLRC20Asset !== 'Bitcoin';
  const tokenBalance = isTokenSelected
    ? displayCorrectDenomination({
        amount: formatTokensNumber(
          seletctedToken?.balance,
          seletctedToken?.tokenMetadata?.decimals,
        ),
        masterInfoObject,
        useCustomLabel: true,
        customLabel: seletctedToken?.tokenMetadata?.tokenTicker,
        fiatStats,
      })
    : '';

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={false}
      globalThemeViewStyles={memorizedKeyboardStyle}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('constants.send')}
          right={
            !isUsingLRC20 && !lockedAmount ? (
              <CurrencyButton
                label={currencyCode === 'SATS' ? 'SAT' : currencyCode}
                onPress={openCurrencyPicker}
                disabled={details.isLoadingRate}
                accessibilityLabel={t(
                  'settings.nwc.createNWCAmount.changeCurrency',
                )}
              />
            ) : null
          }
        />
        <CustomScrollView contentContainerStyle={styles.scrollContainer}>
          <AmountHero
            amount={amountText}
            formatAmount={false}
            mutedValue={isEmpty}
            amountSize={60}
          />
          <ThemeText
            variant="body"
            CustomNumberOfLines={1}
            styles={[styles.secondary, { color: tokens.muted }]}
            content={secondaryText || ' '}
          />
        </CustomScrollView>

        {isTokenSelected ? (
          <ListCard style={styles.payWith}>
            <ListRow
              onPress={handleSelectTokenPress}
              lead={getTokenIcon(
                [selectedLRC20Asset, seletctedToken],
                40,
                tokensImageCache,
                13,
              )}
              title={t('constants.payWith')}
              titleStyle={{ fontSize: 14, color: tokens.muted }}
              sub={`${
                seletctedToken?.tokenMetadata?.tokenTicker || ''
              } · ${tokenBalance}`}
              subStyle={{ color: tokens.ink, fontSize: 15 }}
              showChevron
            />
          </ListCard>
        ) : (
          <PaymentMethod
            determinePaymentMethod={
              showTokenSelector ? 'BTC' : resolvedPaymentMethod
            }
            handleSelectPaymentMethod={
              showTokenSelector
                ? handleSelectTokenPress
                : handleSelectPaymentMethod
            }
            bitcoinBalance={bitcoinBalance}
            dollarBalanceToken={dollarBalanceToken}
            masterInfoObject={masterInfoObject}
            fiatStats={fiatStats}
            uiState={lockedAmount ? 'CHOOSE_METHOD' : 'EDIT_AMOUNT'}
            t={t}
            showBitcoinCardOnly={
              !showTokenSelector && !lockedAmount && details.isBTCOnlyPayment
            }
          />
        )}

        {!lockedAmount && (
          <NumberInputSendPage
            paymentInfo={draft}
            setPaymentInfo={updateDraft}
            fiatStats={conversionFiatStats}
            selectedLRC20Asset={selectedLRC20Asset}
            seletctedToken={seletctedToken}
            inputDenomination={primaryDisplay.denomination}
            primaryDisplay={primaryDisplay}
          />
        )}

        <CustomButton
          size="regular"
          buttonStyles={[styles.button, isNextDisabled && styles.buttonEmpty]}
          disabled={isNextDisabled}
          useLoading={isPreparing}
          actionFunction={handleNext}
          textContent={buttonLabel}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  scrollContainer: {
    flexGrow: 1,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { marginTop: 4, textAlign: 'center' },
  payWith: { marginTop: CONTENT_KEYBOARD_OFFSET },
  button: {
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  buttonEmpty: {
    opacity: HIDDEN_OPACITY,
  },
});
