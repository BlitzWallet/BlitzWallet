// import {
//   Keyboard,
//   ScrollView,
//   StyleSheet,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import {CENTER, COLORS, FONT, ICONS, SIZES} from '../../../../constants';
// import {useEffect, useRef, useState} from 'react';
// import {
//   nodeInfo,
//   prepareRedeemOnchainFunds,
//   redeemOnchainFunds,
// } from '@breeztech/react-native-breez-sdk';
// import {
//   copyToClipboard,
//   getLocalStorageItem,
//   setLocalStorageItem,
// } from '../../../../functions';
// import {useGlobalContextProvider} from '../../../../../context-store/context';
// import {useNavigation} from '@react-navigation/native';
// import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
// import CustomButton from '../../../../functions/CustomElements/button';
// import SendOnChainBitcoinFeeSlider from './onChainComponents/txFeeSlider';
// import {
//   CustomKeyboardAvoidingView,
//   ThemeText,
// } from '../../../../functions/CustomElements';
// import GetThemeColors from '../../../../hooks/themeColors';
// import ThemeImage from '../../../../functions/CustomElements/themeImage';
// import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
// import connectToLightningNode from '../../../../functions/connectToLightning';
// import {DUST_LIMIT_FOR_BTC_CHAIN_PAYMENTS} from '../../../../constants/math';
// import {useLightningEvent} from '../../../../../context-store/lightningEventContext';
// import {useGlobalThemeContext} from '../../../../../context-store/theme';
// import {recommendedFees} from '@breeztech/react-native-breez-sdk-liquid';
// import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
// import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
// import {KEYBOARDTIMEOUT} from '../../../../constants/styles';
// import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';

// export default function SendOnChainBitcoin({isDoomsday}) {
//   const {masterInfoObject} = useGlobalContextProvider();
//   const {theme, darkModeType} = useGlobalThemeContext();
//   const [isLoading, setIsLoading] = useState(true);
//   const navigate = useNavigation();
//   const [bitcoinAddress, setBitcoinAddress] = useState('');
//   const [isSendingPayment, setIsSendingPayment] = useState({
//     sendingBTCpayment: false,
//     didSend: false,
//   });
//   const [isKeyboardActive, setIsKeyboardActive] = useState(false);
//   const [onChainBalance, setOnChainBalance] = useState(0);
//   const [errorMessage, setErrorMessage] = useState(null);
//   const [feeInfo, setFeeInfo] = useState([]);
//   const [bitcoinTxId, setBitcoinTxId] = useState('');
//   const [txFeeSat, setTxFeeSat] = useState(0);
//   const {backgroundOffset, textInputBackground, textInputColor} =
//     GetThemeColors();
//   const runCountRef = useRef(0);
//   const {onLightningBreezEvent} = useLightningEvent();
//   useEffect(() => {
//     getMempoolTxFee();
//     initPage();
//   }, []);

//   return (
//     <CustomKeyboardAvoidingView
//       useLocalPadding={true}
//       isKeyboardActive={isKeyboardActive}
//       useTouchableWithoutFeedback={true}
//       useStandardWidth={true}>
//       <CustomSettingsTopBar
//         showLeftImage={true}
//         leftImageBlue={ICONS.receiptIcon}
//         LeftImageDarkMode={ICONS.receiptWhite}
//         leftImageFunction={() => {
//           Keyboard.dismiss();
//           setTimeout(
//             () => {
//               navigate.navigate('HistoricalOnChainPayments');
//             },
//             Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
//           );
//         }}
//         shouldDismissKeyboard={true}
//         label={'Channel Closure'}
//       />

//       {isLoading || onChainBalance === 0 ? (
//         <FullLoadingScreen
//           showLoadingIcon={isLoading}
//           textStyles={{textAlign: 'center'}}
//           text={
//             !isLoading
//               ? 'You do not have any on-chain funds from a channel closure'
//               : ''
//           }
//         />
//       ) : isSendingPayment.sendingBTCpayment ? (
//         <View
//           style={{
//             flex: 1,
//             width: INSET_WINDOW_WIDTH,
//             ...CENTER,
//             alignItems: 'center',
//             justifyContent: 'center',
//           }}>
//           {isSendingPayment.didSend ? (
//             <View
//               style={{
//                 flexDirection: 'row',
//                 flexWrap: 'wrap',
//                 justifyContent: 'center',
//               }}>
//               <ThemeText styles={{fontSize: SIZES.large}} content={'Txid'} />
//               <TouchableOpacity
//                 onPress={() => {
//                   copyToClipboard(String(bitcoinTxId), navigate);
//                 }}
//                 style={{width: '95%'}}>
//                 <ThemeText
//                   styles={{textAlign: 'center'}}
//                   content={bitcoinTxId}
//                 />
//               </TouchableOpacity>
//               <ThemeText
//                 styles={{marginVertical: 10}}
//                 content={'Save this ID to check up on your transaction'}
//               />

//               <TouchableOpacity
//                 onPress={() => {
//                   navigate.navigate('CustomWebView', {
//                     headerText: 'Mempool',
//                     webViewURL: `https://mempool.space/tx/${bitcoinTxId}`,
//                   });
//                 }}>
//                 <ThemeText
//                   styles={{
//                     color:
//                       theme && darkModeType
//                         ? COLORS.darkModeText
//                         : COLORS.primary,
//                     textAlign: 'center',
//                   }}
//                   content={'View Transaction'}
//                 />
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <FullLoadingScreen text={'Sending transaction'} />
//           )}
//         </View>
//       ) : (
//         <>
//           <ScrollView
//             showsVerticalScrollIndicator={false}
//             style={{flexGrow: 1, width: INSET_WINDOW_WIDTH, ...CENTER}}>
//             <View style={styles.balanceContainer}>
//               <ThemeText content={'Current balance'} />
//               <FormattedSatText
//                 neverHideBalance={true}
//                 styles={{...styles.balanceNum}}
//                 globalBalanceDenomination={
//                   isDoomsday ? 'sats' : masterInfoObject.userBalanceDenomination
//                 }
//                 balance={onChainBalance / 1000}
//               />
//             </View>
//             <View
//               style={[
//                 styles.btcAdressContainer,
//                 {
//                   backgroundColor: backgroundOffset,
//                 },
//               ]}>
//               <ThemeText
//                 styles={{marginBottom: 10}}
//                 content={'Enter BTC address'}
//               />
//               <View style={[styles.inputContainer]}>
//                 <TextInput
//                   keyboardAppearance={theme ? 'dark' : 'light'}
//                   value={bitcoinAddress}
//                   onChangeText={setBitcoinAddress}
//                   style={[
//                     styles.input,
//                     {
//                       // borderColor: theme
//                       //   ? COLORS.darkModeText
//                       //   : COLORS.lightModeText,
//                       backgroundColor: COLORS.darkModeText,
//                       color: COLORS.lightModeText,
//                     },
//                   ]}
//                   placeholder="bc1..."
//                   placeholderTextColor={COLORS.opaicityGray}
//                   onBlur={() => setIsKeyboardActive(false)}
//                   onFocus={() => setIsKeyboardActive(true)}
//                 />
//                 <TouchableOpacity
//                   onPress={() => {
//                     navigate.navigate('CameraModal', {
//                       updateBitcoinAdressFunc: setBitcoinAddress,
//                     });
//                   }}>
//                   <ThemeImage
//                     darkModeIcon={ICONS.faceIDIcon}
//                     lightModeIcon={ICONS.faceIDIcon}
//                     lightsOutIcon={ICONS.faceIDIconWhite}
//                   />
//                 </TouchableOpacity>
//               </View>
//             </View>

//             <SendOnChainBitcoinFeeSlider
//               changeSelectedFee={changeSelectedFee}
//               feeInfo={feeInfo}
//               bitcoinAddress={bitcoinAddress}
//               txFeeSat={txFeeSat}
//             />
//           </ScrollView>
//           <ThemeText
//             styles={{
//               width: '95%',
//               textAlign: 'center',
//               ...CENTER,
//               marginBottom: 10,
//             }}
//             content={errorMessage}
//           />
//           <CustomButton
//             buttonStyles={{
//               opacity:
//                 !bitcoinAddress ||
//                 feeInfo.filter(item => item.isSelected).length === 0 ||
//                 txFeeSat >= onChainBalance ||
//                 errorMessage
//                   ? 0.5
//                   : 1,
//               width: 'auto',
//               marginTop: 'auto',
//               ...CENTER,
//             }}
//             actionFunction={() => {
//               if (
//                 !bitcoinAddress ||
//                 feeInfo.filter(item => item.isSelected).length === 0 ||
//                 txFeeSat >= onChainBalance ||
//                 errorMessage
//               )
//                 return;

//               navigate.navigate('ConfirmActionPage', {
//                 confirmFunction: sendOnChain,
//                 confirmMessage: 'Are you sure you want to send this payment?',
//               });
//             }}
//             textContent={'Send transaction'}
//           />
//         </>
//       )}
//     </CustomKeyboardAvoidingView>
//   );

//   async function initPage() {
//     try {
//       crashlyticsLogReport(
//         'Starting page for send on-chain which is for closed channels',
//       );
//       const [node_info, didSetMempoolFees] = await Promise.all([
//         nodeInfo(),
//         getMempoolTxFee(),
//       ]);

//       const balance = node_info.onchainBalanceMsat;
//       // const swaps = await inProgressOnchainPayments();
//       // console.log(swaps);
//       // for (const swap of swaps) {
//       //   console.log(
//       //     `Onchain payment ${swap.id} in progress, status is ${swap.status}`,
//       //   );
//       // }

//       // const didLoad = await getMempoolTxFee();
//       setOnChainBalance(balance);

//       if (didSetMempoolFees) setIsLoading(false);
//     } catch (err) {
//       if (runCountRef.current !== 0) {
//         setIsLoading(false);
//         return;
//       }
//       runCountRef.current = 1;
//       const lightningSession = await connectToLightningNode(
//         onLightningBreezEvent,
//       );
//       if (lightningSession?.isConnected) {
//         const didSet = await setLightningInformationUnderDoomsday();
//         if (didSet) initPage();
//       }
//       console.log(err);
//     }
//   }

//   async function calculateTxFee(globalItem) {
//     try {
//       const [satPerVbyte] = feeInfo.filter(item => item.feeType === globalItem);

//       const prepareRedeemOnchainFundsResp = await prepareRedeemOnchainFunds({
//         toAddress: bitcoinAddress,
//         satPerVbyte: satPerVbyte.feeAmount,
//       });

//       return new Promise(resolve => {
//         resolve({
//           didRunError:
//             onChainBalance - prepareRedeemOnchainFundsResp.txFeeSat <
//             DUST_LIMIT_FOR_BTC_CHAIN_PAYMENTS,
//           content: prepareRedeemOnchainFundsResp.txFeeSat,
//         });
//       });
//     } catch (err) {
//       console.log(err);
//       setTxFeeSat(0);
//       return new Promise(resolve => {
//         resolve({didRunError: true, content: err.message});
//       });
//     }
//   }

//   async function sendOnChain() {
//     setIsSendingPayment(prev => {
//       return {...prev, sendingBTCpayment: true};
//     });
//     const [satPerVbyte] = feeInfo.filter(item => item.isSelected);
//     try {
//       const redeemOnchainFundsResp = await redeemOnchainFunds({
//         toAddress: bitcoinAddress,
//         satPerVbyte: satPerVbyte.feeAmount,
//       });

//       const sentBTCPayments =
//         JSON.parse(await getLocalStorageItem('refundedBTCtransactions')) || [];
//       setBitcoinTxId(redeemOnchainFundsResp.txid);
//       setLocalStorageItem(
//         'refundedBTCtransactions',
//         JSON.stringify([
//           ...sentBTCPayments,
//           {
//             date: new Date(),
//             txid: redeemOnchainFundsResp.txid,
//             toAddress: bitcoinAddress,
//             satPerVbyte: satPerVbyte.feeAmount,
//           },
//         ]),
//       );
//       setIsSendingPayment(prev => {
//         return {...prev, didSend: true};
//       });
//     } catch (err) {
//       console.log(err);
//       setIsSendingPayment(prev => {
//         return {...prev, sendingBTCpayment: false};
//       });
//       navigate.navigate('ErrorScreen', {
//         errorMessage: 'Unable to send transaction',
//       });
//     }
//   }
//   async function getMempoolTxFee() {
//     try {
//       const data = await recommendedFees();
//       const {fastestFee, halfHourFee, hourFee} = data;

//       setFeeInfo([
//         {feeType: 'fastest', isSelected: true, feeAmount: fastestFee},
//         {feeType: 'halfHour', isSelected: false, feeAmount: halfHourFee},
//         {feeType: 'hour', isSelected: false, feeAmount: hourFee},
//       ]);

//       return new Promise(resolve => {
//         resolve(true);
//       });
//     } catch (err) {
//       setErrorMessage('Error getting transaction fee amount');
//       return new Promise(resolve => {
//         resolve(false);
//       });
//     }
//   }
//   async function changeSelectedFee(item, sliderFunction) {
//     if (!bitcoinAddress) {
//       navigate.navigate('ErrorScreen', {
//         errorMessage: 'Please enter a bitcoin address',
//       });
//       return;
//     }

//     setErrorMessage('');
//     console.log(item);

//     const txFee = await calculateTxFee(item);

//     if (txFee.didRunError) {
//       setErrorMessage(txFee.content);
//       return;
//     }

//     console.log(item);
//     sliderFunction();
//     setFeeInfo(prev => {
//       return prev.map(prevItem => {
//         console.log(prevItem.feeType, item);
//         return {
//           ...prevItem,
//           isSelected: item === prevItem.feeType ? true : false,
//         };
//       });
//     });

//     setTxFeeSat(txFee.content);
//   }
// }

// async function setLightningInformationUnderDoomsday() {
//   try {
//     await nodeInfo();
//     return true;
//   } catch (err) {
//     console.log(err, 'TESTING');
//     return new Promise(resolve => {
//       resolve(false);
//     });
//   }
// }

// const styles = StyleSheet.create({
//   globalContainer: {
//     flex: 1,
//     alignItems: 'center',
//   },

//   balanceContainer: {
//     alignItems: 'center',
//     marginTop: 25,
//     marginBottom: 50,
//   },
//   balanceNum: {
//     fontSize: SIZES.xxLarge,
//   },

//   btcAdressContainer: {
//     width: '100%',
//     padding: 8,
//     borderRadius: 8,
//   },

//   inputContainer: {
//     width: '100%',
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   input: {
//     flex: 1,
//     width: '80%',
//     borderRadius: 8,
//     paddingHorizontal: 10,
//     marginRight: 10,
//     padding: 10,
//     fontSize: SIZES.medium,
//     fontFamily: FONT.Title_Regular,
//     includeFontPadding: false,
//   },
// });
