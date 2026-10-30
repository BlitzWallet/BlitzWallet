import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { KeyboardController } from 'react-native-keyboard-controller';

import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import AnimatedStep from '../../../../functions/CustomElements/redesign/AnimatedStep';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import formatBalanceAmount from '../../../../functions/formatNumber';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import useContactPayment from './hooks/useContactPayment';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import PaymentMethod from '../../../../functions/CustomElements/redesign/PaymentMethod';
import {
  normalizeDisplayCurrency,
  SATS_DISPLAY_CURRENCY,
} from '../../../../functions/displayCurrency';
import BudgetCurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ContactAvatar from './internalComponents/contactAvatar';

export default function SendAndRequestPage(props) {
  const {
    selectedRequestMethod = 'BTC',
    selectedPaymentMethod = 'BTC',
    endReceiveType = 'BTC',
    selectedContact,
    paymentType,
    imageData,
  } = props.route.params || {};

  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { tokens, mode } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  // Two steps in one route, sharing one useContactPayment instance.
  const [step, setStep] = useState('amount');
  const [direction, setDirection] = useState(1);
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  const payment = useContactPayment({
    selectedContact,
    paymentType,
    selectedPaymentMethod,
    selectedRequestMethod,
    endReceiveType,
    imageData,
    lockInitialPaymentMethod: true,
    t,
  });

  const contactName =
    selectedContact?.name || selectedContact?.uniqueName || '';
  const title =
    paymentType === 'Gift'
      ? t('constants.gift')
      : paymentType === 'send'
      ? t('constants.send')
      : t('constants.request');

  const goToNote = useCallback(() => {
    if (!payment.canReview) {
      // Same feedback the old Review button gave (amount, LNURL limits, contact doc).
      if (!payment.amountValue) return;
      const validation = payment.getValidationErrorResult();
      if (!validation.didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: validation.errorMessage,
        });
      }
      return;
    }
    setDirection(1);
    setStep('note');
  }, [navigate, payment]);

  const goToAmount = useCallback(() => {
    KeyboardController.dismiss();
    setDirection(-1);
    setStep('amount');
  }, []);

  const handleHardwareBack = useCallback(() => {
    if (step !== 'note') return false;
    goToAmount();
    return true;
  }, [step, goToAmount]);
  useHandleBackPressNew(handleHardwareBack);

  // iOS swipe-back would leave the route from the note step.
  useEffect(() => {
    navigate.setOptions({ gestureEnabled: step === 'amount' });
  }, [navigate, step]);

  const handleSelectPaymentMethod = useCallback(() => {
    if (paymentType === 'send') {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'SelectPaymentMethod',
        selectedPaymentMethod: payment.paymentMethod,
        fromPage: 'SendAndRequestPage',
      });
    } else {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'SelectContactRequestCurrency',
        selectedRecieveOption: payment.paymentMethod,
      });
    }
  }, [navigate, payment.paymentMethod, paymentType]);

  const openCurrencyPicker = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.6,
      currentCurrency: payment.displayCurrency,
      onSelectCurrency: payment.handleDisplayCurrencySelect,
    });
  }, [navigate, payment.displayCurrency, payment.handleDisplayCurrencySelect]);

  const handleSubmit = useCallback(async () => {
    const result =
      paymentType === 'send'
        ? await payment.buildSendHandoff()
        : await payment.submitRequest();

    if (!result.didWork) {
      navigate.navigate('ErrorScreen', {
        errorMessage: result.errorMessage,
        useTranslationString: result.useTranslationString,
      });
      return;
    }

    if (paymentType === 'send') {
      navigate.navigate('ConfirmPaymentScreen', result.params);
    } else {
      navigate.replace('ConfirmPaymentRequest', {
        amount: formatBalanceAmount(
          payment.amountValue || 0,
          false,
          payment.masterInfoObject,
        ),
        fiatStats: payment.primaryDisplay.forceFiatStats,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: payment.primaryDisplay.denomination,
        },
        forceCurrency: payment.primaryDisplay.forceCurrency,
        name: selectedContact?.name || selectedContact?.uniqueName,
      });
    }
  }, [navigate, payment, paymentType, selectedContact]);

  // Amount as typed, in the denomination the amount step displays.
  const amountLabel = useMemo(
    () =>
      displayCorrectDenomination({
        amount: formatBalanceAmount(
          payment.amountValue || 0,
          false,
          payment.masterInfoObject,
        ),
        masterInfoObject: {
          ...payment.masterInfoObject,
          userBalanceDenomination:
            payment.primaryDisplay.denomination === 'fiat' ? 'fiat' : 'sats',
        },
        forceCurrency: payment.primaryDisplay.forceCurrency,
        fiatStats: payment.conversionFiatStats,
        convertAmount: false,
      }),
    [
      payment.amountValue,
      payment.masterInfoObject,
      payment.primaryDisplay,
      payment.conversionFiatStats,
    ],
  );

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom:
        step === 'note' && isNoteFocused
          ? CONTENT_KEYBOARD_OFFSET
          : bottomPadding,
    };
  }, [bottomPadding, step, isNoteFocused]);

  if (payment.isAutoResolvingCurrency) {
    return (
      <CustomKeyboardAvoidingView
        useStandardWidth={true}
        globalThemeViewStyles={memorizedKeyboardStyle}
      >
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={title} />
          <FullLoadingScreen />
        </View>
      </CustomKeyboardAvoidingView>
    );
  }

  const avatar = size => (
    <ContactAvatar
      name={selectedContact?.name}
      seed={selectedContact?.uuid}
      updated={imageData?.updated}
      uri={imageData?.localUri}
      size={size}
      fontSize={size / 3}
    />
  );
  const normalizedDisplayCurrency = normalizeDisplayCurrency(
    payment.displayCurrency,
  );
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      globalThemeViewStyles={memorizedKeyboardStyle}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={title}
          onBack={step === 'note' ? goToAmount : undefined}
          shouldDismissKeyboard={step === 'note'}
          right={
            step === 'amount' ? (
              <BudgetCurrencyButton
                label={isSats ? 'SAT' : normalizedDisplayCurrency}
                onPress={openCurrencyPicker}
                disabled={payment.isResolvingDisplayCurrency}
                accessibilityLabel={t(
                  'settings.nwc.createNWCAmount.changeCurrency',
                )}
              />
            ) : null
          }
        />

        <View style={styles.steps}>
          <AnimatedStep active={step === 'amount'} direction={direction}>
            <View style={styles.step}>
              <CustomScrollView
                style={styles.hero}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.heroContent}
              >
                <View style={styles.avatarRow}>
                  <View style={styles.splitSlot} />
                  {avatar(56)}
                  <View style={styles.splitSlot}>
                    {!selectedContact?.isLNURL && (
                      <IconButton
                        icon="Plus"
                        label="contacts.sendAndRequestPage.splitWithMore"
                        size={36}
                        iconSize={18}
                        iconColor={
                          mode !== 'lightsOut' ? tokens.accent : tokens.ink
                        }
                        onPress={() =>
                          navigate.navigate('AddFriendsToSplit', {
                            paymentType,
                            selectedContact,
                            paymentCurrency: payment.paymentMethod,
                          })
                        }
                      />
                    )}
                  </View>
                </View>
                <ThemeText styles={styles.contactName} content={contactName} />
                <AmountHero
                  // The typed value is already in the displayed denomination:
                  // format it as typed (keeps "1." / "1.50") and skip the
                  // sats->fiat conversion that would mangle fiat amounts.
                  amount={formatBalanceAmount(
                    payment.amountValue || 0,
                    false,
                    masterInfoObject,
                  )}
                  convertAmount={false}
                  fiatStats={payment.primaryDisplay.forceFiatStats}
                  forceCurrency={payment.primaryDisplay.forceCurrency}
                  masterInfoObject={{
                    ...masterInfoObject,
                    userBalanceDenomination:
                      payment.primaryDisplay.denomination,
                  }}
                  mutedValue={!payment.amountValue}
                />
              </CustomScrollView>

              <PaymentMethod
                determinePaymentMethod={payment.paymentMethod}
                handleSelectPaymentMethod={handleSelectPaymentMethod}
                bitcoinBalance={payment.balances.sparkBalance}
                dollarBalanceToken={payment.balances.dollarBalanceToken}
                masterInfoObject={payment.masterInfoObject}
                fiatStats={payment.fiatStats}
                t={t}
                containerStyles={styles.selectContainer}
                isSend={paymentType === 'send'}
              />

              <CustomNumberKeyboard
                redesign
                showDot={payment.primaryDisplay.denomination === 'fiat'}
                frompage="sendContactsPage"
                setInputValue={payment.setAmountValue}
                usingForBalance={true}
                fiatStats={payment.conversionFiatStats}
                disabled={payment.isResolvingDisplayCurrency}
                disabledMessage={t(
                  'contacts.sendAndRequestPage.fiatRateLoading',
                )}
              />
              <CustomButton
                size="regular"
                buttonStyles={{
                  marginTop: CONTENT_KEYBOARD_OFFSET,
                  opacity: payment.canReview ? 1 : HIDDEN_OPACITY,
                }}
                useLoading={payment.isLoading}
                actionFunction={goToNote}
                textContent={t('constants.next')}
              />
            </View>
          </AnimatedStep>

          <AnimatedStep
            active={step === 'note'}
            direction={direction}
            exitsBack
          >
            <View style={styles.step}>
              <CustomScrollView
                style={styles.hero}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.noteContent}
              >
                <View style={styles.headline}>
                  <ThemeText
                    styles={styles.headlineText}
                    content={
                      paymentType === 'send'
                        ? t('constants.pay')
                        : t('constants.request')
                    }
                  />
                  {avatar(32)}
                  <ThemeText
                    styles={[styles.headlineText, styles.headlineName]}
                    content={contactName}
                  />
                </View>
                <View style={styles.noteRow}>
                  <ThemeText styles={styles.noteText} content={amountLabel} />
                  <ThemeText
                    styles={[styles.noteText, { color: tokens.muted }]}
                    content={t('contacts.sendAndRequestPage.noteFor')}
                  />
                  <TextInput
                    autoFocus
                    multiline
                    maxLength={149}
                    value={payment.descriptionValue}
                    onChangeText={payment.setDescriptionValue}
                    onFocus={() => setIsNoteFocused(true)}
                    onBlur={() => setIsNoteFocused(false)}
                    placeholder={t(
                      'contacts.sendAndRequestPage.notePlaceholder',
                    )}
                    placeholderTextColor={tokens.muted}
                    selectionColor={tokens.accent}
                    style={[styles.noteInput, { color: tokens.ink }]}
                  />
                </View>
              </CustomScrollView>

              <View style={styles.noteBar}>
                <View style={styles.emojiBar}>
                  <EmojiQuickBar
                    description={payment.descriptionValue}
                    onEmojiSelect={payment.setDescriptionValue}
                    maxLength={149}
                    removeMargin
                    pill
                  />
                </View>
                <CustomButton
                  size="fit"
                  tone={'primary'}
                  useLoading={payment.isLoading}
                  actionFunction={handleSubmit}
                  textContent={
                    paymentType === 'send'
                      ? t('constants.review')
                      : t('constants.request')
                  }
                />
              </View>
            </View>
          </AnimatedStep>
        </View>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  steps: {
    flex: 1,
  },
  step: {
    flex: 1,
  },
  hero: {
    flex: 1,
    minHeight: 0,
  },
  heroContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitSlot: {
    width: 36,
    alignItems: 'center',
  },
  contactName: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  amount: {
    marginTop: 20,
  },
  selectContainer: {
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  noteContent: {
    flexGrow: 1,
    paddingTop: 24,
  },
  headline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  headlineText: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 36,
    includeFontPadding: false,
  },
  headlineName: {
    flexShrink: 1,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  noteText: {
    fontSize: 28,
    lineHeight: 36,
    includeFontPadding: false,
  },
  noteInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    margin: 0,
    fontFamily: FONT.Title_Regular,
    fontSize: 28,
    lineHeight: 36,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  noteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  emojiBar: {
    flex: 1,
    minWidth: 0,
    borderRadius: 25,
  },
});
