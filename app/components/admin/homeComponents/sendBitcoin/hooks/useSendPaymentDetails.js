import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { InputTypes } from 'bitcoin-address-parser';
import { USDB_TOKEN_ID } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { dollarsToSats } from '../../../../../functions/spark/flashnet';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../../functions/displayCurrency';
import usePaymentValidation from '../functions/paymentValidation';
import decodeSendAddress from '../functions/decodeSendAdress';
import { resolvePaymentMethod } from '../functions/sendFlow';

// What SendPaymentScreen, SendAmount, SendDescription and SendReview all derive
// from one paymentInfo + route params: token, method, fee, display and validation.
export default function useSendPaymentDetails({
  paymentInfo,
  params,
  isDecoding = false,
  isSendingPayment = false,
}) {
  const {
    btcAdress,
    fromPage,
    enteredPaymentInfo = {},
    contactInfo,
    masterTokenInfo = {},
    selectedPaymentMethod = '',
    preSelectedPaymentMethod,
    paymentDisplayCurrency,
    paymentDisplayFiatStats,
    description = '',
  } = params;

  const { t } = useTranslation();
  const { poolInfoRef, swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();

  // Latest-value ref for balances (same pattern as stablecoinSendScreen). The
  // send-decision memos/effects read balance through this ref instead of the
  // reactive context values, so balance is dropped from their dependency
  // arrays. A burst of incoming payments then can't recompute the payment
  // method mid-send. The actual send still validates against live balance via
  // sparkInfoRef.current.
  const balanceRef = useRef({
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
  });
  balanceRef.current.bitcoinBalance = bitcoinBalance;
  balanceRef.current.dollarBalanceSat = dollarBalanceSat;
  balanceRef.current.dollarBalanceToken = dollarBalanceToken;

  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { accountMnemoinc, contactsPrivateKey, publicKey } = useKeysContext();
  const { sparkInformation, showTokensInformation, sparkInfoRef } =
    useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { liquidNodeInformation, fiatStats } = useNodeContext();
  const { globalContactsInformation } = useGlobalContactsInfo();

  const paymentMode =
    preSelectedPaymentMethod === 'USD' ||
    enteredPaymentInfo?.inputCurrency === 'USD' ||
    selectedPaymentMethod === 'USD'
      ? 'USD'
      : 'BTC';

  const userPaymentMethod = selectedPaymentMethod || preSelectedPaymentMethod;
  const combinedPaymentDescription =
    description || paymentInfo?.data?.label || paymentInfo?.data?.message || '';

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

  const selectedContactInfo = contactInfo || paymentInfo?.blitzContactInfo;

  // Intentionally keyed off `contactInfo` only: including blitzContactInfo here
  // would swap the token selector for the BTC/USD chooser and unpin the payment
  // method for @username sends. Display is handled by the InvoiceInfo props.
  const useFullTokensDisplay =
    enabledLRC20 &&
    isSparkPayment &&
    paymentInfo?.data?.expectedToken !== USDB_TOKEN_ID &&
    !contactInfo;

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

  // Tokens only exist on Spark — a bolt11/on-chain/LNURL invoice can never be
  // funded with the default spend token. Before the decode lands paymentNetwork
  // is undefined, so keep the user's pick: processSparkAddress reads it to
  // decide isLRC20.
  const selectedLRC20Asset =
    !paymentInfo?.paymentNetwork || useFullTokensDisplay
      ? masterTokenInfo?.tokenName || defaultToken
      : 'Bitcoin';
  const seletctedToken =
    masterTokenInfo?.details ||
    sparkInformation?.tokens?.[selectedLRC20Asset] ||
    {};
  const tokenDecimals = seletctedToken?.tokenMetadata?.decimals ?? 0;
  const isUsingLRC20 = selectedLRC20Asset?.toLowerCase() !== 'bitcoin';
  // The ticker actually shown on this screen. USDB-funded sends that weren't
  // picked through the token selector display as fiat, so the confirm screen
  // must be told the label instead of re-deriving it from the tx's token info.
  const displayTokenTicker = isUsingLRC20
    ? seletctedToken?.tokenMetadata?.tokenTicker
    : '';

  const sendingAmount = paymentInfo?.sendAmount || 0;
  const canEditAmount = paymentInfo?.canEditPayment === true;
  const receiverExpectsCurrency = paymentInfo?.data?.expectedReceive || 'sats';
  const flashnetReady = sparkInformation?.didConnectToFlashnet;

  const isBTCOnlyPayment =
    isBitcoinPayment ||
    (isLightningPayment && paymentInfo?.usingZeroAmountInvoice);

  const resolvedPaymentMethod = useMemo(
    () =>
      resolvePaymentMethod({
        paymentInfo,
        // read frozen balance, decoupled from live deps
        balances: balanceRef.current,
        isUsingLRC20,
        useFullTokensDisplay,
        flashnetReady,
        swapLimits,
        minUsdSwapAmount: min_usd_swap_amount,
        preSelectedPaymentMethod,
        userPaymentMethod,
        inputCurrency: enteredPaymentInfo?.inputCurrency,
      }),
    [
      preSelectedPaymentMethod,
      enteredPaymentInfo?.inputCurrency,
      userPaymentMethod,
      paymentInfo,
      isUsingLRC20,
      useFullTokensDisplay,
      flashnetReady,
      swapLimits,
      min_usd_swap_amount,
    ],
  );

  const paymentFee =
    resolvedPaymentMethod === 'USD' && paymentInfo?.usdPaymentFee != null
      ? (paymentInfo.usdPaymentFee || 0) + (paymentInfo.usdSupportFee || 0)
      : (paymentInfo?.paymentFee || 0) + (paymentInfo?.supportFee || 0);

  const lnFeeEstimate = enteredPaymentInfo?.lnFeeEstimate ?? null;
  const effectivePaymentFee =
    isLightningPayment && lnFeeEstimate !== null
      ? lnFeeEstimate + (paymentInfo?.supportFee || 0)
      : paymentFee;

  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  // When arriving from a flow where the user already picked a display rate
  // (e.g. a contact send), honor that currency instead of re-deriving the
  // device-based default. Falls back to the legacy default otherwise.
  const initialDisplayCurrency = useMemo(
    () =>
      paymentDisplayCurrency ||
      getDefaultDisplayCurrency({
        paymentMode: resolvedPaymentMethod || paymentMode,
        masterInfoObject,
        fiatStats,
      }),
    [
      paymentDisplayCurrency,
      resolvedPaymentMethod,
      paymentMode,
      masterInfoObject,
      fiatStats,
    ],
  );
  const additionalRates = useMemo(
    () =>
      paymentDisplayCurrency && paymentDisplayFiatStats?.value
        ? { [paymentDisplayCurrency]: paymentDisplayFiatStats }
        : undefined,
    [paymentDisplayCurrency, paymentDisplayFiatStats],
  );
  const displayController = useDisplayCurrencyController({
    initialCurrency: initialDisplayCurrency,
    fiatStats,
    usdFiatStats,
    masterInfoObject,
    additionalRates,
  });

  const currencyDisplay = useCurrencyDisplay({
    displayCurrency: displayController.displayCurrency,
    fiatStats,
    usdFiatStats,
    currencyRates: displayController.currencyRates,
    masterInfoObject,
    isSendingPayment,
  });
  const { primaryDisplay, conversionFiatStats, convertSatsToDisplay } =
    currencyDisplay;

  // Prefer the user's verbatim entered string (display-truth) when we carried it across
  // the accept/contact handoff and it was entered in the denomination we're now showing.
  // Only genuine fixed-from-invoice amounts (no entry) fall back to reconversion.
  // Guard keys on denomination only (fiat vs sats), not the specific currency: the contact
  // handoff pins paymentDisplayCurrency/paymentDisplayFiatStats and the confirm view hides the
  // currency switcher, so a same-denomination/different-currency mismatch cannot occur here.
  const hasEnteredDisplay =
    paymentInfo?.enteredDisplayAmount != null &&
    paymentInfo?.enteredDisplayAmount !== '' &&
    paymentInfo?.enteredDisplayDenomination === primaryDisplay.denomination;

  const displayAmount = canEditAmount
    ? sendingAmount
    : hasEnteredDisplay
    ? paymentInfo.enteredDisplayAmount
    : convertSatsToDisplay(sendingAmount);

  const convertedSendAmount = !isUsingLRC20
    ? canEditAmount
      ? currencyDisplay.convertDisplayToSats(sendingAmount) // User entered amount, convert to sats
      : Number(sendingAmount) // Fixed invoice amount, already in sats
    : Number(sendingAmount);

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

  // Runs one decode pass and hands the outcome back instead of writing it to a
  // screen, so the caller decides whether a late result still applies.
  const decodePayment = useCallback(
    async ({
      basePaymentInfo,
      comingFromAccept,
      entered,
      usablePaymentMethod,
      amountSat,
      navigate,
      setLoadingMessage = () => {},
    }) => {
      let decoded = null;
      let error = null;
      await decodeSendAddress({
        fiatStats,
        btcAdress,
        goBackFunction: reason => {
          error =
            reason ||
            t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage');
        },
        setPaymentInfo: value => {
          decoded = value;
        },
        liquidNodeInformation,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: primaryDisplay.denomination,
        },
        navigate,
        comingFromAccept,
        enteredPaymentInfo: entered,
        setLoadingMessage,
        paymentInfo: basePaymentInfo,
        parsedInvoice: basePaymentInfo?.decodedInput,
        fromPage,
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
        contactInfo,
        globalContactsInformation,
        accountMnemoinc,
        usablePaymentMethod,
        bitcoinBalance,
        dollarBalanceSat,
        convertedSendAmount: amountSat,
        poolInfoRef,
        swapLimits,
        min_usd_swap_amount,
        primaryDisplay,
        conversionFiatStats,
        contactsPrivateKey,
        publicKey,
      });
      return { decoded, error };
    },
    [
      fiatStats,
      btcAdress,
      t,
      liquidNodeInformation,
      masterInfoObject,
      primaryDisplay,
      fromPage,
      sparkInformation,
      seletctedToken,
      currentWalletMnemoinc,
      contactInfo,
      globalContactsInformation,
      accountMnemoinc,
      bitcoinBalance,
      dollarBalanceSat,
      poolInfoRef,
      swapLimits,
      min_usd_swap_amount,
      conversionFiatStats,
      contactsPrivateKey,
      publicKey,
    ],
  );

  return {
    poolInfoRef,
    swapLimits,
    swapUSDPriceDollars,
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    balanceRef,
    currentWalletMnemoinc,
    contactsPrivateKey,
    sparkInformation,
    sparkInfoRef,
    masterInfoObject,
    fiatStats,
    globalContactsInformation,
    enabledLRC20,
    userPaymentMethod,
    combinedPaymentDescription,
    isLightningPayment,
    isLiquidPayment,
    isBitcoinPayment,
    isSparkPayment,
    isLNURLPayment,
    selectedContactInfo,
    useFullTokensDisplay,
    min_usd_swap_amount,
    selectedLRC20Asset,
    seletctedToken,
    tokenDecimals,
    isUsingLRC20,
    displayTokenTicker,
    sendingAmount,
    canEditAmount,
    receiverExpectsCurrency,
    flashnetReady,
    isBTCOnlyPayment,
    resolvedPaymentMethod,
    effectivePaymentFee,
    displayAmount,
    convertedSendAmount,
    paymentValidation,
    decodePayment,
    ...displayController,
    ...currencyDisplay,
  };
}
