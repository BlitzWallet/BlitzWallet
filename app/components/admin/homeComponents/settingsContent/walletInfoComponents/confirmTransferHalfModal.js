// import {Platform, StyleSheet, useWindowDimensions, View} from 'react-native';
// import GetThemeColors from '../../../../../hooks/themeColors';
// import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
// import {useNavigation} from '@react-navigation/native';
// import {useCallback, useEffect, useState} from 'react';
// import {ThemeText} from '../../../../../functions/CustomElements';
// import {COLORS, LIQUID_DEFAULT_FEE, SIZES} from '../../../../../constants';
// import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
// import {breezLiquidReceivePaymentWrapper} from '../../../../../functions/breezLiquid';
// import {receivePayment} from '@breeztech/react-native-breez-sdk';
// import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';

// import {useAppStatus} from '../../../../../../context-store/appStatus';
// import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
// import {getECashInvoice} from '../../../../../functions/eCash/wallet';
// import {
//   ECASH_QUOTE_EVENT_NAME,
//   ecashEventEmitter,
// } from '../../../../../../context-store/eCash';
// import {useTranslation} from 'react-i18next';
// export default function ConfirmInternalTransferHalfModal(props) {
//   const {backgroundColor, backgroundOffset, textColor} = GetThemeColors();
//   const {minMaxLiquidSwapAmounts} = useAppStatus();
//   const {t} = useTranslation();
//   const navigate = useNavigation();
//   const [invoiceInfo, setInvoiceInfo] = useState({
//     fee: null,
//     invoice: '',
//   });

//   const {amount, startTransferFunction, transferInfo, theme, darkModeType} =
//     props;

//   useEffect(() => {
//     async function retriveSwapInformation() {
//       try {
//         let address;
//         let receiveFee = 0;
//         const liquidFee =
//           LIQUID_DEFAULT_FEE +
//           calculateBoltzFeeNew(
//             amount,
//             'liquid-ln',
//             minMaxLiquidSwapAmounts.submarineSwapStats,
//           );
//         const lnFee = amount * 0.005 + 4;

//         if (transferInfo.to.toLowerCase() === 'bank') {
//           console.log('Generating liquid swap invoice for transfer');
//           const response = await breezLiquidReceivePaymentWrapper({
//             sendAmount: amount,
//             paymentType: 'lightning',
//             description: 'Internal_Transfer',
//           });
//           if (!response)
//             throw new Error(t('settings.balanceinfo.confirmpage.text1'));

//           const {destination, receiveFeesSat} = response;

//           address = destination;
//           receiveFee =
//             LIQUID_DEFAULT_FEE +
//             calculateBoltzFeeNew(
//               amount,
//               'liquid-ln',
//               minMaxLiquidSwapAmounts.submarineSwapStats,
//             ) +
//             lnFee;
//         } else if (transferInfo.to.toLowerCase() === 'ecash') {
//           console.log('Generating ecash invoice for transfer');
//           const eCashInvoice = await getECashInvoice({
//             amount: amount,
//             descriptoin: 'Internal_Transfer',
//           });
//           if (!eCashInvoice.didWork)
//             throw new Error(t('settings.balanceinfo.confirmpage.text1'));
//           ecashEventEmitter.emit(ECASH_QUOTE_EVENT_NAME, {
//             quote: eCashInvoice.mintQuote.quote,
//             mintURL: eCashInvoice.mintURL,
//             shouldNavigate: false,
//           });

//           address = eCashInvoice.mintQuote.request;
//           receiveFee =
//             LIQUID_DEFAULT_FEE +
//             calculateBoltzFeeNew(
//               amount,
//               'liquid-ln',
//               minMaxLiquidSwapAmounts.submarineSwapStats,
//             );
//         } else {
//           console.log('Generating lightning invoice for transfer');
//           const response = await receivePayment({
//             amountMsat: amount * 1000,
//             description: 'Internal_Transfer',
//           });
//           if (response.openingFeeMsat)
//             throw new Error(t('settings.balanceinfo.confirmpage.text2'));
//           address = response.lnInvoice.bolt11;
//           receiveFee =
//             transferInfo.from.toLowerCase() === 'bank'
//               ? LIQUID_DEFAULT_FEE +
//                 calculateBoltzFeeNew(
//                   amount,
//                   'liquid-ln',
//                   minMaxLiquidSwapAmounts.submarineSwapStats,
//                 )
//               : lnFee;
//         }
//         setInvoiceInfo({
//           fee: receiveFee,
//           invoice: address,
//         });
//       } catch (err) {
//         console.log('generate transfer invoice error', err);
//         navigate.navigate('ErrorScreen', {errorMessage: err.message});
//       }
//     }
//     retriveSwapInformation();
//   }, []);

//   const onSwipeSuccess = useCallback(() => {
//     navigate.goBack();
//     startTransferFunction({
//       invoice: invoiceInfo.invoice,
//       transferInfo: {...transferInfo, amount},
//     });
//   }, [invoiceInfo, transferInfo, amount]);

//   return (
//     <View style={styles.container}>
//       {invoiceInfo.fee === null || !invoiceInfo.invoice ? (
//         <FullLoadingScreen />
//       ) : (
//         <View style={styles.container}>
//           <ThemeText
//             styles={{
//               fontSize: SIZES.xLarge,
//               textAlign: 'center',
//             }}
//             content={t('settings.balanceinfo.confirmpage.text3')}
//           />
//           <FormattedSatText
//             frontText={t('settings.balanceinfo.confirmpage.text4')}
//             containerStyles={{marginTop: 'auto'}}
//             styles={{fontSize: SIZES.large}}
//             balance={amount}
//           />

//           <FormattedSatText
//             containerStyles={{marginBottom: 'auto'}}
//             frontText={t('settings.balanceinfo.confirmpage.text5')}
//             balance={invoiceInfo.fee}
//           />
//           <SwipeButtonNew
//             onSwipeSuccess={onSwipeSuccess}
//             width={0.95}
//             containerStyles={{marginBottom: 20}}
//             thumbIconStyles={{
//               backgroundColor:
//                 theme && darkModeType ? backgroundOffset : backgroundColor,
//               borderColor:
//                 theme && darkModeType ? backgroundOffset : backgroundColor,
//             }}
//             railStyles={{
//               backgroundColor:
//                 theme && darkModeType ? backgroundOffset : backgroundColor,
//               borderColor:
//                 theme && darkModeType ? backgroundOffset : backgroundColor,
//             }}
//           />
//         </View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {flex: 1, alignItems: 'center'},
// });
