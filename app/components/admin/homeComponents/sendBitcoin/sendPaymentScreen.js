import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
  USDB_TOKEN_ID,
} from '../../../../constants';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import SendTransactionFeeInfo from './components/feeInfo';
import usePaymentValidation from './functions/paymentValidation';
import decodeSendAddress from './functions/decodeSendAdress';
import { useNavigation } from '@react-navigation/native';
// import {useWebView} from '../../../../../context-store/webViewContext';
import GetThemeColors from '../../../../hooks/themeColors';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import AcceptButtonSendPage from './components/acceptButton';
import NumberInputSendPage from './components/numberInput';
import SendMaxComponent from './components/sendMaxComponent';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAppStatus } from '../../../../../context-store/appStatus';
import hasAlredyPaidInvoice from './functions/hasPaid';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import ErrorWithPayment from './components/errorScreen';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
  useSparkWallet,
} from '../../../../../context-store/sparkContext';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import InvoiceInfo from './components/invoiceInfo';
import formatSparkPaymentAddress from './functions/formatSparkPaymentAddress';
import SelectLRC20Token from './components/selectLRC20Token';
import ChoosePaymentMethod from './components/choosePaymentMethodContainer';
import ChooseLRC20TokenContainer from './components/chooseLRC20TokenContainer';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
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
import NavBarWithBalance from '../../../../functions/CustomElements/navWithBalance';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { useKeysContext } from '../../../../../context-store/keys';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import CustomButton from '../../../../functions/CustomElements/button';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import SwapRatesChangedState from './components/swapRatesChangedState';
import {
  dollarsToSats,
  satsToDollars,
  getLightningPaymentQuote,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import normalizeLNURLAddress from '../../../../functions/lnurl/normalizeLNURLAddress';
import { publishMessage } from '../../../../functions/messaging/publishMessage';
import { useToast } from '../../../../../context-store/toastManager';
import useDebounce from '../../../../hooks/useDebounce';
import customUUID from '../../../../functions/customUUID';
import { useBudgetWarning } from '../../../../hooks/useBudgetWarning';
import { getLNAddressForLiquidPayment } from './functions/payments';

export default function SendPaymentScreen(props) {
  console.log('CONFIRM SEND PAYMENT SCREEN');
  const navigate = useNavigation();
  const {
    btcAdress,
    fromPage,
    publishMessageFunc,
    comingFromAccept,
    enteredPaymentInfo = {},
    errorMessage,
    contactInfo,
    masterTokenInfo = {},
    selectedPaymentMethod = '',
    preSelectedPaymentMethod,
    selectedContact,
    retrivedContact,
  } = props.route.params;

  const paramsRef = useRef({
    btcAdress,
  });

  const { poolInfoRef, swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { sendWebViewRequest } = useWebView();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { screenDimensions } = useAppStatus();
  const { accountMnemoinc, contactsPrivateKey } = useKeysContext();
  const { sparkInformation, showTokensInformation, sparkInfoRef } =
    useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { liquidNodeInformation, fiatStats } = useNodeContext();

  const { globalContactsInformation } = useGlobalContactsInfo();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();

  const didWarnAboutBudget = useRef(null);
  const [rerenderInput, setRerenderInput] = useState(0);
  const useAltLayout = screenDimensions.height < 720;
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
  const quoteId = useRef(null);

  // Drives the SWAP_RATES_CHANGED uiState when Flashnet rate drift breaks swap viability.
  const [rateChangeDetected, setRateChangeDetected] = useState(false);
  // Captures swapUSDPriceDollars on CONFIRM_PAYMENT entry (ref = no extra re-render).
  const rateAtConfirmEntryRef = useRef(null);

  const [didSelectPaymentMethod, setDidSelectPaymentMethod] = useState(false);
  const [isDecoding, setIsDecoding] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState({});
  const [lnFeeEstimate, setLnFeeEstimate] = useState(
    enteredPaymentInfo?.lnFeeEstimate ?? null,
  );
  const [isEstimatingFee, setIsEstimatingFee] = useState(false);
  const { showToast } = useToast();

  const prevSelectedPaymentInfo = useRef({
    preSelectedPaymentMethod,
    enteredInfo: enteredPaymentInfo?.inputCurrency,
    selectedPaymentMethod,
    selectedLRC20Asset: masterTokenInfo?.tokenName,
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
  const [loadingMessage, setLoadingMessage] = useState(
    sparkInformation.didConnect
      ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
      : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
  );
  const [refreshDecode, setRefreshDecode] = useState(0);
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

  const enabledLRC20 = showTokensInformation;
  const defaultToken = enabledLRC20
    ? masterInfoObject?.defaultSpendToken || 'Bitcoin'
    : 'Bitcoin';

  const useFullTokensDisplay =
    enabledLRC20 &&
    isSparkPayment &&
    paymentInfo?.data?.expectedToken !== USDB_TOKEN_ID &&
    !contactInfo;

  // const showSendMax = !dollarBalanceSat && !bitcoinBalance;

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
  const isUsingLRC20 = selectedLRC20Asset?.toLowerCase() !== 'bitcoin';

  const sendingAmount = paymentInfo?.sendAmount || 0;
  const canEditAmount = paymentInfo?.canEditPayment === true;
  const receiverExpectsCurrency = paymentInfo?.data?.expectedReceive || 'sats';

  // True when the payment amount itself meets the swap minimum for this direction.
  // For editable amounts or zero-amount invoices the user can change the value,
  // so we treat them as viable and let downstream validation enforce the limit.
  const amountViableForSwap = useMemo(() => {
    if (canEditAmount || paymentInfo?.usingZeroAmountInvoice) return true;
    const amountSat = Number(paymentInfo?.amountSat) || 0;

    // BTC→USD swap minimum is expressed in USD, converted to sats
    if (receiverExpectsCurrency === 'tokens')
      return amountSat >= min_usd_swap_amount;
    // USD→BTC swap minimum is expressed directly in sats
    return amountSat >= swapLimits.bitcoin;
  }, [
    canEditAmount,
    paymentInfo?.usingZeroAmountInvoice,
    paymentInfo?.amountSat,
    paymentInfo?.data?.expectedReceive,
    min_usd_swap_amount,
    swapLimits.bitcoin,
    receiverExpectsCurrency,
  ]);

  const resolvedPaymentMethod = useMemo(() => {
    if (!paymentInfo || !Object.keys(paymentInfo || {}).length)
      return undefined;

    if (isBitcoinPayment) return 'BTC';
    if (isUsingLRC20) return 'BTC';
    if (isSparkPayment && useFullTokensDisplay) return 'BTC';
    if (isLightningPayment && paymentInfo?.usingZeroAmountInvoice) return 'BTC';

    const flashnetReady = sparkInformation?.didConnectToFlashnet;
    const receiverExpectsTokens = receiverExpectsCurrency === 'tokens';
    const amountSat = paymentInfo?.amountSat || 0;

    const canUse = method => {
      if (method === 'USD') {
        if (Number(dollarBalanceToken) < 0.01) return false;
        if (receiverExpectsTokens) return dollarBalanceSat >= amountSat;
        return (
          flashnetReady &&
          Number(dollarBalanceToken) >= swapLimits.usd &&
          amountViableForSwap
        );
      } else {
        if (!bitcoinBalance) return false;
        if (receiverExpectsTokens)
          return (
            flashnetReady &&
            bitcoinBalance >= swapLimits.bitcoin &&
            amountViableForSwap
          );
        return bitcoinBalance >= amountSat;
      }
    };

    const resolvePreferred = preferred => {
      if (canUse(preferred)) return preferred;
      const opposite = preferred === 'USD' ? 'BTC' : 'USD';
      if (canUse(opposite)) return opposite;
      return preferred;
    };

    if (preSelectedPaymentMethod)
      return resolvePreferred(preSelectedPaymentMethod);
    if (userPaymentMethod) return userPaymentMethod;
    if (enteredPaymentInfo?.inputCurrency)
      return resolvePreferred(enteredPaymentInfo.inputCurrency);

    const btcViable = canUse('BTC');
    const usdViable = canUse('USD');
    if (btcViable && usdViable)
      return receiverExpectsTokens
        ? dollarBalanceSat >= bitcoinBalance
          ? 'USD'
          : 'BTC'
        : bitcoinBalance >= dollarBalanceSat
        ? 'BTC'
        : 'USD';
    if (btcViable) return 'BTC';
    if (usdViable) return 'USD';
    return 'BTC';
  }, [
    preSelectedPaymentMethod,
    enteredPaymentInfo?.inputCurrency,
    userPaymentMethod,
    paymentInfo,
    dollarBalanceSat,
    dollarBalanceToken,
    bitcoinBalance,
    isBitcoinPayment,
    isUsingLRC20,
    isSparkPayment,
    useFullTokensDisplay,
    isLightningPayment,
    sparkInformation?.didConnectToFlashnet,
    swapLimits,
    canEditAmount,
    min_usd_swap_amount,
    amountViableForSwap,
    receiverExpectsCurrency,
  ]);

  const paymentFee =
    resolvedPaymentMethod === 'USD' && paymentInfo?.usdPaymentFee != null
      ? (paymentInfo.usdPaymentFee || 0) + (paymentInfo.usdSupportFee || 0)
      : (paymentInfo?.paymentFee || 0) + (paymentInfo?.supportFee || 0);

  const effectivePaymentFee =
    isLightningPayment && lnFeeEstimate !== null
      ? lnFeeEstimate + (paymentInfo?.supportFee || 0)
      : paymentFee;

  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
  );

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertSatsToDisplay,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: resolvedPaymentMethod,
    inputDenomination,
    fiatStats,
    usdFiatStats: usdFiatStats,
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

  // fixing static ln amount selector showing logic
  const hasBothUSDAndBitcoinBalance =
    Number(dollarBalanceToken) >= 0.01 && !!bitcoinBalance;

  const requiresUserMethodSelection = useMemo(() => {
    if (
      !!preSelectedPaymentMethod ||
      useFullTokensDisplay ||
      isUsingLRC20 ||
      !hasBothUSDAndBitcoinBalance ||
      didSelectPaymentMethod
    )
      return false;

    if (!sparkInformation?.didConnectToFlashnet) return false;

    if (isBitcoinPayment) return false;

    const formattedFee = isLightningPayment ? effectivePaymentFee : 0;

    const hasEnoughBTC = bitcoinBalance >= convertedSendAmount + formattedFee;
    const hasEnoughUSD = dollarBalanceSat >= convertedSendAmount + formattedFee;

    const canSendWithBTC =
      resolvedPaymentMethod === 'BTC' && receiverExpectsCurrency === 'sats'
        ? hasEnoughBTC
        : hasEnoughBTC && amountViableForSwap;

    const canSendWIthUSD =
      resolvedPaymentMethod === 'USD' && receiverExpectsCurrency === 'tokens'
        ? hasEnoughUSD
        : hasEnoughUSD && amountViableForSwap;

    if (
      (canSendWithBTC && canSendWIthUSD) ||
      (!canSendWithBTC && !canSendWIthUSD)
    )
      return true;
    else return false;
  }, [
    isBitcoinPayment,
    useFullTokensDisplay,
    isUsingLRC20,
    hasBothUSDAndBitcoinBalance,
    didSelectPaymentMethod,
    sparkInformation?.didConnectToFlashnet,
    paymentInfo?.data?.expectedReceive,
    bitcoinBalance,
    dollarBalanceSat,
    amountViableForSwap,
    resolvedPaymentMethod,
    receiverExpectsCurrency,
    preSelectedPaymentMethod,
    isLightningPayment,
  ]);

  const { shouldWarn } = useBudgetWarning(convertedSendAmount);

  useEffect(() => {
    primaryDisplayRef.current = primaryDisplay;
  }, [primaryDisplay]);
  useEffect(() => {
    conversionFiatStatsRef.current = conversionFiatStats;
  }, [conversionFiatStats]);

  useEffect(() => {
    determinePaymentMethodRef.current = resolvedPaymentMethod;
  }, [resolvedPaymentMethod]);

  const estimateLightningFee = useCallback(
    async (amount, id) => {
      if (!amount || !isLightningPayment || !canEditAmount) {
        setIsEstimatingFee(false);
        return;
      }
      if (quoteId.current !== id) return;

      const balance =
        resolvedPaymentMethod === 'USD' ? dollarBalanceSat : bitcoinBalance;
      const bufferAmount = amount * 1.1;

      // Skip if balance easily covers the send + estimated fee buffer, or if
      // already over balance (validation will catch it without needing a fee)
      if (bufferAmount < balance || amount > balance) {
        setIsEstimatingFee(false);
        return;
      }

      try {
        const formattedSparkPaymentInfo = formatSparkPaymentAddress(
          paymentInfo,
          false,
        );
        let invoice = formattedSparkPaymentInfo.address;
        if (paymentInfo.type === InputTypes.LNURL_PAY && !invoice) {
          const invoiceResponse = await getLNAddressForLiquidPayment(
            paymentInfo.decodedInput,
            amount,
          );

          if (!invoiceResponse.pr) throw new Error('No invoice received');
          invoice = invoiceResponse.pr;
          setPaymentInfo(prev => ({
            ...prev,
            data: { ...(prev.data || {}), invoice },
          }));
        }

        if (!invoice) {
          setIsEstimatingFee(false);
          return;
        }
        if (resolvedPaymentMethod === 'USD') {
          const quote = await getLightningPaymentQuote(
            currentWalletMnemoinc,
            invoice,
            USD_ASSET_ADDRESS,
          );
          if (!quote.didWork)
            throw new Error(quote.error || 'Fee quote failed');
          if (quoteId.current !== id) return;
          const fee = quote.quote.fee;
          if (fee + amount > dollarBalanceSat) {
            showToast({
              type: 'error',
              title: t('errormessages.lightningAmountFeeWarning', {
                amount: displayCorrectDenomination({
                  amount: fee,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'sats',
                  },
                  fiatStats,
                }),
              }),
              duration: 6000,
            });
          }
          setLnFeeEstimate(fee);
          setPaymentInfo(prev => ({
            ...prev,
            paymentFee: fee,
            supportFee: prev.supportFee ?? 0,
          }));
        } else {
          const feeResult = await sparkPaymenWrapper({
            getFee: true,
            paymentType: 'lightning',
            address: invoice,
            amountSats: amount,
            masterInfoObject,
            sparkInformation: sparkInfoRef.current,
            mnemonic: currentWalletMnemoinc,
            sendWebViewRequest,
          });
          if (!feeResult.didWork) throw new Error('Fee estimation failed');
          if (quoteId.current !== id) return;
          const fee = feeResult.fee;
          if (fee + amount > bitcoinBalance) {
            showToast({
              type: 'error',
              title: t('errormessages.lightningAmountFeeWarning', {
                amount: displayCorrectDenomination({
                  amount: fee,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'sats',
                  },
                  fiatStats,
                }),
              }),
              duration: 6000,
            });
          }
          setLnFeeEstimate(fee);
          setPaymentInfo(prev => ({
            ...prev,
            paymentFee: fee,
            supportFee: prev.supportFee ?? 0,
          }));
        }
      } catch {
        showToast({
          type: 'error',
          title: t('wallet.sendPages.sendPaymentScreen.feeEstimateError'),
        });
      } finally {
        if (quoteId.current === id) {
          setIsEstimatingFee(false);
        }
      }
    },
    [
      isLightningPayment,
      canEditAmount,
      resolvedPaymentMethod,
      dollarBalanceSat,
      bitcoinBalance,
      paymentInfo,
      currentWalletMnemoinc,
      masterInfoObject,
      fiatStats,
      sparkInfoRef,
      sendWebViewRequest,
      showToast,
      t,
    ],
  );

  const debouncedEstimateFee = useDebounce(estimateLightningFee, 600);

  useEffect(() => {
    inputDenominationRef.current = inputDenomination;
  }, [inputDenomination]);

  // When resolvedPaymentMethod auto-selects USD but the route params didn't
  // initialize paymentMode as USD, seed the denomination to fiat so the user
  // enters amounts in USD rather than sats. Only applies when the user hasn't
  // already toggled the denomination themselves.
  useEffect(() => {
    if (
      resolvedPaymentMethod === 'USD' &&
      paymentMode !== 'USD' &&
      !userSetInputDenomination
    ) {
      setUserSetInputDenomination('fiat');
    }
  }, [resolvedPaymentMethod, paymentMode, userSetInputDenomination]);

  useEffect(() => {
    if (requiresUserMethodSelection && !didRequireChoiceRef.current) {
      didRequireChoiceRef.current = true;
    }
  }, [requiresUserMethodSelection]);

  // Fast pay logic
  const canUseFastPay =
    sparkInformation.didConnect &&
    Object.keys(paymentInfo || {}).length > 0 &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.isFastPayEnabled &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.fastPayThresholdSats >=
      convertedSendAmount &&
    !isUsingLRC20 &&
    (!didRequireChoiceRef.current || didSelectPaymentMethod) &&
    !requiresUserMethodSelection &&
    convertedSendAmount >= effectivePaymentFee;

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
      requiresUserMethodSelection &&
      !isSendingPayment.current &&
      !isBitcoinPayment &&
      !isUsingLRC20 &&
      !canUseFastPay &&
      !preSelectedPaymentMethod &&
      hasBothUSDAndBitcoinBalance
    ) {
      return 'CHOOSE_METHOD'; // Show info screen with button to select method
    }

    return 'CONFIRM_PAYMENT'; // Show swipe button
  }, [
    canEditAmount,
    rateChangeDetected,
    requiresUserMethodSelection,
    didSelectPaymentMethod,
    isBitcoinPayment,
    isUsingLRC20,
    canUseFastPay,
    hasBothUSDAndBitcoinBalance,
    preSelectedPaymentMethod,
  ]);

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    if (
      uiState === 'CONFIRM_PAYMENT' &&
      shouldWarn &&
      !didWarnAboutBudget.current &&
      !isSendingPayment.current &&
      !isDecoding
    ) {
      didWarnAboutBudget.current = true;
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'nearBudgetLimitWarning',
        sliderHight: 0.6,
        sendingAmount: convertedSendAmount,
      });
    }
  }, [uiState, shouldWarn, convertedSendAmount, isDecoding]);

  useEffect(() => {
    if (
      prevSelectedPaymentInfo.current.preSelectedPaymentMethod !==
        preSelectedPaymentMethod ||
      prevSelectedPaymentInfo.current.enteredInfo !==
        enteredPaymentInfo?.inputCurrency ||
      prevSelectedPaymentInfo.current.selectedPaymentMethod !==
        selectedPaymentMethod ||
      prevSelectedPaymentInfo.current.selectedLRC20Asset !== selectedLRC20Asset
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
        selectedLRC20Asset,
      };
    }
  }, [
    preSelectedPaymentMethod,
    enteredPaymentInfo?.inputCurrency,
    selectedPaymentMethod,
    selectedLRC20Asset,
  ]);

  const paymentValidation = usePaymentValidation({
    paymentInfo,
    convertedSendAmount,
    paymentFee: effectivePaymentFee,
    determinePaymentMethod: resolvedPaymentMethod,
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
    poolInfoRef,
  });
  console.log(paymentValidation);

  const canSendPayment =
    paymentValidation.canProceed &&
    sendingAmount !== 0 &&
    uiState === 'CONFIRM_PAYMENT';

  const isUsingFastPay = canUseFastPay && canSendPayment && !canEditAmount;

  // Rate-sensitive swap path: only Flashnet swaps (USD→BTC / BTC→USDB) are affected
  // by live rate changes. Mirrors needsSwap in paymentValidation.
  const needsRateSwap =
    (resolvedPaymentMethod === 'USD' && receiverExpectsCurrency === 'sats') ||
    (resolvedPaymentMethod === 'BTC' && receiverExpectsCurrency === 'tokens');

  // Snapshot + detection effect.
  // Captures the rate on CONFIRM_PAYMENT entry; when a subsequent rate tick
  // breaks swap viability (convertedSendAmount shrinks, min_usd_swap_amount rises),
  // sets rateChangeDetected → transitions to SWAP_RATES_CHANGED uiState.
  // Resets completely when the user leaves the confirm flow.
  useEffect(() => {
    if (isDecoding) return;
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
    isDecoding,
  ]);

  const handleRateChangedReset = useCallback(() => {
    rateAtConfirmEntryRef.current = null;
    setRateChangeDetected(false);
    if (isLNURLPayment || isSparkPayment) {
      // Full reset — mirrors hasParamsChanged effect sequence exactly
      setIsAmountFocused(true);
      setPaymentInfo({});
      setLnFeeEstimate(null);
      setIsEstimatingFee(false);
      isSendingPayment.current = null;
      setPaymentDescription('');
      hasTriggeredFastPay.current = false;
      didRequireChoiceRef.current = false;
      setUserSetInputDenomination(null);
      setLoadingMessage(
        sparkInformation.didConnect && sparkInformation.identityPubKey
          ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
          : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
      );
      setDidSelectPaymentMethod(false);
      setShowProgressAnimation(false);
      setRefreshDecode(x => x + 1);
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
      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: '',
        fromPage: '',
        publishMessageFunc: null,
        comingFromAccept: null,
        enteredPaymentInfo: {},
        errorMessage:
          reason ||
          t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage'),
      });
    },
    [navigate, t],
  );

  useEffect(() => {
    const currentParams = { btcAdress };
    const prevParams = paramsRef.current;

    const hasParamsChanged =
      currentParams.btcAdress &&
      currentParams.btcAdress !== prevParams.btcAdress;

    if (hasParamsChanged) {
      setIsAmountFocused(true);
      setPaymentInfo({});
      setLnFeeEstimate(null);
      setIsEstimatingFee(false);
      isSendingPayment.current = null;
      setPaymentDescription('');
      hasTriggeredFastPay.current = false;
      didRequireChoiceRef.current = false;
      setLoadingMessage(
        !!sparkInformation.didConnect && !!sparkInformation.identityPubKey
          ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
          : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
      );
      setDidSelectPaymentMethod(false);
      setShowProgressAnimation(false);
      setRefreshDecode(x => x + 1);
      paramsRef.current = currentParams;
    }
  }, [
    btcAdress,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    t,
  ]);

  useEffect(() => {
    convertedSendAmountRef.current = convertedSendAmount;
  }, [convertedSendAmount]);

  useEffect(() => {
    if (!canEditAmount || !isLightningPayment) return;
    setLnFeeEstimate(null);
    setPaymentInfo(prev => ({
      ...prev,
      data: { ...(prev.data || {}), invoice: '' },
      paymentFee: 0,
    }));
    if (convertedSendAmount > 0) {
      const id = customUUID();
      quoteId.current = id;
      setIsEstimatingFee(true);
      debouncedEstimateFee(convertedSendAmount, id);
    }
  }, [convertedSendAmount, canEditAmount, isLightningPayment]);

  useEffect(() => {
    async function decodePayment() {
      crashlyticsLogReport('Starting decode address');
      setIsDecoding(true);
      await decodeSendAddress({
        fiatStats,
        btcAdress: paramsRef.current.btcAdress,
        goBackFunction: errorMessageNavigation,
        setPaymentInfo,
        liquidNodeInformation,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: inputDenominationRef.current,
        },
        // setWebViewArgs,
        // webViewRef,
        navigate,
        // maxZeroConf:
        //   minMaxLiquidSwapAmounts?.submarineSwapStats?.limits?.maximalZeroConf,
        comingFromAccept: enteredPaymentInfo.fromContacts,
        enteredPaymentInfo,
        setLoadingMessage,
        paymentInfo,
        fromPage,
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
        sendWebViewRequest,
        contactInfo,
        globalContactsInformation,
        accountMnemoinc,
        usablePaymentMethod:
          userPaymentMethod || determinePaymentMethodRef.current,
        bitcoinBalance,
        dollarBalanceSat,
        convertedSendAmount: convertedSendAmountRef.current,
        poolInfoRef,
        swapLimits,
        // usd_multiplier_coefiicent,
        min_usd_swap_amount,
        primaryDisplay: primaryDisplayRef.current,
        conversionFiatStats: conversionFiatStatsRef.current,
      });
      setIsDecoding(false);
    }

    if (!sparkInformation.didConnect || !sparkInformation.identityPubKey)
      return;
    if (isSendingPayment.current) return;

    requestAnimationFrame(() => {
      decodePayment();
    });
  }, [
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    refreshDecode,
    // selectedPaymentMethod,
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

  const publishMessageFuncForContact = useCallback(
    txid => {
      const UUID = customUUID();
      const sendObject = {
        amountMsat: convertedSendAmountRef.current * 1000,
        uuid: UUID,
        wasSeen: null,
        didSend: null,
        isRedeemed: null,
        description: combinedPaymentDescription || '',
        isRequest: false,
        paymentDenomination: inputDenominationRef.current || 'BTC',
        amountDollars:
          inputDenominationRef.current === 'USD'
            ? satsToDollars(
                convertedSendAmount,
                poolInfoRef.currentPriceAInB,
              ).toFixed(2)
            : null,
        ...(globalContactsInformation.myProfile?.uniqueName
          ? {
              senderProfileSnapshot: {
                uniqueName: globalContactsInformation.myProfile.uniqueName,
              },
            }
          : {}),
      };
      publishMessage({
        toPubKey: selectedContact.uuid,
        fromPubKey: globalContactsInformation.myProfile.uuid,
        data: {
          ...sendObject,
          txid,
          name:
            globalContactsInformation.myProfile?.name ||
            globalContactsInformation.myProfile?.uniqueName,
        },
        globalContactsInformation,
        selectedContact,
        isLNURLPayment: selectedContact?.isLNURL,
        privateKey: contactsPrivateKey,
        retrivedContact,
        currentTime: Date.now(),
        masterInfoObject,
      });
    },
    [
      selectedContact,
      retrivedContact,
      globalContactsInformation,
      contactsPrivateKey,
      masterInfoObject,
      combinedPaymentDescription,
    ],
  );
  const effectivePublishMessageFunc =
    paymentInfo?.publishMessageFunc ||
    publishMessageFunc ||
    (selectedContact ? publishMessageFuncForContact : null);

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
      const formattedSparkPaymentInfo = formatSparkPaymentAddress(
        paymentInfo,
        selectedLRC20Asset?.toLowerCase() !== 'bitcoin',
      );

      const memo =
        paymentInfo.type === InputTypes.BOLT11
          ? enteredPaymentInfo?.description || combinedPaymentDescription
          : combinedPaymentDescription || enteredPaymentInfo?.description;

      const paymentObject = {
        getFee: false,
        ...formattedSparkPaymentInfo,
        isUsingLRC20,
        amountSats: isUsingLRC20
          ? paymentInfo?.sendAmount * 10 ** tokenDecimals
          : convertedSendAmount,
        masterInfoObject,
        fee: paymentFee,
        memo,
        userBalance: bitcoinBalance,
        sparkInformation: sparkInfoRef.current,
        feeQuote: paymentInfo.feeQuote,
        swapPaymentQuote: paymentInfo.swapPaymentQuote,
        usingZeroAmountInvoice: paymentInfo.usingZeroAmountInvoice,
        seletctedToken: selectedLRC20Asset,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
        contactInfo,
        fromMainSendScreen: true,
        usablePaymentMethod: resolvedPaymentMethod,
        paymentInfo,
        fiatValueConvertedSendAmount,
        poolInfoRef,
      };

      const paymentResponse = await sparkPaymenWrapper(paymentObject);

      // Handle deferred save if identityPubKey wasn't available during payment
      if (paymentResponse.shouldSave) {
        let retries = 0;
        const maxRetries = 20; // 10 seconds max wait

        while (!sparkInfoRef.current.identityPubKey && retries < maxRetries) {
          console.log('WATIINT FOR IDENTITY PUBKEY');
          await new Promise(res => setTimeout(res, 500));
          retries++;
        }

        if (sparkInfoRef.current.identityPubKey) {
          const tx = {
            ...paymentResponse.response,
            accountId: sparkInfoRef.current.identityPubKey,
          };
          await bulkUpdateSparkTransactions([tx], 'paymentWrapperTx', 0);
        } else {
          console.error('Failed to get identityPubKey after waiting');
        }

        isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
      }

      if (progressAnimationRef.current) {
        progressAnimationRef.current.completeProgress();
        await new Promise(res => setTimeout(res, 600));
      }

      if (paymentResponse.didWork) {
        if (
          (fromPage === 'contacts' && paymentResponse.response?.id) ||
          fromPage === 'paylink'
        ) {
          effectivePublishMessageFunc(paymentResponse.response.id);
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            navigate.reset({
              index: 0,
              routes: [
                {
                  name: 'HomeAdmin',
                  params: {
                    screen: 'Home',
                  },
                },
                {
                  name: 'ConfirmTxPage',
                  params: {
                    transaction: paymentResponse.response,
                    lnurlAddress:
                      paymentInfo?.type === InputTypes.LNURL_PAY
                        ? normalizeLNURLAddress(paymentInfo?.data?.address)
                        : undefined,
                    blitzContactInfo: paymentInfo?.blitzContactInfo,
                  },
                },
              ],
            });
          });
        });
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            navigate.reset({
              index: 0,
              routes: [
                {
                  name: 'HomeAdmin',
                  params: {
                    screen: 'Home',
                  },
                },
                {
                  name: 'ConfirmTxPage',
                  params: {
                    transaction: paymentResponse.response,
                    error: paymentResponse.error,
                    lnurlAddress:
                      paymentInfo?.type === InputTypes.LNURL_PAY
                        ? normalizeLNURLAddress(paymentInfo?.data?.address)
                        : undefined,
                    blitzContactInfo: paymentInfo?.blitzContactInfo,
                  },
                },
              ],
            });
          });
        });
      }
    } catch (error) {
      console.error('Error in sendPayment:', error);
      // Reset state on error
      isSendingPayment.current = false;
      setShowProgressAnimation(false);
      // Optionally show error to user
      errorMessageNavigation(error.message);
    }
  }, [
    canSendPayment,
    paymentInfo,
    selectedLRC20Asset,
    enteredPaymentInfo,
    combinedPaymentDescription,
    isUsingLRC20,
    tokenDecimals,
    convertedSendAmount,
    masterInfoObject,
    paymentFee,
    bitcoinBalance,
    sparkInformation,
    currentWalletMnemoinc,
    sendWebViewRequest,
    contactInfo,
    fromPage,
    effectivePublishMessageFunc,
    navigate,
    errorMessageNavigation,
    resolvedPaymentMethod,
    fiatValueConvertedSendAmount,
    paymentValidation,
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
          selectedPaymentMethod: resolvedPaymentMethod,
        });
      }
    },
    [navigate, paymentValidation, resolvedPaymentMethod],
  );
  const handleSelectTokenPress = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectLRC20Token',
    });
  }, [navigate]);

  const handleEmoji = newDescription => {
    setPaymentDescription(newDescription);
  };

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

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: !isAmountFocused ? 0 : bottomPadding,
    };
  }, [isAmountFocused, bottomPadding]);

  const sendingAsset =
    selectedLRC20Asset === 'Bitcoin'
      ? !isLightningPayment &&
        !isBitcoinPayment &&
        !(isSparkPayment && receiverExpectsCurrency === 'sats')
        ? t('constants.dollars_upper')
        : t('constants.bitcoin_upper')
      : seletctedToken?.tokenMetadata?.tokenTicker;

  if (
    (!Object.keys(paymentInfo).length && !errorMessage) ||
    !sparkInformation.didConnect
  ) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar />
        <FullLoadingScreen text={loadingMessage} />
      </GlobalThemeView>
    );
  }

  if (errorMessage) {
    return <ErrorWithPayment reason={errorMessage} />;
  }

  return (
    <CustomKeyboardAvoidingView globalThemeViewStyles={memorizedKeyboardStyle}>
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
                maxDecimals={isUsingLRC20 ? tokenDecimals : 2}
              />

              {/* Alternate denomination display */}
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

          {/* Send max button for edit mode */}
          {/* {!useAltLayout && uiState === 'EDIT_AMOUNT' && showSendMax && (
            <SendMaxComponent
              fiatStats={fiatStats}
              sparkInformation={sparkInformation}
              paymentInfo={paymentInfo}
              setPaymentInfo={setPaymentInfo}
              masterInfoObject={masterInfoObject}
              paymentFee={paymentFee}
              paymentType={paymentInfo?.paymentNetwork}
              // minMaxLiquidSwapAmounts={minMaxLiquidSwapAmounts}
              selectedLRC20Asset={selectedLRC20Asset}
              seletctedToken={seletctedToken}
              useAltLayout={useAltLayout}
            />
          )} */}

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
              fromPage={
                fromPage || (paymentInfo?.blitzContactInfo ? 'contacts' : '')
              }
              theme={theme}
              darkModeType={darkModeType}
            />
          )}
          {uiState === 'CHOOSE_METHOD' && (
            <ChoosePaymentMethod
              theme={theme}
              darkModeType={darkModeType}
              determinePaymentMethod={resolvedPaymentMethod}
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

        {/* EDIT_AMOUNT State - Show input controls */}
        {uiState === 'EDIT_AMOUNT' && (
          <>
            {/* Token selector for Spark LRC20 payments */}
            {enabledLRC20 &&
              paymentInfo.type === 'spark' &&
              canEditAmount &&
              useFullTokensDisplay && (
                <ChooseLRC20TokenContainer
                  theme={theme}
                  darkModeType={darkModeType}
                  determinePaymentMethod={resolvedPaymentMethod}
                  handleSelectPaymentMethod={handleSelectTokenPress}
                  bitcoinBalance={bitcoinBalance}
                  dollarBalanceToken={dollarBalanceToken}
                  masterInfoObject={masterInfoObject}
                  fiatStats={fiatStats}
                  uiState={uiState}
                  seletctedToken={seletctedToken}
                  selectedLRC20Asset={selectedLRC20Asset}
                  t={t}
                />
              )}
            {!(
              enabledLRC20 &&
              paymentInfo.type === 'spark' &&
              canEditAmount &&
              useFullTokensDisplay
            ) && (
              <ChoosePaymentMethod
                theme={theme}
                darkModeType={darkModeType}
                determinePaymentMethod={resolvedPaymentMethod}
                handleSelectPaymentMethod={handleSelectPaymentMethod}
                bitcoinBalance={bitcoinBalance}
                dollarBalanceToken={dollarBalanceToken}
                masterInfoObject={masterInfoObject}
                fiatStats={fiatStats}
                uiState={uiState}
                t={t}
                showBitcoinCardOnly={isBitcoinPayment}
              />
            )}
            <CustomSearchInput
              onFocusFunction={() => setIsAmountFocused(false)}
              onBlurFunction={() => setIsAmountFocused(true)}
              placeholderText={t('constants.paymentDescriptionPlaceholder')}
              setInputText={setPaymentDescription}
              inputText={combinedPaymentDescription}
              textInputMultiline={true}
              textAlignVertical={'baseline'}
              maxLength={paymentInfo?.data?.commentAllowed || 150}
              containerStyles={{
                width: INSET_WINDOW_WIDTH,
                marginTop: 10,
                maxWidth: 350,
              }}
            />

            {isAmountFocused && (
              <NumberInputSendPage
                key={`${rerenderInput}-${inputDenomination}`}
                paymentInfo={paymentInfo}
                setPaymentInfo={setPaymentInfo}
                fiatStats={conversionFiatStats}
                selectedLRC20Asset={selectedLRC20Asset}
                seletctedToken={seletctedToken}
                inputDenomination={inputDenomination}
                primaryDisplay={primaryDisplay}
              />
            )}

            {
              // !useAltLayout &&
              isAmountFocused && (
                <AcceptButtonSendPage
                  decodeSendAddress={decodeSendAddress}
                  errorMessageNavigation={errorMessageNavigation}
                  btcAdress={btcAdress}
                  paymentInfo={paymentInfo}
                  convertedSendAmount={convertedSendAmount}
                  paymentDescription={combinedPaymentDescription}
                  setPaymentInfo={setPaymentInfo}
                  setLoadingMessage={setLoadingMessage}
                  fromPage={fromPage}
                  sparkInformation={sparkInformation}
                  seletctedToken={seletctedToken}
                  useAltLayout={false} //will be useAltLayout in future
                  sendWebViewRequest={sendWebViewRequest}
                  globalContactsInformation={globalContactsInformation}
                  canUseFastPay={canUseFastPay}
                  selectedPaymentMethod={resolvedPaymentMethod}
                  bitcoinBalance={bitcoinBalance}
                  dollarBalanceSat={dollarBalanceSat}
                  isDecoding={isDecoding || isEstimatingFee}
                  poolInfoRef={poolInfoRef}
                  swapLimits={swapLimits}
                  min_usd_swap_amount={min_usd_swap_amount}
                  inputDenomination={inputDenomination}
                  paymentValidation={paymentValidation}
                  setDidSelectPaymentMethod={setDidSelectPaymentMethod}
                  conversionFiatStats={conversionFiatStats}
                  primaryDisplay={primaryDisplay}
                />
              )
            }
          </>
        )}

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
              width: INSET_WINDOW_WIDTH,
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

      {/* Emoji bar for description input */}
      {!isAmountFocused && uiState === 'EDIT_AMOUNT' && (
        <EmojiQuickBar
          description={combinedPaymentDescription}
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
