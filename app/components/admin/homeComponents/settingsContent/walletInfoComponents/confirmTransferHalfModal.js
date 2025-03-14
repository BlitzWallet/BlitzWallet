import {Platform, StyleSheet, useWindowDimensions, View} from 'react-native';
import GetThemeColors from '../../../../../hooks/themeColors';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useState} from 'react';
import {ThemeText} from '../../../../../functions/CustomElements';
import {COLORS, SIZES} from '../../../../../constants';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {breezLiquidReceivePaymentWrapper} from '../../../../../functions/breezLiquid';
import {receivePayment} from '@breeztech/react-native-breez-sdk';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';

import {useAppStatus} from '../../../../../../context-store/appStatus';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
export default function ConfirmInternalTransferHalfModal(props) {
  const {backgroundColor, backgroundOffset, textColor} = GetThemeColors();
  const {minMaxLiquidSwapAmounts} = useAppStatus();

  const navigate = useNavigation();
  const [invoiceInfo, setInvoiceInfo] = useState({
    fee: null,
    invoice: '',
  });

  const {amount, startTransferFunction, transferInfo, theme, darkModeType} =
    props;

  useEffect(() => {
    async function retriveSwapInformation() {
      let address;
      let receiveFee = 0;

      if (['lightning', 'ecash'].includes(transferInfo.from.toLowerCase())) {
        const response = await breezLiquidReceivePaymentWrapper({
          sendAmount: amount,
          paymentType: 'lightning',
          description: 'Internal_Transfer',
        });
        if (!response) {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Unable to generate invoice',
          });
          return;
        }
        const {destination, receiveFeesSat} = response;

        address = destination;
        receiveFee =
          receiveFeesSat +
          (transferInfo.from.toLowerCase() === 'ecash'
            ? 5
            : Math.round(amount * 0.005) + 4);
        console.log('GENERATING LN to LIQUID INVOICE');
      } else {
        const response = await receivePayment({
          amountMsat: amount * 1000,
          description: 'Internal_Transfer',
        });
        if (response.openingFeeMsat) {
          navigate.navigate('ErrorScreen', {
            errorMessage:
              'Payment will create a new channel. Please send a smaller amount.',
          });
          return;
        }
        address = response.lnInvoice.bolt11;
        receiveFee =
          26 +
          calculateBoltzFeeNew(
            amount,
            'liquid-ln',
            minMaxLiquidSwapAmounts.submarineSwapStats,
          );
        console.log('GENERATING LIQUID to LN INVOICE');
      }
      setInvoiceInfo({
        fee: receiveFee,
        invoice: address,
      });
    }
    retriveSwapInformation();
  }, []);

  const onSwipeSuccess = useCallback(() => {
    navigate.goBack();
    startTransferFunction({
      invoice: invoiceInfo.invoice,
      transferInfo,
    });
  }, [invoiceInfo, transferInfo]);

  return (
    <View style={styles.container}>
      {!invoiceInfo.fee || !invoiceInfo.invoice ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{
              fontSize: SIZES.xLarge,
              textAlign: 'center',
            }}
            content={`Confirm transfer`}
          />
          <FormattedSatText
            frontText={`Amount: `}
            containerStyles={{marginTop: 'auto'}}
            styles={{fontSize: SIZES.large}}
            balance={amount}
          />

          <FormattedSatText
            styles={{marginBottom: 'auto'}}
            frontText={`Fee: `}
            balance={invoiceInfo.fee}
          />
          <SwipeButtonNew
            onSwipeSuccess={onSwipeSuccess}
            width={0.95}
            containerStyles={{marginBottom: 20}}
            thumbIconStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
            railStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center'},
});
