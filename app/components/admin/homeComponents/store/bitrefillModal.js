import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  EMAIL_REGEX,
  SIZES,
} from '../../../../constants';
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
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { KeyboardController } from 'react-native-keyboard-controller';

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

// Injected into the Bitrefill embed so it reports in-page navigation back to RN
// over the existing postMessage channel. Lets us detect when the user leaves the
// "waiting for payment" screen and clear the pending checkout.
const WEBVIEW_NAV_LISTENER = `
(function() {
  if (window.__blitzNavPatched) return;
  window.__blitzNavPatched = true;
  function post(type) {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: 'embed_navigation', type: type, path: location.pathname }),
      );
    } catch (e) {}
  }
  var origPush = history.pushState;
  history.pushState = function() { origPush.apply(this, arguments); post('push'); };
  var origReplace = history.replaceState;
  history.replaceState = function() { origReplace.apply(this, arguments); post('replace'); };
  window.addEventListener('popstate', function() { post('pop'); });
})();
true;
`;

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
  const isSendingPayment = useRef(false);
  const paidPaymentUris = useRef(new Set());
  const initialLoadDone = useRef(false);
  const pendingPaymentIntentRef = useRef(null);
  const lastEmbedPathRef = useRef(null);
  const isMounted = useRef(true);
  const [pendingPaymentIntent, setPendingPaymentIntent] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
    const config = {
      ref: BITREFILL_REFERRAL_TOKEN,
      paymentMethods: BITREFILL_PAYMENT_METHODS,
      theme: theme ? 'dark' : 'light',
      utm_source: 'blitzwallet',
      customStyles: JSON.stringify({
        '--brand-background:': backgroundColor,
        '--background-body': backgroundColor,
        '--background-primary': backgroundColor,
        '--text-primary': textColor,
      }),
      hl: webViewLanguage,
      ...(decryptedEmail ? { email: decryptedEmail } : {}),
    };

    return `https://embed.bitrefill.com/?${new URLSearchParams(config)}`;
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

  // Writes the latest pending intent to both the ref (source of truth for what
  // gets paid) and state (drives the Repay button). Passing null clears both.
  const setPendingIntent = useCallback(intent => {
    pendingPaymentIntentRef.current = intent;
    setPendingPaymentIntent(intent);
  }, []);

  // Pays the current latest pending intent with the user-chosen balance. Always
  // reads from the ref so a newer intent supersedes any older one.
  const payWithMethod = useCallback(
    async method => {
      const intent = pendingPaymentIntentRef.current;
      if (!intent) return;
      if (isSendingPayment.current) return;
      if (paidPaymentUris.current.has(intent.paymentUri)) return;

      isSendingPayment.current = true;
      setIsProcessingPayment(true);

      // Skip navigation/state updates if the screen unmounted while awaiting.
      const navigateError = msg => {
        if (isMounted.current) {
          naivgate.navigate('ErrorScreen', { errorMessage: msg });
        }
      };

      try {
        const { invoiceAddress, amountSats, invoiceId } = intent;
        let paymentFee = 0;
        let swapPaymentQuote = null;

        if (method === 'BTC') {
          const btcFeeResult = await sparkPaymenWrapper({
            getFee: true,
            address: invoiceAddress,
            amountSats,
            paymentType: 'lightning',
            masterInfoObject,
            mnemonic: currentWalletMnemoinc,
            sendWebViewRequest,
          });

          if (!btcFeeResult.didWork) {
            navigateError(
              btcFeeResult.error || t('screens.bitrefill.paymentFailed'),
            );
            return;
          }

          const fee = btcFeeResult.fee ?? 0;
          if (bitcoinBalance < amountSats + fee) {
            navigateError(t('screens.bitrefill.insufficientBalance'));
            return;
          }
          paymentFee = fee;
        } else {
          const usdQuote = await getLightningPaymentQuote(
            currentWalletMnemoinc,
            invoiceAddress,
            USD_ASSET_ADDRESS,
            undefined,
            undefined,
            { amountSats: amountSats },
          );

          if (!usdQuote.didWork) {
            navigateError(t('screens.bitrefill.paymentFailed'));
            return;
          }

          const tokenAmountRequired = usdQuote.quote.tokenAmountRequired;
          const userDollarBalance = dollarBalanceToken * Math.pow(10, 6);

          if (userDollarBalance < tokenAmountRequired) {
            navigateError(t('screens.bitrefill.insufficientBalance'));
            return;
          }

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
          usablePaymentMethod: method,
          swapPaymentQuote,
          fromMainSendScreen: false,
          poolInfoRef,
          extraDetails: {
            bitrefillInvoiceId: invoiceId,
          },
        });

        if (!paymentResponse.didWork) {
          navigateError(
            paymentResponse.error || t('screens.bitrefill.paymentFailed'),
          );
          return;
        }

        paidPaymentUris.current.add(intent.paymentUri);
        if (isMounted.current) setPendingIntent(null);
      } catch (err) {
        console.error('Bitrefill payment error:', err);
        navigateError(err.message || t('screens.bitrefill.paymentFailed'));
      } finally {
        isSendingPayment.current = false;
        if (isMounted.current) setIsProcessingPayment(false);
      }
    },
    [
      masterInfoObject,
      currentWalletMnemoinc,
      sendWebViewRequest,
      bitcoinBalance,
      dollarBalanceToken,
      dollarBalanceSat,
      poolInfoRef,
      sparkInformation,
      naivgate,
      t,
      setPendingIntent,
    ],
  );

  const openPaymentMethodSelection = useCallback(() => {
    naivgate.navigate('CustomHalfModal', {
      wantedContent: 'SelectPaymentMethod',
      selectedPaymentMethod: null,
      onSelectMethod: method => payWithMethod(method),
    });
  }, [naivgate, payWithMethod]);

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
        if (paidPaymentUris.current.has(paymentUri)) break;
        if (pendingPaymentIntentRef.current?.paymentUri === paymentUri) break;

        let parsedInvoice;
        try {
          parsedInvoice = await parseInput(paymentUri);
        } catch (err) {
          console.error('Failed to parse payment URI:', err);
          naivgate.navigate('ErrorScreen', {
            errorMessage: t('screens.bitrefill.invalidInvoice'),
          });
          break;
        }

        const invoiceAddress = parsedInvoice?.data?.address;
        if (!invoiceAddress) {
          naivgate.navigate('ErrorScreen', {
            errorMessage: t('screens.bitrefill.invalidInvoice'),
          });
          break;
        }

        const amountSats = Math.round(
          (parsedInvoice?.data?.amountMsat || 0) / 1000,
        );

        setPendingIntent({
          paymentUri,
          invoiceId,
          invoiceAddress,
          amountSats,
          paymentPath: lastEmbedPathRef.current,
        });
        openPaymentMethodSelection();
        break;
      }
      case 'embed_navigation': {
        lastEmbedPathRef.current = data.path;
        // Drop the pending checkout + hide the Repay button once the user
        // leaves the page the invoice was created on, so a stale intent can't
        // be paid for an order that's no longer on screen. Never mid-payment.
        // Fall back to the back-navigation ('pop') heuristic when we don't have
        // a recorded path to compare against.
        const intent = pendingPaymentIntentRef.current;
        if (intent && !isSendingPayment.current) {
          const leftPaymentPage = intent.paymentPath
            ? data.path !== intent.paymentPath
            : data.type === 'pop';
          if (leftPaymentPage) setPendingIntent(null);
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

  const handleBack = useCallback(() => {
    if (step === 'emailEdit') {
      setStep('webview');
      return true;
    }
    naivgate.goBack();
    return true;
  }, [naivgate, step]);

  useHandleBackPressNew(handleBack);

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
              onLoadStart={() => {
                if (!initialLoadDone.current) setIsLoading(true);
              }}
              onLoadEnd={() => {
                initialLoadDone.current = true;
                setIsLoading(false);
              }}
              onError={() => {
                initialLoadDone.current = true;
                setIsLoading(false);
              }}
              startInLoadingState={true}
              onMessage={handleMessage}
              injectedJavaScript={WEBVIEW_NAV_LISTENER}
              onShouldStartLoadWithRequest={request =>
                request.url.startsWith('https://embed.bitrefill.com')
              }
            />

            {isLoading && (
              <View style={[styles.loadingOverlay, { backgroundColor }]}>
                <FullLoadingScreen showText={false} />
              </View>
            )}

            {pendingPaymentIntent &&
              !isProcessingPayment &&
              !showEmailScreen && (
                <View style={styles.repayOverlay}>
                  <CustomButton
                    actionFunction={openPaymentMethodSelection}
                    textContent={t('screens.bitrefill.completePayment')}
                  />
                </View>
              )}
          </View>
        </Animated.View>

        {/* Email screen — slides in over the WebView */}
        {showEmailScreen && (
          <TouchableWithoutFeedback onPress={KeyboardController.dismiss}>
            <Animated.View
              style={[styles.emailOverlay, { backgroundColor }, emailAnimStyle]}
            >
              <View style={styles.emailContent}>
                <View style={styles.emailTopSection}>
                  <ThemeText
                    styles={styles.emailTitle}
                    content={
                      step === 'emailEdit' && decryptedEmail.length > 0
                        ? t('screens.bitrefill.editEmail')
                        : t('screens.bitrefill.addEmail')
                    }
                  />
                  <ThemeText
                    styles={styles.emailDescription}
                    content={
                      step === 'emailEdit' && decryptedEmail.length > 0
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
                      styles={[
                        styles.statusText,
                        {
                          color:
                            theme && darkModeType
                              ? COLORS.darkModeText
                              : COLORS.cancelRed,
                        },
                      ]}
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
  repayOverlay: {
    alignItems: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
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
