import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { InputTypes } from 'bitcoin-address-parser';
import { CONTENT_KEYBOARD_OFFSET, FONT } from '../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../functions/CustomElements/button';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import formatBalanceAmount from '../../../../functions/formatNumber';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import GetThemeColors from '../../../../hooks/themeColors';
import useSendPaymentDetails from './hooks/useSendPaymentDetails';
import { buildNextParams } from './functions/sendFlow';
import {
  paymentAssetLabel,
  RecipientAvatar,
  resolveAssetAvatar,
  resolveRecipientDisplay,
} from './components/recipientCard';
import normalizeLNURLAddress from '../../../../functions/lnurl/normalizeLNURLAddress';

// Route SendDescription: the note, shown only when the recipient will see it.
export default function SendDescriptionScreen(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const params = props.route.params;
  const {
    paymentInfo: preparedPaymentInfo,
    basePaymentInfo,
    preparedEntry,
    fromPage,
    selectedPaymentMethod,
    isFastPayEligible,
  } = params;

  const [note, setNote] = useState(
    basePaymentInfo?.data?.label || basePaymentInfo?.data?.message || '',
  );
  const [isNoteFocused, setIsNoteFocused] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  // The re-minted invoice, held for one render so validation sees its fee.
  const [reminted, setReminted] = useState(null);
  const details = useSendPaymentDetails({
    paymentInfo: reminted || preparedPaymentInfo,
    params,
  });
  const { paymentValidation, displayAmount, primaryDisplay } = details;
  const { theme, darkModeType } = useGlobalThemeContext();
  const { tokens } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const contentWidth = useContentWidth();
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const goToReview = useCallback(
    (paymentInfo, description) => {
      navigate.navigate(
        'SendReview',
        buildNextParams(params, { paymentInfo, description }),
      );
    },
    [navigate, params],
  );

  const returnWithError = useCallback(
    message => {
      navigate.popTo(
        'SendAmount',
        { validationError: message },
        { merge: true },
      );
    },
    [navigate],
  );

  useEffect(() => {
    if (!reminted) return;
    setReminted(null);
    if (!paymentValidation.isValid) {
      returnWithError(
        paymentValidation.getErrorMessage(paymentValidation.primaryError),
      );
      return;
    }
    goToReview(reminted, note.trim());
  }, [reminted]);

  const handleContinue = useCallback(async () => {
    if (isPreparing) return;
    const trimmedNote = note.trim();
    // An LNURL invoice carries its comment, so a typed one needs a fresh
    // invoice. A contact's note travels in the contact message instead.
    const needsNewInvoice =
      preparedPaymentInfo?.type === InputTypes.LNURL_PAY &&
      !!trimmedNote &&
      fromPage !== 'contacts';

    if (!needsNewInvoice) {
      goToReview(preparedPaymentInfo, trimmedNote);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsPreparing(true);
    let outcome;
    try {
      outcome = await details.decodePayment({
        basePaymentInfo,
        comingFromAccept: true,
        entered: { ...preparedEntry, description: trimmedNote },
        usablePaymentMethod: selectedPaymentMethod,
        amountSat: preparedEntry.amount,
        navigate,
      });
    } catch (err) {
      outcome = { error: err?.message };
    }
    if (!isMountedRef.current || requestId !== requestIdRef.current) return;
    setIsPreparing(false);

    if (!outcome.decoded) {
      returnWithError(
        outcome.error ||
          t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage'),
      );
      return;
    }
    setReminted(outcome.decoded);
  }, [
    isPreparing,
    note,
    preparedPaymentInfo,
    fromPage,
    goToReview,
    details,
    basePaymentInfo,
    preparedEntry,
    selectedPaymentMethod,
    navigate,
    returnWithError,
    t,
  ]);

  const isDollarBalance = details.resolvedPaymentMethod === 'USD';
  // A raw LNURL has nothing to name, so it shows what is being spent.
  const resolved = useMemo(
    () =>
      resolveRecipientDisplay({
        lnurlAddress:
          preparedPaymentInfo?.type === InputTypes.LNURL_PAY
            ? normalizeLNURLAddress(preparedPaymentInfo?.data?.address)
            : undefined,
        contactInfo: details.selectedContactInfo,
      }) ?? {
        ...resolveAssetAvatar({ isDollarBalance }),
        displayName: paymentAssetLabel({ isDollarBalance }),
      },
    [preparedPaymentInfo, details.selectedContactInfo, isDollarBalance],
  );

  const amountLabel = details.isUsingLRC20
    ? `${displayAmount} ${details.displayTokenTicker || ''}`
    : displayCorrectDenomination({
        amount: formatBalanceAmount(
          displayAmount || 0,
          false,
          details.masterInfoObject,
        ),
        masterInfoObject: {
          ...details.masterInfoObject,
          userBalanceDenomination:
            primaryDisplay.denomination === 'fiat' ? 'fiat' : 'sats',
        },
        forceCurrency: primaryDisplay.forceCurrency,
        fiatStats: details.conversionFiatStats,
        convertAmount: false,
      });

  const maxLength = preparedPaymentInfo?.data?.commentAllowed || 150;

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={false}
      globalThemeViewStyles={{
        paddingBottom: isNoteFocused ? CONTENT_KEYBOARD_OFFSET : bottomPadding,
      }}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.send')} />
        <CustomScrollView
          style={styles.hero}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.noteContent}
        >
          <View style={styles.headline}>
            <ThemeText
              styles={styles.headlineText}
              content={t('constants.pay')}
            />
            <RecipientAvatar
              resolved={resolved}
              theme={theme}
              darkModeType={darkModeType}
              size={32}
              backgroundColor={tokens.surface}
            />
            {!!resolved?.displayName && (
              <ThemeText
                styles={[styles.headlineText, styles.headlineName]}
                content={resolved.displayName}
              />
            )}
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
              maxLength={maxLength}
              value={note}
              onChangeText={setNote}
              onFocus={() => setIsNoteFocused(true)}
              onBlur={() => setIsNoteFocused(false)}
              placeholder={t('contacts.sendAndRequestPage.notePlaceholder')}
              placeholderTextColor={tokens.muted}
              selectionColor={tokens.accent}
              style={[styles.noteInput, { color: tokens.ink }]}
            />
          </View>
        </CustomScrollView>

        <View style={styles.noteBar}>
          <View style={styles.emojiBar}>
            <EmojiQuickBar
              description={note}
              onEmojiSelect={setNote}
              maxLength={maxLength}
              removeMargin
              pill
            />
          </View>
          <CustomButton
            size="fit"
            tone={'primary'}
            useLoading={isPreparing}
            actionFunction={handleContinue}
            textContent={
              isFastPayEligible ? t('constants.confirm') : t('constants.review')
            }
          />
        </View>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'center' },
  hero: { flex: 1, minHeight: 0 },
  noteContent: { flexGrow: 1, paddingTop: 24 },
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
  headlineName: { flexShrink: 1 },
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
  emojiBar: { flex: 1, minWidth: 0 },
});
