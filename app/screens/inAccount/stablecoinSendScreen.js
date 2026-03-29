import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import FormattedBalanceInput from '../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../functions/CustomElements/customNumberKeyboard';
import CustomSearchInput from '../../functions/CustomElements/searchInput';
import ChoosePaymentMethod from '../../components/admin/homeComponents/sendBitcoin/components/choosePaymentMethodContainer';
import SwipeButtonNew from '../../functions/CustomElements/sliderButton';

import GetThemeColors from '../../hooks/themeColors';
import { CENTER, COLORS, SIZES, USDB_TOKEN_ID } from '../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../constants/theme';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useKeysContext } from '../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useUserBalanceContext } from '../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../context-store/context';

import fetchBackend from '../../../db/handleBackend';
import { sendSparkPayment, sendSparkTokens } from '../../functions/spark';
import { bulkUpdateSparkTransactions } from '../../functions/spark/transactions';
import { dollarsToSats, satsToDollars } from '../../functions/spark/flashnet';
import EmojiQuickBar from '../../functions/CustomElements/emojiBar';
import usePaymentInputDisplay from '../../hooks/usePaymentInputDisplay';
import convertTextInputValue from '../../functions/textInputConvertValue';
import SendTransactionFeeInfo from '../../components/admin/homeComponents/sendBitcoin/components/feeInfo';
import { formatStablecoinAmount } from '../../functions/sendBitcoin';
import { SliderProgressAnimation } from '../../functions/CustomElements/sendPaymentAnimation';

const QUOTE_TTL_MS = 115_000;

function truncateAddress(addr) {
  if (!addr || addr.length <= 16) return addr || '';
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatCountdown(ms) {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function StablecoinSendScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  const { address, chain, chainLabel, asset, selectedPaymentMethod } =
    route.params;
  const { t } = useTranslation();

  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();

  const [screenMode, setScreenMode] = useState('EDIT_AMOUNT'); // 'EDIT_AMOUNT' | 'CONFIRM_PAYMENT'
  const [rawInput, setRawInput] = useState('');
  const [inputDenomination, setInputDenomination] = useState('fiat');

  const [description, setDescription] = useState('');

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [sending, setSending] = useState(false);
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [retriggerQuoteFetch, setRetriggerQuoteFetch] = useState(0);

  const debounceRef = useRef(null);
  const countdownRef = useRef(null);
  const quoteExpiresAt = useRef(null);
  const isSendingPayment = useRef(null);
  const progressAnimationRef = useRef(null);

  const sourceMethod = selectedPaymentMethod || 'BTC';

  useEffect(() => {
    isSendingPayment.current = sending;
  }, [sending]);

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertSatsToDisplay,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: sourceMethod,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
    isSendingPayment: isSendingPayment.current,
  });

  const convertedSendAmount = convertDisplayToSats(rawInput);

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
    async sats => {
      if (sats <= 0 || !contactsPrivateKey || !publicKey) return;
      setQuoteError(null);
      setQuote(null);
      clearCountdown();
      try {
        const apiSourceMethod = sourceMethod === 'BTC' ? 'spark' : 'usdb';
        const result = await fetchBackend(
          'createFlashnetStablecoinQuote',
          {
            recipientAddress: address,
            destinationChain: chain,
            destinationAsset: asset,
            amountSats: sats,
            sourceMethod: apiSourceMethod,
            refundAddress: sparkInformation.sparkAddress,
          },
          contactsPrivateKey,
          publicKey,
        );
        if (!result || result.error) {
          throw new Error(
            result?.error || t('wallet.stablecoinSend.quoteError'),
          );
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
        setQuoteError(err.message || t('wallet.stablecoinSend.quoteError'));
      } finally {
        setQuoteLoading(false);
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
      setQuoteLoading(true);
      const fetchAmount =
        sourceMethod === 'BTC'
          ? convertDisplayToSats(rawInput)
          : rawInput * Math.pow(10, 6);
      debounceRef.current = setTimeout(() => fetchQuote(fetchAmount), 800);
    } else {
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

  const handleDenominationToggle = () => {
    if (!isAmountFocused) return;
    if (!convertedSendAmount) {
      setInputDenomination(prev => (prev === 'fiat' ? 'sats' : 'fiat'));
      return;
    }
    const nextDenom = getNextDenomination();
    const convertedValue = convertForToggle(rawInput, convertTextInputValue);

    setInputDenomination(nextDenom);
    setRawInput(String(convertedValue));
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
          description: description || `Send ${asset}`,
          address: quote.depositAddress,
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

      await fetchBackend(
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
                },
              },
            ],
          });
        });
      });
    } catch (err) {
      console.log(err, 'error navigating to bla bla bla');
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  }, [
    quote,
    sending,
    sourceMethod,
    navigate,
    currentWalletMnemoinc,
    sparkInformation,
    description,
    address,
    chain,
    asset,
    contactsPrivateKey,
    publicKey,
    clearCountdown,
    t,
  ]);

  const handleEmoji = newDescription => {
    setDescription(newDescription);
  };

  const isQuoteLoading =
    (quoteLoading || (quote && countdown === null)) && !sending;

  const canConfirm =
    !!quote && !quoteLoading && !sending && convertedSendAmount > 0;

  const handleReview = useCallback(() => {
    if (!convertedSendAmount || convertedSendAmount <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.stablecoinSend.noAmount'),
      });
      return;
    }
    if (isQuoteLoading) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.stablecoinSend.quoteStillLoading'),
      });
      return;
    }

    if (!quote) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.stablecoinSend.noQuote'),
      });
      return;
    }

    const hasEnoughBalance =
      sourceMethod === 'BTC'
        ? convertedSendAmount <= Number(bitcoinBalance)
        : Number(rawInput) <= Number(dollarBalanceToken);

    if (!hasEnoughBalance) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.insufficientBalance'),
      });
      return;
    }

    if (Date.now() >= quote.expiresAt) {
      setQuoteError(t('wallet.stablecoinSend.quoteExpired'));
      setQuote(null);
      clearCountdown();
      return;
    }
    setIsAmountFocused(true);
    setScreenMode('CONFIRM_PAYMENT');
  }, [
    canConfirm,
    quote,
    clearCountdown,
    t,
    convertedSendAmount,
    isQuoteLoading,
    sourceMethod,
    rawInput,
    bitcoinBalance,
    dollarBalanceToken,
    navigate,
  ]);

  const rowBg = backgroundOffset;

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: !isAmountFocused ? 0 : bottomPadding,
    };
  }, [isAmountFocused]);

  const isConfirmMode = screenMode === 'CONFIRM_PAYMENT';

  return (
    <CustomKeyboardAvoidingView globalThemeViewStyles={memorizedKeyboardStyle}>
      <View style={styles.replacementContainer}>
        <CustomSettingsTopBar label={`${t('constants.send')} ${asset}`} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount display — tap to toggle denomination (edit mode only) */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDenominationToggle}
            style={CENTER}
            disabled={!isAmountFocused || isConfirmMode}
          >
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={rawInput}
              inputDenomination={primaryDisplay.denomination}
              forceCurrency={primaryDisplay.forceCurrency}
              forceFiatStats={primaryDisplay.forceFiatStats}
              activeOpacity={!convertedSendAmount ? 0.5 : 1}
            />
            <FormattedSatText
              neverHideBalance={true}
              containerStyles={{
                opacity: !convertedSendAmount ? HIDDEN_OPACITY : 1,
              }}
              styles={{ includeFontPadding: false, ...styles.satValue }}
              globalBalanceDenomination={secondaryDisplay.denomination}
              forceCurrency={secondaryDisplay.forceCurrency}
              balance={convertedSendAmount}
              forceFiatStats={secondaryDisplay.forceFiatStats}
            />
          </TouchableOpacity>

          {/* Confirm mode: fee info */}
          {isConfirmMode && (
            <SendTransactionFeeInfo
              paymentFee={quote?.fee}
              isLightningPayment={true}
              isDecoding={isQuoteLoading}
            />
          )}

          {/* Confirm mode: destination info */}
          {isConfirmMode && (
            <TouchableOpacity
              onPress={() =>
                navigate.navigate('ErrorScreen', {
                  errorMessage: address,
                })
              }
              style={[styles.destinationBox, { backgroundColor: rowBg }]}
            >
              <ThemeText
                styles={styles.quoteValue}
                content={`${truncateAddress(address)}`}
              />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Source method picker: shown in edit mode only */}
        {!isConfirmMode && (
          <ChoosePaymentMethod
            theme={theme}
            darkModeType={darkModeType}
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

        {/* Description input: edit mode only */}
        {!isConfirmMode && (
          <CustomSearchInput
            onFocusFunction={() => setIsAmountFocused(false)}
            onBlurFunction={() => setIsAmountFocused(true)}
            placeholderText={t('constants.paymentDescriptionPlaceholder')}
            setInputText={setDescription}
            inputText={description}
            textInputMultiline={true}
            textAlignVertical="baseline"
            maxLength={150}
            containerStyles={{
              width: INSET_WINDOW_WIDTH,
              marginTop: 10,
              maxWidth: 350,
              ...CENTER,
            }}
          />
        )}

        {/* Quote summary */}
        {convertedSendAmount > 0 && isAmountFocused && !sending && (
          <View style={[styles.quoteBox, { backgroundColor: rowBg }]}>
            {isQuoteLoading && (
              <View style={styles.quoteLoadingRow}>
                <ActivityIndicator
                  size="small"
                  color={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                />
                <ThemeText
                  styles={styles.quoteLoadingText}
                  content={t('wallet.stablecoinSend.gettingQuote')}
                />
              </View>
            )}
            {!isQuoteLoading && quoteError && (
              <ThemeText
                styles={[
                  styles.quoteErrorText,
                  {
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.cancelRed,
                  },
                ]}
                content={quoteError}
              />
            )}
            {!isQuoteLoading && quote && countdown !== null && (
              <>
                <View style={styles.quoteRow}>
                  <ThemeText
                    styles={styles.quoteLabel}
                    content={t('wallet.stablecoinSend.recipientGets')}
                  />
                  <ThemeText
                    styles={styles.quoteValue}
                    content={`${formatStablecoinAmount(
                      quote.estimatedOut,
                    )} ${asset}`}
                  />
                </View>
                <View style={styles.quoteRow}>
                  <ThemeText
                    styles={styles.quoteLabel}
                    content={t('wallet.stablecoinSend.quoteExpiresIn')}
                  />
                  <ThemeText
                    styles={[
                      styles.quoteValue,
                      countdown < 30000 && {
                        color:
                          theme && darkModeType
                            ? COLORS.darkModeText
                            : COLORS.cancelRed,
                      },
                    ]}
                    content={formatCountdown(countdown)}
                  />
                </View>
              </>
            )}
          </View>
        )}

        {/* EDIT_AMOUNT: keyboard + Review button */}
        {!isConfirmMode && isAmountFocused && (
          <CustomNumberKeyboard
            setInputValue={setRawInput}
            showDot={inputDenomination === 'fiat'}
            fiatStats={conversionFiatStats}
          />
        )}

        {!isConfirmMode && isAmountFocused && (
          <CustomButton
            textContent={t('constants.review')}
            actionFunction={handleReview}
            buttonStyles={{ ...CENTER }}
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
                textColor={COLORS.darkModeText}
                backgroundColor={
                  theme && darkModeType ? backgroundOffset : COLORS.primary
                }
                width={0.95}
              />
            ) : (
              <SwipeButtonNew
                onSwipeSuccess={handleSend}
                width={0.85}
                resetAfterSuccessAnimDuration={true}
                shouldResetAfterSuccess={!sending}
                containerStyles={{
                  opacity: canConfirm ? 1 : HIDDEN_OPACITY,
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
      {!isAmountFocused && !isConfirmMode && (
        <EmojiQuickBar description={description} onEmojiSelect={handleEmoji} />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  replacementContainer: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  satValue: {
    fontSize: SIZES.medium,
    marginTop: 4,
  },
  destinationBox: {
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    ...CENTER,
    marginTop: 30,
  },
  quoteBox: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  quoteLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteLoadingText: {
    fontSize: SIZES.medium,
    opacity: 0.65,
  },
  quoteErrorText: {
    fontSize: SIZES.small,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteLabel: {
    fontSize: SIZES.medium,
    opacity: 0.65,
  },
  quoteValue: {
    fontSize: SIZES.medium,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
});
