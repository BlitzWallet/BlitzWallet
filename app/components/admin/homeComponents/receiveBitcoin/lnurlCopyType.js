// import {StyleSheet, TouchableOpacity, View} from 'react-native';
// import {ThemeText} from '../../../../functions/CustomElements';
// import {INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
// import {CENTER, ICONS} from '../../../../constants';
// import ThemeImage from '../../../../functions/CustomElements/themeImage';
// import {useGlobalContacts} from '../../../../../context-store/globalContacts';
// import {encodeLNURL} from '../../../../functions/lnurl/bench32Formmater';
// import GetThemeColors from '../../../../hooks/themeColors';
// import {useToast} from '../../../../../context-store/toastManager';
// import {copyToClipboard} from '../../../../functions';
// import {useGlobalThemeContext} from '../../../../../context-store/theme';
// import {useTranslation} from 'react-i18next';

// export default function ChooseLNURLCopyFormat() {
//   const {showToast} = useToast();
//   const {theme, darkModeType} = useGlobalThemeContext();
//   const {globalContactsInformation} = useGlobalContacts();
//   const {backgroundOffset, backgroundColor} = GetThemeColors();
//   const {t} = useTranslation();

//   const lightningAddress = `${globalContactsInformation.myProfile.uniqueName}@blitzwalletapp.com`;
//   const lightningString = `${encodeLNURL(
//     globalContactsInformation.myProfile.uniqueName,
//   )}`;
//   return (
//     <View style={styles.container}>
//       <ThemeText styles={styles.header} content={t('constants.copy')} />
//       <TouchableOpacity
//         onPress={() => {
//           copyToClipboard(lightningAddress, showToast);
//         }}
//         style={{
//           ...styles.copyRow,
//           backgroundColor:
//             theme && darkModeType ? backgroundColor : backgroundOffset,
//         }}>
//         <ThemeImage
//           styles={styles.copyIcon}
//           lightModeIcon={ICONS.clipboardBlue}
//           darkModeIcon={ICONS.clipboardBlue}
//           lightsOutIcon={ICONS.clipboardLight}
//         />
//         <View style={styles.textContainer}>
//           <ThemeText content={`Lightning ${t('constants.address')}`} />
//           <ThemeText
//             styles={styles.copyPreviewText}
//             CustomNumberOfLines={1}
//             content={`${globalContactsInformation.myProfile.uniqueName}@blitzwalletapp.com`}
//           />
//         </View>
//       </TouchableOpacity>
//       <TouchableOpacity
//         onPress={() => {
//           copyToClipboard(lightningString, showToast);
//         }}
//         style={{
//           ...styles.copyRow,
//           backgroundColor:
//             theme && darkModeType ? backgroundColor : backgroundOffset,
//         }}>
//         <ThemeImage
//           styles={styles.copyIcon}
//           lightModeIcon={ICONS.clipboardBlue}
//           darkModeIcon={ICONS.clipboardBlue}
//           lightsOutIcon={ICONS.clipboardLight}
//         />
//         <View style={styles.textContainer}>
//           <ThemeText content={`Lightning ${t('constants.string')}`} />
//           <ThemeText
//             CustomNumberOfLines={1}
//             styles={styles.copyPreviewText}
//             content={`${encodeLNURL(
//               globalContactsInformation.myProfile.uniqueName,
//             )}@blitzwalletapp.com`}
//           />
//         </View>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     width: INSET_WINDOW_WIDTH,
//     ...CENTER,
//     alignItems: 'center',
//   },
//   header: {
//     fontSize: SIZES.large,
//     marginBottom: 10,
//   },
//   copyRow: {
//     width: '100%',
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginVertical: 10,
//     padding: 10,
//     borderRadius: 8,
//   },
//   copyIcon: {
//     marginRight: 10,
//   },
//   textContainer: {
//     flexShrink: 1,
//   },
//   copyPreviewText: {
//     fontSize: SIZES.small,
//     opacity: 0.6,
//   },
// });
