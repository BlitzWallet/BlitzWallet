import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  CENTER,
  COLORS,
  HIDDEN_BALANCE_TEXT,
  ICONS,
  SIZES,
  SKELETON_ANIMATION_SPEED,
} from '../constants';
import { ThemeText } from './CustomElements';
import FormattedSatText from './CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import Icon from './CustomElements/Icon';
import { memo, useMemo, useCallback } from 'react';
import { crashlyticsLogReport } from './crashlyticsLogs';
import SkeletonPlaceholder from './CustomElements/skeletonView';
import formatTokensNumber from './lrc20/formatTokensBalance';
import { Image } from 'expo-image';
import { getTimeDisplay } from './contacts';

// Constants to avoid re-creating objects
const TRANSACTION_CONSTANTS = {
  VIEW_ALL_PAGE: 'viewAllTx',
  SPARK_WALLET: 'sparkWallet',
  HOME: 'home',
  FAILED: 'failed',
  PENDING: 'pending',
  LIGHTNING: 'lightning',
  LIGHTNING_INITIATED: 'LIGHTNING_PAYMENT_INITIATED',
  INCOMING: 'INCOMING',
  OUTGOING: 'OUTGOING',
};

const SKELETON_STYLES = {
  icon: {
    height: 50,
    width: 50,
    marginRight: 10,
    borderRadius: 100,
  },
  content: {
    flex: 1,
    height: 30,
  },
  line: {
    flex: 1,
    marginBottom: 10,
    borderRadius: 100,
  },
  lastLine: {
    flex: 1,
    borderRadius: 100,
  },
};

// Utility functions moved outside component
const calculateTimeDifference = (currentTime, paymentDate) => {
  const timeDifferenceMs = currentTime - paymentDate;
  const minutes = timeDifferenceMs / (1000 * 60);
  const hours = minutes / 60;
  const days = hours / 24;
  const years = days / 365;
  return { minutes, hours, days, years, timeDifferenceMs };
};

const generateBannerText = (timeDifference, texts) => {
  const { todayText, yesterdayText, dayText, monthText, yearText, agoText } =
    texts;

  if (timeDifference < 0.5) return todayText;
  if (timeDifference > 0.5 && timeDifference < 1) return yesterdayText;

  const roundedDays = Math.round(timeDifference);
  if (roundedDays <= 30) {
    return `${roundedDays} ${
      roundedDays === 1 ? dayText : dayText + 's'
    } ${agoText}`;
  }

  if (roundedDays < 365) {
    const months = Math.floor(roundedDays / 30);
    return `${months} ${monthText}${months === 1 ? '' : 's'} ${agoText}`;
  }

  const years = Math.floor(roundedDays / 365);
  return `${years} ${yearText}${years === 1 ? '' : 's'} ${agoText}`;
};

const getContainerWidth = frompage => {
  return frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE ||
    Dimensions.get('screen').width < 370
    ? '90%'
    : '85%';
};

const createLoadingSkeleton = (
  numberOfCachedTxs,
  frompage,
  theme,
  darkModeType,
) => {
  const arrayLength = Math.min(numberOfCachedTxs, 20);
  const containerWidth = getContainerWidth(frompage);

  const loadingTxElements = Array.from({ length: arrayLength }, (_, i) => (
    <View
      key={i}
      style={{
        ...styles.transactionContainer,
        width: containerWidth,
        ...CENTER,
      }}
    >
      <View style={SKELETON_STYLES.icon} />
      <View style={SKELETON_STYLES.content}>
        <View style={SKELETON_STYLES.line} />
        <View style={SKELETON_STYLES.lastLine} />
      </View>
    </View>
  ));

  return {
    type: 'tx',
    item: (
      <SkeletonPlaceholder
        highlightColor={
          theme
            ? darkModeType
              ? COLORS.lightsOutBackground
              : COLORS.darkModeBackground
            : COLORS.lightModeBackground
        }
        backgroundColor={COLORS.opaicityGray}
        enabled={true}
        speed={SKELETON_ANIMATION_SPEED}
      >
        {loadingTxElements}
      </SkeletonPlaceholder>
    ),
    key: 'placeholderTxs',
  };
};

const createDateBanner = bannerText => (
  <View key={bannerText}>
    <ThemeText styles={styles.transactionTimeBanner} content={bannerText} />
  </View>
);

export default function getFormattedHomepageTxsForSpark(props) {
  const {
    currentTime,
    sparkInformation,
    homepageTxPreferance = 25,
    navigate,
    frompage,
    viewAllTxText,
    noTransactionHistoryText,
    todayText,
    yesterdayText,
    dayText,
    monthText,
    yearText,
    agoText,
    theme,
    darkModeType,
    userBalanceDenomination,
    // numberOfCachedTxs,
    didGetToHomepage,
    enabledLRC20,
  } = props;

  // Remove unnecessary console.logs for performance
  // crashlyticsLogReport('Starting re-rendering of formatted transactions');

  if (!didGetToHomepage) {
    return null;
  }

  const sparkTransactions = sparkInformation?.transactions;
  const sparkTransactionsLength = sparkTransactions?.length || 0;

  // Early return with loading skeleton
  if (!sparkInformation.didConnect || !sparkInformation.identityPubKey) {
    return [createLoadingSkeleton(20, frompage, theme, darkModeType)];
  }

  let formattedTxs = [];
  let currentGroupedDate = '';
  const transactionLimit =
    frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE
      ? sparkTransactionsLength
      : homepageTxPreferance;

  // Pre-calculate text objects to avoid recreation
  const bannerTexts = {
    todayText,
    yesterdayText,
    dayText,
    monthText,
    yearText,
    agoText,
  };

  for (
    let transactionIndex = 0;
    transactionIndex < sparkTransactionsLength &&
    formattedTxs.length < transactionLimit;
    transactionIndex++
  ) {
    try {
      const currentTransaction = sparkTransactions[transactionIndex];
      const transactionPaymentType = currentTransaction.paymentType;
      const paymentStatus = currentTransaction.paymentStatus;

      const paymentDetails =
        frompage === TRANSACTION_CONSTANTS.SPARK_WALLET
          ? {
              time: currentTransaction.createdTime,
              direction: currentTransaction.transferDirection,
              amount: currentTransaction.totalValue,
            }
          : JSON.parse(currentTransaction.details);

      const isLRC20Payment = paymentDetails.isLRC20Payment;

      // Early continue conditions
      if (!enabledLRC20 && isLRC20Payment) continue;
      if (
        paymentStatus === TRANSACTION_CONSTANTS.FAILED &&
        paymentDetails.direction === TRANSACTION_CONSTANTS.INCOMING
      )
        continue;
      if (
        transactionPaymentType === TRANSACTION_CONSTANTS.LIGHTNING &&
        currentTransaction.status === TRANSACTION_CONSTANTS.LIGHTNING_INITIATED
      )
        continue;

      const paymentDate = new Date(paymentDetails.time).getTime();
      const uniuqeIDFromTx = currentTransaction.sparkID;
      const isFailedPayment = paymentStatus === TRANSACTION_CONSTANTS.FAILED;

      // Calculate time difference once
      const timeDifferenceInDays =
        (currentTime - paymentDate) / (1000 * 60 * 60 * 24);

      // Add date banner if needed
      if (
        (transactionIndex === 0 ||
          currentGroupedDate !==
            generateBannerText(timeDifferenceInDays, bannerTexts)) &&
        timeDifferenceInDays > 0.5 &&
        frompage !== TRANSACTION_CONSTANTS.HOME
      ) {
        const bannerText = generateBannerText(
          timeDifferenceInDays,
          bannerTexts,
        );
        currentGroupedDate = bannerText;
        formattedTxs.push(createDateBanner(bannerText));
      }

      const styledTx = (
        <UserTransaction
          key={uniuqeIDFromTx}
          tx={{ ...currentTransaction, details: paymentDetails }}
          currentTime={currentTime}
          navigate={navigate}
          transactionPaymentType={transactionPaymentType}
          paymentDate={paymentDate}
          id={uniuqeIDFromTx}
          frompage={frompage}
          theme={theme}
          darkModeType={darkModeType}
          userBalanceDenomination={userBalanceDenomination}
          isFailedPayment={isFailedPayment}
          sparkInformation={sparkInformation}
          isLRC20Payment={isLRC20Payment}
        />
      );

      formattedTxs.push({
        type: 'tx',
        item: styledTx,
        key: uniuqeIDFromTx,
      });
    } catch (err) {
      // Only log in development
      if (__DEV__) {
        console.log(err);
      }
    }
  }

  if (!formattedTxs?.length) {
    return [
      {
        type: 'tx',
        item: (
          <View style={styles.noTransactionsContainer} key="noTx">
            <ThemeText
              content={noTransactionHistoryText}
              styles={styles.noTransactionsText}
            />
          </View>
        ),
        key: 'noTx',
      },
    ];
  }

  // Add "View All" button if conditions are met
  if (
    frompage !== TRANSACTION_CONSTANTS.VIEW_ALL_PAGE &&
    frompage !== TRANSACTION_CONSTANTS.SPARK_WALLET &&
    formattedTxs.length === homepageTxPreferance
  ) {
    formattedTxs.push({
      type: 'tx',
      item: (
        <TouchableOpacity
          key="view_all_tx_btn"
          style={[styles.viewAllButton, CENTER]}
          onPress={() => navigate.navigate('ViewAllTxPage')}
        >
          <ThemeText content={viewAllTxText} styles={styles.headerText} />
        </TouchableOpacity>
      ),
      key: 'view_all_tx_btn',
    });
  }

  return formattedTxs;
}

export const UserTransaction = memo(function UserTransaction({
  tx: transaction,
  currentTime,
  paymentDate,
  transactionPaymentType,
  id,
  navigate,
  frompage,
  theme,
  darkModeType,
  userBalanceDenomination,
  isFailedPayment,
  sparkInformation,
  isLRC20Payment,
}) {
  const { t } = useTranslation();

  const timeDifference = useMemo(
    () => calculateTimeDifference(currentTime, paymentDate),
    [currentTime, paymentDate],
  );

  const paymentImage = useMemo(() => {
    if (isFailedPayment) {
      return darkModeType && theme
        ? ICONS.failedTransactionWhite
        : ICONS.failedTransaction;
    }
    return darkModeType && theme
      ? ICONS.arrow_small_left_white
      : ICONS.smallArrowLeft;
  }, [darkModeType, theme, isFailedPayment]);

  const token = useMemo(
    () =>
      isLRC20Payment
        ? sparkInformation.tokens?.[transaction.details.LRC20Token]
            ?.tokenMetadata
        : null,
    [isLRC20Payment, sparkInformation.tokens, transaction.details.LRC20Token],
  );

  const containerWidth = useMemo(() => getContainerWidth(frompage), [frompage]);

  const handlePress = useCallback(() => {
    if (frompage === TRANSACTION_CONSTANTS.SPARK_WALLET) return;
    crashlyticsLogReport('Navigating to expanded tx from user transaction');
    navigate.navigate('ExpandedTx', { isFailedPayment: {}, transaction });
  }, [frompage, navigate, transaction]);

  const showPendingTransactionStatusIcon =
    transaction.paymentStatus === TRANSACTION_CONSTANTS.PENDING;
  const paymentDescription = transaction.details?.description?.trim();
  const isDefaultDescription =
    paymentDescription === BLITZ_DEFAULT_PAYMENT_DESCRIPTION;

  const descriptionTextStyle = useMemo(
    () => ({
      ...styles.descriptionText,
      color: isFailedPayment
        ? theme && darkModeType
          ? COLORS.darkModeText
          : COLORS.failedTransaction
        : theme
        ? COLORS.darkModeText
        : COLORS.lightModeText,
      fontStyle: isFailedPayment ? 'italic' : 'normal',
    }),
    [isFailedPayment, theme, darkModeType],
  );

  const dateTextStyle = useMemo(
    () => ({
      ...styles.dateText,
      fontWeight: isFailedPayment ? 400 : 300,
      color: isFailedPayment
        ? theme && darkModeType
          ? COLORS.darkModeText
          : COLORS.failedTransaction
        : theme
        ? COLORS.darkModeText
        : COLORS.lightModeText,
      fontStyle: isFailedPayment ? 'italic' : 'normal',
    }),
    [isFailedPayment, theme, darkModeType],
  );

  const imageTransformStyle = useMemo(
    () => ({
      transform: [
        {
          rotate:
            showPendingTransactionStatusIcon || isFailedPayment
              ? '0deg'
              : transaction.details.direction === TRANSACTION_CONSTANTS.INCOMING
              ? '270deg'
              : '90deg',
        },
      ],
      marginLeft: -5,
    }),
    [
      showPendingTransactionStatusIcon,
      isFailedPayment,
      transaction.details.direction,
    ],
  );

  // Pre-calculate description content
  const descriptionContent = useMemo(() => {
    if (isFailedPayment) return t('transactionLabelText.notSent');
    // if (userBalanceDenomination === 'hidden') return HIDDEN_BALANCE_TEXT;
    if (isDefaultDescription || !paymentDescription) {
      return transaction.details.direction === TRANSACTION_CONSTANTS.OUTGOING
        ? t('constants.sent')
        : t('constants.received');
    }
    return paymentDescription;
  }, [
    isFailedPayment,
    userBalanceDenomination,
    isDefaultDescription,
    paymentDescription,
    transaction.details.direction,
    t,
  ]);

  return (
    <TouchableOpacity
      style={{
        ...styles.transactionContainer,
        width: containerWidth,
      }}
      activeOpacity={frompage === TRANSACTION_CONSTANTS.SPARK_WALLET ? 1 : 0.5}
      onPress={handlePress}
    >
      {showPendingTransactionStatusIcon ? (
        <View style={styles.icons}>
          <Icon
            width={27}
            height={27}
            color={darkModeType && theme ? COLORS.darkModeText : COLORS.primary}
            name="pendingTxIcon"
          />
        </View>
      ) : (
        <Image
          style={[styles.icons, imageTransformStyle]}
          source={paymentImage}
          contentFit="contain"
        />
      )}
      <View style={styles.transactionContent}>
        <ThemeText
          CustomEllipsizeMode="tail"
          CustomNumberOfLines={1}
          styles={descriptionTextStyle}
          content={descriptionContent}
        />
        <ThemeText
          CustomNumberOfLines={1}
          styles={dateTextStyle}
          content={getTimeDisplay(
            timeDifference.minutes,
            timeDifference.hours,
            timeDifference.days,
            timeDifference.years,
          )}
        />
      </View>
      {!isFailedPayment && (
        <FormattedSatText
          containerStyles={styles.amountContainer}
          frontText={
            userBalanceDenomination !== 'hidden'
              ? transaction.details.direction === TRANSACTION_CONSTANTS.INCOMING
                ? '+'
                : '-'
              : ''
          }
          balance={
            isLRC20Payment
              ? formatTokensNumber(transaction.details.amount, token?.decimals)
              : transaction.details.amount
          }
          useCustomLabel={isLRC20Payment}
          customLabel={token?.tokenTicker?.slice(0, 3)}
          useMillionDenomination={true}
        />
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  transactionContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12.5,
    ...CENTER,
  },
  icons: {
    width: 30,
    height: 30,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionContent: {
    flex: 1,
    width: '100%',
    marginRight: 20,
  },
  descriptionText: {
    includeFontPadding: false,
  },
  dateText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },

  amountContainer: {
    marginLeft: 'auto',
    marginBottom: 'auto',
  },
  transactionTimeBanner: {
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
    width: '85%',
    alignItems: 'center',
  },
  noTransactionsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  noTransactionsText: {
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
  },
  mostRecentTxContainer: {
    width: 'auto',
    ...CENTER,
    alignItems: 'center',
  },
  viewAllButton: {
    marginBottom: 10,
  },
});
