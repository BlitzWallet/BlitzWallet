// import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
// import GetThemeColors from '../../hooks/themeColors';
// import { useGlobalThemeContext } from '../../../context-store/theme';
// import { CENTER, COLORS, FONT, ICONS, SIZES } from '../../constants';

// export default function ProfileImageContainer({
//   containerFunction,
//   imageURL = '',
//   showSelectPhotoIcon = false,
//   containerStyles = {},
//   activeOpacity = 0.2,
//   imageStyles = {},
//   useLogo = false,
// }) {
//   const { backgroundColor, backgroundOffset } = GetThemeColors();
//   const { theme, darkModeType } = useGlobalThemeContext();
//   return (
//     <TouchableOpacity
//       activeOpacity={activeOpacity}
//       onPress={() => {
//         containerFunction?.();
//       }}
//       style={{ ...containerStyles }}
//     >
//       <View
//         style={[
//           styles.profileImage,
//           {
//             backgroundColor: backgroundOffset,
//             ...imageStyles,
//           },
//         ]}
//       >
//         <Image
//           source={
//             useLogo
//               ? darkModeType && theme
//                 ? ICONS.logoIconWhite
//                 : ICONS.logoIcon
//               : imageURL
//               ? {
//                   uri: imageURL,
//                 }
//               : darkModeType && theme
//               ? ICONS.userWhite
//               : ICONS.userIcon
//           }
//           style={
//             useLogo
//               ? { width: '50%', height: '50%' }
//               : imageURL
//               ? { width: '100%', aspectRatio: 1 }
//               : { width: '50%', height: '50%' }
//           }
//         />
//       </View>
//       {showSelectPhotoIcon && (
//         <View style={styles.selectFromPhotos}>
//           <Image
//             source={imageURL ? ICONS.xSmallIconBlack : ICONS.ImagesIconDark}
//             style={{ width: 20, height: 20 }}
//           />
//         </View>
//       )}
//     </TouchableOpacity>
//   );
// }
// const styles = StyleSheet.create({
//   selectFromPhotos: {
//     width: 30,
//     height: 30,
//     borderRadius: 20,
//     backgroundColor: COLORS.darkModeText,
//     alignItems: 'center',
//     justifyContent: 'center',
//     position: 'absolute',
//     right: 12.5,
//     bottom: 12.5,
//     zIndex: 2,
//   },
//   profileImage: {
//     width: 150,
//     height: 150,
//     borderRadius: 125,
//     backgroundColor: 'red',
//     ...CENTER,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 10,
//     overflow: 'hidden',
//   },

//   textInput: {
//     fontSize: SIZES.medium,
//     padding: 10,
//     fontFamily: FONT.Title_Regular,
//     includeFontPadding: false,
//     borderRadius: 8,
//     marginBottom: 10,
//   },
//   textInputContainer: { width: '100%' },
//   textInputContainerDescriptionText: {
//     marginBottom: 5,
//   },
// });
