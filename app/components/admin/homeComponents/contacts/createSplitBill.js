import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTheme } from '../../../../../context-store/theme';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useKeysContext } from '../../../../../context-store/keys';
import { useServerTimeOnly } from '../../../../../context-store/serverTime';
import { FONT } from '../../../../constants/theme';
import { bulkPaymentRequest } from '../../../../functions/spark/bulkPaymentFunctions';
import { getDocsByIds } from '../../../../../db';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import Segmented from '../../../../functions/CustomElements/redesign/Segmented';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import { dollarsToSats } from '../../../../functions/spark/flashnet';
import { validateSplitPayment } from '../../../../functions/payments/validateSplitPayment';
import { matchSplitRecipientsToUsers } from '../../../../functions/payments/matchSplitRecipientsToUsers';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import ContactAvatarDisc from './internalComponents/contactAvatar';
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
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { globalContactsInformation } = useGlobalContacts();
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey } = useKeysContext();
  const { cache } = useImageCache();
  const { fiatStats } = useNodeContext();
  const getServerTime = useServerTimeOnly();
  const { poolInfoRef, poolInfo, swapLimits, swapUSDPriceDollars } =
    useFlashnet();
  const { bitcoinBalance, dollarBalanceSat } = useUserBalanceContext();

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

  const price = poolInfo?.currentPriceAInB ?? 0;

  const totalAmountSats = useMemo(() => {
    if (!isUSD) return totalNative;
    if (price <= 0) return 0;
    return Math.round(dollarsToSats(totalNative / 100, price));
  }, [isUSD, totalNative, price]);

  const {
    canPayBTC,
    canPayUSD,
    errorMessage: balanceErrorMessage,
  } = useMemo(() => {
    if (paymentType !== 'send' || totalAmountSats <= 0) {
      return { canPayBTC: true, canPayUSD: true, errorMessage: null };
    }
    return validateSplitPayment({
      totalSats: totalAmountSats,
      paymentCurrency,
      bitcoinBalance,
      dollarBalanceSat,
      swapLimits,
      price,
      masterInfoObject,
      swapUSDPriceDollars,
      t,
    });
  }, [
    paymentType,
    totalAmountSats,
    paymentCurrency,
    bitcoinBalance,
    dollarBalanceSat,
    swapLimits,
    price,
    masterInfoObject,
    swapUSDPriceDollars,
    t,
  ]);

  const canConfirm = useMemo(() => {
    if (totalNative <= 0) return false;
    if (!memo.trim()) return false;
    if (paymentType === 'send' && !canPayBTC && !canPayUSD) return false;
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
    paymentType,
    canPayBTC,
    canPayUSD,
  ]);

  const buildRecipients = useCallback(() => {
    return selectedContacts.map((contact, index) => {
      const isLast = index === selectedContacts.length - 1;

      if (isUSD) {
        let amountCents;
        if (splitMode === 'even') {
          amountCents = isLast
            ? totalNative - perPersonNative * (selectedContacts.length - 1)
            : perPersonNative;
        } else {
          amountCents = parseInt(customAmounts[contact.uuid] || '0', 10);
        }
        const proportion = totalNative > 0 ? amountCents / totalNative : 0;
        const amountSat = dollarsToSats(
          amountCents / 100,
          poolInfoRef.currentPriceAInB,
        );
        return {
          contact,
          amountSats: amountSat,
          amountCents,
          currency: 'USD',
          proportion,
        };
      }

      let amountSats;
      if (splitMode === 'even') {
        amountSats = isLast
          ? totalNative - perPersonNative * (selectedContacts.length - 1)
          : perPersonNative;
      } else {
        amountSats = parseInt(customAmounts[contact.uuid] || '0', 10);
      }
      const proportion = totalNative > 0 ? amountSats / totalNative : 0;
      return {
        contact,
        amountSats,
        amountCents: null,
        currency: 'BTC',
        proportion,
      };
    });
  }, [
    selectedContacts,
    isUSD,
    splitMode,
    perPersonNative,
    totalNative,
    customAmounts,
  ]);

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
    if ((splitMode === 'custom' && !canConfirm) || perPersonNative <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.splitBill.errors.noAmount', {
          context: 'custom',
        }),
      });
      return;
    }
    if (isLoading) return;

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
      if (balanceErrorMessage) {
        navigate.navigate('ErrorScreen', { errorMessage: balanceErrorMessage });
        return;
      }

      const docIds = recipients.map(r => r.contact.uuid);
      const users = await getDocsByIds('blitzWalletUsers', docIds);

      // Join docs to recipients by uuid — an index-based join after dropping
      // missing docs pairs payments with the wrong contact's spark address.
      const { matched: recipientsWithAddress, missing } =
        matchSplitRecipientsToUsers(recipients, users);

      if (missing.length > 0) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('contacts.splitBill.errors.contactLookupFailed'),
        });
        return;
      }

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
    totalCentsInt,
    splitMode,
    canConfirm,
    balanceErrorMessage,
    perPersonNative,
  ]);

  const formatNative = useCallback(
    value =>
      isUSD
        ? `$${(value / 100).toFixed(2)}`
        : displayCorrectDenomination({
            amount: value,
            masterInfoObject,
            fiatStats,
          }),
    [isUSD, masterInfoObject, fiatStats],
  );

  const contactElements = useMemo(() => {
    return selectedContacts.map(contact => {
      const uniqueName = contact.uniqueName || '';
      const contactName =
        contact.name || uniqueName || t('contacts.splitBill.noName') || '';
      const contactAmount =
        splitMode === 'even'
          ? perPersonNative
          : typeof customAmounts[contact.uuid] === 'number'
          ? customAmounts[contact.uuid]
          : parseInt(customAmounts[contact.uuid] || '0', 10);

      const amountChip = isUSD ? (
        <ThemeText
          variant="body"
          styles={styles.amountText}
          content={
            contactAmount > 0 ? `$${(contactAmount / 100).toFixed(2)}` : '$0.00'
          }
        />
      ) : (
        <FormattedSatText
          autoAdjustFontSize
          styles={styles.amountText}
          balance={contactAmount}
        />
      );

      return (
        <ListRow
          key={contact.uuid}
          minHeight={64}
          paddingVertical={4}
          lead={
            <ContactAvatarDisc
              name={contactName}
              seed={contact.uuid}
              uri={cache[contact.uuid]?.localUri}
              updated={cache[contact.uuid]?.updated}
              size={40}
            />
          }
          title={contactName}
          sub={uniqueName ? `@${uniqueName}` : undefined}
          trailing={
            splitMode === 'custom' ? (
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.amountPill, { backgroundColor: tokens.ground }]}
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
            )
          }
        />
      );
    });
  }, [
    selectedContacts,
    splitMode,
    perPersonNative,
    customAmounts,
    cache,
    isUSD,
    t,
    tokens,
  ]);

  const totalHeroAmount = useMemo(() => {
    if (!isUSD) return totalNative;
    const [whole, cents] = (totalNative / 100).toFixed(2).split('.');
    return [
      `$${whole}`,
      <ThemeText
        key="cents"
        content={`.${cents}`}
        styles={[styles.heroCents, { color: tokens.muted }]}
      />,
    ];
  }, [isUSD, totalNative, tokens.muted]);

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('contacts.splitBill.createBillTitle')} />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <ThemeText
              variant="body"
              styles={[styles.muted, { color: tokens.muted }]}
              content={t('contacts.splitBill.totalAmountLabel')}
            />
            {/* Tappable in even; in custom the total follows the sum. */}
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
              style={styles.heroButton}
            >
              <AmountHero
                amount={isUSD ? totalHeroAmount : totalNative}
                formatAmount={!isUSD}
                splitCents={!isUSD}
                amountSize={52}
                mutedValue={totalNative <= 0}
              />
            </TouchableOpacity>
            <ThemeText
              variant="body"
              styles={[styles.muted, { color: tokens.muted }]}
              content={
                splitMode === 'even'
                  ? t('contacts.splitBill.perPerson', {
                      amount: formatNative(perPersonNative),
                    })
                  : t('contacts.splitBill.totalSub', {
                      amount: formatNative(totalNative),
                    })
              }
            />
            <View style={styles.segmented}>
              <Segmented
                fit
                value={splitMode}
                onChange={setSplitMode}
                options={[
                  { value: 'even', label: t('contacts.splitBill.evenSplit') },
                  {
                    value: 'custom',
                    label: t('contacts.splitBill.customSplit'),
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.people}>
            <ListCard>{contactElements}</ListCard>
          </View>

          <SectionHeader title={t('contacts.splitBill.memoLabel')} />
          <UserInput
            placeholder={t('contacts.splitBill.memoPlaceholder')}
            value={memo}
            onChangeText={setMemo}
            maxLength={100}
            showTextCount
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
          />
        </CustomScrollView>

        <CustomButton
          buttonStyles={[
            styles.confirmButton,
            { opacity: canConfirm ? 1 : 0.5 },
          ]}
          actionFunction={handleConfirm}
          disabled={isLoading}
          useLoading={isLoading}
          size="regular"
          textContent={
            paymentType === 'request'
              ? t('constants.request')
              : t('constants.review')
          }
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingBottom: 24 },
  hero: { marginTop: 24, alignItems: 'center' },
  heroButton: { marginTop: 2, maxWidth: '100%' },
  heroCents: { fontFamily: FONT.Title_Regular, letterSpacing: 0 },
  muted: { textAlign: 'center' },
  segmented: { marginTop: 16 },
  people: { marginTop: 16 },
  amountText: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  amountPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: { marginTop: CONTENT_KEYBOARD_OFFSET },
});
