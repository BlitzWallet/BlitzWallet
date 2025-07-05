// import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
// import {useNavigation} from '@react-navigation/native';
// import {useEffect, useRef, useState} from 'react';
// import {
//   CENTER,
//   COLORS,
//   HIDDEN_BALANCE_TEXT,
//   ICONS,
//   LIQUID_DEFAULT_FEE,
//   SATSPERBITCOIN,
//   SIZES,
// } from '../../../../../constants';
// import {
//   GlobalThemeView,
//   ThemeText,
// } from '../../../../../functions/CustomElements';
// import CustomButton from '../../../../../functions/CustomElements/button';
// import {useGlobalContextProvider} from '../../../../../../context-store/context';
// import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
// import {nodeInfo, parseInput} from '@breeztech/react-native-breez-sdk';
// import {getInfo} from '@breeztech/react-native-breez-sdk-liquid';
// import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
// import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
// import {useGlobaleCash} from '../../../../../../context-store/eCash';
// import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
// import {breezLiquidPaymentWrapper} from '../../../../../functions/breezLiquid';
// import {breezPaymentWrapper} from '../../../../../functions/SDK';
// import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
// import {useNodeContext} from '../../../../../../context-store/nodeContext';
// import {useAppStatus} from '../../../../../../context-store/appStatus';
// import {
//   getMeltQuote,
//   payLnInvoiceFromEcash,
// } from '../../../../../functions/eCash/wallet';
// import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
// import calculateCanDoTransfer from './functions/canDoTransfer';
// import {useTranslation} from 'react-i18next';

// export default function ManualSwapPopup() {
//   const navigate = useNavigation();
//   const {masterInfoObject} = useGlobalContextProvider();
//   const {minMaxLiquidSwapAmounts} = useAppStatus();
//   const {nodeInformation, liquidNodeInformation} = useNodeContext();
//   const [sendingAmount, setSendingAmount] = useState('');
//   const [userBalanceInformation, setUserBalanceInformation] = useState({});
//   const [transferInfo, setTransferInfo] = useState({from: '', to: ''});
//   const [isDoingTransfer, setIsDoingTransfer] = useState(false);
//   const {ecashWalletInformation} = useGlobaleCash();
//   const {t} = useTranslation();
//   const eCashBalance = ecashWalletInformation.balance;

//   const convertedSendAmount =
//     masterInfoObject.userBalanceDenomination != 'fiat'
//       ? Math.round(Number(sendingAmount))
//       : Math.round(
//           (SATSPERBITCOIN / nodeInformation?.fiatStats?.value) *
//             Number(sendingAmount),
//         );

//   const maxBankTransfer =
//     masterInfoObject.liquidWalletSettings.isLightningEnabled &&
//     !!userBalanceInformation.lightningBalance
//       ? userBalanceInformation.lightningInboundAmount >
//         userBalanceInformation.liquidBalance
//         ? userBalanceInformation.liquidBalance - 5
//         : userBalanceInformation.lightningInboundAmount - 5
//       : masterInfoObject.enabledEcash
//       ? Math.min(
//           masterInfoObject.ecashWalletSettings.maxReceiveAmountSat,
//           masterInfoObject.ecashWalletSettings.maxEcashBalance - eCashBalance,
//           userBalanceInformation.liquidBalance - LIQUID_DEFAULT_FEE,
//         )
//       : 0;

//   const maxTransferAmountFromBalance =
//     transferInfo.from.toLowerCase() === 'bank'
//       ? maxBankTransfer
//       : transferInfo.from.toLowerCase() === 'ecash'
//       ? eCashBalance - (eCashBalance * 0.005 + 6)
//       : userBalanceInformation.lightningBalance -
//         (userBalanceInformation.lightningBalance * 0.005 + 10);

//   const maxAmountCaluclation =
//     maxTransferAmountFromBalance > minMaxLiquidSwapAmounts.max
//       ? minMaxLiquidSwapAmounts.max -
//         calculateBoltzFeeNew(
//           maxTransferAmountFromBalance,
//           transferInfo.from.toLowerCase() === 'bank'
//             ? 'liquid-ln'
//             : 'ln-liquid',
//           minMaxLiquidSwapAmounts[
//             transferInfo.from.toLowerCase() === 'bank'
//               ? 'submarineSwapStats'
//               : 'reverseSwapStats'
//           ],
//         )
//       : maxTransferAmountFromBalance -
//         calculateBoltzFeeNew(
//           maxTransferAmountFromBalance,
//           transferInfo.from.toLowerCase() === 'bank'
//             ? 'liquid-ln'
//             : 'ln-liquid',
//           minMaxLiquidSwapAmounts[
//             transferInfo.from.toLowerCase() === 'bank'
//               ? 'submarineSwapStats'
//               : 'reverseSwapStats'
//           ],
//         );

//   const maxTransferAmount =
//     transferInfo.from.toLowerCase() === 'lightning'
//       ? maxTransferAmountFromBalance //can only go to bank so any amount is fine
//       : transferInfo.from.toLowerCase() === 'bank'
//       ? maxAmountCaluclation - LIQUID_DEFAULT_FEE //calucluation above
//       : transferInfo.to.toLowerCase() === 'bank'
//       ? maxTransferAmountFromBalance - 5 // if going to bank any amount is fine
//       : Math.min(
//           maxTransferAmountFromBalance - 5,
//           userBalanceInformation.lightningInboundAmount - 5,
//         ); //can either be the max of the ecash balance or inbound liquidty amount

//   const canDoTransfer = calculateCanDoTransfer({
//     from: transferInfo.from,
//     to: transferInfo.to,
//     minMaxLiquidSwapAmounts,
//     maxTransferAmount,
//     convertedSendAmount,
//   });

//   useEffect(() => {
//     async function loadUserBalanceInformation() {
//       const [node_info, liquid_info] = await Promise.all([
//         masterInfoObject.liquidWalletSettings.isLightningEnabled
//           ? nodeInfo()
//           : Promise.resolve({
//               totalInboundLiquidityMsats: 0,
//               channelsBalanceMsat: 0,
//             }),
//         getInfo(),
//       ]);

//       setUserBalanceInformation({
//         lightningInboundAmount: node_info.totalInboundLiquidityMsats / 1000,
//         lightningBalance: node_info.channelsBalanceMsat / 1000,
//         liquidBalance: liquid_info.walletInfo.balanceSat,
//         ecashBalance: eCashBalance,
//       });
//     }
//     loadUserBalanceInformation();
//   }, []);

//   return (
//     <GlobalThemeView useStandardWidth={true}>
//       <CustomSettingsTopBar
//         label={t('settings.balanceinfo.manualswap.text1')}
//       />
//       {!Object.keys(userBalanceInformation).length || isDoingTransfer ? (
//         <FullLoadingScreen
//           textStyles={{textAlign: 'center'}}
//           text={
//             isDoingTransfer ? t('settings.balanceinfo.manualswap.text2') : ''
//           }
//         />
//       ) : (
//         <>
//           <ScrollView style={{width: '100%', flex: 1}}>
//             <View style={styles.transferAccountRow}>
//               <ThemeText content={t('settings.balanceinfo.manualswap.text3')} />
//               <TouchableOpacity
//                 onPress={() =>
//                   navigate.navigate('AccountInformationPage', {
//                     setTransferInfo: setTransferInfo,
//                     transferType: 'from',
//                     userBalanceInformation: userBalanceInformation,
//                   })
//                 }
//                 style={styles.chooseAccountBTN}>
//                 <ThemeText
//                   content={
//                     !transferInfo.from
//                       ? t('settings.balanceinfo.manualswap.text4')
//                       : transferInfo.from
//                   }
//                 />
//                 <ThemeImage
//                   styles={styles.chooseAccountImage}
//                   lightModeIcon={ICONS.leftCheveronIcon}
//                   darkModeIcon={ICONS.leftCheveronIcon}
//                   lightsOutIcon={ICONS.left_cheveron_white}
//                 />
//               </TouchableOpacity>
//             </View>
//             <View style={styles.transferAccountRow}>
//               <ThemeText content={t('settings.balanceinfo.manualswap.text5')} />
//               <TouchableOpacity
//                 activeOpacity={1}
//                 style={styles.chooseAccountBTN}>
//                 <ThemeText
//                   content={
//                     !transferInfo.to ? HIDDEN_BALANCE_TEXT : transferInfo.to
//                   }
//                 />
//               </TouchableOpacity>
//             </View>
//             <FormattedBalanceInput
//               customTextInputContainerStyles={{marginTop: 20}}
//               maxWidth={0.9}
//               amountValue={sendingAmount}
//               inputDenomination={masterInfoObject.userBalanceDenomination}
//             />

//             <FormattedSatText
//               containerStyles={{opacity: !sendingAmount ? 0.5 : 1}}
//               neverHideBalance={true}
//               styles={{includeFontPadding: false}}
//               globalBalanceDenomination={
//                 masterInfoObject.userBalanceDenomination === 'sats' ||
//                 masterInfoObject.userBalanceDenomination === 'hidden'
//                   ? 'fiat'
//                   : 'sats'
//               }
//               balance={convertedSendAmount}
//             />
//           </ScrollView>
//           {transferInfo.from && transferInfo.to && !!convertedSendAmount && (
//             <FormattedSatText
//               neverHideBalance={true}
//               frontText={`${
//                 convertedSendAmount < minMaxLiquidSwapAmounts.min &&
//                 !canDoTransfer
//                   ? t('constants.minimum')
//                   : t('constants.maximum')
//               } ${t('settings.balanceinfo.manualswap.text6')} `}
//               balance={
//                 convertedSendAmount < minMaxLiquidSwapAmounts.min &&
//                 !canDoTransfer
//                   ? minMaxLiquidSwapAmounts.min
//                   : maxTransferAmount
//               }
//               styles={{textAlign: 'center'}}
//               containerStyles={{
//                 marginBottom: 10,
//                 width: '100%',
//                 flexWrap: 'wrap',
//                 ...CENTER,
//               }}
//             />
//           )}

//           <CustomNumberKeyboard
//             showDot={masterInfoObject.userBalanceDenomination === 'fiat'}
//             frompage="sendContactsPage"
//             setInputValue={setSendingAmount}
//             usingForBalance={true}
//             nodeInformation={nodeInformation}
//           />

//           <CustomButton
//             textContent={t('constants.confirm')}
//             buttonStyles={{
//               ...CENTER,
//               opacity:
//                 !transferInfo.from ||
//                 !transferInfo.to ||
//                 !canDoTransfer ||
//                 !sendingAmount
//                   ? 0.2
//                   : 1,
//             }}
//             actionFunction={() => {
//               if (!transferInfo.from || !transferInfo.to) return;
//               if (!canDoTransfer) return;
//               if (!sendingAmount) return;
//               navigate.navigate('CustomHalfModal', {
//                 wantedContent: 'confirmInternalTransferHalfModal',
//                 amount: convertedSendAmount,
//                 transferInfo: transferInfo,
//                 startTransferFunction: initiateTransfer,
//                 sliderHight: 0.5,
//               });
//             }}
//           />
//         </>
//       )}
//     </GlobalThemeView>
//   );
//   async function initiateTransfer({invoice, transferInfo}) {
//     try {
//       setIsDoingTransfer(true);
//       if (transferInfo.from.toLowerCase() === 'lightning') {
//         const parsedInvoice = await parseInput(invoice);
//         await breezPaymentWrapper({
//           paymentInfo: parsedInvoice,
//           paymentDescription: 'Internal_Transfer',
//           failureFunction: response => {
//             navigate.reset({
//               index: 0, // The top-level route index
//               routes: [
//                 {
//                   name: 'HomeAdmin',
//                   params: {screen: 'Home'},
//                 },
//                 {
//                   name: 'ConfirmTxPage',
//                   params: {
//                     for: 'paymentFailed',
//                     information: response,
//                     formattingType: 'lightningNode',
//                   },
//                 },
//               ],
//             });
//           },
//           confirmFunction: response => {
//             navigate.reset({
//               index: 0, // The top-level route index
//               routes: [
//                 {
//                   name: 'HomeAdmin',
//                   params: {screen: 'Home'},
//                 },
//                 {
//                   name: 'ConfirmTxPage',
//                   params: {
//                     for: 'paymentSucceed',
//                     information: response,
//                     formattingType: 'lightningNode',
//                   },
//                 },
//               ],
//             });
//           },
//         });
//       } else if (transferInfo.from.toLowerCase() === 'ecash') {
//         const meltQuote = await getMeltQuote(invoice);
//         if (!meltQuote.quote) {
//           navigate.reset({
//             index: 0, // The top-level route index
//             routes: [
//               {
//                 name: 'HomeAdmin', // Navigate to HomeAdmin
//                 params: {
//                   screen: 'Home',
//                 },
//               },
//               {
//                 name: 'ConfirmTxPage',
//                 params: {
//                   for: 'paymentFailed',
//                   information: {
//                     status: 'failed',
//                     fee: 0,
//                     amountSat: 0,
//                     details: {
//                       error:
//                         meltQuote.reason ||
//                         'Not able to generate ecash quote or proofs',
//                     },
//                   },
//                   formattingType: 'ecash',
//                 },
//               },
//             ],
//           });
//           return;
//         }
//         const didPay = await payLnInvoiceFromEcash({
//           quote: meltQuote.quote,
//           invoice: invoice,
//           proofsToUse: meltQuote.proofsToUse,
//           description: 'Internal_Transfer',
//         });
//         navigate.reset({
//           index: 0, // The top-level route index
//           routes: [
//             {
//               name: 'HomeAdmin', // Navigate to HomeAdmin
//               params: {
//                 screen: 'Home',
//               },
//             },

//             {
//               name: 'ConfirmTxPage', // Navigate to ExpandedAddContactsPage
//               params: {
//                 for: didPay.didWork ? 'paymentSucceed' : 'paymentFailed',
//                 information: {
//                   status: didPay.didWork ? 'complete' : 'failed',
//                   feeSat: didPay.txObject?.fee,
//                   amountSat: didPay.txObject?.amount,
//                   details: didPay.didWork
//                     ? {error: ''}
//                     : {
//                         error: didPay.message,
//                       },
//                 },
//                 formattingType: 'ecash',
//               },
//             },
//           ],
//           // Array of routes to set in the stack
//         });
//       } else {
//         const paymentResponse = await breezLiquidPaymentWrapper({
//           invoice: invoice,
//           paymentType: 'bolt11',
//         });
//         if (!paymentResponse.didWork) {
//           navigate.reset({
//             index: 0, // The top-level route index
//             routes: [
//               {
//                 name: 'HomeAdmin',
//                 params: {screen: 'Home'},
//               },
//               {
//                 name: 'ConfirmTxPage',
//                 params: {
//                   for: 'paymentFailed',
//                   information: {
//                     details: {
//                       error: paymentResponse.error,
//                       amountSat: convertedSendAmount,
//                     },
//                   },
//                   formattingType: 'liquidNode',
//                 },
//               },
//             ],
//           });
//           return;
//         }
//         const {payment, fee} = paymentResponse;
//         navigate.reset({
//           index: 0, // The top-level route index
//           routes: [
//             {
//               name: 'HomeAdmin',
//               params: {screen: 'Home'},
//             },
//             {
//               name: 'ConfirmTxPage',
//               params: {
//                 for: 'paymentSucceed',
//                 information: payment,
//                 formattingType: 'liquidNode',
//               },
//             },
//           ],
//         });
//       }
//     } catch (err) {
//       console.log(err, 'TRANSFER ERROR');
//       navigate.navigate('ErrorScreen', {
//         errorMessage: 'Unable to perform transfer',
//       });
//     }
//   }
// }

// const styles = StyleSheet.create({
//   topbar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   topBarText: {
//     fontSize: SIZES.xLarge,
//     width: '100%',
//     textAlign: 'center',
//   },
//   container: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: COLORS.halfModalBackgroundColor,
//   },
//   absolute: {
//     width: '100%',
//     height: '100%',
//     position: 'absolute',
//     top: 0,
//     left: 0,
//   },
//   contentContainer: {
//     width: '90%',
//     backgroundColor: COLORS.darkModeText,
//     padding: 10,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   transferAccountRow: {
//     width: '90%',
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 15,
//     alignItems: 'center',
//     ...CENTER,
//   },
//   chooseAccountBTN: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     includeFontPadding: false,
//   },
//   chooseAccountImage: {
//     height: 20,
//     width: 10,
//     transform: [{rotate: '180deg'}],
//     marginLeft: 5,
//   },
//   textInputContainer: {
//     margin: 0,
//     marginTop: 10,
//     ...CENTER,
//   },
// });
