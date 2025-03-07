// import {
//   ActivityIndicator,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import {COLORS, FONT, SIZES} from '../../../../../constants';
// import {useGlobalThemeContext} from '../../../../../../context-store/theme';

// export default function AutomatedPaymentsErrorScreen(props) {
//   const {theme, darkModeType} = useGlobalThemeContext();
//   return (
//     <View
//       style={{
//         flex: 1,
//         alignItems: 'center',
//         justifyContent: 'center',
//       }}>
//       {!props.errorMessage && (
//         <ActivityIndicator
//           size="large"
//           color={theme ? COLORS.darkModeText : COLORS.lightModeText}
//         />
//       )}
//       <Text
//         style={{
//           color: theme ? COLORS.darkModeText : COLORS.lightModeText,

//           fontSize: SIZES.medium,
//           fontFamily: FONT.Title_Regular,
//           marginTop: 10,
//         }}>
//         {props.errorMessage
//           ? props.errorMessage
//           : `Sent ${props.numberOfGiftsSent} of ${props.addedContacts.length} ${
//               props.isGiveaway ? 'gifts' : 'payment requests'
//             }.`}
//       </Text>
//       {props.errorMessage && (
//         <TouchableOpacity
//           onPress={props.clearPage}
//           style={[
//             styles.button,
//             {backgroundColor: COLORS.primary, marginTop: 10},
//           ]}>
//           <Text style={styles.buttonText}>Try again</Text>
//         </TouchableOpacity>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   button: {
//     width: 150,
//     height: 35,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: COLORS.primary,
//     borderRadius: 8,
//     marginTop: 50,
//   },
//   buttonText: {color: COLORS.white, fontFamily: FONT.Other_Regular},
// });
