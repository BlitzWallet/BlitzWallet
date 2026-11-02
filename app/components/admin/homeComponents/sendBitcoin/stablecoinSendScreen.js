import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import CurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import PaymentMethod from '../../../../functions/CustomElements/redesign/PaymentMethod';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import KeyValueRow from '../../../../functions/CustomElements/redesign/KeyValueRow';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';

import GetThemeColors from '../../../../hooks/themeColors';
import {
  APPROXIMATE_SYMBOL,
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  USDB_TOKEN_ID,
} from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useKeysContext } from '../../../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
  useSparkWallet,
} from '../../../../../context-store/sparkContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';

import fetchBackend from '../../../../../db/handleBackend';
import { sendSparkPayment, sendSparkTokens } from '../../../../functions/spark';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import {
  calculateFlashnetAmountIn,
  dollarsToSats,
} from '../../../../functions/spark/flashnet';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { formatAmountText, formatFeeText } from './functions/formatSendText';
import { formatStablecoinAmount } from '../../../../functions/sendBitcoin';
import { SliderProgressAnimation } from '../../../../functions/CustomElements/sendPaymentAnimation';
import { formatBalanceAmount } from '../../../../functions';
import { useBudgetWarning } from '../../../../hooks/useBudgetWarning';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../functions/displayCurrency';
import { Image } from 'expo-image';
import { formatCountdown } from '../../../../functions/timeFormatter';
import { useAuthContext } from '../../../../../context-store/authContext';
import { waitForForground } from '../../../../hooks/useWaitForForground';

const QUOTE_TTL_MS = 115_000;

function truncateAddress(addr) {
  if (!addr || addr.length <= 16) return addr || '';
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function StablecoinSendScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  const {
    address,
    chain,
    chainLabel,
    asset,
    selectedPaymentMethod,
    prefillAmount,
  } = route.params;
  const { t } = useTranslation();

  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, tokens } = GetThemeColors();
  const contentWidth = useContentWidth();
  const didWarnAboutBudget = useRef(null);
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { bitcoinBalance, dollarBalanceToken, dollarBalanceSat } =
    useUserBalanceContext();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  // Provider-owned auth-reset counter. A long-background/logout reset bumps it
  // AND navigates to SplashReload (login); it also tears down the WebView
  // bridge, which settles any in-flight/held send with a fabricated cleanup
  // result (didWork:false). That cleanup is NOT a real payment outcome, so the
  // send screen must NOT navigate to the confirm/cancel screen off it —
  // otherwise the user sees the cancel screen flash before login. We snapshot
  // the counter at send-start and skip navigation if a reset intervened. Using
  // the provider's ref (not a consumer mirror) keeps it valid even after this
  // screen is unmounted by the reset's navigation.
  const { authResetkeyRef } = useAuthContext();

  const [screenMode, setScreenMode] = useState('EDIT_AMOUNT'); // 'EDIT_AMOUNT' | 'CONFIRM_PAYMENT'
  const [rawInput, setRawInput] = useState(
    prefillAmount != null ? String(prefillAmount) : '',
  );
  console.log(rawInput);

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [sending, setSending] = useState(false);
  const [retriggerQuoteFetch, setRetriggerQuoteFetch] = useState(0);

  const debounceRef = useRef(null);
  const countdownRef = useRef(null);
  const quoteExpiresAt = useRef(null);
  const isSendingPayment = useRef(null);
  const progressAnimationRef = useRef(null);
  const fetchTokenRef = useRef(0);
  const balanceRef = useRef({
    bitcoin: bitcoinBalance,
    dollarToken: dollarBalanceToken,
  });
  balanceRef.current.bitcoin = bitcoinBalance;
  balanceRef.current.dollarToken = dollarBalanceToken;

  const sourceMethod = selectedPaymentMethod || 'BTC';
  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      sourceMethod === 'USD'
        ? 'USD'
        : getDefaultDisplayCurrency({
            paymentMode: sourceMethod,
            masterInfoObject,
            fiatStats,
          }),
    [sourceMethod, masterInfoObject, fiatStats],
  );

  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });

  useEffect(() => {
    isSendingPayment.current = sending;
  }, [sending]);

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    useCurrencyDisplay({
      displayCurrency: sourceMethod === 'USD' ? 'USD' : displayCurrency,
      fiatStats,
      usdFiatStats,
      currencyRates,
      masterInfoObject,
      isSendingPayment: isSendingPayment.current,
    });

  // Kept current so the success-page handoff reads the live display config
  // rather than a stale value captured in the handleSend useCallback closure.
  const primaryDisplayRef = useRef(primaryDisplay);
  useEffect(() => {
    primaryDisplayRef.current = primaryDisplay;
  }, [primaryDisplay]);

  const convertedSendAmount = convertDisplayToSats(rawInput);

  const { shouldWarn } = useBudgetWarning(convertedSendAmount);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
  }, []);

  const startCountdown = useCallback(
    expiresAt => {
      clearCountdown();
      quoteExpiresAt.current = expiresAt;
      countdownRef.current = setInterval(() => {
        const remaining = quoteExpiresAt.current - Date.now();
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          setCountdown(null);
          setQuote(null);
          setRetriggerQuoteFetch(prev => prev + 1);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    },
    [clearCountdown, t],
  );

  const fetchQuote = useCallback(
    async (sats, myToken) => {
      if (sats <= 0 || !contactsPrivateKey || !publicKey) return;
      setQuoteError(null);
      setQuote(null);
      clearCountdown();
      try {
        const apiSourceMethod = sourceMethod === 'BTC' ? 'spark' : 'usdb';
        // Adding flag for backend to not manipulate the amount so we don't cause balance issues + failures
        const maxBalance =
          sourceMethod === 'BTC'
            ? balanceRef.current.bitcoin
            : balanceRef.current.dollarToken * Math.pow(10, 6);
        const isUsingMax = maxBalance > 0 && sats >= maxBalance * 0.98;

        // ── stale-response guard ──────────────────────────────────────────────
        if (myToken !== fetchTokenRef.current) return;
        const result = await fetchBackend(
          'createFlashnetStablecoinQuoteV2',
          {
            recipientAddress: address,
            destinationChain: chain,
            destinationAsset: asset,
            amountSats: sats,
            sourceMethod: apiSourceMethod,
            refundAddress: sparkInformation.sparkAddress,
            isUsingMax,
          },
          contactsPrivateKey,
          publicKey,
        );

        // ── stale-response guard ──────────────────────────────────────────────
        if (myToken !== fetchTokenRef.current) return;

        if (!result || result.error) {
          const { code, minimumSats } = result.error;

          if (code === 'amount_too_small') {
            if (minimumSats) {
              throw new Error(
                t('flashnetUSDCUSDTMessages.amount_too_small_minimum', {
                  minimumSats,
                }),
              );
            }
            throw new Error(
              t('flashnetUSDCUSDTMessages.amount_too_small_chain_fees'),
            );
          }

          throw new Error(t(`flashnetUSDCUSDTMessages.${code}`));
        }

        const expiresAt = result.expiresAt || Date.now() + QUOTE_TTL_MS;
        const formattedFee =
          sourceMethod === 'BTC'
            ? result.fee
            : dollarsToSats(
                result?.fee / Math.pow(10, 6),
                poolInfoRef.currentPriceAInB,
              );
        setQuote({ ...result, fee: formattedFee, expiresAt });
        startCountdown(expiresAt);
      } catch (err) {
        // Only surface the error if this is still the active request
        if (myToken !== fetchTokenRef.current) return;
        setQuoteError(err.message || t('wallet.stablecoinSend.quoteError'));
      } finally {
        // Only clear loading if this is still the active request
        if (myToken === fetchTokenRef.current) {
          setQuoteLoading(false);
        }
      }
    },
    [
      address,
      chain,
      asset,
      sourceMethod,
      contactsPrivateKey,
      publicKey,
      clearCountdown,
      startCountdown,
      t,
    ],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (rawInput > 0) {
      const exceedsBalance =
        sourceMethod === 'BTC'
          ? convertedSendAmount > balanceRef.current.bitcoin
          : Number(rawInput) > Number(balanceRef.current.dollarToken);

      // Stop quote fetch if we do not have an available balance
      if (exceedsBalance) {
        fetchTokenRef.current += 1;
        setQuoteLoading(false);
        setQuote(null);
        setQuoteError(null);
        clearCountdown();
        return;
      }

      setQuoteLoading(true);
      // Invalidate any in-flight response right now, before the debounce fires.
      fetchTokenRef.current += 1;

      //  Find max balance without going over actual user balance
      const amountIn = calculateFlashnetAmountIn({
        baseAmountIn:
          sourceMethod === 'BTC'
            ? convertDisplayToSats(rawInput)
            : rawInput * Math.pow(10, 6),
        isUsdAssetIn: sourceMethod === 'USD',
        dollarBalanceSat,
        maxBalance: bitcoinBalance,
        currentPriceAInB: poolInfoRef.currentPriceAInB,
        bufferMultiplier: 1,
      });

      debounceRef.current = setTimeout(
        () => fetchQuote(amountIn, fetchTokenRef.current),
        800,
      );
    } else {
      fetchTokenRef.current += 1;
      setQuoteLoading(false);
      setQuote(null);
      setQuoteError(null);
      clearCountdown();
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawInput, sourceMethod, fetchQuote, clearCountdown, retriggerQuoteFetch]);

  useEffect(() => {
    return () => {
      clearCountdown();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [clearCountdown]);

  // Handle back press from CONFIRM_PAYMENT — return to EDIT_AMOUNT
  useEffect(() => {
    const unsubscribe = navigate.addListener('beforeRemove', e => {
      if (screenMode !== 'CONFIRM_PAYMENT') return;
      if (isSendingPayment.current) return;
      e.preventDefault();
      setScreenMode('EDIT_AMOUNT');
    });
    return unsubscribe;
  }, [navigate, screenMode]);

  const openPicker = () => {
    if (isConfirmMode || sourceMethod === 'USD') return;

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.6,
      currentCurrency: displayCurrency,
      onSelectCurrency: async code => {
        const response = await selectCurrency(code);
        if (response?.didWork) setRawInput('');
        return response;
      },
    });
  };

  const handleMethodToggle = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectPaymentMethod',
      selectedPaymentMethod: sourceMethod,
      fromPage: 'StablecoinSendScreen',
    });
  };

  const handleSend = useCallback(async () => {
    if (!quote || sending) return;
    if (Date.now() >= quote.expiresAt) {
      setQuoteError(t('wallet.stablecoinSend.quoteExpired'));
      setQuote(null);
      clearCountdown();
      setScreenMode('EDIT_AMOUNT');
      return;
    }

    setSending(true);
    // Snapshot the auth-reset counter: if a reset lands while the payment is in
    // flight, its result is a bridge-cleanup (not a real outcome) and login
    // navigation has already fired — the send screen must not navigate on it.
    const startAuthResetKey = authResetkeyRef.current;
    isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, true);
    clearCountdown();

    try {
      let result;
      if (sourceMethod === 'BTC') {
        result = await sendSparkPayment({
          receiverSparkAddress: quote.depositAddress,
          amountSats: Number(quote.amountIn),
          mnemonic: currentWalletMnemoinc,
        });
      } else {
        // USDb: quote.amountIn is in token micro-units (e.g. 1_000_000 = $1)
        result = await sendSparkTokens({
          tokenIdentifier: USDB_TOKEN_ID,
          tokenAmount: Number(quote.amountIn),
          receiverSparkAddress: quote.depositAddress,
          mnemonic: currentWalletMnemoinc,
        });
      }

      if (!result.didWork) throw new Error(result.error);

      const sparkTransferId =
        sourceMethod === 'USD' ? result.response : result.response?.id;

      const pendingTx = {
        id: sparkTransferId,
        paymentStatus: 'pending',
        paymentType: 'spark',
        accountId: sparkInformation.identityPubKey,
        details: {
          amount: quote.amountIn,
          fee: quote?.fee,
          totalFee: 0,
          supportFee: 0,
          description: '',
          address: quote.depositAddress,
          sourceSparkAddress: sparkInformation.sparkAddress,
          time: Date.now(),
          createdAt: Date.now(),
          direction: 'OUTGOING',
          isFlashnetStablecoin: true,
          quoteId: quote.quoteId,
          destinationAddress: address,
          destinationChain: chain,
          destinationAsset: asset,
          sourceMethod,
          isLRC20Payment: sourceMethod === 'USD',
          ...(sourceMethod === 'USD' ? { LRC20Token: USDB_TOKEN_ID } : {}),
        },
      };

      await bulkUpdateSparkTransactions([pendingTx], 'fullUpdate');

      fetchBackend(
        'submitFlashnetStablecoinOrder',
        {
          quoteId: quote.quoteId,
          sparkTxHash: sparkTransferId,
          sourceSparkAddress: sparkInformation.sparkAddress,
        },
        contactsPrivateKey,
        publicKey,
      );

      if (progressAnimationRef.current) {
        progressAnimationRef.current.completeProgress();
        await new Promise(res => setTimeout(res, 600));
      }
      await waitForForground();

      // An auth reset landed mid-payment: this result is a bridge-cleanup, not a
      // real outcome, and login navigation has already fired. Emit nothing and
      // navigate nowhere — only the reset's login navigation should stand.
      if (authResetkeyRef.current !== startAuthResetKey) {
        isSendingPayment.current = false;
        return;
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
                  transaction: pendingTx,
                  paymentDisplay: primaryDisplayRef.current,
                  displayAmount: rawInput,
                  stablecoinInfo: { asset, label: chainLabel },
                },
              },
            ],
          });
        });
      });
    } catch (err) {
      console.log(err, 'error navigating to bla bla bla');
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
                  transaction: {},
                  error: err.message,
                  lnurlAddress: undefined,
                  blitzContactInfo: undefined,
                  stablecoinInfo: { asset, label: chainLabel },
                },
              },
            ],
          });
        });
      });
    } finally {
      isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
    }
  }, [
    quote,
    sending,
    sourceMethod,
    navigate,
    currentWalletMnemoinc,
    sparkInformation,
    address,
    chain,
    asset,
    contactsPrivateKey,
    publicKey,
    clearCountdown,
    t,
    rawInput,
    chainLabel,
    asset,
  ]);

  const isQuoteLoading =
    (quoteLoading || (quote && countdown === null)) && !sending;

  const hasEnoughBalance =
    sourceMethod === 'BTC'
      ? convertedSendAmount <= Number(bitcoinBalance)
      : Number(rawInput) <= Number(dollarBalanceToken);

  const canConfirm =
    !!quote &&
    !isQuoteLoading &&
    !sending &&
    convertedSendAmount > 0 &&
    hasEnoughBalance;

  const canReview =
    (convertedSendAmount > 0 && hasEnoughBalance && !sending && quote) ||
    quoteLoading;

  const handleReview = useCallback(() => {
    if (!convertedSendAmount || convertedSendAmount <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.stablecoinSend.noAmount'),
      });
      return;
    }

    if (!hasEnoughBalance) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.insufficientBalance'),
      });
      return;
    }

    if (isQuoteLoading) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.stablecoinSend.quoteStillLoading'),
      });
      return;
    }

    if (quoteError) {
      navigate.navigate('ErrorScreen', { errorMessage: quoteError });
      return;
    }

    if (!quote) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.stablecoinSend.noQuote'),
      });
      return;
    }

    if (Date.now() >= quote.expiresAt) {
      setQuoteError(t('wallet.stablecoinSend.quoteExpired'));
      setQuote(null);
      clearCountdown();
      return;
    }
    setScreenMode('CONFIRM_PAYMENT');
  }, [
    canConfirm,
    quote,
    quoteError,
    clearCountdown,
    t,
    convertedSendAmount,
    isQuoteLoading,
    sourceMethod,
    rawInput,
    bitcoinBalance,
    dollarBalanceToken,
    navigate,
    hasEnoughBalance,
  ]);

  const isConfirmMode = screenMode === 'CONFIRM_PAYMENT';

  const receiveAmountContent = `${APPROXIMATE_SYMBOL}${formatBalanceAmount(
    formatStablecoinAmount(
      quote?.estimatedOut || 0,
      2,
      chain === 'bsc' ? 18 : 6,
    ),
    false,
    masterInfoObject,
  )} ${asset}`;

  useEffect(() => {
    if (
      isConfirmMode &&
      shouldWarn &&
      !didWarnAboutBudget.current &&
      !isSendingPayment.current
    ) {
      didWarnAboutBudget.current = true;
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'nearBudgetLimitWarning',
        sliderHight: 0.6,

        sendingAmount: convertedSendAmount,
      });
    }
  }, [isConfirmMode, shouldWarn, convertedSendAmount]);

  const displayDetails = {
    masterInfoObject,
    primaryDisplay,
    conversionFiatStats,
    fiatStats,
  };
  const amountText = formatAmountText(rawInput || 0, displayDetails);
  const feeText = formatFeeText(
    isQuoteLoading ? 0 : quote?.fee || 0,
    displayDetails,
  );
  const bitcoinAmountText = displayCorrectDenomination({
    amount: quote?.amountIn || 0,
    masterInfoObject: { ...masterInfoObject, userBalanceDenomination: 'sats' },
    fiatStats,
  });
  const usdAmountText = displayCorrectDenomination({
    amount: quote?.amountIn || 0,
    masterInfoObject: { ...masterInfoObject, userBalanceDenomination: 'fiat' },
    forceCurrency: 'USD',
    fiatStats: usdFiatStats,
  });
  const currencyCode = normalizeDisplayCurrency(
    sourceMethod === 'USD' ? 'USD' : displayCurrency,
  );
  // Compare against the amount the user didn't type: sats entry shows USD,
  // USD entry shows bitcoin, any other fiat shows both.
  const showBitcoinRow = sourceMethod === 'BTC' && currencyCode !== 'SATS';
  const showUsdRow = sourceMethod === 'BTC' && currencyCode !== 'USD';
  const countdownDanger =
    countdown != null &&
    countdown < 30000 &&
    (theme && darkModeType ? tokens.ink : tokens.danger);

  return (
    <GlobalThemeView useStandardWidth={false}>
      <View style={[styles.replacementContainer, { width: contentWidth }]}>
        <TopBar
          title={`${t('constants.send')}`}
          right={
            isConfirmMode ? null : (
              <>
                {countdown != null && (
                  <View
                    style={[
                      styles.countdownPill,
                      { backgroundColor: tokens.surface },
                    ]}
                    accessibilityLabel={`${t(
                      'wallet.stablecoinSend.quoteExpiresIn',
                    )} ${formatCountdown(countdown)}`}
                  >
                    <ThemeText
                      styles={[
                        styles.countdownText,
                        !!countdownDanger && { color: countdownDanger },
                      ]}
                      content={formatCountdown(countdown)}
                    />
                  </View>
                )}
                {sourceMethod !== 'USD' && (
                  <CurrencyButton
                    label={currencyCode === 'SATS' ? 'SAT' : currencyCode}
                    onPress={openPicker}
                    disabled={isLoadingRate}
                    accessibilityLabel={t(
                      'settings.nwc.createNWCAmount.changeCurrency',
                    )}
                  />
                )}
              </>
            )
          }
        />

        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <AmountHero
              amount={amountText}
              formatAmount={false}
              mutedValue={!convertedSendAmount}
              amountSize={60}
            />
            <ThemeText
              variant="body"
              CustomNumberOfLines={1}
              styles={[styles.secondary, { color: tokens.muted }]}
              content={`${t(
                'wallet.stablecoinSend.recipientGets',
              )} ${receiveAmountContent}`}
            />
          </View>

          {/* Confirm mode: destination, fee and quote clock */}
          {isConfirmMode && (
            <ListCard style={styles.card}>
              <ListRow
                onPress={() =>
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'sendAddress',
                    address,
                    title: t('wallet.stablecoinSend.networkLabel', {
                      currency: asset,
                      chain: chainLabel,
                    }),
                    sliderHight: 0.6,
                  })
                }
                minHeight={72}
                lead={
                  <View style={styles.confirmIconWrapper}>
                    <View
                      style={[
                        styles.confirmChainCircle,
                        { backgroundColor: tokens.disc },
                      ]}
                    >
                      <Image
                        style={styles.confirmChainIcon}
                        source={ICONS[`chain_${chainLabel?.toLowerCase()}`]}
                        contentFit="contain"
                      />
                    </View>
                    <View
                      style={[
                        styles.confirmCurrencyBadge,
                        { borderColor: tokens.ground },
                      ]}
                    >
                      <Image
                        style={styles.confirmCurrencyIcon}
                        source={ICONS[`${asset?.toLowerCase()}Logo`]}
                        contentFit="contain"
                      />
                    </View>
                  </View>
                }
                title={t('wallet.stablecoinSend.networkLabel', {
                  currency: asset,
                  chain: chainLabel,
                })}
                sub={truncateAddress(address)}
                showChevron
              />
              {showUsdRow && (
                <KeyValueRow
                  mono={false}
                  label={t('wallet.stablecoinSend.usdAmount')}
                  value={usdAmountText}
                />
              )}
              {showBitcoinRow && (
                <KeyValueRow
                  mono={false}
                  label={t('wallet.stablecoinSend.bitcoinAmount')}
                  value={bitcoinAmountText}
                />
              )}
              <KeyValueRow
                mono={false}
                label={t('constants.fee')}
                value={feeText}
              />
              <KeyValueRow
                mono={false}
                label={t('wallet.stablecoinSend.quoteExpiresIn')}
                value={countdown != null ? formatCountdown(countdown) : '—'}
                valueColor={countdownDanger || undefined}
              />
            </ListCard>
          )}
        </CustomScrollView>

        {/* Source method picker: shown in edit mode only */}
        {!isConfirmMode && (
          <PaymentMethod
            determinePaymentMethod={sourceMethod}
            handleSelectPaymentMethod={handleMethodToggle}
            bitcoinBalance={bitcoinBalance}
            dollarBalanceToken={dollarBalanceToken}
            masterInfoObject={masterInfoObject}
            fiatStats={fiatStats}
            uiState="EDIT_AMOUNT"
            t={t}
            containerStyles={{ marginTop: 5 }}
          />
        )}

        {/* EDIT_AMOUNT: keyboard + Review button */}
        {!isConfirmMode && (
          <View style={styles.keyboard}>
            <CustomNumberKeyboard
              setInputValue={setRawInput}
              showDot={primaryDisplay.denomination === 'fiat'}
              fiatStats={conversionFiatStats}
              usingForBalance={true}
              redesign
            />
          </View>
        )}

        {!isConfirmMode && (
          <CustomButton
            size="regular"
            textContent={t('constants.review')}
            actionFunction={handleReview}
            buttonStyles={{
              ...CENTER,
              opacity: canReview ? 1 : HIDDEN_OPACITY,
            }}
            useLoading={isQuoteLoading}
          />
        )}

        {/* CONFIRM_PAYMENT: swipe button */}
        {isConfirmMode && (
          <View style={styles.buttonContainer}>
            {sending ? (
              <SliderProgressAnimation
                ref={progressAnimationRef}
                isVisible={true}
                textColor={tokens.onAccent}
                backgroundColor={
                  theme && darkModeType ? backgroundOffset : tokens.accent
                }
                width={1}
              />
            ) : (
              <SwipeButtonNew
                variant="redesign"
                title={t('wallet.sendPages.reviewParts.slideToSend')}
                onSwipeSuccess={handleSend}
                resetAfterSuccessAnimDuration={true}
                shouldResetAfterSuccess={!sending}
                containerStyles={{
                  opacity: canConfirm ? 1 : HIDDEN_OPACITY,
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
    flex: 1,
    ...CENTER,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 52,
    paddingBottom: 10,
  },
  keyboard: { marginVertical: CONTENT_KEYBOARD_OFFSET },
  hero: { alignItems: 'center' },
  secondary: { marginTop: 4, textAlign: 'center' },
  card: { marginTop: 48 },
  countdownPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownText: {
    fontSize: 14,
    includeFontPadding: false,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIconWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  confirmChainCircle: {
    width: 40,
    height: 40,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmChainIcon: {
    width: 40,
    height: 40,
  },
  confirmCurrencyBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 15,
    bottom: -4,
    right: -4,
    borderWidth: 2,
    overflow: 'hidden',
  },
  confirmCurrencyIcon: {
    width: '100%',
    height: '100%',
  },
});
