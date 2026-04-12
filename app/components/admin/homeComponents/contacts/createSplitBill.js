import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useKeysContext } from '../../../../../context-store/keys';
import { useServerTimeOnly } from '../../../../../context-store/serverTime';
import {
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { bulkPaymentRequest } from '../../../../functions/spark/bulkPaymentFunctions';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { getDocsByIds } from '../../../../../db';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import WordsQrToggle from '../../../../functions/CustomElements/wordsQrToggle';
import { dollarsToSats } from '../../../../functions/spark/flashnet';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import ContactProfileImage from './internalComponents/profileImage';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useNodeContext } from '../../../../../context-store/nodeContext';

export default function CreateSplitBill(props) {
  const navigate = useNavigation();
  const {
    selectedContacts = [],
    paymentType,
    amount,
    paymentCurrency = 'BTC',
  } = props.route.params || {};
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textInputBackground, textInputColor } =
    GetThemeColors();
  const { globalContactsInformation } = useGlobalContacts();
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey } = useKeysContext();
  const { cache } = useImageCache();
  const { fiatStats } = useNodeContext();
  const getServerTime = useServerTimeOnly();
  const { poolInfoRef } = useFlashnet();

  const [memo, setMemo] = useState('');
  const [totalSats, setTotalSats] = useState(0); //BTC
  const [totalCents, setTotalCents] = useState(0); //USD
  const [splitMode, setSplitMode] = useState('even'); // 'even' | 'custom'
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [customAmounts, setCustomAmounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const n = selectedContacts.length;
  const isUSD = paymentCurrency === 'USD';

  useEffect(() => {
    const {
      amount: returnedAmount,
      type: returnedType,
      amountValue: returnedDollarValue,
    } = props.route.params || {};

    if (returnedType) {
      if (isUSD) {
        const cents = Math.round(parseFloat(returnedDollarValue || '0') * 100);
        setCustomAmounts(prev => ({ ...prev, [returnedType]: cents }));
      } else {
        setCustomAmounts(prev => ({
          ...prev,
          [returnedType]: parseInt(returnedAmount || 0, 10),
        }));
      }
      navigate.setParams({ type: undefined });
    } else if (returnedAmount !== undefined && returnedAmount !== totalSats) {
      // Total amount input returned
      if (isUSD) {
        const cents = Math.round(parseFloat(returnedDollarValue || '0') * 100);
        setTotalCents(cents);
      } else {
        setTotalSats(parseInt(returnedAmount, 10) || 0);
      }
    }
  }, [
    props.route.params?.type,
    props.route.params?.amount,
    props.route.params?.amountValue,
  ]);

  useEffect(() => {
    if (splitMode === 'even') {
      navigate.setParams({ amount: undefined, amountValue: undefined });
      setTotalSats(0);
      setCustomAmounts({});
      setTotalCents(0);
    }
  }, [splitMode]);

  const chipProgress = useSharedValue(splitMode === 'even' ? 0 : 1);

  useEffect(() => {
    chipProgress.value = withTiming(splitMode === 'even' ? 0 : 1, {
      duration: 200,
    });
  }, [splitMode]);

  const animatedChipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      chipProgress.value,
      [0, 1],
      ['transparent', textInputBackground],
    ),
  }));

  const totalSatsInt = useMemo(() => parseInt(totalSats, 10) || 0, [totalSats]);
  const totalCentsInt = useMemo(
    () => parseInt(totalCents, 10) || 0,
    [totalCents],
  );
  const customTotal = useMemo(
    () =>
      Object.values(customAmounts).reduce(
        (sum, v) => sum + (typeof v === 'number' ? v : parseInt(v, 10) || 0),
        0,
      ),
    [customAmounts],
  );

  const totalNative =
    splitMode === 'even' ? (isUSD ? totalCentsInt : totalSatsInt) : customTotal;

  const perPersonNative = useMemo(
    () => (n > 0 ? Math.floor(totalNative / n) : 0),
    [totalNative, n],
  );

  const canConfirm = useMemo(() => {
    if (totalNative <= 0) return false;
    if (!memo.trim()) return false;
    if (splitMode === 'even') return perPersonNative > 0;
    // custom: every contact must have a valid positive integer and sum must equal total
    const allSet = selectedContacts.every(c => {
      const v = customAmounts[c.uuid];
      return (typeof v === 'number' ? v : parseInt(v || '0', 10)) > 0;
    });
    return allSet && customTotal === totalNative;
  }, [
    totalSatsInt,
    memo,
    splitMode,
    perPersonNative,
    selectedContacts,
    customAmounts,
    customTotal,
  ]);

  const buildRecipients = useCallback(() => {
    return selectedContacts.map((contact, index) => {
      if (isUSD) {
        const amountCents =
          splitMode === 'even'
            ? perPersonNative
            : typeof customAmounts[contact.uuid] === 'number'
            ? customAmounts[contact.uuid]
            : parseInt(customAmounts[contact.uuid] || '0', 10);
        const amountSat = dollarsToSats(
          amountCents / 100,
          poolInfoRef.currentPriceAInB,
        );
        return { contact, amountSats: amountSat, amountCents, currency: 'USD' };
      }
      const amountSats =
        splitMode === 'even'
          ? perPersonNative
          : parseInt(customAmounts[contact.uuid] || '0', 10);
      return { contact, amountSats, amountCents: null, currency: 'BTC' };
    });
  }, [selectedContacts, splitMode, perPersonNative, customAmounts, isUSD]);

  const handleConfirm = useCallback(async () => {
    if (totalNative <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.splitBill.errors.noAmount', {
          context: splitMode,
        }),
      });
      return;
    }
    if (!memo.trim()) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.splitBill.errors.noDescription'),
      });
      return;
    }
    if (splitMode === 'custom' && !canConfirm) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.splitBill.errors.noAmount', {
          context: 'custom',
        }),
      });
      return;
    }
    if (!canConfirm || isLoading) return;

    const recipients = buildRecipients();

    if (paymentType === 'request') {
      setIsLoading(true);
      try {
        const senderInfo = {
          globalContactsInformation,
          privateKey: contactsPrivateKey,
          masterInfoObject,
          currentTime: getServerTime(),
        };
        const result = await bulkPaymentRequest(
          recipients,
          memo.trim(),
          senderInfo,
        );

        keyboardNavigate(() =>
          navigate.reset({
            index: 0,
            routes: [
              { name: 'HomeAdmin', params: { screen: 'Home' } },
              {
                name: 'ConfirmTxPage',
                params: {
                  bulkResults: result,
                  isSplitPayment: true,
                  isRequset: true,
                },
              },
            ],
          }),
        );
      } catch (err) {
        console.log('CreateSplitBill: request error', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      const docIds = recipients.map(r => r.contact.uuid);
      const users = await getDocsByIds('blitzWalletUsers', docIds);

      const existingUsers = users.filter(Boolean);

      // Combine recipients with their sparkAddress from Firestore docs
      const recipientsWithAddress = recipients
        .map((recipient, index) => {
          const user = existingUsers[index];
          if (!user) return null;

          return {
            ...recipient,
            contactFull: user,
            contact: {
              ...recipient.contact,
              receiveAddress: user.contacts?.myProfile?.sparkAddress ?? null,
            },
          };
        })
        .filter(Boolean);

      keyboardNavigate(() =>
        navigate.navigate('ConfirmSplitPayment', {
          splitRecipients: recipientsWithAddress,
          enteredPaymentInfo: {
            amount: isUSD ? totalCentsInt : totalSatsInt,
            description: memo.trim(),
            fromContacts: true,
          },
          fromPage: 'contacts',
          paymentCurrency,
          selectedPaymentMethod: paymentCurrency,
        }),
      );
    }
  }, [
    canConfirm,
    isLoading,
    buildRecipients,
    paymentType,
    globalContactsInformation,
    contactsPrivateKey,
    masterInfoObject,
    getServerTime,
    memo,
    navigate,
    t,
    totalSatsInt,
    splitMode,
  ]);

  const contactElements = useMemo(() => {
    return selectedContacts.map(contact => {
      const uniqueName = contact.uniqueName || '';
      const contactName = contact.name || t('contacts.splitBill.noName') || '';
      const contactAmount =
        splitMode === 'even'
          ? perPersonNative
          : typeof customAmounts[contact.uuid] === 'number'
          ? customAmounts[contact.uuid]
          : parseInt(customAmounts[contact.uuid] || '0', 10);

      const amountChip = isUSD ? (
        <ThemeText
          styles={styles.amountChip}
          content={
            contactAmount > 0 ? `$${(contactAmount / 100).toFixed(2)}` : '$0.00'
          }
        />
      ) : (
        <FormattedSatText
          autoAdjustFontSize
          styles={styles.amountChip}
          balance={contactAmount}
        />
      );

      return (
        <View key={contact.uuid} style={styles.contactRow}>
          <View style={styles.contactAvatar}>
            <ContactProfileImage
              uri={cache[contact.uuid]?.localUri}
              updated={cache[contact.uuid]?.updated}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemeText
              styles={styles.contactUniqueName}
              content={uniqueName}
              CustomNumberOfLines={1}
            />
            <ThemeText
              styles={styles.contactName}
              content={contactName}
              CustomNumberOfLines={1}
            />
          </View>
          <Animated.View style={[styles.chipWrapper, animatedChipStyle]}>
            {splitMode === 'custom' ? (
              <TouchableOpacity
                onPress={() => {
                  keyboardNavigate(() =>
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'customInputText',
                      returnLocation: 'CreateSplitBill',
                      sliderHight: 0.5,
                      type: contact.uuid,
                      forceUSD: isUSD,
                    }),
                  );
                }}
              >
                {amountChip}
              </TouchableOpacity>
            ) : (
              amountChip
            )}
          </Animated.View>
        </View>
      );
    });
  }, [
    selectedContacts,
    splitMode,
    perPersonNative,
    customAmounts,
    backgroundOffset,
    cache,
    isUSD,
    textInputBackground,
    t,
  ]);

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar label={t('contacts.splitBill.createBillTitle')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <ThemeText
          styles={[
            styles.totalAmountLabel,
            { textAlign: 'center', marginBottom: 0 },
          ]}
          content={t('contacts.splitBill.totalAmountLabel')}
        />
        {/* Big total amount display — tappable in even, grayed in custom */}
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'customInputText',
              returnLocation: 'CreateSplitBill',
              sliderHight: 0.5,
              forceUSD: isUSD,
            });
          }}
          disabled={splitMode === 'custom' || isKeyboardActive}
          activeOpacity={splitMode === 'custom' ? 1 : 0.7}
        >
          {isUSD ? (
            <ThemeText
              styles={[
                styles.balanceText,
                { opacity: splitMode === 'custom' ? HIDDEN_OPACITY : 1 },
              ]}
              content={
                totalNative > 0 ? `$${(totalNative / 100).toFixed(2)}` : '$0.00'
              }
            />
          ) : (
            <FormattedSatText
              autoAdjustFontSize
              styles={{
                ...styles.balanceText,
                opacity: splitMode === 'custom' ? HIDDEN_OPACITY : 1,
              }}
              balance={totalNative}
            />
          )}
        </TouchableOpacity>

        {/* Even/Custom pill toggle */}
        <WordsQrToggle
          option1Text={t('contacts.splitBill.evenSplit')}
          option2Text={t('contacts.splitBill.customSplit')}
          option1Value="even"
          option2Value="custom"
          setSelectedDisplayOption={setSplitMode}
          selectedDisplayOption={splitMode}
          containerStyle={{ marginTop: 16, alignSelf: 'center' }}
        />

        {/* Divider */}
        {/* <View style={[styles.divider, { backgroundColor: backgroundOffset }]} /> */}

        {/* Contact rows — always shown, mode-aware */}
        <View style={styles.contactsContainer}>{contactElements}</View>

        {/* Divider */}
        {/* <View style={[styles.divider, { backgroundColor: backgroundOffset }]} /> */}

        {/* Memo input */}
        <View style={styles.fieldGroup}>
          <ThemeText
            styles={styles.fieldLabel}
            content={t('contacts.splitBill.memoLabel')}
          />
          <CustomSearchInput
            placeholderText={t('contacts.splitBill.memoPlaceholder')}
            inputText={memo}
            setInputText={setMemo}
            maxLength={100}
            onFocusFunction={() => setIsKeyboardActive(true)}
            onBlurFunction={() => setIsKeyboardActive(false)}
          />
          <ThemeText
            styles={styles.charCounter}
            content={`${memo.length}/100`}
          />
        </View>
      </ScrollView>

      {/* Confirm button */}
      <CustomButton
        buttonStyles={[styles.confirmButton, { opacity: canConfirm ? 1 : 0.5 }]}
        actionFunction={handleConfirm}
        disabled={isLoading}
        useLoading={isLoading}
        textContent={t('contacts.splitBill.confirmButton')}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingBottom: 24,
  },
  balanceText: {
    width: '100%',
    fontSize: SIZES.huge,
    textAlign: 'center',
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  contactsContainer: {
    width: '100%',
    marginVertical: 25,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactUniqueName: {
    includeFontPadding: false,
    flexShrink: 1,
  },
  contactName: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    flexShrink: 1,
  },
  chipWrapper: {
    borderRadius: 8,
  },
  amountChip: {
    minWidth: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: SIZES.medium,
    includeFontPadding: false,
    textAlign: 'right',
  },
  fieldGroup: {
    width: '100%',
  },
  fieldLabel: {
    includeFontPadding: false,
    marginBottom: 8,
  },
  totalAmountLabel: { includeFontPadding: false, marginTop: 16 },
  charCounter: {
    textAlign: 'right',
    includeFontPadding: false,
    marginTop: 10,
  },
  confirmButton: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
