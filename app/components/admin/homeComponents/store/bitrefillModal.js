import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import WebView from 'react-native-webview';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import GetThemeColors from '../../../../hooks/themeColors';
import { CENTER, COLORS, EMAIL_REGEX, SIZES } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { WINDOWWIDTH } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useKeysContext } from '../../../../../context-store/keys';
import {
  encriptMessage,
  decryptMessage,
} from '../../../../functions/messaging/encodingAndDecodingMessages';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { parseInput } from 'bitcoin-address-parser';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useWebView } from '../../../../../context-store/webViewContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useToast } from '../../../../../context-store/toastManager';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import {
  getLightningPaymentQuote,
  dollarsToSats,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';

const BITREFILL_REFERRAL_TOKEN = 'blitzwallet_brtoken_26';
const BITREFILL_PAYMENT_METHODS = ['lightning'].join(',');
const languages = [
  'en', // English
  'ru', // Russian
  'fr', // French
  'es', // Spanish
  'de', // German
  'it', // Italian
  'nl', // Dutch
  'pt', // Portuguese
  'vi', // Vietnamese
  'ko', // Korean
  'ja', // Japanese
  'zh-Hans', // Chinese Simplified
  'pl', // Polish
  'uk', // Ukrainian
  'tr', // Turkish
];

const normalizeLang = lang => lang.toLowerCase().split('-')[0];

const isSupportedLanguage = lang => {
  const normalized = normalizeLang(lang);
  return languages.includes(normalized);
};

export default function BitrefillShopModal() {
  const naivgate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sendWebViewRequest } = useWebView();
  const { poolInfoRef } = useFlashnet();
  const { showToast } = useToast();
  const isSendingPayment = useRef(false);
  const paidPaymentUris = useRef(new Set());

  const selectedLanguage = masterInfoObject?.userSelectedLanguage;

  const decryptedEmail = useMemo(() => {
    const stored = masterInfoObject?.bitrefillEmail;
    if (!stored || !contactsPrivateKey || !publicKey) return '';
    try {
      return decryptMessage(contactsPrivateKey, publicKey, stored) || '';
    } catch {
      return '';
    }
  }, [masterInfoObject?.bitrefillEmail, contactsPrivateKey, publicKey]);

  const [emailValue, setEmailValue] = useState(decryptedEmail);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(
    decryptedEmail ? 'webview' : 'emailReminder',
  ); // emailReminder, webview, emailEdit

  const isValidEmail = EMAIL_REGEX.test(emailValue.trim());

  const showEmailScreen = step !== 'webview';

  // ── Animations ──────────────────────────────────────────────────────────────

  const contentOpacity = useSharedValue(showEmailScreen ? 0 : 1);
  const contentTranslateX = useSharedValue(showEmailScreen ? -30 : 0);

  const emailOpacity = useSharedValue(showEmailScreen ? 1 : 0);
  const emailTranslateX = useSharedValue(showEmailScreen ? 0 : 30);

  useEffect(() => {
    contentOpacity.value = withTiming(showEmailScreen ? 0 : 1, {
      duration: 250,
    });
    contentTranslateX.value = withTiming(showEmailScreen ? -30 : 0, {
      duration: 250,
    });
    emailOpacity.value = withTiming(showEmailScreen ? 1 : 0, { duration: 250 });
    emailTranslateX.value = withTiming(showEmailScreen ? 0 : 30, {
      duration: 250,
    });
  }, [showEmailScreen]);

  const webViewStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const emailAnimStyle = useAnimatedStyle(() => ({
    opacity: emailOpacity.value,
    transform: [{ translateX: emailTranslateX.value }],
  }));

  // ── URL ─────────────────────────────────────────────────────────────────────

  const webViewLanguage = useMemo(() => {
    if (selectedLanguage && isSupportedLanguage(selectedLanguage)) {
      return normalizeLang(selectedLanguage);
    }
    return 'en';
  }, [selectedLanguage]);

  const bitrefillHomeUrl = useMemo(() => {
    const bitrefillTheme = theme ? 'dark' : 'light';

    const customStyles = encodeURIComponent(
      JSON.stringify({
        '--background-body': backgroundColor,
        '--background-primary': backgroundColor,
        '--background-secondary': backgroundOffset,
        '--background-contrast': backgroundOffset,
        '--text-primary': textColor,
        '--preheader-bg': backgroundOffset,
      }),
    );

    const emailParam = decryptedEmail
      ? `&email=${encodeURIComponent(decryptedEmail)}`
      : '';

    return (
      'https://embed.bitrefill.com/' +
      [
        `?ref=${BITREFILL_REFERRAL_TOKEN}`,
        `paymentMethods=${encodeURIComponent(BITREFILL_PAYMENT_METHODS)}`,
        `theme=${bitrefillTheme}`,
        `utm_source=${encodeURIComponent('blitzwallet')}`,
        `customStyles=${customStyles}`,
        `hl=${encodeURIComponent(webViewLanguage)}`,
      ].join('&') +
      emailParam
    );
  }, [
    backgroundColor,
    backgroundOffset,
    darkModeType,
    textColor,
    theme,
    decryptedEmail,
    webViewLanguage,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleMessage = async e => {
    let data;
    try {
      data = JSON.parse(e.nativeEvent.data);
    } catch (err) {
      console.error('Failed to parse message data:', err);
      data = e.nativeEvent.data;
    }
    const { event, invoiceId, paymentUri } = data;

    switch (event) {
      case 'payment_intent': {
        if (!paymentUri) break;
        if (isSendingPayment.current) break;
        if (paidPaymentUris.current.has(paymentUri)) break;

        isSendingPayment.current = true;

        try {
          let parsedInvoice;
          try {
            parsedInvoice = await parseInput(paymentUri);
          } catch (err) {
            console.error('Failed to parse payment URI:', err);
            showToast({
              type: 'error',
              title: t('screens.bitrefill.invalidInvoice'),
              duration: 5000,
            });
            break;
          }

          const invoiceAddress = parsedInvoice?.data?.address;
          if (!invoiceAddress) {
            showToast({
              type: 'error',
              title: t('screens.bitrefill.invalidInvoice'),
              duration: 5000,
            });
            break;
          }

          const amountSats = Math.round(
            (parsedInvoice?.data?.amountMsat || 0) / 1000,
          );

          let usablePaymentMethod = null;
          let paymentFee = 0;
          let swapPaymentQuote = null;

          const btcFeeResult = await sparkPaymenWrapper({
            getFee: true,
            address: invoiceAddress,
            amountSats,
            paymentType: 'lightning',
            masterInfoObject,
            mnemonic: currentWalletMnemoinc,
            sendWebViewRequest,
          });

          if (btcFeeResult.didWork) {
            const fee = btcFeeResult.fee ?? 0;
            if (bitcoinBalance >= amountSats + fee) {
              usablePaymentMethod = 'BTC';
              paymentFee = fee;
            }
          }

          if (!usablePaymentMethod) {
            const usdQuote = await getLightningPaymentQuote(
              currentWalletMnemoinc,
              invoiceAddress,
              USD_ASSET_ADDRESS,
            );

            if (usdQuote.didWork) {
              const tokenAmountRequired = usdQuote.quote.tokenAmountRequired;
              const userDollarBalance = dollarBalanceToken * Math.pow(10, 6);

              if (userDollarBalance >= tokenAmountRequired) {
                usablePaymentMethod = 'USD';

                const estimatedAmmFeeSat = Math.round(
                  dollarsToSats(
                    usdQuote.quote.estimatedAmmFee / Math.pow(10, 6),
                    poolInfoRef.currentPriceAInB,
                  ),
                );

                paymentFee =
                  usdQuote.quote.estimatedLightningFee + estimatedAmmFeeSat;

                swapPaymentQuote = {
                  ...usdQuote.quote,
                  bitcoinBalance,
                  dollarBalanceSat,
                };
              }
            }
          }

          if (!usablePaymentMethod) {
            showToast({
              type: 'error',
              title: t('screens.bitrefill.insufficientBalance'),
              duration: 5000,
            });
            break;
          }

          const paymentResponse = await sparkPaymenWrapper({
            getFee: false,
            address: invoiceAddress,
            paymentType: 'lightning',
            amountSats,
            masterInfoObject,
            memo: t('screens.bitrefill.paymentMemo'),
            fee: paymentFee,
            userBalance: bitcoinBalance,
            sparkInformation,
            mnemonic: currentWalletMnemoinc,
            sendWebViewRequest,
            usablePaymentMethod,
            swapPaymentQuote,
            fromMainSendScreen: false,
            poolInfoRef,
            extraDetails: {
              bitrefillInvoiceId: invoiceId,
            },
          });

          if (!paymentResponse.didWork) {
            showToast({
              type: 'error',
              title:
                paymentResponse.error || t('screens.bitrefill.paymentFailed'),
              duration: 5000,
            });
            break;
          }

          paidPaymentUris.current.add(paymentUri);
        } catch (err) {
          console.error('Bitrefill payment error:', err);
          showToast({
            type: 'error',
            title: err.message || t('screens.bitrefill.paymentFailed'),
            duration: 5000,
          });
        } finally {
          isSendingPayment.current = false;
        }

        break;
      }
      default:
        break;
    }
  };

  const handleSave = async () => {
    if (!isValidEmail && emailValue.length > 0) return;
    setIsSaving(true);
    try {
      const encrypted = encriptMessage(
        contactsPrivateKey,
        publicKey,
        emailValue.trim(),
      );
      await toggleMasterInfoObject({ bitrefillEmail: encrypted });
      setStep('webview');
    } catch (err) {
      console.log('Bitrefill email save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setStep('webview');
  };
  const handleEditEmail = () => {
    setEmailValue(decryptedEmail);
    setStep('emailEdit');
  };

  const handleBack = () => {
    if (step === 'emailEdit') {
      setStep('webview');
      return;
    }
    naivgate.goBack();
  };

  return (
    <GlobalThemeView styles={styles.emailOverlayInner}>
      <CustomSettingsTopBar
        customBackFunction={handleBack}
        containerStyles={styles.topBar}
        label={showEmailScreen ? '' : t('apps.appList.shop')}
        showLeftImage={!showEmailScreen}
        iconNew="Settings"
        leftImageFunction={handleEditEmail}
      />
      <View style={styles.overlayContainr}>
        {/* WebView — always mounted so it loads in the background */}
        <Animated.View style={[styles.webViewWrapper, webViewStyle]}>
          <View style={styles.webViewContainer}>
            <WebView
              source={{ uri: bitrefillHomeUrl }}
              style={[styles.webView, { backgroundColor }]}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              startInLoadingState={true}
              onMessage={handleMessage}
              onShouldStartLoadWithRequest={request =>
                request.url.startsWith('https://')
              }
              incognito={true}
            />

            {isLoading && (
              <View style={[styles.loadingOverlay, { backgroundColor }]}>
                <FullLoadingScreen showText={false} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Email screen — slides in over the WebView */}
        {showEmailScreen && (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.View
              style={[styles.emailOverlay, { backgroundColor }, emailAnimStyle]}
            >
              <View style={styles.emailContent}>
                <View style={styles.emailTopSection}>
                  <ThemeText
                    styles={styles.emailTitle}
                    content={
                      step === 'emailEdit'
                        ? t('screens.bitrefill.editEmail')
                        : t('screens.bitrefill.addEmail')
                    }
                  />
                  <ThemeText
                    styles={styles.emailDescription}
                    content={
                      step === 'emailEdit'
                        ? t('screens.bitrefill.editEmailDesc')
                        : t('screens.bitrefill.addEmailDesc')
                    }
                  />

                  <ThemeText
                    styles={styles.inputLabel}
                    content={t('screens.bitrefill.textInputDescriptor')}
                  />
                  <View style={styles.inputCard}>
                    <CustomSearchInput
                      inputText={emailValue}
                      setInputText={setEmailValue}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderText={t('screens.bitrefill.emailplaceholder')}
                    />
                  </View>

                  {emailValue.length > 0 && !isValidEmail && (
                    <ThemeText
                      styles={[styles.statusText, { color: COLORS.cancelRed }]}
                      content={t('screens.bitrefill.emailError')}
                    />
                  )}
                </View>

                <View style={styles.buttonRow}>
                  {step === 'emailReminder' && (
                    <CustomButton
                      buttonStyles={styles.halfButton}
                      actionFunction={handleSkip}
                      textContent={t('constants.skip')}
                    />
                  )}
                  <CustomButton
                    buttonStyles={styles.halfButton}
                    actionFunction={handleSave}
                    useLoading={isSaving}
                    disabled={emailValue.length > 0 && !isValidEmail}
                    textContent={t('constants.save')}
                  />
                </View>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 30,
    paddingBottom: 0,
  },
  overlayContainr: { flex: 1, position: 'relative' },
  topBar: {
    width: WINDOWWIDTH,
    ...CENTER,
  },
  webViewWrapper: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editEmailText: {
    fontSize: SIZES.small,
    opacity: 0.7,
  },
  editEmailLink: {
    fontSize: SIZES.small,
    opacity: 0.7,
    textDecorationLine: 'underline',
  },
  // ── Email overlay ──
  emailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  emailOverlayInner: {
    paddingTop: 30,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  emailContent: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  emailTopSection: {
    flex: 1,
  },
  emailTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 10,
    marginBottom: 8,
  },
  emailDescription: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    opacity: 0.6,
    lineHeight: 22,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.55,
    marginBottom: 4,
    textTransform: 'uppercase',
    marginTop: 16,
  },
  inputCard: {
    borderRadius: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  skipButton: {
    opacity: 0.5,
  },
});
