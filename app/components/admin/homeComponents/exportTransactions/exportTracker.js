import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import writeAndShareFileToFilesystem from '../../../../functions/writeFileToFilesystem';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import {useSparkWallet} from '../../../../../context-store/sparkContext';

export default function ConfirmExportPayments({
  startExport,
  theme,
  darkModeType,
}) {
  const navigate = useNavigation();
  const {sparkInformation} = useSparkWallet();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const totalPayments = sparkInformation?.transactions?.length || 10;

  const [txNumber, setTxNumber] = useState(0);

  useEffect(() => {
    async function generateCSV() {
      if (!startExport) return;
      try {
        crashlyticsLogReport('Stating transaction exporting');
        const headers = [
          [
            'Payment Type',
            'Description',
            'Date',
            'Transaction Fees (sat)',
            'Amount (sat)',
            'Sent/Received',
          ],
        ];

        const conjoinedTxList = sparkInformation.transactions;
        let formatedData = [];

        for (let index = 0; index < conjoinedTxList.length; index++) {
          const tx = conjoinedTxList[index];

          setTxNumber(prev => (prev += 1));

          try {
            const txDetails = JSON.parse(tx.details);
            const txDate = new Date(txDetails.time);

            const formattedTx = [
              tx.paymentType,
              txDetails.description ? txDetails.description : 'No description',
              txDate.toLocaleString().replace(/,/g, ' '),
              Math.round(txDetails.fee).toLocaleString().replace(/,/g, ' '),
              Math.round(txDetails.amount).toLocaleString().replace(/,/g, ' '),
              txDetails.direction === 'OUTGOING' ? 'Sent' : 'Receiived',
            ];
            formatedData.push(formattedTx);
          } catch (err) {
            console.log(err);
          }
        }

        const csvData = headers.concat(formatedData).join('\n');
        const fileName = 'BlitzWallet.csv';

        await writeAndShareFileToFilesystem(
          csvData,
          fileName,
          'text/csv',
          navigate,
        );
        navigate.goBack();
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Unable to create transaction file',
        });
      }
    }
    generateCSV();
  }, [startExport]);

  const onSwipeSuccess = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'exportTransactions',
      startExport: true,
      sliderHight: 0.5,
    });
  }, []);

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
        styles={{width: INSET_WINDOW_WIDTH, ...CENTER}}
        content={
          'Export your payment history in CSV (comma seperated value) format.'
        }
      />
      <View
        style={{
          width: '100%',
          marginBottom: 10,
          flex: 1,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
        {txNumber === 0 ? (
          <ThemeText content={`${totalPayments} payments`} />
        ) : (
          <FullLoadingScreen
            showLoadingIcon={false}
            containerStyles={{justifyContent: 'flex-end'}}
            text={`${txNumber} of ${totalPayments}`}
          />
        )}
      </View>
      <SwipeButtonNew
        onSwipeSuccess={onSwipeSuccess}
        width={0.95}
        title="Slide to export"
        shouldAnimateViewOnSuccess={true}
        containerStyles={styles.swipeBTNContainer}
        thumbIconStyles={dynamicStyles}
        railStyles={dynamicStyles}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  containerStyle: {
    flex: 1,
    alignItems: 'center',
  },
  swipeBTNContainer: {
    marginBottom: 20,
  },
});
