import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useKeysContext } from '../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import fetchBackend from '../../../db/handleBackend';
import { sendSparkPayment } from '../../functions/spark';
import { dollarsToSats, satsToDollars } from '../../functions/spark/flashnet';

const QUOTE_TTL_MS = 115_000; // 115s — leave 5s buffer before 2-min expiry

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
  const { address, chain, chainLabel, asset } = route.params;
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const { fiatStats } = useNodeContext();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();

  const [amountInput, setAmountInput] = useState('');
  const [denomination, setDenomination] = useState('USD');
  const [sourceMethod, setSourceMethod] = useState('lightning');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const debounceRef = useRef(null);
  const countdownRef = useRef(null);
  const quoteExpiresAt = useRef(null);

  const btcPrice = fiatStats?.value || 0;

  const amountSats = (() => {
    const n = parseFloat(amountInput);
    if (!n || n <= 0) return 0;
    if (denomination === 'USD') return Math.round(dollarsToSats(n, btcPrice));
    return Math.round(n * 1e8);
  })();

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
          setQuoteError(t('wallet.stablecoinSend.quoteExpired'));
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
      setQuoteLoading(true);
      setQuoteError(null);
      setQuote(null);
      clearCountdown();
      try {
        const result = await fetchBackend(
          'createFlashnetStablecoinQuote',
          {
            recipientAddress: address,
            destinationChain: chain,
            destinationAsset: asset,
            amountSats: sats,
            sourceMethod,
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
        setQuote({ ...result, expiresAt });
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

  // Debounced re-fetch when amount or source method changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (amountSats > 0) {
      debounceRef.current = setTimeout(() => fetchQuote(amountSats), 800);
    } else {
      setQuote(null);
      setQuoteError(null);
      clearCountdown();
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [amountSats, sourceMethod, fetchQuote, clearCountdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCountdown();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [clearCountdown]);

  const handleConfirm = useCallback(async () => {
    if (!quote || sending) return;
    if (Date.now() >= quote.expiresAt) {
      setQuoteError(t('wallet.stablecoinSend.quoteExpired'));
      setQuote(null);
      clearCountdown();
      return;
    }
    setSending(true);
    try {
      if (sourceMethod === 'lightning') {
        // Hand off to existing ConfirmPaymentScreen with the BOLT11 invoice
        navigate.navigate('ConfirmPaymentScreen', {
          btcAdress: quote.depositAddress,
        });
      } else {
        // USDb path: send directly via Spark
        const result = await sendSparkPayment({
          receiverSparkAddress: quote.depositAddress,
          amountSats: quote.amountIn,
          mnemonic: currentWalletMnemoinc,
        });
        if (result?.error) throw new Error(result.error);
        navigate.navigate('ConfirmTxPage', {
          success: true,
          txType: 'spark',
        });
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setSending(false);
    }
  }, [
    quote,
    sending,
    sourceMethod,
    navigate,
    currentWalletMnemoinc,
    clearCountdown,
    t,
  ]);
  Keyboard.dismiss();

  const rowBg = theme && darkModeType ? backgroundColor : backgroundOffset;
  const canConfirm = !!quote && !quoteLoading && !sending && !!amountSats;

  const usdDisplay = amountSats
    ? satsToDollars(amountSats, btcPrice).toFixed(2)
    : '0.00';
  const satsDisplay = amountSats ? amountSats.toLocaleString() : '0';

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('wallet.stablecoinSend.sendStablecoins')}
      />

      <View style={styles.content}>
        {/* Recipient summary */}
        <View style={[styles.row, { backgroundColor: rowBg }]}>
          <ThemeText styles={styles.labelText} content={chainLabel} />
          <ThemeText
            styles={styles.valueText}
            content={truncateAddress(address)}
          />
          <View
            style={[styles.assetBadge, { backgroundColor: COLORS.primary }]}
          >
            <ThemeText styles={styles.assetBadgeText} content={asset} />
          </View>
        </View>

        {/* Amount input */}
        <View style={[styles.amountContainer, { backgroundColor: rowBg }]}>
          <TextInput
            style={[styles.amountInput, { color: theme ? '#fff' : '#000' }]}
            keyboardType="decimal-pad"
            placeholder={denomination === 'USD' ? '0.00' : '0'}
            placeholderTextColor="#888"
            value={amountInput}
            onChangeText={setAmountInput}
          />
          <ThemeText styles={styles.denomLabel} content={denomination} />
          <TouchableOpacity
            style={styles.denomToggle}
            onPress={() => setDenomination(d => (d === 'USD' ? 'BTC' : 'USD'))}
          >
            <ThemeText
              styles={styles.denomToggleText}
              content={
                denomination === 'USD'
                  ? `≈ ${satsDisplay} sats`
                  : `≈ $${usdDisplay}`
              }
            />
          </TouchableOpacity>
        </View>

        {/* Source method toggle */}
        <View style={styles.methodRow}>
          {['lightning', 'spark'].map(method => (
            <TouchableOpacity
              key={method}
              style={[
                styles.methodButton,
                { backgroundColor: rowBg },
                sourceMethod === method && {
                  borderColor: COLORS.primary,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => setSourceMethod(method)}
              activeOpacity={0.7}
            >
              <ThemeText
                styles={styles.methodLabel}
                content={
                  method === 'lightning'
                    ? t('wallet.stablecoinSend.payWithLightning')
                    : t('wallet.stablecoinSend.payWithUSDb')
                }
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quote section */}
        {amountSats > 0 && (
          <View style={[styles.quoteBox, { backgroundColor: rowBg }]}>
            {quoteLoading && (
              <View style={styles.quoteLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <ThemeText
                  styles={styles.quoteLoadingText}
                  content={t('wallet.stablecoinSend.gettingQuote')}
                />
              </View>
            )}

            {!quoteLoading && quoteError && (
              <View style={styles.quoteError}>
                <ThemeText
                  styles={styles.quoteErrorText}
                  content={quoteError}
                />
                <TouchableOpacity
                  onPress={() => fetchQuote(amountSats)}
                  style={styles.retryButton}
                >
                  <ThemeText
                    styles={styles.retryText}
                    content={t('constants.retry')}
                  />
                </TouchableOpacity>
              </View>
            )}

            {!quoteLoading && quote && !quoteError && (
              <View style={styles.quoteDetails}>
                <View style={styles.quoteRow}>
                  <ThemeText
                    styles={styles.quoteLabel}
                    content={t('wallet.stablecoinSend.recipientGets')}
                  />
                  <ThemeText
                    styles={styles.quoteValue}
                    content={`${parseFloat(quote.estimatedOut || 0).toFixed(
                      2,
                    )} ${asset}`}
                  />
                </View>
                <View style={styles.quoteRow}>
                  <ThemeText
                    styles={styles.quoteLabel}
                    content={t('wallet.stablecoinSend.youSend')}
                  />
                  <ThemeText
                    styles={styles.quoteValue}
                    content={`${quote.amountIn?.toLocaleString?.()} sats`}
                  />
                </View>
                {countdown !== null && (
                  <View style={styles.quoteRow}>
                    <ThemeText
                      styles={styles.quoteLabel}
                      content={t('wallet.stablecoinSend.quoteExpiresIn')}
                    />
                    <ThemeText
                      styles={[
                        styles.quoteValue,
                        countdown < 30000 && { color: '#ff6b6b' },
                      ]}
                      content={formatCountdown(countdown)}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      <CustomButton
        textContent={t('constants.send')}
        actionFunction={handleConfirm}
        disabled={!canConfirm}
        useLoading={sending}
        buttonStyles={[{ marginBottom: bottomPadding || 20 }]}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 12,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  labelText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Medium,
    opacity: 0.65,
  },
  valueText: {
    flex: 1,
    fontSize: SIZES.medium,
  },
  assetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  assetBadgeText: {
    fontSize: SIZES.small,
    color: '#fff',
    fontFamily: FONT.Descriptoin_Medium,
  },
  amountContainer: {
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  amountInput: {
    fontSize: SIZES.xxLarge || 32,
    fontFamily: FONT.Title_Regular,
    padding: 0,
  },
  denomLabel: {
    fontSize: SIZES.medium,
    opacity: 0.65,
  },
  denomToggle: {
    marginTop: 4,
  },
  denomToggleText: {
    fontSize: SIZES.smedium || 13,
    opacity: 0.55,
    textDecorationLine: 'underline',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  methodLabel: {
    fontSize: SIZES.smedium || 13,
    fontFamily: FONT.Descriptoin_Medium,
  },
  quoteBox: {
    padding: 16,
    borderRadius: 12,
  },
  quoteLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteLoadingText: {
    fontSize: SIZES.medium,
    opacity: 0.65,
  },
  quoteError: {
    gap: 8,
  },
  quoteErrorText: {
    fontSize: SIZES.smedium || 13,
    color: '#ff6b6b',
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: SIZES.smedium || 13,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  quoteDetails: {
    gap: 10,
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
    fontFamily: FONT.Descriptoin_Medium,
  },
});
