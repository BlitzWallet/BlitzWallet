import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ThemeText} from '../../../../functions/CustomElements';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import GetThemeColors from '../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import writeAndShareFileToFilesystem from '../../../../functions/writeFileToFilesystem';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';

export default function ConfirmExportPayments({
  startExport,
  theme,
  darkModeType,
}) {
  const navigate = useNavigation();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const ecashTransactions = ecashWalletInformation.transactions;
  const totalPayments =
    nodeInformation.transactions.length +
    liquidNodeInformation.transactions.length +
    ecashTransactions.length;

  const [txNumber, setTxNumber] = useState(0);

  useEffect(() => {
    async function generateCSV() {
      if (!startExport) return;
      try {
        const lNdata = nodeInformation.transactions;
        const liquidData = liquidNodeInformation.transactions;
        const ecashData = ecashTransactions;
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

        const conjoinedTxList = [...liquidData, ...lNdata, ...ecashData];
        let formatedData = [];

        for (let index = 0; index < conjoinedTxList.length; index++) {
          const tx = conjoinedTxList[index];

          setTxNumber(prev => (prev += 1));

          try {
            const txDate = new Date(
              tx.type === 'ecash'
                ? tx.time
                : tx.paymentTime
                ? tx.paymentTime * 1000
                : tx.timestamp * 1000,
            );

            const formattedTx = [
              tx.type === 'ecash' ? 'Ecash' : tx.details?.type,
              tx.description ? tx.description : 'No description',
              txDate.toLocaleString().replace(/,/g, ' '),
              Math.round(
                tx.type === 'ecash'
                  ? tx.fee
                  : !!tx.timestamp
                  ? tx.feesSat
                  : tx.feeMsat / 1000,
              ).toLocaleString(),
              Math.round(
                tx.type === 'ecash'
                  ? tx.amount * (tx.paymentType === 'sent' ? -1 : 1)
                  : tx.amountMsat / 1000 || tx.amountSat,
              )
                .toLocaleString()
                .replace(/,/g, ' '),
              tx.paymentType,
            ];
            formatedData.push(formattedTx);
          } catch (err) {
            console.log(err);
          } finally {
            await new Promise(res => setTimeout(res, 0.1));
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
