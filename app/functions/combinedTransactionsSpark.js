import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import {
  APPROXIMATE_SYMBOL,
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  CENTER,
  COLORS,
  FONT,
  HIDDEN_BALANCE_TEXT,
  ICONS,
  SIZES,
  SKELETON_ANIMATION_SPEED,
  USDB_TOKEN_ID,
} from '../constants';
import GetThemeColors from '../hooks/themeColors';
import { ThemeText } from './CustomElements';
import FormattedSatText from './CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import React, { memo, useMemo, useCallback } from 'react';
import { crashlyticsLogReport } from './crashlyticsLogs';
import SkeletonPlaceholder from './CustomElements/skeletonView';
import formatTokensNumber from './lrc20/formatTokensBalance';
import { getTimeDisplay } from './contacts';
import { isFlashnetTransfer } from './spark/handleFlashnetTransferIds';
import { satsToDollars } from './spark/flashnet';
import ThemeIcon from './CustomElements/themeIcon';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../constants/theme';

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
    height: 40,
    width: 40,
    marginRight: 12,
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
    ? INSET_WINDOW_WIDTH
    : '100%';
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
        paddingVertical:
          frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE ? 13 : 0,
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

// Add this helper OUTSIDE the component (after TRANSACTION_CONSTANTS)
const getTxIconName = (
  details,
  transactionPaymentType,
  showSwapConversion,
  isFailedPayment,
  isReceive,
) => {
  // Default: Lightning / Bitcoin / Spark — directional arrows
  return { icon: isReceive ? 'ArrowDown' : 'ArrowUp', bg: null };
  if (isFailedPayment) return { icon: 'CircleX', bg: null };

  // Pending / swap pending
  if (showSwapConversion) return { icon: 'Clock', bg: null };

  // Savings
  // if (details.isSavings) {
  //   // Determine which asset icon to use
  //   const useDollars =
  //     details.direction === 'OUTGOING' ||
  //     (details.direction === 'INCOMING' && details.isLRC20Payment);
  //   return { icon: null, isSavings: true, useDollars };
  // }

  // Gifts
  if (details.isGift) return { icon: 'Gift', bg: null };

  // Pools
  if (details.isPoolPayment) return { icon: 'PiggyBank', bg: null };

  // Contacts (has a sendingUUID)
  if (details.sendingUUID?.trim()) return { icon: 'UsersRound', bg: null };

  // Swaps (showSwapLabel = incoming swap, or LRC20 outgoing on ln/btc rails)
  if (
    details.showSwapLabel ||
    (details.isLRC20Payment &&
      details.direction === 'OUTGOING' &&
      (transactionPaymentType === 'lightning' ||
        transactionPaymentType === 'bitcoin'))
  ) {
    return { icon: 'ArrowLeftRight', bg: null };
  }
};

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
    scrollPosition,
    poolInfoRef,
  } = props;

  // Remove unnecessary console.logs for performance
  // crashlyticsLogReport('Starting re-rendering of formatted transactions');

  // if (!didGetToHomepage) {
  //   return null;
  // }
  const shownTxs = new Set();
  const sparkTransactions = sparkInformation?.transactions;
  const sparkTransactionsLength = sparkTransactions?.length || 0;

  let formattedTxs = [];
  let ln_funding_txIds = new Set();
  let currentGroupedDate = '';
  const transactionLimit =
    frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE
      ? sparkTransactionsLength
      : homepageTxPreferance;

  // Early return with loading skeleton
  if (
    (!sparkInformation.didConnect ||
      !sparkInformation.identityPubKey ||
      !didGetToHomepage) &&
    sparkTransactionsLength
  ) {
    formattedTxs.push(createLoadingSkeleton(1, frompage, theme, darkModeType));
  }

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
      const hasSavedTokenData =
        sparkInformation.tokens?.[paymentDetails.LRC20Token];

      if (paymentDetails?.ln_funding_id) {
        // add any ln funding txs ids here
        ln_funding_txIds.add(paymentDetails.ln_funding_id);
      }

      const showSwapConversion =
        paymentDetails.performSwaptoUSD &&
        (!paymentDetails.completedSwaptoUSD ||
          !ln_funding_txIds.has(currentTransaction.sparkID));

      // Early continue conditions
      if (
        !enabledLRC20 &&
        isLRC20Payment &&
        paymentDetails.LRC20Token !== USDB_TOKEN_ID
      )
        continue;

      if (
        paymentDetails.senderIdentityPublicKey ===
        process.env.SPARK_IDENTITY_PUBKEY
      )
        continue;
      if (shownTxs.has(currentTransaction.sparkID)) continue;
      if (isLRC20Payment && !hasSavedTokenData) continue;
      if (paymentStatus === TRANSACTION_CONSTANTS.FAILED) continue;
      if (
        transactionPaymentType === TRANSACTION_CONSTANTS.LIGHTNING &&
        currentTransaction.status === TRANSACTION_CONSTANTS.LIGHTNING_INITIATED
      )
        continue;
      if (
        frompage === TRANSACTION_CONSTANTS.HOME &&
        isFlashnetTransfer(currentTransaction.sparkID)
      )
        continue;
      if (
        scrollPosition === 'total' &&
        paymentDetails.showSwapLabel &&
        paymentDetails.direction === 'OUTGOING'
      )
        continue;
      if (
        (scrollPosition === 'sats' && isLRC20Payment) ||
        (scrollPosition === 'sats' && showSwapConversion)
      )
        continue;

      if (
        (scrollPosition === 'usd' &&
          isLRC20Payment &&
          paymentDetails.LRC20Token !== USDB_TOKEN_ID) ||
        (scrollPosition === 'usd' && !isLRC20Payment && !showSwapConversion)
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
          poolInfoRef={poolInfoRef}
          showSwapConversion={showSwapConversion}
        />
      );
      shownTxs.add(uniuqeIDFromTx);
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
    if (frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE) {
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
    } else {
      return [
        {
          type: 'tx',
          item: (
            <View
              style={[styles.transactionContainer, { paddingVertical: 0 }]}
              key="noTx"
            >
              <View
                style={[
                  styles.icons,
                  {
                    backgroundColor: theme
                      ? 'rgba(255,255,255,0.07)'
                      : 'rgba(0,0,0,0.055)',
                  },
                ]}
              >
                <ThemeIcon
                  size={22}
                  iconName={'Clock'}
                  colorOverride={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                />
              </View>

              <View style={styles.transactionContent}>
                <ThemeText
                  CustomEllipsizeMode="tail"
                  CustomNumberOfLines={1}
                  styles={styles.descriptionText}
                  content={'No transactions yet'}
                />
              </View>
            </View>
          ),
          key: 'noTx',
        },
      ];
    }
  }

  // Mark the first and last tx item so they can adjust their dividers/styles
  if (frompage === TRANSACTION_CONSTANTS.HOME) {
    let firstTxIdx = -1;
    let lastTxIdx = -1;

    formattedTxs.forEach((item, idx) => {
      if (item.type === 'tx') {
        if (firstTxIdx === -1) firstTxIdx = idx;
        lastTxIdx = idx;
      }
    });

    if (firstTxIdx >= 0) {
      const firstEntry = formattedTxs[firstTxIdx];
      formattedTxs[firstTxIdx] = {
        ...firstEntry,
        item: React.cloneElement(firstEntry.item, { isFirstItem: true }),
      };
    }

    if (lastTxIdx >= 0) {
      const lastEntry = formattedTxs[lastTxIdx];
      formattedTxs[lastTxIdx] = {
        ...lastEntry,
        item: React.cloneElement(lastEntry.item, { isLastItem: true }),
      };
    }
  }

  // Add "View All" button if conditions are met
  // if (
  //   frompage !== TRANSACTION_CONSTANTS.VIEW_ALL_PAGE &&
  //   frompage !== TRANSACTION_CONSTANTS.SPARK_WALLET &&
  //   frompage !== TRANSACTION_CONSTANTS.HOME &&
  //   formattedTxs.length === homepageTxPreferance
  // ) {
  //   formattedTxs.push({
  //     type: 'tx',
  //     item: (
  //       <TouchableOpacity
  //         key="view_all_tx_btn"
  //         style={[styles.viewAllButton, CENTER]}
  //         onPress={() => navigate.navigate('ViewAllTxPage')}
  //       >
  //         <ThemeText content={viewAllTxText} styles={styles.headerText} />
  //       </TouchableOpacity>
  //     ),
  //     key: 'view_all_tx_btn',
  //   });
  // }

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
  poolInfoRef,
  showSwapConversion,
  isLastItem,
  isFirstItem,
}) {
  const { t } = useTranslation();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();

  const timeDifference = useMemo(
    () => calculateTimeDifference(currentTime, paymentDate),
    [currentTime, paymentDate],
  );

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
    transaction.paymentStatus === TRANSACTION_CONSTANTS.PENDING ||
    transaction.isBalancePending ||
    showSwapConversion;

  const isReceive =
    transaction.details.direction === TRANSACTION_CONSTANTS.INCOMING;

  const txIconMeta = getTxIconName(
    transaction.details,
    transactionPaymentType,
    showSwapConversion,
    isFailedPayment,
    isReceive,
  );

  const isGrayMode = theme && darkModeType;

  const iconBg =
    frompage === TRANSACTION_CONSTANTS.HOME
      ? backgroundColor
      : backgroundOffset;

  const iconColor = isGrayMode
    ? isReceive
      ? 'rgba(255,255,255,0.75)' // visible gray arrow for incoming
      : textColor // outgoing uses normal text color on darker bg
    : isReceive
    ? COLORS.primary
    : isFailedPayment
    ? theme && darkModeType
      ? COLORS.darkModeText
      : COLORS.cancelRed
    : textColor;

  const amountColor = textColor;
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
        paddingTop:
          frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE
            ? 13
            : isFirstItem
            ? 0
            : 13,
        paddingBottom:
          frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE
            ? 13
            : isLastItem
            ? 0
            : 13,
      }}
      activeOpacity={frompage === TRANSACTION_CONSTANTS.SPARK_WALLET ? 1 : 0.5}
      onPress={handlePress}
    >
      {showPendingTransactionStatusIcon ? (
        <View style={[styles.icons, { backgroundColor: iconBg }]}>
          <ThemeIcon size={22} iconName="Clock" colorOverride={iconColor} />
        </View>
      ) : (
        <View style={[styles.icons, { backgroundColor: iconBg }]}>
          <ThemeIcon
            size={22}
            iconName={txIconMeta.icon}
            colorOverride={iconColor}
          />
        </View>
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
        <View>
          {showSwapConversion ? (
            <FormattedSatText
              neverHideBalance={
                frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE
              }
              containerStyles={styles.amountContainer}
              styles={{ color: amountColor }}
              frontText={APPROXIMATE_SYMBOL}
              balance={
                satsToDollars(
                  transaction.details.amount,
                  poolInfoRef.currentPriceAInB,
                ) *
                (1 - (poolInfoRef.lpFeeBps / 100 + 1) / 100)
              }
              useCustomLabel={true}
              customLabel={token?.tokenTicker || 'USDB'}
              useMillionDenomination={true}
            />
          ) : (
            <FormattedSatText
              neverHideBalance={
                frompage === TRANSACTION_CONSTANTS.VIEW_ALL_PAGE
              }
              containerStyles={styles.amountContainer}
              styles={{ color: amountColor }}
              frontText={
                userBalanceDenomination !== 'hidden'
                  ? transaction.details.direction ===
                    TRANSACTION_CONSTANTS.INCOMING
                    ? '+'
                    : '-'
                  : ''
              }
              balance={
                isLRC20Payment
                  ? formatTokensNumber(
                      transaction.details.amount,
                      token?.decimals,
                    )
                  : transaction.details.amount
              }
              useCustomLabel={isLRC20Payment}
              customLabel={token?.tokenTicker}
              useMillionDenomination={true}
            />
          )}
        </View>
      )}
      {!isLastItem && (
        <View style={[styles.txDivider, { backgroundColor: textColor }]} />
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  transactionContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    position: 'relative',
    ...CENTER,
  },
  icons: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  transactionContent: {
    flex: 1,
    width: '100%',
    marginRight: 12,
  },
  descriptionText: {
    includeFontPadding: false,
  },
  dateText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: HIDDEN_OPACITY,
  },
  txDivider: {
    position: 'absolute',
    bottom: 0,
    left: 68,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.08,
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
    // marginTop: 15,
  },
  noTransactionsText: {
    width: INSET_WINDOW_WIDTH,
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
