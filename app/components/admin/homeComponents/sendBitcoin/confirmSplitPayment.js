import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  IS_SPARK_ID,
  QUICK_PAY_STORAGE_KEY,
  USDB_TOKEN_ID,
} from '../../../../constants';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import SendTransactionFeeInfo from './components/feeInfo';
import usePaymentValidation from './functions/paymentValidation';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../hooks/themeColors';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAppStatus } from '../../../../../context-store/appStatus';
import ErrorWithPayment from './components/errorScreen';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
  useSparkWallet,
} from '../../../../../context-store/sparkContext';
import { bulkSparkPayment } from '../../../../functions/spark/bulkPaymentFunctions';
import InvoiceInfo from './components/invoiceInfo';
import ChoosePaymentMethod from './components/choosePaymentMethodContainer';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { SliderProgressAnimation } from '../../../../functions/CustomElements/sendPaymentAnimation';
import { InputTypes } from 'bitcoin-address-parser';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useWebView } from '../../../../../context-store/webViewContext';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useKeysContext } from '../../../../../context-store/keys';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import CustomButton from '../../../../functions/CustomElements/button';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import SwapRatesChangedState from './components/swapRatesChangedState';
import {
  BTC_ASSET_ADDRESS,
  INTEGRATOR_FEE,
  SEND_AMOUNT_INCREASE_BUFFER,
  USD_ASSET_ADDRESS,
  dollarsToSats,
  executeSwap,
  getUserSwapHistory,
  satsToDollars,
  simulateSwap,
} from '../../../../functions/spark/flashnet';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import usePaymentMethodSelection from '../../../../hooks/usePaymentMethodSelection';
import { useBudgetWarning } from '../../../../hooks/useBudgetWarning';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { setFlashnetTransfer } from '../../../../functions/spark/handleFlashnetTransferIds';
import {
  getSingleTxDetails,
  getSparkPaymentStatus,
} from '../../../../functions/spark';

export default function ConfirmSplitPayment(props) {
  console.log('CONFIRM SEND PAYMENT SCREEN');
  const navigate = useNavigation();
  const {
    enteredPaymentInfo = {},
    errorMessage,
    contactInfo,
    masterTokenInfo = {},
    selectedPaymentMethod = '',
    preSelectedPaymentMethod,
    splitRecipients,
    paymentCurrency,
  } = props.route.params;

  const isUSDSplit = paymentCurrency === 'USD';

  console.log(isUSDSplit, 'tesint');

  const { poolInfoRef, swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { sendWebViewRequest } = useWebView();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { accountMnemoinc, contactsPrivateKey } = useKeysContext();
  const { sparkInformation, showTokensInformation, sparkInfoRef } =
    useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { liquidNodeInformation, fiatStats } = useNodeContext();

  const { globalContactsInformation } = useGlobalContacts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { shouldWarn } = useBudgetWarning();
  const didWarnAboutBudget = useRef(null);
  const [rerenderInput, setRerenderInput] = useState(0);
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [showProgressAnimation, setShowProgressAnimation] = useState(false);
  const progressAnimationRef = useRef(null);
  const hasTriggeredFastPay = useRef(false);
  const convertedSendAmountRef = useRef(null);
  const determinePaymentMethodRef = useRef(null);
  const didRequireChoiceRef = useRef(false);
  const uiStateRef = useRef(null);
  const primaryDisplayRef = useRef(null);
  const conversionFiatStatsRef = useRef(null);
  const swapFeeKeyRef = useRef(null);

  // Drives the SWAP_RATES_CHANGED uiState when Flashnet rate drift breaks swap viability.
  const [rateChangeDetected, setRateChangeDetected] = useState(false);
  // Captures swapUSDPriceDollars on CONFIRM_PAYMENT entry (ref = no extra re-render).
  const rateAtConfirmEntryRef = useRef(null);

  const [didSelectPaymentMethod, setDidSelectPaymentMethod] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({});
  const prevSelectedPaymentInfo = useRef({
    preSelectedPaymentMethod,
    enteredInfo: enteredPaymentInfo?.inputCurrency,
    selectedPaymentMethod,
  });

  const paymentMode =
    preSelectedPaymentMethod === 'USD' ||
    enteredPaymentInfo?.inputCurrency === 'USD' ||
    selectedPaymentMethod === 'USD'
      ? 'USD'
      : 'BTC';

  const [userSetInputDenomination, setUserSetInputDenomination] =
    useState(null);

  const inputDenomination = userSetInputDenomination
    ? userSetInputDenomination
    : paymentMode === 'USD'
    ? 'fiat'
    : masterInfoObject.userBalanceDenomination !== 'fiat'
    ? 'sats'
    : 'fiat';

  const inputDenominationRef = useRef(inputDenomination);
  const [paymentDescription, setPaymentDescription] = useState('');
  const isSendingPayment = useRef(null);
  const userPaymentMethod = selectedPaymentMethod || preSelectedPaymentMethod;
  const combinedPaymentDescription =
    paymentDescription ||
    paymentInfo?.data?.label ||
    paymentInfo?.data?.message ||
    '';

  // Payment type flags
  const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';
  const isLiquidPayment = paymentInfo?.paymentNetwork === 'liquid';
  const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
  const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';
  const isLNURLPayment = paymentInfo?.type === InputTypes.LNURL_PAY;

  const isBTCdenominated =
    inputDenomination === 'hidden' || inputDenomination === 'sats';

  const enabledLRC20 = showTokensInformation;
  const defaultToken = enabledLRC20
    ? masterInfoObject?.defaultSpendToken || 'Bitcoin'
    : 'Bitcoin';

  const tokensObject = sparkInformation?.tokens ?? {};
  const tokensList = useMemo(() => {
    return Object.entries(tokensObject)
      .filter(token => {
        const [key, value] = token;
        return !!value?.balance;
      })
      .map(item => item[0]);
  }, [tokensObject]);

  const useFullTokensDisplay =
    (tokensList.length >= 2 ||
      (tokensList.length === 1 && !tokensList.includes(USDB_TOKEN_ID)) ||
      (masterInfoObject.enabledBTKNTokens && tokensList.length)) &&
    isSparkPayment &&
    paymentInfo?.data?.expectedToken !== USDB_TOKEN_ID &&
    !contactInfo;

  const showSendMax = !dollarBalanceSat && !bitcoinBalance;

  const totalSplitSats = useMemo(() => {
    return (
      splitRecipients?.reduce((sum, r) => sum + (r.amountSats || 0), 0) || 0
    );
  }, [splitRecipients]);

  const totalSplitCents = useMemo(() => {
    if (!isUSDSplit) return 0;
    return (
      splitRecipients?.reduce((sum, r) => sum + (r.amountCents || 0), 0) || 0
    );
  }, [isUSDSplit, splitRecipients]);

  const totalSplitDollars = totalSplitCents / 100;

  // finds the true min swap amount
  const min_usd_swap_amount = useMemo(() => {
    return Math.round(
      dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB),
    );
  }, [poolInfoRef.currentPriceAInB, swapLimits]);

  const minLNURLSatAmount = isLNURLPayment
    ? paymentInfo?.data?.minSendable / 1000
    : 0;
  const maxLNURLSatAmount = isLNURLPayment
    ? paymentInfo?.data?.maxSendable / 1000
    : 0;

  const selectedLRC20Asset = masterTokenInfo?.tokenName || defaultToken;
  const seletctedToken =
    masterTokenInfo?.details ||
    sparkInformation?.tokens?.[selectedLRC20Asset] ||
    {};
  const tokenDecimals = seletctedToken?.tokenMetadata?.decimals ?? 0;
  const tokenBalance = seletctedToken?.balance ?? 0;
  const sparkBalance = sparkInformation?.balance ?? 0;
  const isUsingLRC20 = selectedLRC20Asset?.toLowerCase() !== 'bitcoin';

  const sendingAmount = paymentInfo?.sendAmount || 0;
  const canEditAmount = paymentInfo?.canEditPayment === true;

  const paymentFee =
    (paymentInfo?.paymentFee || 0) + (paymentInfo?.supportFee || 0);
  console.log(paymentInfo, 'payment info');

  const {
    determinePaymentMethod,
    needsToChoosePaymentMethod,
    hasBothUSDAndBitcoinBalance,
  } = usePaymentMethodSelection({
    paymentInfo,
    paymentFee,
    sparkBalance,
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    convertedSendAmount,
    min_usd_swap_amount,
    swapLimits,
    isUsingLRC20,
    useFullTokensDisplay,
    selectedPaymentMethod: userPaymentMethod,
    didSelectPaymentMethod,
    sparkInformation,
  });

  const { determinePaymentMethod: determinePaymentMethodForChoice } =
    usePaymentMethodSelection({
      paymentInfo,
      paymentFee,
      sparkBalance,
      bitcoinBalance,
      dollarBalanceSat,
      dollarBalanceToken,
      convertedSendAmount,
      min_usd_swap_amount,
      swapLimits,
      isUsingLRC20,
      useFullTokensDisplay,
      selectedPaymentMethod: '',
      didSelectPaymentMethod: false,
      sparkInformation,
    });

  // For split payments, allow CHOOSE_METHOD even with a preselected method
  const shouldShowChooseMethod =
    determinePaymentMethodForChoice === 'user-choice' &&
    !didSelectPaymentMethod &&
    !isUsingLRC20 &&
    hasBothUSDAndBitcoinBalance;

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertSatsToDisplay,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode:
      enteredPaymentInfo?.fromContacts &&
      !enteredPaymentInfo?.payingContactsRequest
        ? paymentMode
        : determinePaymentMethod,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
    isSendingPayment: isSendingPayment.current,
  });

  const displayAmount = canEditAmount
    ? sendingAmount // User is editing, so sendingAmount is in current display denomination
    : convertSatsToDisplay(sendingAmount); // Fixed from invoice, convert sats to display

  const convertedSendAmount = !isUsingLRC20
    ? canEditAmount
      ? convertDisplayToSats(sendingAmount) // User entered amount, convert to sats
      : Number(sendingAmount) // Fixed invoice amount, already in sats
    : Number(sendingAmount);

  // use stablepool info ref so the fiat amount doesnt change in between inputs leading to a false amount being sent.
  const fiatValueConvertedSendAmount = Math.round(
    satsToDollars(
      convertedSendAmount,
      enteredPaymentInfo?.stablePoolInfoRef?.currentPriceAInB ||
        poolInfoRef.currentPriceAInB,
    ).toFixed(2) * Math.pow(10, 6),
  );

  useEffect(() => {
    primaryDisplayRef.current = primaryDisplay;
  }, [primaryDisplay]);
  useEffect(() => {
    conversionFiatStatsRef.current = conversionFiatStats;
  }, [conversionFiatStats]);

  useEffect(() => {
    determinePaymentMethodRef.current = determinePaymentMethod;
  }, [determinePaymentMethod]);

  useEffect(() => {
    inputDenominationRef.current = inputDenomination;
  }, [inputDenomination]);

  useEffect(() => {
    if (shouldShowChooseMethod && !didRequireChoiceRef.current) {
      didRequireChoiceRef.current = true;
    }
  }, [shouldShowChooseMethod]);

  // Fast pay logic
  const canUseFastPay =
    sparkInformation.didConnect &&
    Object.keys(paymentInfo || {}).length > 0 &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.isFastPayEnabled &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.fastPayThresholdSats >=
      convertedSendAmount &&
    !isUsingLRC20 &&
    (!didRequireChoiceRef.current || didSelectPaymentMethod) &&
    determinePaymentMethod !== 'user-choice' &&
    convertedSendAmount >= paymentFee;

  const receiverExpectsCurrency = paymentInfo?.data?.expectedReceive || 'sats';

  const uiState = useMemo(() => {
    if (canEditAmount && !isSendingPayment.current) {
      return 'EDIT_AMOUNT'; // Show number pad + description input
    }

    // Rate-change intercept: show before CHOOSE_METHOD / CONFIRM_PAYMENT so it
    // takes over the screen whenever the Flashnet rate broke swap viability.
    if (rateChangeDetected) {
      return 'SWAP_RATES_CHANGED';
    }

    if (
      (shouldShowChooseMethod || !didSelectPaymentMethod) &&
      !isSendingPayment.current &&
      !isBitcoinPayment &&
      !isUsingLRC20 &&
      !canUseFastPay &&
      hasBothUSDAndBitcoinBalance
    ) {
      return 'CHOOSE_METHOD'; // Show info screen with button to select method
    }

    return 'CONFIRM_PAYMENT'; // Show swipe button
  }, [
    canEditAmount,
    rateChangeDetected,
    shouldShowChooseMethod,
    didSelectPaymentMethod,
    isBitcoinPayment,
    isUsingLRC20,
    canUseFastPay,
    hasBothUSDAndBitcoinBalance,
  ]);
  console.log(
    shouldShowChooseMethod,
    didSelectPaymentMethod,
    isBitcoinPayment,
    isUsingLRC20,
    canUseFastPay,
    hasBothUSDAndBitcoinBalance,
    uiState,
  );

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    if (
      uiState === 'CONFIRM_PAYMENT' &&
      shouldWarn &&
      !didWarnAboutBudget.current
    ) {
      didWarnAboutBudget.current = true;
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'nearBudgetLimitWarning',
        sliderHight: 0.6,
      });
    }
  }, [uiState, shouldWarn]);

  useEffect(() => {
    if (
      prevSelectedPaymentInfo.current.preSelectedPaymentMethod !==
        preSelectedPaymentMethod ||
      prevSelectedPaymentInfo.current.enteredInfo !==
        enteredPaymentInfo?.inputCurrency ||
      prevSelectedPaymentInfo.current.selectedPaymentMethod !==
        selectedPaymentMethod
    ) {
      console.log(
        'Payment method or input currency changed, resetting payment info',
      );
      if (uiStateRef.current !== 'EDIT_AMOUNT') return;
      console.log('Resetting payment info for new selection');
      setPaymentInfo(prev => ({
        ...prev,
        sendAmount: '',
      }));
      setUserSetInputDenomination(null);
      prevSelectedPaymentInfo.current = {
        preSelectedPaymentMethod,
        enteredInfo: enteredPaymentInfo?.inputCurrency,
        selectedPaymentMethod,
      };
    }
  }, [
    preSelectedPaymentMethod,
    enteredPaymentInfo?.inputCurrency,
    selectedPaymentMethod,
  ]);

  const paymentValidation = usePaymentValidation({
    paymentInfo,
    convertedSendAmount,
    paymentFee,
    determinePaymentMethod,
    selectedPaymentMethod: userPaymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    min_usd_swap_amount,
    swapLimits,
    isUsingLRC20,
    seletctedToken,
    minLNURLSatAmount,
    maxLNURLSatAmount,
    isDecoding,
    canEditAmount,
    t,
    masterInfoObject,
    fiatStats,
    inputDenomination: primaryDisplay.denomination,
    primaryDisplay,
    conversionFiatStats,
    sparkInformation,
  });
  console.log(paymentValidation, 'pv');

  const canSendPayment =
    paymentValidation.canProceed &&
    sendingAmount !== 0 &&
    uiState === 'CONFIRM_PAYMENT';

  const isUsingFastPay = canUseFastPay && canSendPayment && !canEditAmount;

  // Rate-sensitive swap path: only Flashnet swaps (USD→BTC / BTC→USDB) are affected
  // by live rate changes. Mirrors needsSwap in paymentValidation.
  const needsRateSwap =
    (determinePaymentMethod === 'USD' && receiverExpectsCurrency === 'sats') ||
    (determinePaymentMethod === 'BTC' && receiverExpectsCurrency === 'tokens');

  // Snapshot + detection effect.
  // Captures the rate on CONFIRM_PAYMENT entry; when a subsequent rate tick
  // breaks swap viability (convertedSendAmount shrinks, min_usd_swap_amount rises),
  // sets rateChangeDetected → transitions to SWAP_RATES_CHANGED uiState.
  // Resets completely when the user leaves the confirm flow.
  useEffect(() => {
    if (uiState === 'CONFIRM_PAYMENT') {
      // Capture rate once on entry
      if (rateAtConfirmEntryRef.current === null) {
        rateAtConfirmEntryRef.current = swapUSDPriceDollars;
      }
      // Detect drift that broke viability
      if (
        rateAtConfirmEntryRef.current !== null &&
        swapUSDPriceDollars !== rateAtConfirmEntryRef.current &&
        !paymentValidation.canProceed &&
        needsRateSwap &&
        !isSendingPayment.current
      ) {
        setRateChangeDetected(true);
      }
    } else if (uiState !== 'SWAP_RATES_CHANGED') {
      // Leaving the confirm flow entirely (EDIT / CHOOSE / back) — full reset.
      // Guard against SWAP_RATES_CHANGED so the state doesn't clear itself.
      rateAtConfirmEntryRef.current = null;
      setRateChangeDetected(false);
    }
  }, [
    uiState,
    swapUSDPriceDollars,
    paymentValidation.canProceed,
    needsRateSwap,
  ]);

  const handleRateChangedReset = useCallback(() => {
    rateAtConfirmEntryRef.current = null;
    setRateChangeDetected(false);
    if (isLNURLPayment || isSparkPayment) {
      // Full reset — mirrors hasParamsChanged effect sequence exactly
      setIsAmountFocused(true);
      setPaymentInfo({});
      isSendingPayment.current = null;
      setPaymentDescription('');
      hasTriggeredFastPay.current = false;
      didRequireChoiceRef.current = false;
      setUserSetInputDenomination(null);
      setDidSelectPaymentMethod(false);
      setShowProgressAnimation(false);
    } else {
      navigate.goBack();
    }
  }, [
    isLNURLPayment,
    isSparkPayment,
    navigate,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    t,
  ]);

  const errorMessageNavigation = useCallback(
    reason => {
      navigate.navigate('ConfirmSplitPayment', {
        comingFromAccept: null,
        enteredPaymentInfo: {},
        splitRecipients,
        errorMessage:
          reason ||
          t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage'),
      });
    },
    [navigate, t, splitRecipients],
  );

  useEffect(() => {
    convertedSendAmountRef.current = convertedSendAmount;
  }, [convertedSendAmount]);

  // Pre-populate paymentInfo for split payments so amount display shows the total
  useEffect(() => {
    if (isUSDSplit) {
      const totalCents = splitRecipients.reduce(
        (sum, r) => sum + (r.amountCents ?? 0),
        0,
      );
      const price = poolInfoRef?.currentPriceAInB;
      const approxSats =
        price > 0 ? Math.round(dollarsToSats(totalCents / 100, price)) : 0;
      setPaymentInfo({
        paymentNetwork: 'spark',
        sendAmount: approxSats,
        canEditPayment: false,
        data: {
          expectedReceive: 'tokens',
        },
      });
      return;
    }
    const totalSats =
      splitRecipients?.reduce((sum, r) => sum + r.amountSats, 0) || 0;
    setPaymentInfo({
      paymentNetwork: 'spark',
      sendAmount: totalSats,
      canEditPayment: false,
      data: {
        expectedReceive: 'sats',
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate swap fee for split payments when funding source requires a swap.
  useEffect(() => {
    let cancelled = false;

    const clearSwapFee = () => {
      swapFeeKeyRef.current = null;
      setPaymentInfo(prev => {
        if (!prev || !Object.keys(prev).length) return prev;
        if (
          (prev.paymentFee || 0) === 0 &&
          (prev.supportFee || 0) === 0 &&
          (!prev.swapPaymentQuote ||
            Object.keys(prev.swapPaymentQuote).length === 0)
        ) {
          return prev;
        }
        return {
          ...prev,
          paymentFee: 0,
          supportFee: 0,
          swapPaymentQuote: {},
        };
      });
    };

    const runSwapFeeCalc = async () => {
      if (!poolInfoRef?.currentPriceAInB || !poolInfoRef?.lpPublicKey) return;

      if (!determinePaymentMethod || determinePaymentMethod === 'user-choice') {
        clearSwapFee();
        return;
      }

      const needsSwapForSplit =
        (paymentCurrency === 'BTC' && determinePaymentMethod === 'USD') ||
        (paymentCurrency === 'USD' && determinePaymentMethod === 'BTC');

      if (!needsSwapForSplit) {
        clearSwapFee();
        return;
      }

      const price = poolInfoRef.currentPriceAInB;

      if (paymentCurrency === 'BTC' && determinePaymentMethod === 'USD') {
        const shortfallSatsReg = totalSplitSats;

        if (shortfallSatsReg <= 0 || shortfallSatsReg < min_usd_swap_amount) {
          clearSwapFee();
          return;
        }

        const shortfallSats = shortfallSatsReg;

        const key = `usd-btc:${shortfallSats}:${price}:${dollarBalanceSat}`;
        if (swapFeeKeyRef.current === key) return;
        swapFeeKeyRef.current = key;

        const amountToSendConversion = satsToDollars(shortfallSats, price);
        const usdBalanceConversion = satsToDollars(dollarBalanceSat, price);
        const maxAmount = Math.min(
          amountToSendConversion,
          usdBalanceConversion,
        );
        const usdAmount = Math.ceil(maxAmount.toFixed(2) * Math.pow(10, 6));

        const result = await simulateSwap(currentWalletMnemoinc, {
          poolId: poolInfoRef.lpPublicKey,
          assetInAddress: USD_ASSET_ADDRESS,
          assetOutAddress: BTC_ASSET_ADDRESS,
          amountIn: usdAmount,
        });

        if (cancelled) return;
        if (!result?.didWork) {
          clearSwapFee();
          return;
        }

        const fees = result.simulation.feePaidAssetIn;
        const satFee = Math.round(dollarsToSats(fees / Math.pow(10, 6), price));

        setPaymentInfo(prev => ({
          ...prev,
          paymentFee: satFee,
          supportFee: 0,
          swapPaymentQuote: {
            warn: parseFloat(result.simulation.priceImpact) > 3,
            poolId: poolInfoRef.lpPublicKey,
            assetInAddress: USD_ASSET_ADDRESS,
            assetOutAddress: BTC_ASSET_ADDRESS,
            amountIn: usdAmount,
            satFee,
            bitcoinBalance,
            dollarBalanceSat,
          },
        }));
      }

      if (paymentCurrency === 'USD' && determinePaymentMethod === 'BTC') {
        const shortfallDollars = totalSplitDollars;
        console.log(shortfallDollars, 'short fall dollar');
        if (shortfallDollars <= 0) {
          clearSwapFee();
          return;
        }
        const shortFallSats = Math.round(
          dollarsToSats(shortfallDollars, price),
        );
        const satAmount = shortFallSats;

        console.log(satAmount, 'short fall sats');
        if (satAmount < swapLimits.bitcoin) {
          clearSwapFee();
          return;
        }

        const key = `btc-usd:${satAmount}:${price}:${bitcoinBalance}`;
        if (swapFeeKeyRef.current === key) return;
        swapFeeKeyRef.current = key;

        const result = await simulateSwap(currentWalletMnemoinc, {
          poolId: poolInfoRef.lpPublicKey,
          assetInAddress: BTC_ASSET_ADDRESS,
          assetOutAddress: USD_ASSET_ADDRESS,
          amountIn: satAmount,
        });

        if (cancelled) return;
        if (!result?.didWork) {
          clearSwapFee();
          return;
        }

        const fees = Number(result.simulation.feePaidAssetIn);
        let satFee = dollarsToSats(fees / Math.pow(10, 6), price);
        satFee += satAmount * INTEGRATOR_FEE;

        setPaymentInfo(prev => ({
          ...prev,
          paymentFee: Math.round(satFee),
          supportFee: 0,
          swapPaymentQuote: {
            warn: parseFloat(result.simulation.priceImpact) > 3,
            poolId: poolInfoRef.lpPublicKey,
            assetInAddress: BTC_ASSET_ADDRESS,
            assetOutAddress: USD_ASSET_ADDRESS,
            amountIn: satAmount,
            satFee: Math.round(satFee),
            bitcoinBalance,
            dollarBalanceSat,
          },
        }));
      }
    };

    runSwapFeeCalc();

    return () => {
      cancelled = true;
    };
  }, [
    paymentCurrency,
    paymentInfo,
    isUsingLRC20,
    poolInfoRef,
    determinePaymentMethod,
    totalSplitSats,
    totalSplitDollars,
    bitcoinBalance,
    dollarBalanceToken,
    dollarBalanceSat,
    min_usd_swap_amount,
    swapLimits.bitcoin,
    currentWalletMnemoinc,
    selectedPaymentMethod,
  ]);

  // Fast pay auto-trigger
  useEffect(() => {
    if (
      !isUsingFastPay ||
      hasTriggeredFastPay.current ||
      isSendingPayment.current
    )
      return;

    setShowProgressAnimation(true);

    if (progressAnimationRef.current) {
      requestAnimationFrame(() => {
        progressAnimationRef.current.startAtBeginning();
      });
    }

    const fastPayTrigger = setTimeout(() => {
      hasTriggeredFastPay.current = true;
      if (progressAnimationRef.current) {
        progressAnimationRef.current.startProgress();
      }
      sendPayment();
    }, 250);

    return () => {
      clearTimeout(fastPayTrigger);
    };
  }, [isUsingFastPay]);

  console.log(splitRecipients, 'split recitps');

  const sendPayment = useCallback(async () => {
    if (!paymentValidation.isValid) {
      const error = paymentValidation.getErrorMessage(
        paymentValidation.primaryError,
      );
      navigate.navigate('ErrorScreen', { errorMessage: error });
      return;
    }

    if (isSendingPayment.current) return;

    isSendingPayment.current = true;
    setShowProgressAnimation(true);

    try {
      const splitMemo = enteredPaymentInfo?.description || '';
      let executionResponse;

      const expectedReceiveType = paymentInfo?.data?.expectedReceive || 'sats';
      const needsSwap =
        (determinePaymentMethod === 'USD' && expectedReceiveType === 'sats') ||
        (determinePaymentMethod === 'BTC' && expectedReceiveType === 'tokens');

      if (needsSwap) {
        if (!paymentInfo?.swapPaymentQuote) {
          throw new Error('Swap quote not available');
        }

        if (!poolInfoRef?.currentPriceAInB) {
          throw new Error('Pool info not available');
        }

        if (determinePaymentMethod === 'USD') {
          const amountInWithBuffer = Math.min(
            (paymentInfo.swapPaymentQuote.amountIn *
              SEND_AMOUNT_INCREASE_BUFFER) /
              Math.pow(10, 6),
            satsToDollars(dollarBalanceSat, poolInfoRef.currentPriceAInB),
          );
          const formatted = Math.round(
            amountInWithBuffer.toFixed(2) * Math.pow(10, 6),
          );
          executionResponse = await executeSwap(currentWalletMnemoinc, {
            poolId:
              paymentInfo.swapPaymentQuote.poolId || poolInfoRef.lpPublicKey,
            assetInAddress: USD_ASSET_ADDRESS,
            assetOutAddress: BTC_ASSET_ADDRESS,
            amountIn: formatted,
          });
        } else {
          const amountInWithBuffer = Math.min(
            paymentInfo.swapPaymentQuote.amountIn * SEND_AMOUNT_INCREASE_BUFFER,
            bitcoinBalance,
          );
          const formatted = Math.round(amountInWithBuffer);
          executionResponse = await executeSwap(currentWalletMnemoinc, {
            poolId:
              paymentInfo.swapPaymentQuote.poolId || poolInfoRef.lpPublicKey,
            assetInAddress: BTC_ASSET_ADDRESS,
            assetOutAddress: USD_ASSET_ADDRESS,
            amountIn: formatted,
          });
        }

        if (!executionResponse?.didWork)
          throw new Error(
            executionResponse?.error || 'Error when executing swap',
          );

        const outboundTransferId = executionResponse.swap.outboundTransferId;
        setFlashnetTransfer(outboundTransferId);

        const userSwaps = await getUserSwapHistory(currentWalletMnemoinc, 5);

        if (userSwaps.didWork) {
          const swap = userSwaps.swaps.find(
            savedSwap => savedSwap.outboundTransferId === outboundTransferId,
          );

          if (swap) {
            setFlashnetTransfer(swap.inboundTransferId);
          }
        }

        const MAX_WAIT_TIME = 60000;
        const startTime = Date.now();

        while (true) {
          if (Date.now() - startTime > MAX_WAIT_TIME) {
            throw new Error('Swap completion timeout');
          }

          if (!IS_SPARK_ID.test(outboundTransferId)) {
            await new Promise(res => setTimeout(res, 2500));
            break;
          }

          const sparkTransferResponse = await getSingleTxDetails(
            currentWalletMnemoinc,
            outboundTransferId,
          );

          const status = getSparkPaymentStatus(sparkTransferResponse?.status);
          if (status === 'completed') break;

          console.log('Swap is not complete, waiting for completion');
          await new Promise(res => setTimeout(res, 1500));
        }

        // small buffer to help smooth things out
        await new Promise(res => setTimeout(res, 1500));
      }

      let swapFee = 0;
      if (needsSwap) {
        if (determinePaymentMethod === 'USD') {
          swapFee = dollarsToSats(
            executionResponse.swap.feeAmount / Math.pow(10, 6),
            poolInfoRef.currentPriceAInB,
          );
        } else {
          swapFee = dollarsToSats(
            executionResponse.swap.feeAmount / Math.pow(10, 6),
            poolInfoRef.currentPriceAInB,
          );
        }
      }

      // ── Execute payment (BTC and USD paths both call bulkSparkPayment) ──────
      const result = await bulkSparkPayment(
        currentWalletMnemoinc,
        splitRecipients,
        splitMemo,
        sparkInformation?.identityPubKey,
        {
          globalContactsInformation,
          privateKey: contactsPrivateKey,
          masterInfoObject,
          currentTime: Date.now(),
        },
        paymentCurrency,
        swapFee,
      );
      console.log(result, 'bulk payments result');

      isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);

      if (progressAnimationRef.current) {
        progressAnimationRef.current.completeProgress();
        await new Promise(res => setTimeout(res, 600));
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          navigate.reset({
            index: 0,
            routes: [
              { name: 'HomeAdmin', params: { screen: 'Home' } },
              {
                name: 'ConfirmTxPage',
                params: {
                  transaction: result?.transaction,
                  isSplitPayment: true,
                },
              },
            ],
          });
        });
      });
    } catch (error) {
      console.error('Error in sendPayment:', error);
      // Reset state on error
      isSendingPayment.current = false;
      setShowProgressAnimation(false);
      // Optionally show error to user
      errorMessageNavigation(error.message);
    }
  }, [
    paymentInfo,
    selectedLRC20Asset,
    enteredPaymentInfo,
    combinedPaymentDescription,
    isUsingLRC20,
    tokenDecimals,
    convertedSendAmount,
    masterInfoObject,
    paymentFee,
    sparkBalance,
    sparkInformation,
    currentWalletMnemoinc,
    sendWebViewRequest,
    contactInfo,
    navigate,
    errorMessageNavigation,
    determinePaymentMethod,
    fiatValueConvertedSendAmount,
    paymentValidation,
    splitRecipients,
    bitcoinBalance,
    dollarBalanceSat,
    poolInfoRef,
    t,
    globalContactsInformation,
    contactsPrivateKey,
  ]);

  const handleSelectPaymentMethod = useCallback(
    showNextScreen => {
      setRerenderInput(prev => (prev += 1));
      if (showNextScreen) {
        if (!paymentValidation.isValid) {
          const error = paymentValidation.getErrorMessage(
            paymentValidation.primaryError,
          );
          navigate.navigate('ErrorScreen', { errorMessage: error });
          return;
        }

        setDidSelectPaymentMethod(true);
      } else {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'SelectPaymentMethod',
          selectedPaymentMethod: determinePaymentMethod,
          fromPage: 'ConfirmSplitPayment',
        });
      }
    },
    [navigate, paymentValidation, determinePaymentMethod],
  );

  const handleDenominationToggle = () => {
    if (!isAmountFocused) return;
    if (!canEditAmount) {
      // For fixed amounts, just change the display denomination
      const nextDenom = getNextDenomination();
      setUserSetInputDenomination(nextDenom);
      // No need to convert sendingAmount - it stays in sats
      // The display will automatically update via convertSatsToDisplay
    } else {
      // For editable amounts, convert the user-entered value
      const nextDenom = getNextDenomination();
      const convertedValue = convertForToggle(
        sendingAmount,
        convertTextInputValue,
      );

      setUserSetInputDenomination(nextDenom);
      setPaymentInfo(prev => ({
        ...prev,
        sendAmount: convertedValue,
      }));
    }
  };

  const sendingAsset =
    selectedLRC20Asset === 'Bitcoin'
      ? !isLightningPayment &&
        !isBitcoinPayment &&
        !(isSparkPayment && receiverExpectsCurrency === 'sats')
        ? t('constants.dollars_upper')
        : t('constants.bitcoin_upper')
      : seletctedToken?.tokenMetadata?.tokenTicker;

  if (errorMessage) {
    return <ErrorWithPayment reason={errorMessage} />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.replacementContainer}>
        <CustomSettingsTopBar
          label={t('constants.send')}
          containerStyles={{ marginBottom: 0 }}
        />
        <ThemeText styles={styles.sectionTitle} content={sendingAsset} />
        <ScrollView contentContainerStyle={styles.balanceScrollContainer}>
          {/* Amount display */}
          {uiState !== 'SWAP_RATES_CHANGED' && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDenominationToggle}
            >
              <FormattedBalanceInput
                maxWidth={0.9}
                amountValue={displayAmount}
                inputDenomination={primaryDisplay.denomination}
                forceCurrency={primaryDisplay.forceCurrency}
                forceFiatStats={primaryDisplay.forceFiatStats}
                activeOpacity={!sendingAmount ? 0.5 : 1}
                customCurrencyCode={
                  isUsingLRC20 ? seletctedToken?.tokenMetadata?.tokenTicker : ''
                }
              />

              {!isUsingLRC20 && (
                <FormattedSatText
                  containerStyles={{
                    opacity: !sendingAmount ? HIDDEN_OPACITY : 1,
                  }}
                  neverHideBalance={true}
                  styles={{
                    includeFontPadding: false,
                    ...styles.satValue,
                  }}
                  globalBalanceDenomination={secondaryDisplay.denomination}
                  forceCurrency={secondaryDisplay.forceCurrency}
                  balance={convertedSendAmount}
                  forceFiatStats={secondaryDisplay.forceFiatStats}
                />
              )}
            </TouchableOpacity>
          )}

          {/* Fee info for fixed amount */}
          {uiState === 'CONFIRM_PAYMENT' && (
            <SendTransactionFeeInfo
              paymentFee={paymentFee}
              isLightningPayment={isLightningPayment}
              isLiquidPayment={isLiquidPayment}
              isBitcoinPayment={isBitcoinPayment}
              isSparkPayment={isSparkPayment}
              isDecoding={isDecoding}
            />
          )}

          {/* Invoice info */}
          {uiState === 'CONFIRM_PAYMENT' && (
            <InvoiceInfo
              paymentInfo={paymentInfo}
              contactInfo={contactInfo || paymentInfo?.blitzContactInfo}
              theme={theme}
              darkModeType={darkModeType}
              isSplitPayment={true}
              splitRecipients={splitRecipients}
            />
          )}
          {uiState === 'CHOOSE_METHOD' && (
            <ChoosePaymentMethod
              theme={theme}
              darkModeType={darkModeType}
              determinePaymentMethod={determinePaymentMethod}
              handleSelectPaymentMethod={handleSelectPaymentMethod}
              bitcoinBalance={bitcoinBalance}
              dollarBalanceToken={dollarBalanceToken}
              masterInfoObject={masterInfoObject}
              fiatStats={fiatStats}
              uiState={uiState}
              t={t}
            />
          )}

          {/* SWAP_RATES_CHANGED — rate drifted and broke swap viability */}
          {uiState === 'SWAP_RATES_CHANGED' && <SwapRatesChangedState />}
        </ScrollView>

        {/* SELECT_PAYMENT method state - show button to take user to select half modal */}
        {uiState === 'CHOOSE_METHOD' && (
          <CustomButton
            buttonStyles={{
              ...CENTER,
              width: INSET_WINDOW_WIDTH,
              opacity: paymentValidation.isValid ? 1 : HIDDEN_OPACITY,
            }}
            actionFunction={() => handleSelectPaymentMethod(true)}
            textContent={t('constants.review')}
          />
        )}

        {/* SWAP_RATES_CHANGED — primary CTA to re-enter amount */}
        {uiState === 'SWAP_RATES_CHANGED' && (
          <CustomButton
            buttonStyles={{
              ...CENTER,
            }}
            actionFunction={handleRateChangedReset}
            textContent={t(
              'wallet.sendPages.sendPaymentScreen.swapRatesChangedButton',
            )}
          />
        )}

        {/* CONFIRM_PAYMENT State - Show swipe button or progress animation */}
        {uiState === 'CONFIRM_PAYMENT' && (
          <View style={styles.buttonContainer}>
            {showProgressAnimation || isUsingFastPay ? (
              <SliderProgressAnimation
                ref={progressAnimationRef}
                isVisible={showProgressAnimation || isUsingFastPay}
                textColor={COLORS.darkModeText}
                backgroundColor={
                  theme && darkModeType ? backgroundOffset : COLORS.primary
                }
                width={0.95}
              />
            ) : (
              <SwipeButtonNew
                onSwipeSuccess={sendPayment}
                width={0.85}
                resetAfterSuccessAnimDuration={true}
                // shouldAnimateViewOnSuccess={true}
                shouldResetAfterSuccess={!canSendPayment}
                // shouldDisplaySuccessState={isSendingPayment}
                containerStyles={{
                  opacity: canSendPayment ? 1 : HIDDEN_OPACITY,
                }}
                thumbIconStyles={{
                  backgroundColor:
                    theme && darkModeType ? backgroundOffset : backgroundColor,
                  borderColor:
                    theme && darkModeType ? backgroundOffset : backgroundColor,
                }}
                railStyles={{
                  backgroundColor:
                    theme && darkModeType ? backgroundOffset : backgroundColor,
                  borderColor:
                    theme && darkModeType ? backgroundOffset : backgroundColor,
                }}
              />
            )}
          </View>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  replacementContainer: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  balanceScrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  maxAndAcceptContainer: {
    width: INSET_WINDOW_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    ...CENTER,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectTokenText: {
    textDecorationLine: 'underline',
    paddingVertical: 10,
    textAlign: 'center',
  },
  selectMethodButton: {
    width: INSET_WINDOW_WIDTH,
    marginBottom: 20,
  },
});
