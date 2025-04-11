import {Image, StyleSheet, View, TouchableOpacity, Text} from 'react-native';
import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  CENTER,
  COLORS,
  HIDDEN_BALANCE_TEXT,
  ICONS,
  SIZES,
} from '../constants';
import {ThemeText} from './CustomElements';
import FormattedSatText from './CustomElements/satTextDisplay';
import {useTranslation} from 'react-i18next';
import Icon from './CustomElements/Icon';
import {memo, useMemo} from 'react';
import {mergeArrays} from './mergeArrays';
import {crashlyticsLogReport} from './crashlyticsLogs';

export default function getFormattedHomepageTxs({
  combinedTransactions,
  currentTime,
  liquidNodeInformation,
  homepageTxPreferance = 25,
  navigate,
  isBankPage,
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
}) {
  crashlyticsLogReport('Starting re-rendering of formatted transactions');
  const arr2 = liquidNodeInformation?.transactions;
  const n2 = liquidNodeInformation?.transactions?.length;

  const conjoinedTxList = isBankPage
    ? mergeArrays({arr2, n2})
    : combinedTransactions;

  console.log(conjoinedTxList?.length, combinedTransactions?.length);
  console.log('re-rendering transactions');

  if (conjoinedTxList.length === 0) {
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
        (isBankPage
          ? n2
          : frompage === 'viewAllTx'
          ? conjoinedTxList.length
          : homepageTxPreferance) &&
      transactionIndex < conjoinedTxList.length
    ) {
      try {
        const currentTransaction = conjoinedTxList[transactionIndex];
        const isLiquidPayment = currentTransaction.usesLiquidNode;
        const isLightningPayment = currentTransaction.usesLightningNode;
        const isEcashPayment = currentTransaction.usesEcash;
        const isFailedPayment =
          !(currentTransaction.status === 'complete') &&
          !!currentTransaction?.error;

        let paymentDate;
        if (isLiquidPayment) {
          paymentDate = currentTransaction.timestamp * 1000;
        } else if (isLightningPayment) {
          paymentDate = currentTransaction.paymentTime * 1000; // could also need to be timd by 1000
        } else {
          paymentDate = currentTransaction.time;
        }

        const uniuqeIDFromTx = isLiquidPayment
          ? currentTransaction.timestamp
          : isLightningPayment
          ? currentTransaction.paymentTime
          : currentTransaction.time;

        const styledTx = (
          <UserTransaction
            tx={currentTransaction}
            currentTime={currentTime}
            navigate={navigate}
            isLiquidPayment={isLiquidPayment}
            isLightningPayment={isLightningPayment}
            isEcashPayment={isEcashPayment}
            isFailedPayment={isFailedPayment}
            paymentDate={paymentDate}
            id={uniuqeIDFromTx}
            isBankPage={isBankPage}
            frompage={frompage}
            theme={theme}
            darkModeType={darkModeType}
            userBalanceDenomination={userBalanceDenomination}
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
          (currentTransaction?.description === 'Auto Channel Rebalance' ||
            currentTransaction?.description === 'Auto Channel Open' ||
            currentTransaction?.description?.toLowerCase() ===
              'internal_transfer') &&
          frompage != 'viewAllTx'
        )
          throw Error('Do not show transaction');
        if (
          frompage != 'viewAllTx' &&
          !isBankPage &&
          isLiquidPayment &&
          (currentTransaction.details?.description ===
            'Auto Channel Rebalance' ||
            currentTransaction.details?.description === 'Auto Channel Open' ||
            currentTransaction.details?.description?.toLowerCase() ===
              'internal_transfer')
        )
          throw Error('Do not show transaction');
        formattedTxs.push(styledTx);
      } catch (err) {
        console.log(err);
      } finally {
        transactionIndex += 1;
      }
    }

    if (
      !isBankPage &&
      frompage != 'viewAllTx' &&
      formattedTxs?.length == homepageTxPreferance
    )
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
  isLiquidPayment,
  isLightningPayment,
  isEcashPayment,
  isFailedPayment,
  id,
  navigate,
  isBankPage,
  frompage,
  theme,
  darkModeType,
  userBalanceDenomination,
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
    if (
      isLiquidPayment ||
      transaction.status === 'complete' ||
      isEcashPayment
    ) {
      return darkModeType && theme
        ? ICONS.arrow_small_left_white
        : ICONS.smallArrowLeft;
    }
    return darkModeType && theme
      ? ICONS.failedTransactionWhite
      : ICONS.failedTransaction;
  }, [
    isLiquidPayment,
    isEcashPayment,
    transaction.status,
    darkModeType,
    theme,
  ]);

  const showPendingTransactionStatusIcon = useMemo(
    () =>
      (transaction.usesLightningNode &&
        transaction.status === 'pending' &&
        !isFailedPayment) ||
      (isLiquidPayment && transaction.status === 'pending'),
    [transaction, isLiquidPayment, isFailedPayment],
  );

  const paymentDescription = isLiquidPayment
    ? transaction?.details?.lnurlInfo?.lnurlPayComment ||
      transaction?.details?.description
    : isLightningPayment
    ? (transaction?.details?.data?.lnAddress &&
        transaction?.details?.data?.label) ||
      transaction?.description
    : transaction?.description;
  const isDefaultDescription =
    paymentDescription === BLITZ_DEFAULT_PAYMENT_DESCRIPTION ||
    paymentDescription === 'Liquid transfer' ||
    paymentDescription === 'Lightning payment';

  return (
    <TouchableOpacity
      style={{
        width: isBankPage || frompage === 'viewAllTx' ? '90%' : '85%',
        ...CENTER,
      }}
      key={id}
      activeOpacity={0.5}
      onPress={() => {
        crashlyticsLogReport('Navigatin to expanded tx from user transaction');
        navigate.navigate('ExpandedTx', {isFailedPayment, transaction});
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
                    rotate:
                      transaction.paymentType === 'closed_channel'
                        ? '0deg'
                        : isLiquidPayment
                        ? transaction?.paymentType !== 'receive' &&
                          transaction?.paymentType !== 'received'
                          ? '130deg'
                          : '310deg'
                        : transaction.status === 'complete' ||
                          transaction.type === 'ecash'
                        ? transaction.paymentType === 'sent'
                          ? '130deg'
                          : '310deg'
                        : '0deg',
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
              color:
                isFailedPayment || transaction.paymentType === 'closed_channel'
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.failedTransaction
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
              fontStyle:
                isFailedPayment || transaction.paymentType === 'closed_channel'
                  ? 'italic'
                  : 'normal',
              marginRight: 20,
            }}
            content={
              isFailedPayment
                ? t('transactionLabelText.failed')
                : userBalanceDenomination === 'hidden'
                ? `${HIDDEN_BALANCE_TEXT}`
                : isDefaultDescription || !paymentDescription
                ? transaction?.paymentType !== 'receive' &&
                  transaction?.paymentType !== 'received'
                  ? t('constants.sent')
                  : t('constants.received')
                : paymentDescription
            }
          />

          <ThemeText
            styles={{
              ...styles.dateText,
              color:
                isFailedPayment || transaction.paymentType === 'closed_channel'
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.failedTransaction
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
              fontStyle:
                isFailedPayment || transaction.paymentType === 'closed_channel'
                  ? 'italic'
                  : 'normal',
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
            isFailedPayment={
              isFailedPayment || transaction.paymentType === 'closed_channel'
            }
            containerStyles={{marginLeft: 'auto', marginBottom: 'auto'}}
            frontText={
              userBalanceDenomination !== 'hidden'
                ? transaction.paymentType === 'closed_channel'
                  ? ''
                  : isLiquidPayment
                  ? transaction?.paymentType === 'receive'
                    ? '+'
                    : '-'
                  : transaction.paymentType === 'received'
                  ? '+'
                  : '-'
                : ''
            }
            styles={{
              ...styles.amountText,
              color:
                isFailedPayment || transaction.paymentType === 'closed_channel'
                  ? COLORS.failedTransaction
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            balance={
              isLiquidPayment
                ? transaction.amountSat
                : transaction.type === 'ecash'
                ? transaction.amount
                : transaction.amountMsat / 1000
            }
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
  },
  dateText: {
    fontSize: SIZES.small,
    fontWeight: 300,
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
