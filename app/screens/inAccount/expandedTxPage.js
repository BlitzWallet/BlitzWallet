import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  CENTER,
  COLORS,
  ICONS,
  SIZES,
  TOKEN_TICKER_MAX_LENGTH,
} from '../../constants';
import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../functions/CustomElements';
import Icon from '../../functions/CustomElements/Icon';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../functions/CustomElements/button';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { useSparkWallet } from '../../../context-store/sparkContext';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useAppStatus } from '../../../context-store/appStatus';
import { formatLocalTimeShort } from '../../functions/timeFormatter';
import { useMemo, useRef, useState } from 'react';
import CustomSearchInput from '../../functions/CustomElements/searchInput';
import { bulkUpdateSparkTransactions } from '../../functions/spark/transactions';
import { keyboardGoBack } from '../../functions/customNavigation';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../context-store/context';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useImageCache } from '../../../context-store/imageCache';

export default function ExpandedTx(props) {
  const { decodedAddedContacts } = useGlobalContacts();
  const { cache } = useImageCache();
  const { screenDimensions } = useAppStatus();
  const { sparkInformation } = useSparkWallet();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();

  const [transaction, setTransaction] = useState(
    props.route.params.transaction,
  );
  const sendingContactUUID = transaction.details?.sendingUUID;

  const selectedContact = useMemo(() => {
    if (!decodedAddedContacts) return undefined;
    return decodedAddedContacts?.find(
      contact => contact.uuid === sendingContactUUID,
    );
  }, [decodedAddedContacts, sendingContactUUID]);

  const transactionPaymentType = sendingContactUUID
    ? t('screens.inAccount.expandedTxPage.contactPaymentType')
    : transaction.paymentType;

  const isFailedPayment = transaction.paymentStatus === 'failed';
  const isPending = transaction.paymentStatus === 'pending';
  const isSuccessful = !isFailedPayment && !isPending;
  const paymentDate = new Date(transaction.details.time);
  const amount = transaction?.details?.amount;
  const description = transaction.details.description || '';

  // const month = paymentDate.toLocaleString('default', { month: 'short' });
  // const day = paymentDate.getDate();
  // const year = paymentDate.getFullYear();

  const handleSave = async memoText => {
    try {
      if (memoText === transaction.details.description) return;
      // deep copy
      let newTx = JSON.parse(JSON.stringify(transaction));
      newTx.details.description = memoText;
      newTx.useTempId = true;
      newTx.id = transaction.sparkID;
      newTx.tempID = transaction.sparkID;

      await bulkUpdateSparkTransactions(
        [newTx],
        undefined,
        undefined,
        undefined,
        true,
      );

      setTransaction(newTx);
    } catch (err) {
      console.log(err);
    }
  };

  useHandleBackPressNew();

  const isLRC20Payment = transaction.details.isLRC20Payment;
  const selectedToken = isLRC20Payment
    ? sparkInformation.tokens?.[transaction.details.LRC20Token]
    : '';
  const formattedTokensBalance = formatTokensNumber(
    transaction?.details?.amount,
    selectedToken?.tokenMetadata?.decimals,
  );

  const getStatusColors = () => {
    if (isPending) {
      return {
        outer: theme
          ? COLORS.expandedTxDarkModePendingOuter
          : COLORS.expandedTXLightModePendingOuter,
        inner: theme
          ? COLORS.expandedTxDarkModePendingInner
          : COLORS.expandedTXLightModePendingInner,
        text: theme
          ? COLORS.darkModeText
          : COLORS.expandedTXLightModePendingInner,
        bg: theme
          ? COLORS.expandedTxDarkModePendingInner
          : COLORS.expandedTXLightModePendingOuter,
      };
    }

    if (isFailedPayment) {
      return {
        outer:
          theme && darkModeType
            ? COLORS.lightsOutBackgroundOffset
            : COLORS.expandedTXLightModeFailed,
        inner: theme && darkModeType ? COLORS.white : COLORS.cancelRed,
        text: theme && darkModeType ? COLORS.white : COLORS.cancelRed,
        bg:
          theme && darkModeType
            ? COLORS.lightsOutBackground
            : COLORS.expandedTXLightModeFailed,
      };
    }

    return {
      outer: theme
        ? COLORS.expandedTXDarkModeConfirmd
        : COLORS.expandedTXLightModeConfirmd,
      inner: theme ? COLORS.darkModeText : COLORS.primary,
      text: theme ? COLORS.darkModeText : COLORS.primary,
      bg: theme
        ? COLORS.expandedTXDarkModeConfirmd
        : COLORS.expandedTXLightModeConfirmd,
    };
  };

  const statusColors = getStatusColors();

  const renderStatusIcon = () => {
    const iconSize = isPending ? 40 : 25;
    const iconColor = isPending
      ? theme
        ? COLORS.darkModeText
        : backgroundColor
      : backgroundColor;

    const iconName = isPending
      ? 'pendingTxIcon'
      : isFailedPayment
      ? 'expandedTxClose'
      : 'expandedTxCheck';

    return (
      <Icon
        width={iconSize}
        height={iconSize}
        color={iconColor}
        name={iconName}
      />
    );
  };

  const renderPaymentStatus = () => (
    <View style={styles.paymentStatusContainer}>
      <ThemeText
        content={t('screens.inAccount.expandedTxPage.paymentStatus')}
      />
      <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
        <ThemeText
          styles={{ ...styles.statusText, color: statusColors.text }}
          content={
            isPending
              ? t('transactionLabelText.pending')
              : isFailedPayment
              ? t('transactionLabelText.failed')
              : t('transactionLabelText.successful')
          }
        />
      </View>
    </View>
  );

  const renderInfoRow = (label, value, isLarge = false, customStyles = {}) => (
    <View style={styles.infoRow}>
      <ThemeText content={label} />

      <ThemeText
        content={value}
        CustomNumberOfLines={1}
        styles={{
          ...styles.infoValue,
          ...(isLarge ? styles.infoValueLarge : {}),
          ...customStyles,
        }}
      />
    </View>
  );

  const renderLRC20TokenRow = () => {
    if (!isLRC20Payment) return null;

    return (
      <View style={styles.infoRow}>
        <ThemeText content={t('constants.token')} />
        <ThemeText
          CustomNumberOfLines={1}
          content={selectedToken?.tokenMetadata?.tokenTicker
            ?.toUpperCase()
            ?.slice(0, TOKEN_TICKER_MAX_LENGTH)}
          styles={styles.tokenText}
        />
      </View>
    );
  };

  const renderContactRow = () => {
    if (!sendingContactUUID) return null;
    return (
      <View style={[styles.contactRow]}>
        <View
          style={[
            styles.profileImage,
            {
              backgroundColor: backgroundOffset,
            },
          ]}
        >
          <ContactProfileImage
            updated={cache[sendingContactUUID]?.updated}
            uri={cache[sendingContactUUID]?.localUri}
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>
        <ThemeText
          styles={styles.addressText}
          CustomNumberOfLines={1}
          content={selectedContact?.name || selectedContact?.uniqueName}
        />
      </View>
    );
  };

  const renderDescription = () => {
    return (
      <MemoSection initialDescription={description} onSave={handleSave} t={t} />
    );
  };

  const formatTime = date => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <CustomKeyboardAvoidingView
      styles={styles.container}
      useStandardWidth={true}
    >
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => keyboardGoBack(navigate)}
        >
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          keyboardShouldPersistTaps="always"
        >
          <View
            style={[
              styles.receiptContainer,
              { backgroundColor: theme ? backgroundOffset : COLORS.white },
            ]}
          >
            {/* Status Circle */}
            <View style={[styles.statusOuterCircle, { backgroundColor }]}>
              <View
                style={[
                  styles.statusFirstCircle,
                  { backgroundColor: statusColors.outer },
                ]}
              >
                <View
                  style={[
                    styles.statusSecondCircle,
                    { backgroundColor: statusColors.inner },
                  ]}
                >
                  {renderStatusIcon()}
                </View>
              </View>
            </View>

            {/* Transaction Message */}
            <ThemeText
              styles={styles.confirmMessage}
              content={t('screens.inAccount.expandedTxPage.confirmMessage', {
                context:
                  transaction.details.direction === 'OUTGOING' ||
                  isFailedPayment
                    ? 'sent'
                    : 'received',
              })}
            />

            {/* Amount */}
            <FormattedSatText
              containerStyles={styles.amountContainer}
              neverHideBalance={true}
              styles={styles.primaryAmount}
              balance={
                isLRC20Payment && formattedTokensBalance >= 1
                  ? formattedTokensBalance
                  : amount
              }
              useCustomLabel={isLRC20Payment}
              customLabel={selectedToken?.tokenMetadata?.tokenTicker}
              useMillionDenomination={true}
            />

            {/* Secondary Amount Display */}
            {!isLRC20Payment && amount >= 1_000_000 && (
              <FormattedSatText
                containerStyles={styles.secondaryAmountContainer}
                neverHideBalance={true}
                styles={styles.secondaryAmount}
                balance={amount}
              />
            )}

            {isLRC20Payment && formattedTokensBalance < 1 && (
              <FormattedSatText
                containerStyles={styles.secondaryAmountContainer}
                neverHideBalance={true}
                styles={styles.secondaryAmount}
                balance={formatTokensNumber(
                  transaction.details.amount,
                  selectedToken?.tokenMetadata?.decimals,
                )}
                useCustomLabel={isLRC20Payment}
                customLabel={selectedToken?.tokenMetadata?.tokenTicker}
                useMillionDenomination={true}
              />
            )}

            {/* Payment Status */}
            {renderPaymentStatus()}

            {/* Divider */}
            <Border screenDimensions={screenDimensions} />

            {renderContactRow()}

            {/* Transaction Details */}
            <View style={styles.detailsSection}>
              {renderInfoRow(
                t('transactionLabelText.date'),
                formatLocalTimeShort(paymentDate),
                true,
              )}

              {renderInfoRow(
                t('transactionLabelText.time'),
                formatTime(paymentDate),
                true,
              )}

              {renderInfoRow(
                t('constants.fee'),
                displayCorrectDenomination({
                  amount: transaction.details.fee || 0,
                  fiatStats,
                  masterInfoObject,
                }),
                true,
              )}

              {renderInfoRow(
                t('constants.type'),
                transactionPaymentType,
                true,
                { textTransform: 'capitalize' },
              )}

              {renderLRC20TokenRow()}

              {isPending &&
                transaction.paymentType === 'bitcoin' &&
                renderInfoRow(
                  t('screens.inAccount.expandedTxPage.confReqired'),
                  '3',
                  true,
                )}
            </View>

            {/* Description */}
            {renderDescription()}

            {/* Details Button */}
            <CustomButton
              buttonStyles={{
                ...styles.detailsButton,
                backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
              }}
              textStyles={{
                color: theme ? COLORS.lightModeText : COLORS.darkModeText,
              }}
              textContent={t('screens.inAccount.expandedTxPage.detailsBTN')}
              actionFunction={() => {
                navigate.navigate('TechnicalTransactionDetails', {
                  transaction: transaction,
                });
              }}
            />

            {/* Receipt Dots */}
            <ReceiptDots screenDimensions={screenDimensions} />
          </View>
        </ScrollView>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

function Border({ screenDimensions }) {
  const { theme } = useGlobalThemeContext();
  const dotsWidth = screenDimensions.width * 0.95 - 30;
  const numDots = Math.floor(dotsWidth / 25);

  const dotElements = Array.from({ length: numDots }, (_, index) => (
    <View
      key={index}
      style={[
        styles.borderDot,
        {
          backgroundColor: theme
            ? COLORS.darkModeText
            : COLORS.lightModeBackground,
        },
      ]}
    />
  ));

  return <View style={styles.borderContainer}>{dotElements}</View>;
}

function ReceiptDots({ screenDimensions }) {
  const { backgroundColor } = GetThemeColors();
  const dotsWidth = screenDimensions.width * 0.95 - 30;
  const numDots = Math.floor(dotsWidth / 25);

  const dotElements = Array.from({ length: numDots }, (_, index) => (
    <View key={index} style={[styles.receiptDot, { backgroundColor }]} />
  ));

  return <View style={styles.receiptDotsContainer}>{dotElements}</View>;
}

const MemoSection = ({ initialDescription, onSave, t }) => {
  const { theme } = useGlobalThemeContext();
  const { backgroundColor, textColor } = GetThemeColors();
  const [isEditing, setIsEditing] = useState(false);
  const [memoText, setMemoText] = useState(initialDescription || '');
  const textInputRef = useRef(null);
  const didCancelRef = useRef(null);
  const didRunSubmit = useRef(null);

  const runSaveFunction = async () => {
    if (didRunSubmit.current) return;
    didRunSubmit.current = true;
    if (!didCancelRef.current) {
      await onSave(memoText);
    }
    requestAnimationFrame(() => {
      if (isEditing) {
        setIsEditing(false);
      }
      if (textInputRef.current?.isFocused()) {
        textInputRef.current?.blur();
      }
    });
  };

  const handleEdit = () => {
    if (isEditing) return;
    didCancelRef.current = false;
    didRunSubmit.current = false;
    setIsEditing(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 0);
    });
  };

  const handleCancel = () => {
    didCancelRef.current = true;
    setMemoText(initialDescription || '');
    setIsEditing(false);
    textInputRef.current?.blur();
  };

  return (
    <View style={styles.descriptionContainer}>
      {/* Header with Edit Button */}
      <View style={styles.memoHeader}>
        <ThemeText
          content={t('transactionLabelText.memo')}
          styles={styles.descriptionHeader}
        />

        <TouchableOpacity
          activeOpacity={isEditing ? 1 : 0.2}
          onPress={handleEdit}
          style={styles.editButton}
        >
          <Icon
            name="editIcon" // Replace with your actual edit icon name
            width={18}
            height={18}
            color={theme ? COLORS.darkModeText : COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Memo Input/Display */}
      {(initialDescription || isEditing) && (
        <View style={[styles.descriptionContent, { backgroundColor }]}>
          {isEditing ? (
            <CustomSearchInput
              inputText={memoText}
              setInputText={setMemoText}
              textInputRef={textInputRef}
              containerStyles={{ width: '100%', margin: 0 }}
              textAlignVertical={'top'}
              maxLength={200}
              textInputStyles={{
                minHeight: '100%',
                padding: 0,
                margin: 0,
                backgroundColor: 'transparent',
                color: textColor,
              }}
              textInputMultiline={true}
              onFocusFunction={() => setIsEditing(true)}
              onBlurFunction={runSaveFunction}
            />
          ) : (
            <ScrollView
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              <ThemeText content={memoText} />
            </ScrollView>
          )}
        </View>
      )}

      {/* Action Buttons (only show when editing) */}
      {isEditing && (
        <View style={styles.actionButtons}>
          <CustomButton
            buttonStyles={{
              ...styles.actionButton,
              backgroundColor: backgroundColor,
            }}
            textStyles={{
              ...styles.actionButtonText,
              color: textColor,
            }}
            actionFunction={handleCancel}
            textContent={t('constants.cancel')}
          />

          <CustomButton
            buttonStyles={{
              ...styles.actionButton,
              backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
            }}
            textStyles={{
              ...styles.actionButtonText,
              color: theme ? COLORS.lightModeText : COLORS.darkModeText,
            }}
            actionFunction={runSaveFunction}
            textContent={t('constants.save')}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 0,
  },
  content: {
    flex: 1,
  },
  backButton: {
    marginRight: 'auto',
  },
  scrollContent: {
    width: '95%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  receiptContainer: {
    width: '100%',
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 40,
    ...CENTER,
    alignItems: 'center',
    marginTop: 50,
    // marginBottom: 20,
  },
  statusOuterCircle: {
    width: 100,
    height: 100,
    position: 'absolute',
    top: -50,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFirstCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
  },
  statusSecondCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },

  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  addressText: {
    includeFontPadding: false,
    flexShrink: 1,
    fontSize: SIZES.large,
  },
  confirmMessage: {
    marginTop: 20,
    includeFontPadding: false,
    textAlign: 'center',
  },
  amountContainer: {
    marginTop: 8,
  },
  primaryAmount: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
    textAlign: 'center',
  },
  secondaryAmountContainer: {
    marginTop: 4,
  },
  secondaryAmount: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    textAlign: 'center',
    opacity: 0.7,
  },
  paymentStatusContainer: {
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 24,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  statusText: {
    includeFontPadding: false,
    fontSize: SIZES.small,
  },
  borderContainer: {
    width: '100%',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
  },
  borderDot: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  detailsSection: {
    width: '100%',
    gap: 12, // Using gap for consistent spacing
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: SIZES.medium,
    marginLeft: 10,
    flexShrink: 1,
    width: '100%',
    textAlign: 'right',
  },
  infoValueLarge: {
    fontSize: SIZES.large,
  },
  tokenText: {
    fontSize: SIZES.large,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  descriptionContent: {
    width: '100%',
    maxHeight: 120,
    minHeight: 100,
    padding: 12,
    borderRadius: 8,
  },

  detailsButton: {
    width: 'auto',
    ...CENTER,
    marginVertical: 24,
    borderRadius: 8,
  },
  receiptDotsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? -10 : -8,
    width: '100%',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  receiptDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  // memo
  descriptionContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  memoHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  descriptionHeader: {
    marginBottom: 0,
  },
  editButton: {
    padding: 4,
  },

  memoInput: {
    fontSize: SIZES.medium,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  actionButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },

  actionButtonText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
