import {Image, StyleSheet, View, TouchableOpacity} from 'react-native';
import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  CENTER,
  COLORS,
  HIDDEN_BALANCE_TEXT,
  ICONS,
  SIZES,
  SKELETON_ANIMATION_SPEED,
} from '../constants';
import {ThemeText} from './CustomElements';
import FormattedSatText from './CustomElements/satTextDisplay';
import {useTranslation} from 'react-i18next';
import Icon from './CustomElements/Icon';
import {memo, useMemo} from 'react';
import {crashlyticsLogReport} from './crashlyticsLogs';
import SkeletonPlaceholder from './CustomElements/skeletonView';

export default function getFormattedHomepageTxsForSpark({
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
  numberOfCachedTxs,
}) {
  crashlyticsLogReport('Starting re-rendering of formatted transactions');
  const sparkTransactions = sparkInformation?.transactions;
  const sparkTransactionsLength = sparkInformation?.transactions?.length;

  console.log(sparkTransactionsLength);
  console.log('re-rendering transactions');

  if (!sparkInformation.didConnect && numberOfCachedTxs) {
    const arraryLength = numberOfCachedTxs >= 20 ? 20 : numberOfCachedTxs;
    const loadingTxElements = Array.from(
      {length: arraryLength},
      (_, i) => i + 1,
    ).map(item => {
      return (
        <View
          key={item}
          style={{
            ...styles.transactionContainer,
            width: '85%',
            ...CENTER,
            backgroundColor: 'green',
          }}>
          <View
            style={{
              height: 50,
              width: 50,
              marginRight: 10,
              borderRadius: 100,
            }}
          />
          <View style={{flex: 1, height: 30}}>
            <View style={{flex: 1, marginBottom: 10, borderRadius: 100}} />
            <View style={{flex: 1, borderRadius: 100}} />
          </View>
        </View>
      );
    });
    return [
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
        speed={SKELETON_ANIMATION_SPEED}>
        {loadingTxElements}
      </SkeletonPlaceholder>,
    ];
  }

  if (!sparkTransactionsLength) {
    return [
      <View style={[styles.noTransactionsContainer]} key={'noTx'}>
        <ThemeText
          content={noTransactionHistoryText}
          styles={{...styles.noTransactionsText}}
        />
      </View>,
    ];
  } else {
    let formattedTxs = [];
    let currentGroupedDate = '';
    let transactionIndex = 0;

    while (
      formattedTxs.length <
        (frompage === 'viewAllTx'
          ? sparkTransactionsLength
          : homepageTxPreferance) &&
      transactionIndex < sparkTransactionsLength
    ) {
      try {
        const currentTransaction = sparkTransactions[transactionIndex];
        const transactionPaymentType = currentTransaction.paymentType;
        const paymentDetials = JSON.parse(currentTransaction.details);

        const isFailedPayment = currentTransaction.paymentStatus === 'failed';

        const paymentDate = new Date(paymentDetials.time).getTime();

        const uniuqeIDFromTx = currentTransaction.sparkID;

        const styledTx = (
          <UserTransaction
            tx={{...currentTransaction, details: paymentDetials}}
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
          />
        );

        const timeDifference =
          (currentTime - paymentDate) / 1000 / 60 / 60 / 24;

        const bannerText =
          timeDifference < 0.5
            ? todayText
            : timeDifference > 0.5 && timeDifference < 1
            ? yesterdayText
            : Math.round(timeDifference) <= 30
            ? `${Math.round(timeDifference)} ${
                Math.round(timeDifference) === 1 ? dayText : dayText + 's'
              } ${agoText}`
            : Math.round(timeDifference) > 30 &&
              Math.round(timeDifference) < 365
            ? `${Math.floor(Math.round(timeDifference) / 30)} ${monthText}${
                Math.floor(Math.round(timeDifference) / 30) === 1 ? '' : 's'
              } ${agoText}`
            : `${Math.floor(Math.round(timeDifference) / 365)} ${yearText}${
                Math.floor(Math.round(timeDifference) / 365) ? '' : 's'
              } ${agoText}`;

        if (
          (transactionIndex === 0 || currentGroupedDate != bannerText) &&
          timeDifference > 0.5 &&
          frompage != 'home'
        ) {
          currentGroupedDate = bannerText;
          formattedTxs.push(dateBanner(bannerText));
        }

        if (
          currentTransaction.paymentStatus === 'failed' &&
          paymentDetials.direction === 'INCOMING'
        )
          throw new Error("Don't show failed incoming txs.");

        if (
          transactionPaymentType === 'lightning' &&
          currentTransaction.status === 'LIGHTNING_PAYMENT_INITIATED'
        )
          throw Error('Lightning invoice has not been paid yet, hiding...');

        formattedTxs.push(styledTx);
      } catch (err) {
        console.log(err);
      } finally {
        transactionIndex += 1;
      }
    }

    if (frompage != 'viewAllTx' && formattedTxs?.length == homepageTxPreferance)
      formattedTxs.push(
        <TouchableOpacity
          key={'view_all_tx_btn'}
          style={{marginBottom: 10, ...CENTER}}
          onPress={() => {
            navigate.navigate('ViewAllTxPage');
          }}>
          <ThemeText content={viewAllTxText} styles={{...styles.headerText}} />
        </TouchableOpacity>,
      );

    return formattedTxs;
  }
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
}) {
  const {t} = useTranslation();

  const endDate = currentTime;

  const timeDifferenceMs = endDate - paymentDate;

  const timeDifference = useMemo(() => {
    const minutes = timeDifferenceMs / (1000 * 60);
    const hours = minutes / 60;
    const days = hours / 24;
    const years = days / 365;
    return {minutes, hours, days, years};
  }, [timeDifferenceMs]);

  const paymentImage = useMemo(() => {
    return transaction.paymentStatus === 'completed'
      ? darkModeType && theme
        ? ICONS.arrow_small_left_white
        : ICONS.smallArrowLeft
      : darkModeType && theme
      ? ICONS.failedTransactionWhite
      : ICONS.failedTransaction;
  }, [transactionPaymentType, transaction, darkModeType, theme]);

  const showPendingTransactionStatusIcon =
    transaction.paymentStatus === 'pending';

  const paymentDescription = transaction.details?.description;
  const isDefaultDescription =
    paymentDescription === BLITZ_DEFAULT_PAYMENT_DESCRIPTION;

  return (
    <TouchableOpacity
      style={{
        width: frompage === 'viewAllTx' ? '90%' : '85%',
        ...CENTER,
      }}
      key={id}
      activeOpacity={0.5}
      onPress={() => {
        crashlyticsLogReport('Navigatin to expanded tx from user transaction');
        navigate.navigate('ExpandedTx', {isFailedPayment: {}, transaction});
      }}>
      <View style={styles.transactionContainer}>
        {showPendingTransactionStatusIcon ? (
          <View style={styles.icons}>
            <Icon
              width={27}
              height={27}
              color={
                darkModeType && theme ? COLORS.darkModeText : COLORS.primary
              }
              name={'pendingTxIcon'}
            />
          </View>
        ) : (
          <Image
            source={paymentImage}
            style={[
              styles.icons,
              {
                transform: [
                  {
                    rotate: showPendingTransactionStatusIcon
                      ? '0deg'
                      : transaction.details.direction === 'INCOMING'
                      ? '310deg'
                      : '130deg',
                  },
                ],
              },
            ]}
            resizeMode="contain"
          />
        )}

        <View style={{flex: 1, width: '100%'}}>
          <ThemeText
            CustomEllipsizeMode="tail"
            CustomNumberOfLines={1}
            styles={{
              ...styles.descriptionText,
              color: isFailedPayment
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.failedTransaction
                : theme
                ? COLORS.darkModeText
                : COLORS.lightModeText,
              fontStyle: isFailedPayment ? 'italic' : 'normal',
              marginRight: 20,
            }}
            content={
              isFailedPayment
                ? t('transactionLabelText.failed')
                : userBalanceDenomination === 'hidden'
                ? `${HIDDEN_BALANCE_TEXT}`
                : isDefaultDescription || !paymentDescription
                ? transaction.details.direction === 'OUTGOING'
                  ? t('constants.sent')
                  : t('constants.received')
                : paymentDescription
            }
          />

          <ThemeText
            styles={{
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
            }}
            content={`${
              timeDifference.minutes <= 1
                ? `Just now`
                : timeDifference.minutes <= 60
                ? Math.round(timeDifference.minutes) || ''
                : timeDifference.hours <= 24
                ? Math.round(timeDifference.hours)
                : timeDifference.days <= 365
                ? Math.round(timeDifference.days)
                : Math.round(timeDifference.years)
            } ${
              timeDifference.minutes <= 1
                ? ''
                : timeDifference.minutes <= 60
                ? t('constants.minute') +
                  (Math.round(timeDifference.minutes) === 1 ? '' : 's')
                : timeDifference.hours <= 24
                ? t('constants.hour') +
                  (Math.round(timeDifference.hours) === 1 ? '' : 's')
                : timeDifference.days <= 365
                ? t('constants.day') +
                  (Math.round(timeDifference.days) === 1 ? '' : 's')
                : Math.round(timeDifference.years) === 1
                ? 'year'
                : 'years'
            } ${
              timeDifference.minutes < 1 ? '' : t('transactionLabelText.ago')
            }`}
          />
        </View>
        {!isFailedPayment && (
          <FormattedSatText
            containerStyles={{marginLeft: 'auto', marginBottom: 'auto'}}
            frontText={
              userBalanceDenomination !== 'hidden'
                ? transaction.details.direction === 'INCOMING'
                  ? '+'
                  : '-'
                : ''
            }
            styles={styles.amountText}
            balance={transaction.details.amount}
          />
        )}
      </View>
    </TouchableOpacity>
  );
});

export function dateBanner(bannerText) {
  return (
    <View key={bannerText}>
      <ThemeText
        styles={{
          ...styles.transactionTimeBanner,
        }}
        content={`${bannerText}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  transactionContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12.5,
    ...CENTER,
  },
  icons: {
    width: 30,
    height: 30,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  descriptionText: {
    fontWeight: 400,
    marginRight: 20,
  },
  dateText: {
    fontSize: SIZES.small,
  },
  amountText: {
    fontWeight: 400,
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
});
