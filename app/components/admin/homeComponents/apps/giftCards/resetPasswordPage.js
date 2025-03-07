// import {
//   Keyboard,
//   KeyboardAvoidingView,
//   Platform,
//   StyleSheet,
//   TextInput,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
//   View,
// } from 'react-native';
// import {
//   GlobalThemeView,
//   ThemeText,
// } from '../../../../../functions/CustomElements';
// import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
// import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import {useNavigation} from '@react-navigation/native';
// import {useCallback, useEffect, useState} from 'react';
// import CustomButton from '../../../../../functions/CustomElements/button';
// import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
// import {useGlobalAppData} from '../../../../../../context-store/appData';
// import {getCurrentDateFormatted} from '../../../../../functions/rotateAddressDateChecker';
// import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
// import callGiftCardsAPI from './giftCardAPI';
// import GetThemeColors from '../../../../../hooks/themeColors';
// import handleBackPress from '../../../../../hooks/handleBackPress';
// import {useKeysContext} from '../../../../../../context-store/keys';

// export default function ResetGiftCardProfilePassword(props) {
//   const {decodedGiftCards, toggleGlobalAppDataInformation} = useGlobalAppData();
//   const {contactsPrivateKey, publicKey} = useKeysContext();
//   const navigate = useNavigation();
//   const [newPassword, setNewPassword] = useState('');
//   const [resetCode, setResetCode] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setIsLoading] = useState(false);
//   const email = props.route?.params?.email;
//   const {textInputBackground, textInputColor} = GetThemeColors();

//   console.log(resetCode);

//   const handleBackPressFunction = useCallback(() => {
//     navigate.goBack();
//     return true;
//   }, [navigate]);

//   useEffect(() => {
//     handleBackPress(handleBackPressFunction);
//   }, [handleBackPressFunction]);

//   return (
//     <GlobalThemeView useStandardWidth={true}>
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
//         <KeyboardAvoidingView
//           behavior={Platform.OS === 'ios' ? 'padding' : null}
//           style={{flex: 1}}>
//           <View style={styles.topBar}>
//             <TouchableOpacity
//               onPress={() => {
//                 navigate.goBack();
//               }}
//               style={{marginRight: 'auto'}}>
//               <ThemeImage
//                 lightModeIcon={ICONS.smallArrowLeft}
//                 darkModeIcon={ICONS.smallArrowLeft}
//                 lightsOutIcon={ICONS.arrow_small_left_white}
//               />
//             </TouchableOpacity>
//           </View>
//           {loading ? (
//             <FullLoadingScreen text={'Reseeting password'} />
//           ) : (
//             <View style={styles.contentContainer}>
//               <ThemeText
//                 styles={styles.headerText}
//                 content={'Check your email'}
//               />
//               <ThemeText
//                 styles={styles.descriptionText}
//                 content={`The Bitcoin Company just sent a link to ${email}, please follow the rest instructions`}
//               />
//               <TextInput
//                 autoCapitalize="characters"
//                 value={resetCode}
//                 onChangeText={setResetCode}
//                 style={{
//                   ...styles.textInput,
//                   color: textInputColor,
//                   backgroundColor: textInputBackground,
//                 }}
//                 placeholder="Reset code"
//                 placeholderTextColor={COLORS.opaicityGray}
//               />

//               <View
//                 style={{
//                   ...styles.textInput,
//                   justifyContent: 'center',
//                   backgroundColor: textInputBackground,
//                 }}>
//                 <TextInput
//                   secureTextEntry={!showPassword}
//                   value={newPassword}
//                   onChangeText={setNewPassword}
//                   placeholder="Enter password"
//                   style={{
//                     width: '100%',
//                     paddingRight: 50,
//                     color: textInputColor,
//                   }}
//                   placeholderTextColor={COLORS.opaicityGray}
//                 />
//                 <TouchableOpacity
//                   onPress={() => setShowPassword(prev => !prev)}
//                   style={{position: 'absolute', right: 20}}>
//                   <ThemeText
//                     styles={{color: textInputColor}}
//                     content={showPassword ? 'Hide' : 'Show'}
//                   />
//                 </TouchableOpacity>
//               </View>
//               <CustomButton
//                 buttonStyles={{
//                   width: 'auto',
//                   ...CENTER,
//                   marginBottom: 10,
//                   opacity: !resetCode || !newPassword ? 0.2 : 1,
//                 }}
//                 textContent={'Reset paasword'}
//                 actionFunction={() => {
//                   if (!newPassword || !resetCode) {
//                     navigate.navigate('ErrorScreen', {
//                       errorMessage: 'Must enter an email and code.',
//                     });
//                     return;
//                   } else if (newPassword.length < 8) {
//                     navigate.navigate('ErrorScreen', {
//                       errorMessage:
//                         'Password must be longer than 8 characters.',
//                     });
//                     return;
//                   }

//                   Keyboard.dismiss();
//                   setTimeout(() => {
//                     resetAccountPassword();
//                   }, 200);
//                 }}
//               />
//             </View>
//           )}
//         </KeyboardAvoidingView>
//       </TouchableWithoutFeedback>
//     </GlobalThemeView>
//   );

//   async function resetAccountPassword() {
//     setIsLoading(true);
//     try {
//       const resetResponse = await callGiftCardsAPI({
//         apiEndpoint: 'resetAccountPassword',
//         resetToken: resetCode,
//         password: newPassword,
//       });

//       if (resetResponse.statusCode === 400) {
//         setIsLoading(false);
//         navigate.navigate('ErrorScreen', {
//           errorMessage: resetResponse.body.error,
//         });
//         return;
//       }

//       const em = encriptMessage(
//         contactsPrivateKey,
//         publicKey,
//         JSON.stringify({
//           ...decodedGiftCards,
//           profile: {
//             ...decodedGiftCards.profile,
//             lastLoginDate: getCurrentDateFormatted(),
//             accessToken: resetResponse.body.response.result.accessToken,
//             refreshToken: resetResponse.body.response.result.refreshToken,
//             lastRefreshToken: new Date(),
//           },
//         }),
//       );
//       toggleGlobalAppDataInformation({giftCards: em}, true);
//       setTimeout(() => {
//         props.navigation.reset({
//           index: 0, // The index of the route to focus on
//           routes: [{name: 'GiftCardsPage'}], // Array of routes to set in the stack
//         });
//       }, 2000);
//     } catch (err) {
//       navigate.navigate('ErrorScreen', {
//         errorMessage: 'Error resetting password.',
//       });
//       console.log('sign user in error', err);
//     }
//   }
// }

// const styles = StyleSheet.create({
//   topBar: {
//     width: '100%',
//     flexDirection: 'row',
//     alignItems: 'center',
//     ...CENTER,
//   },

//   contentContainer: {},

//   headerText: {
//     fontWeight: 500,
//     fontSize: SIZES.xLarge,
//     marginTop: 20,
//     marginBottom: 10,
//   },
//   descriptionText: {
//     marginBottom: 30,
//   },
//   textInput: {
//     width: '100%',
//     backgroundColor: COLORS.darkModeText,
//     paddingVertical: Platform.OS === 'ios' ? 15 : null,
//     paddingHorizontal: 15,
//     borderRadius: 8,
//     marginBottom: 40,
//   },
// });
