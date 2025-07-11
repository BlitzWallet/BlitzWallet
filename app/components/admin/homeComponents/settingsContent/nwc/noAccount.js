// import {
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from 'react-native';

// import {BTN, COLORS, FONT, SIZES} from '../../../../../constants';
// import {useState} from 'react';
// import {webln} from '@getalby/sdk';
// import {useGlobalThemeContext} from '../../../../../../context-store/theme';

// export default function NoNWCAccount() {
//   const {theme} = useGlobalThemeContext();
//   const [nwcUrl, setNwcUrl] = useState('');

//   return (
//     <View style={styles.globalContainer}>
//       <View
//         style={[
//           styles.inputContainer,
//           {
//             backgroundColor: theme
//               ? COLORS.darkModeBackgroundOffset
//               : COLORS.lightModeBackgroundOffset,
//           },
//         ]}>
//         <Text style={styles.inputHeaderText}>
//           Enter Noster Wallet Connect URL
//         </Text>
//         <TextInput
//           onChangeText={setNwcUrl}
//           style={[
//             styles.input,
//             {
//               borderColor: theme ? COLORS.darkModeText : COLORS.lightModeText,
//               color: theme ? COLORS.darkModeText : COLORS.lightModeText,
//             },
//           ]}
//         />
//       </View>
//       {/* <TouchableOpacity onPress={connectWithAlby}>
//         <Text style={styles.albyText}>
//           Connect with Alby Noster Wallet Connect
//         </Text>
//       </TouchableOpacity> */}
//       <TouchableOpacity
//         onPress={connectNWCWithURL}
//         style={[
//           BTN,
//           {
//             backgroundColor: COLORS.primary,
//             marginTop: 'auto',
//             marginBottom: 80,
//           },
//         ]}>
//         <Text style={styles.continueText}>Connect</Text>
//       </TouchableOpacity>
//     </View>
//   );

//   async function connectNWCWithURL() {}
//   async function connectWithAlby() {}
// }

// const styles = StyleSheet.create({
//   globalContainer: {
//     flex: 1,
//     alignItems: 'center',
//   },

//   inputContainer: {
//     width: '95%',
//     maxWidth: 350,
//     marginTop: 50,
//     padding: 10,
//     borderRadius: 8,
//     marginBottom: 20,
//   },
//   inputHeaderText: {
//     fontFamily: FONT.Title_Regular,
//     fontSize: SIZES.medium,
//     marginBottom: 10,
//   },
//   input: {
//     width: '100%',
//     height: 40,
//     borderRadius: 8,
//     borderWidth: 2,
//     paddingLeft: 5,
//   },

//   albyText: {
//     fontFamily: FONT.Title_Regular,
//     fontSize: SIZES.medium,
//     color: COLORS.primary,
//   },

//   continueText: {
//     fontFamily: FONT.Descriptoin_Regular,
//     fontSize: SIZES.medium,
//     color: COLORS.darkModeText,
//   },
// });
