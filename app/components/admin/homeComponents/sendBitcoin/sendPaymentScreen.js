import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import {
  CENTER,
  ICONS,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
  USDB_TOKEN_ID,
} from '../../../../constants';
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
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
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
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { SliderProgressAnimation } from '../../../../functions/CustomElements/sendPaymentAnimation';
import { InputTypes } from 'bitcoin-address-parser';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useWebView } from '../../../../../context-store/webViewContext';
import NavBarWithBalance from '../../../../functions/CustomElements/navWithBalance';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { useKeysContext } from '../../../../../context-store/keys';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import CustomButton from '../../../../functions/CustomElements/button';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import {
  dollarsToSats,
  satsToDollars,
} from '../../../../functions/spark/flashnet';
import convertTextInputValue from '../../../../functions/textInputConvertValue';

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
  } = props.route.params;

  const paramsRef = useRef({
    btcAdress,
  });

  const { poolInfoRef, swapLimits } = useFlashnet();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { sendWebViewRequest } = useWebView();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { screenDimensions } = useAppStatus();
  const { accountMnemoinc } = useKeysContext();
  const { sparkInformation, showTokensInformation, sparkInfoRef } =
    useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { liquidNodeInformation, fiatStats } = useNodeContext();

  const { globalContactsInformation } = useGlobalContacts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();

  const useAltLayout = screenDimensions.height < 720;
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [showProgressAnimation, setShowProgressAnimation] = useState(false);
  const progressAnimationRef = useRef(null);
  const hasTriggeredFastPay = useRef(false);
  const convertedSendAmountRef = useRef(null);
  const determinePaymentMethodRef = useRef(null);
  const didRequireChoiceRef = useRef(false);

  const [didSelectPaymentMethod, setDidSelectPaymentMethod] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({});
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination,
  );
  const inputDenominationRef = useRef(inputDenomination);
  const [paymentDescription, setPaymentDescription] = useState('');
  const [loadingMessage, setLoadingMessage] = useState(
    sparkInformation.didConnect
      ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
      : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
  );
  const [refreshDecode, setRefreshDecode] = useState(0);
  const isSendingPayment = useRef(null);

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
      (tokensList.length === 1 && !tokensList.includes(USDB_TOKEN_ID))) &&
    isSparkPayment &&
    paymentInfo?.data?.expectedToken !== USDB_TOKEN_ID &&
    !contactInfo;

  const showSendMax = !dollarBalanceSat && !bitcoinBalance;

  // finds the true min swap amount
  const min_usd_swap_amount = useMemo(() => {
    return Math.round(
      dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB),
    );
  }, [poolInfoRef.currentPriceAInB, swapLimits]);

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

  const fiatValue = fiatStats?.value || 1;

  const convertedSendAmount = !isUsingLRC20
    ? isBTCdenominated
      ? Math.round(Number(sendingAmount))
      : Math.round((SATSPERBITCOIN / fiatValue) * Number(sendingAmount))
    : Number(sendingAmount);

  const fiatValueConvertedSendAmount =
    satsToDollars(convertedSendAmount, poolInfoRef.currentPriceAInB) *
    Math.pow(10, 6);

  const paymentFee =
    !selectedPaymentMethod || selectedPaymentMethod === 'BTC'
      ? (paymentInfo?.paymentFee || 0) + (paymentInfo?.supportFee || 0)
      : paymentInfo?.swapPaymentQuote?.fee +
          paymentInfo?.swapPaymentQuote?.estimatedLightningFee || 0;

  console.log(paymentInfo, 'payment info');

  const determinePaymentMethod = useMemo(() => {
    // If using LRC20, payment method is not relevant
    if (isUsingLRC20) return 'BTC';

    if (isBitcoinPayment) return 'BTC';

    // If user already selected a method, use it
    if (selectedPaymentMethod) return selectedPaymentMethod;

    // Check user balances
    const hasBTCBalance = sparkBalance >= convertedSendAmount + paymentFee;
    const hasUSDBalance = dollarBalanceSat >= convertedSendAmount + paymentFee;

    // Check swap limits
    const meetsUSDMinimum = convertedSendAmount >= min_usd_swap_amount;
    const meetsBTCMinimum = convertedSendAmount >= swapLimits.bitcoin;

    if (!Object.keys(paymentInfo).length) return;

    // If payment is Spark
    if (paymentInfo.type === 'spark') {
      // If using full token display (multiple tokens), always use BTC
      if (useFullTokensDisplay) return 'BTC';

      // Receiver expects BTC
      if (paymentInfo.data.expectedReceive === 'sats') {
        // BTC → BTC Spark (no swap needed)
        const canPayBTCtoBTC = hasBTCBalance;

        // USD → BTC Spark (requires swap, check minimums)
        const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

        if (canPayBTCtoBTC && canPayUSDtoBTC) {
          return 'user-choice'; // User can choose
        }
        return canPayBTCtoBTC ? 'BTC' : canPayUSDtoBTC ? 'USD' : 'BTC';
      }
      // Receiver expects USD
      else {
        // USD → USD Spark (no swap needed)
        const canPayUSDtoUSD = hasUSDBalance;

        // BTC → USD Spark (requires swap, check minimums)
        const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;

        if (canPayUSDtoUSD && canPayBTCtoUSD) {
          return 'user-choice'; // User can choose
        }
        return canPayUSDtoUSD ? 'USD' : canPayBTCtoUSD ? 'BTC' : 'USD';
      }
    }

    // (always receive as BTC)
    // BTC → BTC (no swap)
    const canPayBTCtoBTC = hasBTCBalance;

    // USD → BTC (requires swap, check minimums)
    const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

    if (canPayBTCtoBTC && canPayUSDtoBTC) {
      return 'user-choice'; // User can choose
    }
    return canPayBTCtoBTC ? 'BTC' : canPayUSDtoBTC ? 'USD' : 'BTC';
  }, [
    isUsingLRC20,
    isBitcoinPayment,
    selectedPaymentMethod,
    paymentInfo,
    sparkBalance,
    dollarBalanceSat,
    convertedSendAmount,
    min_usd_swap_amount,
    useFullTokensDisplay,
  ]);

  useEffect(() => {
    determinePaymentMethodRef.current = determinePaymentMethod;
  }, [determinePaymentMethod]);

  useEffect(() => {
    inputDenominationRef.current = inputDenomination;
  }, [inputDenomination]);

  const needsToChoosePaymentMethod =
    determinePaymentMethod === 'user-choice' &&
    !selectedPaymentMethod &&
    !useFullTokensDisplay &&
    !didSelectPaymentMethod;

  useEffect(() => {
    if (needsToChoosePaymentMethod && !didRequireChoiceRef.current) {
      didRequireChoiceRef.current = true;
    }
  }, [needsToChoosePaymentMethod]);

  const canEditAmount = paymentInfo?.canEditPayment === true;

  // Fast pay logic
  const canUseFastPay =
    sparkInformation.didConnect &&
    Object.keys(paymentInfo || {}).length > 0 &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.isFastPayEnabled &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.fastPayThresholdSats >=
      convertedSendAmount &&
    !isUsingLRC20 &&
    (!didRequireChoiceRef.current || didSelectPaymentMethod) &&
    determinePaymentMethod !== 'user-choice';

  // Check if user has sufficient balance
  const hasSufficientBalance = useMemo(() => {
    if (!sendingAmount) return false;
    if (isUsingLRC20) return true;
    if (!determinePaymentMethod) return false;

    const totalCost = convertedSendAmount + paymentFee;
    const receiverExpectsCurrency = paymentInfo.data.expectedReceive || 'sats';

    // Check if we need a swap and if it meets minimums
    const needsSwap =
      (determinePaymentMethod === 'USD' &&
        receiverExpectsCurrency === 'sats') ||
      (determinePaymentMethod === 'BTC' &&
        receiverExpectsCurrency === 'tokens');

    if (needsSwap) {
      if (determinePaymentMethod === 'USD') {
        // USD → BTC swap
        if (convertedSendAmount < min_usd_swap_amount) return false;
      } else {
        // BTC → USD swap
        if (convertedSendAmount < swapLimits.bitcoin) return false;
      }
    }

    if (determinePaymentMethod === 'USD') {
      return dollarBalanceSat >= totalCost;
    } else {
      return sparkBalance >= totalCost;
    }
  }, [
    sendingAmount,
    convertedSendAmount,
    paymentFee,
    determinePaymentMethod,
    paymentInfo?.data?.expectedCurrency,
    dollarBalanceSat,
    sparkBalance,
    min_usd_swap_amount,
    swapLimits.bitcoin,
    isUsingLRC20,
  ]);

  const uiState = useMemo(() => {
    if (canEditAmount && !isSendingPayment.current) {
      return 'EDIT_AMOUNT'; // Show number pad + description input
    }

    if (
      (needsToChoosePaymentMethod || !didSelectPaymentMethod) &&
      !isSendingPayment.current &&
      !isBitcoinPayment &&
      !isUsingLRC20 &&
      !canUseFastPay
    ) {
      return 'CHOOSE_METHOD'; // Show info screen with button to select method
    }

    return 'CONFIRM_PAYMENT'; // Show swipe button
  }, [
    canEditAmount,
    needsToChoosePaymentMethod,
    didSelectPaymentMethod,
    isBitcoinPayment,
    isUsingLRC20,
    canUseFastPay,
  ]);

  const paymentValidation = usePaymentValidation({
    paymentInfo,
    convertedSendAmount,
    paymentFee,
    determinePaymentMethod,
    selectedPaymentMethod,
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
    inputDenomination,
  });
  console.log(paymentValidation);

  const canSendPayment =
    paymentValidation.canProceed &&
    sendingAmount !== 0 &&
    uiState === 'CONFIRM_PAYMENT';

  const isUsingFastPay = canUseFastPay && canSendPayment && !canEditAmount;

  const minLNURLSatAmount = isLNURLPayment
    ? paymentInfo?.data?.minSendable / 1000
    : 0;
  const maxLNURLSatAmount = isLNURLPayment
    ? paymentInfo?.data?.maxSendable / 1000
    : 0;

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
        comingFromAccept,
        enteredPaymentInfo,
        setLoadingMessage,
        paymentInfo,
        fromPage,
        publishMessageFunc,
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
        sendWebViewRequest,
        contactInfo,
        globalContactsInformation,
        accountMnemoinc,
        usablePaymentMethod: determinePaymentMethodRef.current,
        bitcoinBalance,
        dollarBalanceSat,
        convertedSendAmount: convertedSendAmountRef.current,
        poolInfoRef,
        swapLimits,
        // usd_multiplier_coefiicent,
        min_usd_swap_amount,
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

  const sendPayment = useCallback(async () => {
    if (!canSendPayment) return;
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
          ? enteredPaymentInfo?.description ||
            paymentDescription ||
            paymentInfo?.data.message ||
            ''
          : paymentDescription || paymentInfo?.data.message || '';

      const paymentObject = {
        getFee: false,
        ...formattedSparkPaymentInfo,
        isUsingLRC20,
        amountSats: isUsingLRC20
          ? paymentInfo?.sendAmount * 10 ** tokenDecimals
          : paymentInfo?.type === 'Bitcoin'
          ? convertedSendAmount + (paymentInfo?.paymentFee || 0)
          : convertedSendAmount,
        masterInfoObject,
        fee: paymentFee,
        memo,
        userBalance: sparkBalance,
        sparkInformation: sparkInfoRef.current,
        feeQuote: paymentInfo.feeQuote,
        swapPaymentQuote: paymentInfo.swapPaymentQuote,
        usingZeroAmountInvoice: paymentInfo.usingZeroAmountInvoice,
        seletctedToken: selectedLRC20Asset,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
        contactInfo,
        fromMainSendScreen: true,
        usablePaymentMethod: determinePaymentMethod,
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
        if (fromPage === 'contacts' && paymentResponse.response?.id) {
          publishMessageFunc(paymentResponse.response.id);
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
    paymentDescription,
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
    fromPage,
    publishMessageFunc,
    navigate,
    errorMessageNavigation,
    determinePaymentMethod,
    fiatValueConvertedSendAmount,
  ]);

  const handleSelectPaymentMethod = useCallback(
    showNextScreen => {
      if (showNextScreen) {
        if (!paymentValidation.isValid) {
          const errorMessage = paymentValidation.getErrorMessage(
            paymentValidation.primaryError,
          );
          navigate.navigate('ErrorScreen', { errorMessage });
          return;
        }

        setDidSelectPaymentMethod(true);
      } else {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'SelectPaymentMethod',
          selectedPaymentMethod: determinePaymentMethod,
        });
      }
    },
    [navigate, paymentValidation, determinePaymentMethod],
  );
  const handleSelectTokenPress = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectLRC20Token',
    });
  }, [navigate]);

  const handleEmoji = newDescription => {
    setPaymentDescription(newDescription);
  };

  const handleBackpress = useCallback(() => {
    keyboardGoBack(navigate);
  }, [navigate]);

  useHandleBackPressNew(handleBackpress);

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
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={{
        paddingBottom: !isAmountFocused ? 0 : bottomPadding,
      }}
    >
      <View style={styles.replacementContainer}>
        <NavBarWithBalance
          seletctedToken={seletctedToken}
          selectedLRC20Asset={selectedLRC20Asset}
          backFunction={handleBackpress}
          useFrozen={true}
        />

        {/* Token selector for Spark LRC20 payments */}
        {enabledLRC20 &&
          paymentInfo.type === 'spark' &&
          canEditAmount &&
          useFullTokensDisplay && (
            <TouchableOpacity onPress={handleSelectTokenPress}>
              <ThemeText
                styles={styles.selectTokenText}
                content={t(
                  'wallet.sendPages.sendPaymentScreen.switchTokenText',
                )}
              />
            </TouchableOpacity>
          )}

        <ScrollView contentContainerStyle={styles.balanceScrollContainer}>
          {/* Amount display */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (!isAmountFocused) return;
              if (isUsingLRC20) return;
              if (uiState !== 'EDIT_AMOUNT') return;
              setInputDenomination(prev => {
                const newPrev =
                  prev === 'sats' || prev === 'hidden' ? 'fiat' : 'sats';
                return newPrev;
              });

              setPaymentInfo(prev => {
                return {
                  ...prev,
                  sendAmount: convertTextInputValue(
                    sendingAmount,
                    fiatStats,
                    inputDenomination,
                  ),
                };
              });
            }}
          >
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={sendingAmount}
              inputDenomination={inputDenomination}
              activeOpacity={!sendingAmount ? 0.5 : 1}
              customCurrencyCode={
                isUsingLRC20 ? seletctedToken?.tokenMetadata?.tokenTicker : ''
              }
            />

            {/* Alternate denomination display */}
            {/* {isUsingLRC20 && (
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{opacity: !sendingAmount ? 0.5 : 1}}
            styles={{includeFontPadding: false, ...styles.satValue}}
            customLabel={seletctedToken?.tokenMetadata?.tokenTicker}
            useCustomLabel={true}
            balance={formatTokensNumber(
              convertedSendAmount,
              seletctedToken?.tokenMetadata?.decimals,
            )}
          />
        )} */}
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
                globalBalanceDenomination={
                  inputDenomination === 'sats' || inputDenomination === 'hidden'
                    ? 'fiat'
                    : 'sats'
                }
                balance={convertedSendAmount}
              />
            )}
          </TouchableOpacity>

          {/* Send max button for edit mode */}
          {!useAltLayout && uiState === 'EDIT_AMOUNT' && showSendMax && (
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
              contactInfo={contactInfo}
              fromPage={fromPage}
              theme={theme}
              darkModeType={darkModeType}
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
        </ScrollView>

        {/* EDIT_AMOUNT State - Show input controls */}
        {uiState === 'EDIT_AMOUNT' && (
          <>
            {!(
              enabledLRC20 &&
              paymentInfo.type === 'spark' &&
              canEditAmount &&
              useFullTokensDisplay
            ) &&
              !isBitcoinPayment && (
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
            <CustomSearchInput
              onFocusFunction={() => setIsAmountFocused(false)}
              onBlurFunction={() => setIsAmountFocused(true)}
              placeholderText={t(
                'wallet.sendPages.sendPaymentScreen.descriptionPlaceholder',
              )}
              setInputText={setPaymentDescription}
              inputText={paymentDescription}
              textInputMultiline={true}
              textAlignVertical={'baseline'}
              textInputStyles={{
                borderRadius: useAltLayout ? 15 : 8,
              }}
              maxLength={paymentInfo?.data?.commentAllowed || 150}
              containerStyles={{
                width: INSET_WINDOW_WIDTH,
                marginTop: useAltLayout ? 0 : 10,
                maxWidth: 350,
              }}
            />

            {useAltLayout && (
              <View style={styles.maxAndAcceptContainer}>
                {showSendMax && (
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
                )}
                <AcceptButtonSendPage
                  isLiquidPayment={isLiquidPayment}
                  canSendPayment={canSendPayment}
                  decodeSendAddress={decodeSendAddress}
                  errorMessageNavigation={errorMessageNavigation}
                  btcAdress={btcAdress}
                  paymentInfo={paymentInfo}
                  convertedSendAmount={convertedSendAmount}
                  paymentDescription={paymentDescription}
                  setPaymentInfo={setPaymentInfo}
                  setLoadingMessage={setLoadingMessage}
                  fromPage={fromPage}
                  publishMessageFunc={publishMessageFunc}
                  // webViewRef={webViewRef}
                  minLNURLSatAmount={minLNURLSatAmount}
                  maxLNURLSatAmount={maxLNURLSatAmount}
                  sparkInformation={sparkInformation}
                  seletctedToken={seletctedToken}
                  isLRC20Payment={isUsingLRC20}
                  useAltLayout={useAltLayout}
                  sendWebViewRequest={sendWebViewRequest}
                  globalContactsInformation={globalContactsInformation}
                  canUseFastPay={canUseFastPay}
                  selectedPaymentMethod={determinePaymentMethod}
                  bitcoinBalance={bitcoinBalance}
                  dollarBalanceSat={dollarBalanceSat}
                  needsToChoosePaymentMethod={needsToChoosePaymentMethod}
                  isDecoding={isDecoding}
                  poolInfoRef={poolInfoRef}
                  swapLimits={swapLimits}
                  // usd_multiplier_coefiicent={usd_multiplier_coefiicent}
                  min_usd_swap_amount={min_usd_swap_amount}
                  hasSufficientBalance={hasSufficientBalance}
                  inputDenomination={inputDenomination}
                  paymentValidation={paymentValidation}
                  setDidSelectPaymentMethod={setDidSelectPaymentMethod}
                />
              </View>
            )}

            {isAmountFocused && (
              <NumberInputSendPage
                paymentInfo={paymentInfo}
                setPaymentInfo={setPaymentInfo}
                fiatStats={fiatStats}
                selectedLRC20Asset={selectedLRC20Asset}
                seletctedToken={seletctedToken}
                inputDenomination={inputDenomination}
              />
            )}

            {!useAltLayout && isAmountFocused && (
              <AcceptButtonSendPage
                isLiquidPayment={isLiquidPayment}
                canSendPayment={canSendPayment}
                decodeSendAddress={decodeSendAddress}
                errorMessageNavigation={errorMessageNavigation}
                btcAdress={btcAdress}
                paymentInfo={paymentInfo}
                convertedSendAmount={convertedSendAmount}
                paymentDescription={paymentDescription}
                setPaymentInfo={setPaymentInfo}
                setLoadingMessage={setLoadingMessage}
                fromPage={fromPage}
                publishMessageFunc={publishMessageFunc}
                // webViewRef={webViewRef}
                minLNURLSatAmount={minLNURLSatAmount}
                maxLNURLSatAmount={maxLNURLSatAmount}
                sparkInformation={sparkInformation}
                seletctedToken={seletctedToken}
                isLRC20Payment={isUsingLRC20}
                useAltLayout={useAltLayout}
                sendWebViewRequest={sendWebViewRequest}
                globalContactsInformation={globalContactsInformation}
                canUseFastPay={canUseFastPay}
                selectedPaymentMethod={determinePaymentMethod}
                bitcoinBalance={bitcoinBalance}
                dollarBalanceSat={dollarBalanceSat}
                needsToChoosePaymentMethod={needsToChoosePaymentMethod}
                isDecoding={isDecoding}
                poolInfoRef={poolInfoRef}
                swapLimits={swapLimits}
                // usd_multiplier_coefiicent={usd_multiplier_coefiicent}
                min_usd_swap_amount={min_usd_swap_amount}
                hasSufficientBalance={hasSufficientBalance}
                inputDenomination={inputDenomination}
                paymentValidation={paymentValidation}
                setDidSelectPaymentMethod={setDidSelectPaymentMethod}
              />
            )}
          </>
        )}

        {/* SELECT_PAYMENT method state - show button to take user to select half modal */}
        {uiState === 'CHOOSE_METHOD' && (
          <CustomButton
            buttonStyles={{
              ...CENTER,
              opacity: paymentValidation.isValid ? 1 : HIDDEN_OPACITY,
            }}
            actionFunction={() => handleSelectPaymentMethod(true)}
            textContent={t('constants.review')}
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
