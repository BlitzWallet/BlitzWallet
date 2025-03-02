import {Image, StyleSheet, View, TouchableOpacity, Text} from 'react-native';
import {CENTER, COLORS, FONT, ICONS, SIZES} from '../constants';
import {ThemeText} from './CustomElements';
import FormattedSatText from './CustomElements/satTextDisplay';
import {useTranslation} from 'react-i18next';
import Icon from './CustomElements/Icon';
import {useGlobalThemeContext} from '../../context-store/theme';
import {useGlobalContextProvider} from '../../context-store/context';
import {useMemo} from 'react';
import MinHeap from './minHeap';

export default function getFormattedHomepageTxs({
  nodeInformation,
  liquidNodeInformation,
  homepageTxPreferance = 25,
  navigate,
  isBankPage,
  frompage,
  ecashTransactions,
  viewAllTxText,
  noTransactionHistoryText,
  todayText,
  yesterdayText,
  dayText,
  monthText,
  yearText,
  agoText,
}) {
  const arr1 = [...nodeInformation.transactions];

  const n1 = nodeInformation.transactions.length;

  const arr2 = [...liquidNodeInformation.transactions];

  const n2 = liquidNodeInformation.transactions.length;

  const arr3 = [...ecashTransactions];

  const n3 = ecashTransactions.length;

  const conjoinedTxList = isBankPage
    ? mergeArrays({arr2, n2})
    : mergeArrays({arr1, arr2, n1, n2, arr3, n3});

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
          ? arr2.length
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
        const isFailedPayment = !currentTransaction.status === 'complete';
        let paymentDate;
        if (isLiquidPayment) {
          paymentDate = new Date(currentTransaction.timestamp * 1000);
        } else if (isLightningPayment) {
          paymentDate = new Date(currentTransaction.paymentTime * 1000); // could also need to be timd by 1000
        } else {
          paymentDate = new Date(currentTransaction.time);
        }

        const uniuqeIDFromTx = isLiquidPayment
          ? currentTransaction.timestamp
          : isLightningPayment
          ? currentTransaction.paymentTime
          : currentTransaction.time;

        const styledTx = (
          <UserTransaction
            tx={currentTransaction}
            navigate={navigate}
            nodeInformation={nodeInformation}
            isLiquidPayment={isLiquidPayment}
            isLightningPayment={isLightningPayment}
            isEcashPayment={isEcashPayment}
            isFailedPayment={isFailedPayment}
            paymentDate={paymentDate}
            id={uniuqeIDFromTx}
            isBankPage={isBankPage}
            frompage={frompage}
          />
        );

        const timeDifference = (new Date() - paymentDate) / 1000 / 60 / 60 / 24;

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
          (transactionIndex === 0 || currentGroupedDate != bannerText) && //&&
          // paymentDate.toDateString() != new Date().toDateString()
          timeDifference > 0.5 &&
          frompage != 'home'
        ) {
          currentGroupedDate = bannerText;
          formattedTxs.push(dateBanner(bannerText));
        }
        if (
          (currentTransaction?.description === 'Auto Channel Rebalance' ||
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

    if (!isBankPage && frompage != 'viewAllTx')
      formattedTxs.push(
        <TouchableOpacity
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
function mergeArrays({
  arr1 = [],
  arr2 = [],
  n1 = 0,
  n2 = 0,
  arr3 = [],
  n3 = 0,
}) {
  let mergedArray = [];
  const minHeap = new MinHeap();

  // Function to push elements into the heap
  const pushToHeap = (arr, index, identifier) => {
    if (arr[index]) {
      const time =
        arr[index].paymentTime * 1000 ||
        arr[index].timestamp * 1000 ||
        arr[index].time ||
        Infinity;

      const element = {
        ...arr[index],
        [identifier === 'arr1'
          ? 'usesLightningNode'
          : identifier === 'arr2'
          ? 'usesLiquidNode'
          : 'usesEcash']: true,
        source: identifier,
        index,
        time,
      };

      minHeap.add(element);
    }
  };

  // Add first elements of each array to the heap
  if (n1 > 0) pushToHeap(arr1, 0, 'arr1');
  if (n2 > 0) pushToHeap(arr2, 0, 'arr2');
  if (n3 > 0) pushToHeap(arr3, 0, 'arr3');

  // Process heap
  while (!minHeap.isEmpty()) {
    const minElement = minHeap.poll();
    mergedArray.push(minElement);

    // Push next element from the same source array
    let {source, index} = minElement;
    if (source === 'arr1' && index + 1 < n1)
      pushToHeap(arr1, index + 1, 'arr1');
    if (source === 'arr2' && index + 1 < n2)
      pushToHeap(arr2, index + 1, 'arr2');
    if (source === 'arr3' && index + 1 < n3)
      pushToHeap(arr3, index + 1, 'arr3');
  }

  return mergedArray;
}

export function UserTransaction({
  tx: transaction,
  paymentDate,
  isLiquidPayment,
  isLightningPayment,
  isEcashPayment,
  isFailedPayment,
  id,
  navigate,
  isBankPage,
  frompage,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {t} = useTranslation();
  const endDate = new Date();

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
    return ICONS.failedTransaction;
  }, [
    isLiquidPayment,
    isEcashPayment,
    transaction.status,
    darkModeType,
    theme,
  ]);

  const transactionStatusIcon = useMemo(
    () =>
      (transaction.usesLightningNode && transaction.status === 'pending') ||
      (isLiquidPayment && transaction.status === 'pending'),
    [transaction, isLiquidPayment],
  );

  return (
    <TouchableOpacity
      style={{
        width: isBankPage || frompage === 'viewAllTx' ? '90%' : '85%',
        ...CENTER,
      }}
      key={id}
      activeOpacity={0.5}
      onPress={() =>
        navigate.navigate('ExpandedTx', {isFailedPayment, transaction})
      }>
      <View style={styles.transactionContainer}>
        {transactionStatusIcon ? (
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
                        ? transaction?.paymentType !== 'receive'
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
                  ? COLORS.failedTransaction
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
                : masterInfoObject.userBalanceDenomination === 'hidden'
                ? '*****'
                : isLiquidPayment
                ? transaction?.details?.description ||
                  (transaction?.paymentType !== 'receive'
                    ? t('constants.sent')
                    : t('constants.received'))
                : isLightningPayment && transaction?.details?.data?.lnAddress
                ? transaction?.details?.data?.label
                : transaction?.description ||
                  (transaction.paymentType === 'sent'
                    ? t('constants.sent')
                    : t('constants.received'))
            }
          />

          <ThemeText
            styles={{
              ...styles.dateText,
              color:
                isFailedPayment || transaction.paymentType === 'closed_channel'
                  ? COLORS.failedTransaction
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
              masterInfoObject.userBalanceDenomination !== 'hidden'
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
}

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
