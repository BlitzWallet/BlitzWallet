import {
  ActivityIndicator,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useCallback, useEffect, useState} from 'react';

import SwipeButton from 'rn-swipe-button';
import {CENTER, COLORS, FONT, ICONS, SIZES} from '../../../../constants';
import {ThemeText} from '../../../../functions/CustomElements';
import handleBackPress from '../../../../hooks/handleBackPress';
import * as FileSystem from 'expo-file-system';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import GetThemeColors from '../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';

export default function ConfirmExportPayments() {
  const navigate = useNavigation();
  const insets = useSafeAreaInsets();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const ecashTransactions = ecashWalletInformation.transactions;
  const totalPayments =
    nodeInformation.transactions.length +
    liquidNodeInformation.transactions.length +
    ecashTransactions.length;

  const [txNumber, setTxNumber] = useState(0);

  const handleBackPressFunction = useCallback(() => {
    navigate.goBack();
    return true;
  }, [navigate]);

  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, [handleBackPressFunction]);

  return (
    <View
      style={{
        ...styles.containerStyle,
        height: useWindowDimensions().height * 0.5,
        backgroundColor: backgroundColor,
        paddingBottom: insets.bottom,
      }}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: backgroundOffset,
          },
        ]}
      />

      <ThemeText
        content={
          'Export your payment history in CSV (comma seperated value) format.'
        }
      />
      <View
        style={{
          marginBottom: 10,
          flex: 1,
          justifyContent: 'flex-end',
        }}>
        {txNumber === 0 ? (
          <ThemeText content={`${totalPayments} payments`} />
        ) : (
          <FullLoadingScreen
            size="small"
            containerStyles={{justifyContent: 'flex-end'}}
            text={`${txNumber} of ${totalPayments}`}
          />
        )}
      </View>
      <SwipeButton
        containerStyles={{
          ...styles.swipeButton,
          borderColor: textColor,
        }}
        titleStyles={{fontWeight: 'bold', fontSize: SIZES.large}}
        swipeSuccessThreshold={100}
        onSwipeSuccess={generateCSV}
        railBackgroundColor={theme ? COLORS.darkModeText : COLORS.primary}
        railBorderColor={theme ? backgroundColor : COLORS.lightModeBackground}
        height={55}
        railStyles={{
          backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
          borderColor: theme ? backgroundColor : COLORS.darkModeText,
        }}
        thumbIconBackgroundColor={theme ? backgroundColor : COLORS.darkModeText}
        thumbIconBorderColor={theme ? backgroundColor : COLORS.darkModeText}
        titleColor={theme ? backgroundColor : COLORS.darkModeText}
        title="Slide to export"
      />
    </View>
  );
  async function generateCSV() {
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

      for (let index = 0; index < 100; index++) {
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
          await new Promise(res => setTimeout(res, 5));
        }
      }

      const csvData = headers.concat(formatedData).join('\n');

      const dir = FileSystem.documentDirectory;

      const fileName = 'BlitzWallet.csv';
      const filePath = `${dir}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setTimeout(async () => {
        await Share.share({
          title: 'BlitzWallet',
          // message: `${csvData}`,
          url: `file://${filePath}`,
          type: 'text/csv',
        });
      }, 200);
      navigate.goBack();
      console.log(dir);
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Unable to create transaction file',
      });
    }
  }
}

const styles = StyleSheet.create({
  containerStyle: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 10,

    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  borderTop: {
    width: '100%',
    height: 60,
    position: 'absolute',
    top: -5,
    zIndex: -1,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },

  swipeButton: {width: '90%', maxWidth: 350, ...CENTER, marginBottom: 20},
});
