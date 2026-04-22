import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  IS_SPARK_ID,
} from '../../../../constants';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import SendTransactionFeeInfo from './components/feeInfo';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../hooks/themeColors';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
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
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useKeysContext } from '../../../../../context-store/keys';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import CustomButton from '../../../../functions/CustomElements/button';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import SwapRatesChangedState from './components/swapRatesChangedState';
import {
  BTC_ASSET_ADDRESS,
  calculateFlashnetAmountIn,
  INTEGRATOR_FEE,
  USD_ASSET_ADDRESS,
  dollarsToSats,
  executeSwap,
  getUserSwapHistory,
  satsToDollars,
  simulateSwap,
} from '../../../../functions/spark/flashnet';
import { setFlashnetTransfer } from '../../../../functions/spark/handleFlashnetTransferIds';
import {
  getSingleTxDetails,
  getSparkPaymentStatus,
} from '../../../../functions/spark';
import { validateSplitPayment } from '../../../../functions/payments/validateSplitPayment';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { useBudgetWarning } from '../../../../hooks/useBudgetWarning';

export default function ConfirmSplitPayment(props) {
  const navigate = useNavigation();
  const {
    enteredPaymentInfo = {},
    errorMessage,
    selectedPaymentMethod = '',
    preSelectedPaymentMethod,
    splitRecipients,
    paymentCurrency,
  } = props.route.params;

  const isUSDSplit = paymentCurrency === 'USD';

  const { poolInfoRef, swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { contactsPrivateKey } = useKeysContext();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { globalContactsInformation } = useGlobalContacts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();

  const isSendingPayment = useRef(null);
  const rateAtConfirmEntryRef = useRef(null);
  const swapFeeKeyRef = useRef(null);
  const progressAnimationRef = useRef(null);

  const [sendingMethod, setSendingMethod] = useState(null); // 'BTC' | 'USD'
  const [methodConfirmed, setMethodConfirmed] = useState(false);
  const [paymentFee, setPaymentFee] = useState(0);
  const didWarnAboutBudget = useRef(false);
  const [swapPaymentQuote, setSwapPaymentQuote] = useState({});
  const [rateChangeDetected, setRateChangeDetected] = useState(false);
  const [showProgressAnimation, setShowProgressAnimation] = useState(false);
  const [isCalculatingFeeQuote, setIsCalculatingFeeQuote] = useState(false);
  const [userSetInputDenomination, setUserSetInputDenomination] =
    useState(null);
  const inputDenomination = userSetInputDenomination
    ? userSetInputDenomination
    : isUSDSplit
    ? 'fiat'
    : 'sats';

  // ── Derived totals ──────────────────────────────────────────────────────────

  const totalSplitSats = useMemo(
    () =>
      Math.round(
        splitRecipients?.reduce((sum, r) => sum + (r.amountSats || 0), 0),
      ) || 0,
    [splitRecipients],
  );

  const totalSplitDollars = useMemo(() => {
    if (!isUSDSplit) return 0;
    const cents = splitRecipients?.reduce(
      (sum, r) => sum + (r.amountCents || 0),
      0,
    );
    return (cents || 0) / 100;
  }, [isUSDSplit, splitRecipients]);

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertSatsToDisplay,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: paymentCurrency,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
    isSendingPayment: isSendingPayment.current,
  });

  const displayAmount = convertSatsToDisplay(totalSplitSats);

  const { shouldWarn } = useBudgetWarning(totalSplitSats);

  const handleDenominationToggle = () => {
    // For fixed amounts, just change the display denomination
    const nextDenom = getNextDenomination();
    setUserSetInputDenomination(nextDenom);
    // No need to convert sendingAmount - it stays in sats
    // The display will automatically update via convertSatsToDisplay
  };

  // ── Balance validation ──────────────────────────────────────────────────────

  const { canPayBTC, canPayUSD } = useMemo(() => {
    const price = poolInfoRef.currentPriceAInB;
    return validateSplitPayment({
      totalSats: totalSplitSats,
      paymentCurrency,
      bitcoinBalance,
      dollarBalanceSat,
      swapLimits,
      price,
      masterInfoObject,
      swapUSDPriceDollars,
      t,
    });
    // swapUSDPriceDollars used as reactive proxy for price changes
  }, [
    totalSplitSats,
    paymentCurrency,
    bitcoinBalance,
    dollarBalanceSat,
    swapLimits,
    masterInfoObject,
    swapUSDPriceDollars,
    swapUSDPriceDollars,
  ]);

  console.log(canPayBTC, canPayUSD, 'testing');

  // ── Auto-select / initialize sending method on mount ───────────────────────

  useEffect(() => {
    if (canPayBTC && !canPayUSD) {
      setSendingMethod('BTC');
      setMethodConfirmed(true);
    } else if (canPayUSD && !canPayBTC) {
      setSendingMethod('USD');
      setMethodConfirmed(true);
    } else {
      // Both viable — default to the pre-selected method for the picker display
      const pre = selectedPaymentMethod || preSelectedPaymentMethod;
      setSendingMethod(pre === 'USD' ? 'USD' : 'BTC');
    }
  }, []);

  // ── Watch route params for method selection returning from modal ────────────

  useEffect(() => {
    const method = props.route.params?.selectedPaymentMethod;
    if (method === 'BTC' && canPayBTC) setSendingMethod('BTC');
    else if (method === 'USD' && canPayUSD) setSendingMethod('USD');
  }, [props.route.params?.selectedPaymentMethod, canPayBTC, canPayUSD]);

  // ── UI state machine ────────────────────────────────────────────────────────

  const uiState = useMemo(() => {
    if (rateChangeDetected) return 'SWAP_RATES_CHANGED';
    if (!methodConfirmed) return 'CHOOSE_METHOD';
    return 'CONFIRM_PAYMENT';
  }, [rateChangeDetected, methodConfirmed]);

  // ── Swap detection ──────────────────────────────────────────────────────────

  const needsSwap =
    (isUSDSplit && sendingMethod === 'BTC') ||
    (!isUSDSplit && sendingMethod === 'USD');

  const swapQuoteReady =
    !needsSwap ||
    (!!swapPaymentQuote && Object.keys(swapPaymentQuote).length > 0);

  const canSendPayment =
    uiState === 'CONFIRM_PAYMENT' &&
    totalSplitSats > 0 &&
    swapQuoteReady &&
    !isSendingPayment.current;

  // ── Swap fee calculation ────────────────────────────────────────────────────

  const min_usd_swap_amount = useMemo(
    () =>
      Math.round(dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB)),
    [swapUSDPriceDollars, swapLimits],
  );

  useEffect(() => {
    let cancelled = false;

    const clearSwapFee = () => {
      swapFeeKeyRef.current = null;
      setPaymentFee(0);
      setSwapPaymentQuote({});
      setIsCalculatingFeeQuote(false);
    };

    const runSwapFeeCalc = async () => {
      try {
        if (isSendingPayment.current) return;
        if (!poolInfoRef?.currentPriceAInB || !poolInfoRef?.lpPublicKey) return;
        if (!sendingMethod || !needsSwap) {
          clearSwapFee();
          return;
        }
        setIsCalculatingFeeQuote(true);

        const price = poolInfoRef.currentPriceAInB;

        if (!isUSDSplit && sendingMethod === 'USD') {
          // USD→BTC swap: user pays USD, recipients get BTC
          const shortfallSats = totalSplitSats;
          if (shortfallSats <= 0) {
            clearSwapFee();
            return;
          }

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
          const satFee = Math.round(
            dollarsToSats(fees / Math.pow(10, 6), price),
          );

          setPaymentFee(satFee);
          setSwapPaymentQuote({
            ...result.simulation,
            warn: parseFloat(result.simulation.priceImpact) > 3,
            poolId: poolInfoRef.lpPublicKey,
            assetInAddress: USD_ASSET_ADDRESS,
            assetOutAddress: BTC_ASSET_ADDRESS,
            amountIn: usdAmount,
            satFee,
            bitcoinBalance,
            dollarBalanceSat,
          });
        }

        if (isUSDSplit && sendingMethod === 'BTC') {
          // BTC→USD swap: user pays BTC, recipients get USD
          const satAmount = Math.round(dollarsToSats(totalSplitDollars, price));
          if (satAmount <= 0) {
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
          const satFee = Math.round(
            dollarsToSats(fees / Math.pow(10, 6), price) +
              satAmount * INTEGRATOR_FEE,
          );

          setPaymentFee(satFee);
          setSwapPaymentQuote({
            ...result.simulation,
            warn: parseFloat(result.simulation.priceImpact) > 3,
            poolId: poolInfoRef.lpPublicKey,
            assetInAddress: BTC_ASSET_ADDRESS,
            assetOutAddress: USD_ASSET_ADDRESS,
            amountIn: satAmount,
            satFee,
            bitcoinBalance,
            dollarBalanceSat,
          });
        }
      } catch (err) {
        console.log('error calculating fee quote', err);
      } finally {
        setIsCalculatingFeeQuote(false);
      }
    };

    runSwapFeeCalc();
    return () => {
      cancelled = true;
    };
  }, [
    sendingMethod,
    needsSwap,
    isUSDSplit,
    poolInfoRef,
    totalSplitSats,
    totalSplitDollars,
    bitcoinBalance,
    dollarBalanceSat,
    min_usd_swap_amount,
    swapLimits.bitcoin,
    currentWalletMnemoinc,
  ]);

  // ── Rate-change detection ───────────────────────────────────────────────────

  useEffect(() => {
    if (uiState === 'CONFIRM_PAYMENT') {
      if (rateAtConfirmEntryRef.current === null) {
        rateAtConfirmEntryRef.current = swapUSDPriceDollars;
      }
      if (
        rateAtConfirmEntryRef.current !== null &&
        swapUSDPriceDollars !== rateAtConfirmEntryRef.current &&
        needsSwap &&
        !canSendPayment &&
        !isSendingPayment.current
      ) {
        setRateChangeDetected(true);
      }
    } else if (uiState !== 'SWAP_RATES_CHANGED') {
      rateAtConfirmEntryRef.current = null;
      setRateChangeDetected(false);
    }
  }, [uiState, swapUSDPriceDollars, canSendPayment, needsSwap]);

  useEffect(() => {
    if (
      uiState === 'CONFIRM_PAYMENT' &&
      shouldWarn &&
      !didWarnAboutBudget.current &&
      !isSendingPayment.current
    ) {
      didWarnAboutBudget.current = true;
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'nearBudgetLimitWarning',
        sliderHight: 0.6,
        sendingAmount: totalSplitSats,
      });
    }
  }, [uiState, shouldWarn, totalSplitSats]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRateChangedReset = useCallback(() => {
    rateAtConfirmEntryRef.current = null;
    setRateChangeDetected(false);
    setMethodConfirmed(false);
    setSendingMethod(
      canPayBTC && !canPayUSD
        ? 'BTC'
        : canPayUSD && !canPayBTC
        ? 'USD'
        : sendingMethod,
    );
  }, [canPayBTC, canPayUSD, sendingMethod]);

  const handleSelectPaymentMethod = useCallback(
    showNextScreen => {
      if (showNextScreen) {
        if (!sendingMethod) return;
        setMethodConfirmed(true);
      } else {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'SelectPaymentMethod',
          selectedPaymentMethod: sendingMethod || 'user-choice',
          fromPage: 'ConfirmSplitPayment',
        });
      }
    },
    [navigate, sendingMethod],
  );

  const errorMessageNavigation = useCallback(
    reason => {
      navigate.navigate('ConfirmSplitPayment', {
        enteredPaymentInfo: {},
        splitRecipients,
        errorMessage:
          reason ||
          t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage'),
      });
    },
    [navigate, t, splitRecipients],
  );

  // ── Payment execution ───────────────────────────────────────────────────────
  console.log(swapPaymentQuote);
  const sendPayment = useCallback(async () => {
    if (!canSendPayment) return;
    if (isSendingPayment.current) return;

    isSendingPayment.current = true;
    setShowProgressAnimation(true);

    try {
      const splitMemo = enteredPaymentInfo?.description || '';
      let executionResponse;

      if (needsSwap) {
        if (!swapPaymentQuote || !Object.keys(swapPaymentQuote).length) {
          throw new Error('Swap quote not available');
        }
        if (!poolInfoRef?.currentPriceAInB) {
          throw new Error('Pool info not available');
        }

        if (sendingMethod === 'USD') {
          // USD→BTC swap
          const formatted = calculateFlashnetAmountIn({
            baseAmountIn:
              swapPaymentQuote.amountIn +
              Number(swapPaymentQuote.feePaidAssetIn),
            isUsdAssetIn: true,
            dollarBalanceSat,
            currentPriceAInB: poolInfoRef.currentPriceAInB,
          });
          executionResponse = await executeSwap(currentWalletMnemoinc, {
            poolId: swapPaymentQuote.poolId || poolInfoRef.lpPublicKey,
            assetInAddress: USD_ASSET_ADDRESS,
            assetOutAddress: BTC_ASSET_ADDRESS,
            amountIn: formatted,
          });
        } else {
          // BTC→USD swap
          const formatted = calculateFlashnetAmountIn({
            baseAmountIn:
              swapPaymentQuote.amountIn +
              Math.round(
                dollarsToSats(
                  Number(swapPaymentQuote.feePaidAssetIn) / Math.pow(10, 6),
                ),
              ),
            isUsdAssetIn: false,
            maxBalance: bitcoinBalance,
          });
          executionResponse = await executeSwap(currentWalletMnemoinc, {
            poolId: swapPaymentQuote.poolId || poolInfoRef.lpPublicKey,
            assetInAddress: BTC_ASSET_ADDRESS,
            assetOutAddress: USD_ASSET_ADDRESS,
            amountIn: formatted,
          });
        }

        if (!executionResponse?.didWork) {
          throw new Error(
            executionResponse?.error || 'Error when executing swap',
          );
        }

        const outboundTransferId = executionResponse.swap.outboundTransferId;
        setFlashnetTransfer(outboundTransferId);

        const userSwaps = await getUserSwapHistory(currentWalletMnemoinc, 5);
        if (userSwaps.didWork) {
          const swap = userSwaps.swaps.find(
            s => s.outboundTransferId === outboundTransferId,
          );
          if (swap) setFlashnetTransfer(swap.inboundTransferId);
        }

        const MAX_WAIT_TIME = 60000;
        const startTime = Date.now();
        while (true) {
          if (Date.now() - startTime > MAX_WAIT_TIME)
            throw new Error('Swap completion timeout');

          if (!IS_SPARK_ID.test(outboundTransferId)) {
            await new Promise(res => setTimeout(res, 2500));
            break;
          }

          const sparkTransferResponse = await getSingleTxDetails(
            currentWalletMnemoinc,
            outboundTransferId,
          );
          if (
            getSparkPaymentStatus(sparkTransferResponse?.status) === 'completed'
          )
            break;

          await new Promise(res => setTimeout(res, 1500));
        }

        // small buffer to help smooth things out
        await new Promise(res => setTimeout(res, 1500));
      }

      let effectiveSplitRecipients = splitRecipients;
      if (needsSwap && executionResponse?.swap?.amountOut != null) {
        const amountOut = Number(executionResponse.swap.amountOut);

        if (sendingMethod === 'USD') {
          // USD→BTC: amountOut is in satoshis
          if (amountOut < totalSplitSats) {
            effectiveSplitRecipients = splitRecipients.map(r => ({
              ...r,
              amountSats: Math.floor(
                (r.proportion ?? r.amountSats / totalSplitSats) * amountOut,
              ),
            }));
          }
        } else {
          // BTC→USD: amountOut is in USD base units (10_000 per cent)
          const totalSplitCents = splitRecipients.reduce(
            (sum, r) => sum + (r.amountCents || 0),
            0,
          );
          if (amountOut < totalSplitCents * 10_000) {
            effectiveSplitRecipients = splitRecipients.map(r => ({
              ...r,
              amountCents: Math.floor(
                (r.proportion ?? (r.amountCents || 0) / totalSplitCents) *
                  (amountOut / 10_000),
              ),
            }));
          }
        }
      }

      const swapFee = needsSwap
        ? dollarsToSats(
            executionResponse.swap.feeAmount / Math.pow(10, 6),
            poolInfoRef.currentPriceAInB,
          )
        : 0;

      const result = await bulkSparkPayment(
        currentWalletMnemoinc,
        effectiveSplitRecipients,
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

      isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);

      if (progressAnimationRef.current) {
        progressAnimationRef.current.completeProgress();
        await new Promise(res => setTimeout(res, 600));
      }

      // bug here if tx is undefind we crash the next page
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
                  error: result.error,
                },
              },
            ],
          });
        });
      });
    } catch (error) {
      console.error('ConfirmSplitPayment sendPayment error:', error);
      isSendingPayment.current = false;
      setShowProgressAnimation(false);
      errorMessageNavigation(error.message);
    }
  }, [
    canSendPayment,
    needsSwap,
    swapPaymentQuote,
    sendingMethod,
    enteredPaymentInfo,
    currentWalletMnemoinc,
    splitRecipients,
    paymentCurrency,
    sparkInformation,
    globalContactsInformation,
    contactsPrivateKey,
    masterInfoObject,
    navigate,
    errorMessageNavigation,
    bitcoinBalance,
    dollarBalanceSat,
    poolInfoRef,
  ]);

  // ── Early exit for error state ──────────────────────────────────────────────

  if (errorMessage) {
    return <ErrorWithPayment reason={errorMessage} />;
  }

  // ── Derived display ─────────────────────────────────────────────────────────

  const sendingAsset =
    sendingMethod === 'USD' || (!sendingMethod && isUSDSplit)
      ? t('constants.dollars_upper')
      : t('constants.bitcoin_upper');

  const denomination = isUSDSplit
    ? 'fiat'
    : masterInfoObject.userBalanceDenomination || 'sats';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.replacementContainer}>
        <CustomSettingsTopBar
          label={t('constants.send')}
          containerStyles={{ marginBottom: 0 }}
        />
        <ThemeText styles={styles.sectionTitle} content={sendingAsset} />

        <ScrollView contentContainerStyle={styles.balanceScrollContainer}>
          {/* Amount display — always shown except during rate-change intercept */}
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
              />
              <FormattedSatText
                neverHideBalance={true}
                styles={{
                  includeFontPadding: false,
                }}
                globalBalanceDenomination={secondaryDisplay.denomination}
                forceCurrency={secondaryDisplay.forceCurrency}
                balance={totalSplitSats}
                forceFiatStats={secondaryDisplay.forceFiatStats}
              />
            </TouchableOpacity>
          )}

          {/* Fee info */}
          {uiState === 'CONFIRM_PAYMENT' && (
            <SendTransactionFeeInfo
              paymentFee={paymentFee}
              isSparkPayment={true}
              isDecoding={isCalculatingFeeQuote}
            />
          )}

          {/* Recipient summary */}
          {uiState === 'CONFIRM_PAYMENT' && (
            <InvoiceInfo
              paymentInfo={{
                paymentNetwork: 'spark',
                sendAmount: totalSplitSats,
                canEditPayment: false,
                data: { expectedReceive: isUSDSplit ? 'tokens' : 'sats' },
              }}
              contactInfo={null}
              theme={theme}
              darkModeType={darkModeType}
              isSplitPayment={true}
              splitRecipients={splitRecipients}
            />
          )}

          {/* Payment method picker */}
          {uiState === 'CHOOSE_METHOD' && (
            <ChoosePaymentMethod
              theme={theme}
              darkModeType={darkModeType}
              determinePaymentMethod={
                canPayBTC && canPayUSD
                  ? sendingMethod || 'user-choice'
                  : sendingMethod
              }
              handleSelectPaymentMethod={handleSelectPaymentMethod}
              bitcoinBalance={bitcoinBalance}
              dollarBalanceToken={dollarBalanceToken}
              masterInfoObject={masterInfoObject}
              fiatStats={fiatStats}
              uiState={uiState}
              t={t}
              showBitcoinCardOnly={!canPayUSD}
            />
          )}

          {/* Rates changed */}
          {uiState === 'SWAP_RATES_CHANGED' && <SwapRatesChangedState />}
        </ScrollView>

        {/* CHOOSE_METHOD — continue button */}
        {uiState === 'CHOOSE_METHOD' && (
          <CustomButton
            buttonStyles={{
              ...CENTER,
              width: INSET_WINDOW_WIDTH,
              opacity: sendingMethod ? 1 : HIDDEN_OPACITY,
            }}
            actionFunction={() => handleSelectPaymentMethod(true)}
            textContent={t('constants.review')}
          />
        )}

        {/* SWAP_RATES_CHANGED — reset CTA */}
        {uiState === 'SWAP_RATES_CHANGED' && (
          <CustomButton
            buttonStyles={{ width: INSET_WINDOW_WIDTH, ...CENTER }}
            actionFunction={handleRateChangedReset}
            textContent={t(
              'wallet.sendPages.sendPaymentScreen.swapRatesChangedButton',
            )}
          />
        )}

        {/* CONFIRM_PAYMENT — swipe slider or progress animation */}
        {uiState === 'CONFIRM_PAYMENT' && (
          <View style={styles.buttonContainer}>
            {showProgressAnimation ? (
              <SliderProgressAnimation
                ref={progressAnimationRef}
                isVisible={showProgressAnimation}
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
                shouldResetAfterSuccess={!canSendPayment}
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
  amountDisplay: {
    includeFontPadding: false,
    fontSize: SIZES.large,
    textAlign: 'center',
  },
  balanceScrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
