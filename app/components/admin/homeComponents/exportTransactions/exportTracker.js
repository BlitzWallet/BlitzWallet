import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import writeAndShareFileToFilesystem from '../../../../functions/writeFileToFilesystem';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useTranslation } from 'react-i18next';
import { getAllSparkTransactions } from '../../../../functions/spark/transactions';
import { formatBalanceAmount } from '../../../../functions';
import { useGlobalContextProvider } from '../../../../../context-store/context';

export default function ConfirmExportPayments({
  startExport,
  theme,
  darkModeType,
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { sparkInformation } = useSparkWallet();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const onSwipeSuccess = useCallback(() => {
    setTimeout(async () => {
      try {
        const allTxs = await getAllSparkTransactions({
          accountId: sparkInformation.identityPubKey,
        });
        if (!allTxs || !allTxs.length) return;
        crashlyticsLogReport('Stating transaction exporting');
        const headers = [
          [
            t('wallet.exportTransactions.paymentType'),
            t('wallet.exportTransactions.description'),
            t('wallet.exportTransactions.date'),
            t('wallet.exportTransactions.txFees'),
            t('wallet.exportTransactions.amount'),
            t('wallet.exportTransactions.sent/received'),
          ],
        ];

        const conjoinedTxList = allTxs;
        let formatedData = [];

        for (let index = 0; index < conjoinedTxList.length; index++) {
          const tx = conjoinedTxList[index];

          try {
            const txDetails = JSON.parse(tx.details);
            const txDate = new Date(txDetails.time);

            const formattedTx = [
              tx.paymentType,
              txDetails.description
                ? txDetails.description
                : t('constants.noDescription'),
              txDate.toLocaleString().replace(/,/g, ' '),
              formatBalanceAmount(txDetails.fee, undefined, masterInfoObject),
              formatBalanceAmount(
                txDetails.amount,
                undefined,
                masterInfoObject,
              ),
              txDetails.direction === 'OUTGOING'
                ? t('constants.sent')
                : t('constants.received'),
            ];
            formatedData.push(formattedTx);
          } catch (err) {
            console.log(err);
          }
        }

        const csvData = headers
          .concat(formatedData)
          .map(row =>
            row
              .map(field => `"${String(field).replace(/"/g, '""')}"`)
              .join(','),
          )
          .join('\n');

        const fileName = 'BlitzWallet.csv';

        const response = await writeAndShareFileToFilesystem(
          csvData,
          fileName,
          'text/csv',
        );

        navigate.goBack();
        if (!response.success) {
          setTimeout(() => {
            navigate.navigate('ErrorScreen', {
              errorMessage: response.error,
              useTranslationString: true,
            });
          }, 200);
        }
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'errormessages.createTransactionsFileError',
          useTranslationString: true,
        });
      }
    }, 1000);
  }, [
    masterInfoObject.thousandsSeperator,
    masterInfoObject.userSelectedLanguage,
  ]);

  const dynamicStyles = useMemo(() => {
    return {
      backgroundColor:
        theme && darkModeType ? backgroundOffset : backgroundColor,
      borderColor: theme && darkModeType ? backgroundOffset : backgroundColor,
    };
  }, [theme, darkModeType]);

  return (
    <View style={styles.containerStyle}>
      <ThemeText
        styles={styles.titleText}
        content={t('wallet.exportTransactions.title')}
      />
      <View style={styles.loadingMessageContainer} />
      <SwipeButtonNew
        onSwipeSuccess={onSwipeSuccess}
        width={0.95}
        title={t('constants.slideToExport')}
        shouldAnimateViewOnSuccess={true}
        thumbIconStyles={dynamicStyles}
        railStyles={dynamicStyles}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleText: { width: INSET_WINDOW_WIDTH, ...CENTER, textAlign: 'center' },
  containerStyle: {
    flex: 1,
    alignItems: 'center',
  },
  loadingMessageContainer: {
    width: '100%',
    marginBottom: 10,
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
