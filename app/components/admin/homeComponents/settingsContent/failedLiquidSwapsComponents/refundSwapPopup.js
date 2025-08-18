// import {
//   KeyboardAvoidingView,
//   Platform,
//   ScrollView,
//   StyleSheet,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
//   View,
// } from 'react-native';
// import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
// import {
//   CustomKeyboardAvoidingView,
//   ThemeText,
// } from '../../../../../functions/CustomElements';
// import {useEffect, useMemo, useState} from 'react';
// import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
// import {useNavigation} from '@react-navigation/native';
// import GetThemeColors from '../../../../../hooks/themeColors';
// import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
// import {
//   recommendedFees,
//   refund,
// } from '@breeztech/react-native-breez-sdk-liquid';
// import CustomButton from '../../../../../functions/CustomElements/button';
// import {copyToClipboard} from '../../../../../functions';
// import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import {useGlobalThemeContext} from '../../../../../../context-store/theme';
// import {keyboardGoBack} from '../../../../../functions/customNavigation';
// import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
// import {useToast} from '../../../../../../context-store/toastManager';

// export default function RefundLiquidSwapPopup(props) {
//   const {showToast} = useToast();
//   const {theme} = useGlobalThemeContext();
//   const [bitcoinAddress, setBitcoinAddress] = useState('');
//   const [errorMessage, setErrorMessage] = useState('');
//   const navigate = useNavigation();
//   const {backgroundOffset, textInputBackground, textInputColor} =
//     GetThemeColors();
//   const [refundTxId, setRefundTxId] = useState('');
//   const {swapAddress} = props.route.params;
//   const [isKeyboardFocused, setIsKeyboardActive] = useState(false);
//   const [isSending, setIsSending] = useState(false);
//   const [refundFeeRates, setRefundFeeRates] = useState([]);

//   const showLoadingScreen = !refundFeeRates.length || errorMessage || isSending;

//   useEffect(() => {
//     async function getRefundFeeRates() {
//       try {
//         const fees = await recommendedFees();
//         let newFeeObject = [];
//         for (let index = 0; index < Object.keys(fees).length; index++) {
//           const element = Object.keys(fees)[index];
//           const newObject = {
//             isSelected: element === 'hourFee', // Fixed typo: isSelescted -> isSelected
//             name: element,
//             feeRate: fees[element],
//           };
//           newFeeObject.push(newObject);
//         }
//         setRefundFeeRates(newFeeObject.sort((a, b) => a.feeRate - b.feeRate));
//       } catch (err) {
//         console.error(err);
//         setErrorMessage(err.message);
//       }
//     }

//     getRefundFeeRates();
//   }, []);

//   const feeElements = useMemo(() => {
//     return (
//       !!refundFeeRates.length &&
//       refundFeeRates.map((key, index) => {
//         return (
//           <TouchableOpacity
//             key={key.name}
//             onPress={() => {
//               setRefundFeeRates(prev => {
//                 return prev.map(item => {
//                   if (item.name === key.name) {
//                     return {...item, isSelected: true};
//                   } else return {...item, isSelected: false};
//                 });
//               });
//             }}
//             style={styles.contentContainer}>
//             <ThemeText content={key.name} />
//             <CheckMarkCircle isActive={key.isSelected} containerSize={30} />
//           </TouchableOpacity>
//         );
//       })
//     );
//   }, [refundFeeRates]);

//   return (
//     <CustomKeyboardAvoidingView
//       globalThemeViewStyles={{backgroundColor: COLORS.halfModalBackgroundColor}}
//       isKeyboardActive={isKeyboardFocused}
//       useTouchableWithoutFeedback={false}
//       useLocalPadding={true}
//       useStandardWidth={false}>
//       <View style={styles.background}>
//         <ScrollView
//           contentContainerStyle={{
//             alignItems: showLoadingScreen ? 'unset' : 'start',
//             justifyContent: showLoadingScreen ? 'center' : 'start',
//             height: '100%',
//             width: '100%',
//           }}
//           style={{
//             ...styles.selectionContainer,
//             backgroundColor: backgroundOffset,
//           }}>
//           <TouchableOpacity
//             onPress={() => {
//               keyboardGoBack(navigate);
//             }}>
//             <ThemeImage
//               styles={{
//                 marginLeft: 'auto',
//               }}
//               lightModeIcon={ICONS.xSmallIcon}
//               darkModeIcon={ICONS.xSmallIcon}
//               lightsOutIcon={ICONS.xSmallIconWhite}
//             />
//           </TouchableOpacity>
//           {showLoadingScreen ? (
//             <FullLoadingScreen
//               showLoadingIcon={!errorMessage}
//               textStyles={{textAlign: 'center'}}
//               text={
//                 isSending
//                   ? 'Sending Refund Tx'
//                   : errorMessage || 'Getting fee rates'
//               }
//             />
//           ) : refundTxId ? (
//             <View style={{flex: 1}}>
//               <ThemeText
//                 styles={{marginBottom: 20}}
//                 content={'Refund transaction id'}
//               />
//               <TouchableOpacity
//                 onPress={() => {
//                   copyToClipboard(refundTxId, showToast);
//                 }}>
//                 <ThemeText content={refundTxId.slice(0, 50)} />
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <>
//               <View style={[styles.btcAdressContainer]}>
//                 <ThemeText
//                   styles={styles.btcAdressHeader}
//                   content={'Enter BTC address'}
//                 />
//                 <View style={[styles.inputContainer]}>
//                   <CustomSearchInput
//                     containerStyles={{
//                       marginRight: 10,
//                       marginLeft: 0,
//                       flex: 1,
//                     }}
//                     textInputStyles={{
//                       backgroundColor: theme
//                         ? COLORS.darkModeText
//                         : textInputBackground,
//                       color: theme ? COLORS.lightModeText : textInputColor,
//                     }}
//                     placeholderText={'Bitcoin address...'}
//                     placeholderTextColor={
//                       theme ? COLORS.opaicityGray : textInputColor
//                     }
//                     inputText={bitcoinAddress}
//                     setInputText={setBitcoinAddress}
//                     onFocusFunction={() => setIsKeyboardActive(true)}
//                     onBlurFunction={() => setIsKeyboardActive(false)}
//                   />
//                   <TouchableOpacity
//                     onPress={() => {
//                       if (errorMessage) return;
//                       navigate.navigate('CameraModal', {
//                         updateBitcoinAdressFunc: setBitcoinAddress,
//                       });
//                     }}>
//                     <ThemeImage
//                       styles={styles.scanIcon}
//                       lightModeIcon={ICONS.faceIDIcon}
//                       darkModeIcon={ICONS.faceIDIcon}
//                       lightsOutIcon={ICONS.faceIDIconWhite}
//                     />
//                   </TouchableOpacity>
//                 </View>
//               </View>
//               <ThemeText
//                 styles={{...styles.btcAdressHeader, marginTop: 20}}
//                 content={'Select a fee rate'}
//               />
//               {feeElements}

//               <CustomButton
//                 buttonStyles={{
//                   ...CENTER,
//                   opacity: !bitcoinAddress ? 0.2 : 1,
//                   marginTop: 20,
//                 }}
//                 actionFunction={refundTransaction}
//                 textContent={'Refund'}
//               />
//             </>
//           )}
//         </ScrollView>
//       </View>
//     </CustomKeyboardAvoidingView>
//   );

//   async function refundTransaction() {
//     try {
//       if (!bitcoinAddress) return;

//       // Find the selected fee rate with proper error handling
//       const selectedFeeRate = refundFeeRates.find(item => item.isSelected);

//       // If no fee rate is selected, show an error or use a default
//       if (!selectedFeeRate) {
//         setErrorMessage('Please select a fee rate');
//         return;
//       }

//       setIsSending(true);
//       const destinationAddress = bitcoinAddress;

//       if (!refund) {
//         setErrorMessage('Refund function is not set');
//         return;
//       }

//       const refundResponse = await refund({
//         swapAddress: swapAddress,
//         refundAddress: destinationAddress,
//         feeRateSatPerVbyte:
//           selectedFeeRate.feeRate < 4 ? 4 : selectedFeeRate.feeRate,
//       });
//       setIsSending(false);
//       setRefundTxId(refundResponse);
//     } catch (err) {
//       console.log(err);
//       setErrorMessage(err.message);
//       setIsSending(false);
//     }
//   }
// }

// const styles = StyleSheet.create({
//   background: {
//     flex: 1,
//     width: '100%',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   selectionContainer: {
//     flex: 1,
//     width: '90%',
//     maxHeight: 450,
//     padding: 20,
//     borderRadius: 8,
//   },
//   btcAdressContainer: {
//     width: '100%',
//     borderRadius: 8,
//   },
//   btcAdressHeader: {
//     fontSize: SIZES.medium,
//     marginBottom: 10,
//   },

//   inputContainer: {
//     width: '100%',
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   scanIcon: {
//     width: 35,
//     height: 35,
//   },

//   contentContainer: {
//     width: '100%',
//     borderRadius: 8,
//     minHeight: 0,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 10,
//     paddingHorizontal: 0,
//   },
// });
