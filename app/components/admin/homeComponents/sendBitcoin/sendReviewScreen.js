import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { InputTypes } from 'bitcoin-address-parser';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  QUICK_PAY_STORAGE_KEY,
  USDB_TOKEN_ID,
} from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../functions/CustomElements/button';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import { SliderProgressAnimation } from '../../../../functions/CustomElements/sendPaymentAnimation';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import KeyValueRow from '../../../../functions/CustomElements/redesign/KeyValueRow';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
} from '../../../../../context-store/sparkContext';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { satsToDollars } from '../../../../functions/spark/flashnet';
import { useAuthContext } from '../../../../../context-store/authContext';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import GetThemeColors from '../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useBudgetWarning } from '../../../../hooks/useBudgetWarning';
import { useChildSpendingLimitGate } from '../../../../hooks/useChildSpendingLimitGate';
import { waitForForground } from '../../../../hooks/useWaitForForground';
import normalizeLNURLAddress from '../../../../functions/lnurl/normalizeLNURLAddress';
import { publishMessage } from '../../../../functions/messaging/publishMessage';
import customUUID from '../../../../functions/customUUID';
import RecipientRow from './components/recipientRow';
import SwapRatesChangedState from './components/swapRatesChangedState';
import formatSparkPaymentAddress from './functions/formatSparkPaymentAddress';
import useSendPaymentDetails from './hooks/useSendPaymentDetails';
import { buildNextParams, requiresMethodChoice } from './functions/sendFlow';
import {
  formatAmountText,
  formatFeeText,
  formatSecondaryText,
} from './functions/formatSendText';

// Route SendReview: shows a prepared payment and sends it.
export default function SendReviewScreen(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const params = props.route.params;
  const {
    fromPage,
    publishMessageFunc,
    paymentInfo,
    enteredPaymentInfo = {},
    contactInfo,
    selectedContact,
    retrivedContact,
    lockedAmount,
    preSelectedPaymentMethod,
  } = params;

  const isSendingPayment = useRef(null);
  const details = useSendPaymentDetails({
    paymentInfo,
    params,
    isSendingPayment: isSendingPayment.current,
  });
  const {
    poolInfoRef,
    swapUSDPriceDollars,
    bitcoinBalance,
    currentWalletMnemoinc,
    contactsPrivateKey,
    sparkInformation,
    sparkInfoRef,
    masterInfoObject,
    globalContactsInformation,
    combinedPaymentDescription,
    isLightningPayment,
    isLiquidPayment,
    isSparkPayment,
    selectedContactInfo,
    selectedLRC20Asset,
    tokenDecimals,
    isUsingLRC20,
    displayTokenTicker,
    sendingAmount,
    receiverExpectsCurrency,
    resolvedPaymentMethod,
    effectivePaymentFee,
    displayAmount,
    convertedSendAmount,
    paymentValidation,
    primaryDisplay,
    isLNURLPayment,
    userPaymentMethod,
    flashnetReady,
  } = details;

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
  const { tokens } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const contentWidth = useContentWidth();

  const didWarnAboutBudget = useRef(null);
  const [showProgressAnimation, setShowProgressAnimation] = useState(false);
  const progressAnimationRef = useRef(null);
  const hasTriggeredFastPay = useRef(false);
  const primaryDisplayRef = useRef(null);
  const isMountedRef = useRef(true);
  const [isSending, setIsSending] = useState(false);

  // Drives the SWAP_RATES_CHANGED state when Flashnet rate drift breaks swap viability.
  const [rateChangeDetected, setRateChangeDetected] = useState(false);
  // Captures swapUSDPriceDollars on entry (ref = no extra re-render).
  const rateAtConfirmEntryRef = useRef(null);
  const uiState = rateChangeDetected ? 'SWAP_RATES_CHANGED' : 'CONFIRM_PAYMENT';

  // use stablepool info ref so the fiat amount doesnt change in between inputs leading to a false amount being sent.
  const fiatValueConvertedSendAmount = Math.round(
    satsToDollars(
      convertedSendAmount,
      enteredPaymentInfo?.stablePoolInfoRef?.currentPriceAInB ||
        poolInfoRef.currentPriceAInB,
    ).toFixed(2) * Math.pow(10, 6),
  );

  const { shouldWarn } = useBudgetWarning(convertedSendAmount);
  const { isOverLimit: isOverChildLimit } =
    useChildSpendingLimitGate(convertedSendAmount);

  useEffect(() => {
    primaryDisplayRef.current = primaryDisplay;
  }, [primaryDisplay]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fast pay logic
  const canUseFastPay =
    sparkInformation.didConnect &&
    Object.keys(paymentInfo || {}).length > 0 &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.isFastPayEnabled &&
    masterInfoObject[QUICK_PAY_STORAGE_KEY]?.fastPayThresholdSats >=
      convertedSendAmount &&
    !isUsingLRC20 &&
    convertedSendAmount >= effectivePaymentFee &&
    !shouldWarn;

  const canSendPayment =
    paymentValidation.canProceed &&
    sendingAmount !== 0 &&
    uiState === 'CONFIRM_PAYMENT';

  const isUsingFastPay = canUseFastPay && canSendPayment;

  // Rate-sensitive swap path: only Flashnet swaps (USD→BTC / BTC→USDB) are affected
  // by live rate changes. Mirrors needsSwap in paymentValidation.
  const needsRateSwap =
    (resolvedPaymentMethod === 'USD' && receiverExpectsCurrency === 'sats') ||
    (resolvedPaymentMethod === 'BTC' && receiverExpectsCurrency === 'tokens');

  // Snapshot + detection effect.
  // Captures the rate on entry; when a subsequent rate tick breaks swap
  // viability (convertedSendAmount shrinks, min_usd_swap_amount rises), sets
  // rateChangeDetected → transitions to the SWAP_RATES_CHANGED state.
  useEffect(() => {
    if (uiState !== 'CONFIRM_PAYMENT') return;
    // Capture rate once on entry
    if (rateAtConfirmEntryRef.current === null) {
      rateAtConfirmEntryRef.current = swapUSDPriceDollars;
    }
    // Detect drift that broke viability
    if (
      rateAtConfirmEntryRef.current !== null &&
      swapUSDPriceDollars !== rateAtConfirmEntryRef.current &&
      // Validation also fails while disconnected, which isn't a rate problem.
      sparkInformation.didConnect &&
      !paymentValidation.canProceed &&
      needsRateSwap &&
      !isSendingPayment.current
    ) {
      setRateChangeDetected(true);
    }
  }, [
    uiState,
    swapUSDPriceDollars,
    paymentValidation.canProceed,
    needsRateSwap,
    sparkInformation.didConnect,
  ]);

  // Back to the keypad with the amount kept. A fixed Spark or LNURL payment has
  // no keypad, so it decodes again for a fresh quote; an invoice can't be redone.
  const handleRateChangedReset = useCallback(() => {
    if (!lockedAmount) navigate.popTo('SendAmount', {}, { merge: true });
    else if (isLNURLPayment || isSparkPayment)
      navigate.replace('ConfirmPaymentScreen', params);
    else navigate.goBack();
  }, [navigate, lockedAmount, isLNURLPayment, isSparkPayment, params]);

  // A method nobody picked can flip when Flashnet connects after this page
  // opened. If both can now pay, the choice goes back to the user.
  const wasFlashnetReady = useRef(flashnetReady);
  useEffect(() => {
    if (wasFlashnetReady.current || !flashnetReady) return;
    wasFlashnetReady.current = true;
    if (userPaymentMethod || isSendingPayment.current) return;
    const needsMethodChoice = requiresMethodChoice({
      paymentInfo,
      balances: details.balanceRef.current,
      resolvedMethod: resolvedPaymentMethod,
      amountSat: convertedSendAmount,
      fee: effectivePaymentFee,
      didSelectPaymentMethod: false,
      flashnetReady,
      swapLimits: details.swapLimits,
      minUsdSwapAmount: details.min_usd_swap_amount,
      isUsingLRC20,
      useFullTokensDisplay: details.useFullTokensDisplay,
      preSelectedPaymentMethod,
    });
    if (needsMethodChoice)
      navigate.replace(
        'SendAmount',
        buildNextParams(params, { lockedAmount: true }),
      );
  }, [flashnetReady]);

  const errorMessageNavigation = useCallback(
    reason => {
      if (!isMountedRef.current) return;
      navigate.replace('ConfirmPaymentScreen', {
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
        amountMsat: convertedSendAmount * 1000,
        uuid: UUID,
        wasSeen: null,
        didSend: null,
        isRedeemed: null,
        description: combinedPaymentDescription || '',
        isRequest: false,
        paymentDenomination:
          paymentInfo.data.expectedReceive === 'tokens' ? 'USD' : 'BTC',
        amountDollars:
          paymentInfo.data.expectedReceive === 'tokens'
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
      paymentInfo,
      convertedSendAmount,
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

    // if (isOverChildLimit) {
    //   navigate.navigate('InformationPopup', {
    //     textContent: t('settings.childAccounts.limitGate.message'),
    //     buttonText: t('constants.understandText'),
    //   });
    //   return;
    // }

    if (isSendingPayment.current) return;

    isSendingPayment.current = true;
    setIsSending(true);
    setShowProgressAnimation(true);
    // Snapshot the auth-reset counter: if a reset lands while the payment is in
    // flight, its result is a bridge-cleanup (not a real outcome) and login
    // navigation has already fired — the send screen must not navigate on it.
    const startAuthResetKey = authResetkeyRef.current;

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
        fee: effectivePaymentFee,
        memo,
        userBalance: bitcoinBalance,
        sparkInformation: sparkInfoRef.current,
        feeQuote: paymentInfo.feeQuote,
        swapPaymentQuote: paymentInfo.swapPaymentQuote,
        usingZeroAmountInvoice: paymentInfo.usingZeroAmountInvoice,
        seletctedToken: selectedLRC20Asset,
        mnemonic: currentWalletMnemoinc,
        contactInfo,
        fromMainSendScreen: true,
        usablePaymentMethod: resolvedPaymentMethod,
        paymentInfo,
        fiatValueConvertedSendAmount,
        poolInfoRef,
        extraDetails: paymentInfo?.isUsingBranta
          ? {
              brantaMerchantName: paymentInfo.brantaMerchantName,
              brantaMerchantLogo: paymentInfo.brantaMerchantLogo,
            }
          : {},
      };

      const paymentResponse = await sparkPaymenWrapper(paymentObject);
      await waitForForground();

      // An auth reset landed mid-payment: this result is a bridge-cleanup, not a
      // real outcome, and login navigation has already fired. Emit nothing and
      // navigate nowhere — only the reset's login navigation should stand.
      if (authResetkeyRef.current !== startAuthResetKey) {
        isSendingPayment.current = false;
        return;
      }

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
          effectivePublishMessageFunc(
            paymentResponse.response.id,
            convertedSendAmount,
          );
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
                    blitzContactInfo: selectedContactInfo,
                    paymentDisplay: primaryDisplayRef.current,
                    displayAmount,
                    displayTokenTicker,
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
                    // Ambiguous failure: the payment may have been sent, so the
                    // confirm page shows a non-final state with no resend.
                    ...(paymentResponse.outcome === 'unknown'
                      ? {
                          paymentStatus: 'unknown',
                          intentId: paymentResponse.intentId,
                        }
                      : {}),
                    lnurlAddress:
                      paymentInfo?.type === InputTypes.LNURL_PAY
                        ? normalizeLNURLAddress(paymentInfo?.data?.address)
                        : undefined,
                    blitzContactInfo: selectedContactInfo,
                    paymentDisplay: primaryDisplayRef.current,
                    displayAmount,
                    displayTokenTicker,
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
      setIsSending(false);
      setShowProgressAnimation(false);
      // A reset intervened → the throw is teardown noise, not a real failure;
      // login navigation has already fired, so don't surface an error screen.
      if (authResetkeyRef.current !== startAuthResetKey) return;
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
    effectivePaymentFee,
    bitcoinBalance,
    sparkInformation,
    currentWalletMnemoinc,
    contactInfo,
    fromPage,
    effectivePublishMessageFunc,
    navigate,
    errorMessageNavigation,
    resolvedPaymentMethod,
    fiatValueConvertedSendAmount,
    paymentValidation,
    displayAmount,
    displayTokenTicker,
    selectedContactInfo,
    isOverChildLimit,
    t,
  ]);

  // Leaving while a payment is in flight would orphan its result.
  const blockBackWhileSending = useCallback(
    () => isSendingPayment.current === true,
    [],
  );
  useHandleBackPressNew(blockBackWhileSending);

  const memorizedKeyboardStyle = useMemo(
    () => ({ paddingBottom: bottomPadding }),
    [bottomPadding],
  );

  // The budget sheet opens on the first slide, once per payment; the slide
  // that follows it sends.
  const handleSwipe = () => {
    if (shouldWarn && !didWarnAboutBudget.current) {
      didWarnAboutBudget.current = true;
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'nearBudgetLimitWarning',
        sliderHight: 0.6,
        sendingAmount: convertedSendAmount,
      });
      return;
    }
    sendPayment();
  };

  const amountText = formatAmountText(displayAmount, details);
  const secondaryText = formatSecondaryText(convertedSendAmount, details);
  const feeAmountText = formatFeeText(effectivePaymentFee, details);
  const feeSpeedText =
    isLightningPayment || isLiquidPayment || isSparkPayment
      ? t('constants.instant')
      : t('wallet.sendPages.feeInfo.tenMinutes', { numMins: 10 });

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={false}
      globalThemeViewStyles={memorizedKeyboardStyle}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('constants.send')}
          showBack={!isSending && !isUsingFastPay}
        />
        <CustomScrollView
          contentContainerStyle={
            uiState === 'SWAP_RATES_CHANGED'
              ? styles.swapContainer
              : styles.scrollContainer
          }
        >
          {uiState === 'SWAP_RATES_CHANGED' ? (
            <SwapRatesChangedState />
          ) : (
            <>
              <View style={styles.hero}>
                <ThemeText
                  styles={[styles.secondary, { color: tokens.muted }]}
                  content={t('wallet.sendPages.reviewParts.sending')}
                />
                <AmountHero
                  amount={amountText}
                  formatAmount={false}
                  amountSize={60}
                />
                {!!secondaryText && (
                  <ThemeText
                    variant="body"
                    CustomNumberOfLines={1}
                    styles={[styles.secondary, { color: tokens.muted }]}
                    content={secondaryText}
                  />
                )}
              </View>
              <ListCard
                style={[
                  styles.card,
                  {
                    marginBottom: CONTENT_KEYBOARD_OFFSET,
                  },
                ]}
              >
                <RecipientRow
                  paymentInfo={paymentInfo}
                  contactInfo={
                    fromPage && fromPage !== 'contacts'
                      ? undefined
                      : selectedContactInfo
                  }
                  isDollarBalance={
                    resolvedPaymentMethod === 'USD' ||
                    selectedLRC20Asset === USDB_TOKEN_ID
                  }
                  isToken={isUsingLRC20 && selectedLRC20Asset !== USDB_TOKEN_ID}
                />
                <KeyValueRow
                  layout="stacked"
                  label={t('wallet.sendPages.feeInfo.title')}
                  value={`${feeAmountText} · ${feeSpeedText}`}
                />
              </ListCard>
            </>
          )}
        </CustomScrollView>

        {uiState === 'SWAP_RATES_CHANGED' ? (
          <CustomButton
            size="regular"
            buttonStyles={styles.rateButton}
            actionFunction={handleRateChangedReset}
            textContent={t(
              'wallet.sendPages.sendPaymentScreen.swapRatesChangedButton',
            )}
          />
        ) : (
          <View style={styles.buttonContainer}>
            {showProgressAnimation || isUsingFastPay ? (
              <SliderProgressAnimation
                ref={progressAnimationRef}
                isVisible={showProgressAnimation || isUsingFastPay}
                textColor={tokens.onAccent}
                backgroundColor={tokens.accent}
                width={1}
              />
            ) : (
              <SwipeButtonNew
                variant="redesign"
                title={t('wallet.sendPages.reviewParts.slideToSend')}
                onSwipeSuccess={handleSwipe}
                resetAfterSuccessAnimDuration={true}
                shouldResetAfterSuccess={
                  !canSendPayment || (shouldWarn && !didWarnAboutBudget.current)
                }
                containerStyles={{
                  opacity: canSendPayment ? 1 : HIDDEN_OPACITY,
                }}
              />
            )}
          </View>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  scrollContainer: { flexGrow: 1, paddingTop: 86 },
  swapContainer: { flexGrow: 1, paddingTop: 132 },
  hero: { alignItems: 'center' },
  secondary: { marginTop: 4 },
  card: { marginTop: 48 },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButton: { alignSelf: 'stretch' },
});
