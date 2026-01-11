// import {
//   StyleSheet,
//   View,
//   Text,
//   TouchableOpacity,
//   useWindowDimensions,
//   Share,
// } from 'react-native';
// import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
// import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
// import CustomButton from '../../../../../functions/CustomElements/button';
// import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import { ICONS, SIZES } from '../../../../../constants';
// import { ThemeText } from '../../../../../functions/CustomElements';

// export default function MyProfileQRCode() {
//   const { globalContactsInformation } = useGlobalContacts();
//   const { width, height } = useWindowDimensions();

//   // Calculate responsive QR size based on screen dimensions
//   const getQRSize = () => {
//     const minDimension = Math.min(width, height);
//     // Use 60% of the smaller dimension, with min 200 and max 300
//     return Math.min(Math.max(minDimension * 0.8, 200), 300);
//   };

//   const qrSize = getQRSize();
//   const outerSize = qrSize + 25;

//   const handleShareQR = () => {
//     Share.share({
//       title: 'Click to view my Blitz profile.',
//       message: `https://blitzwalletapp.com/u/${globalContactsInformation.myProfile.uniqueName}`,
//     });
//     // Implement share functionality
//     console.log('Share QR code');
//   };

//   const handleScanQR = () => {
//     // Implement scan functionality
//     console.log('Scan QR code');
//   };

//   return (
//     <View style={styles.container}>
//       {/* QR Code */}
//       <QrCodeWrapper
//         outerContainerStyle={{ width: outerSize, height: outerSize }}
//         innerContainerStyle={{ width: qrSize, height: qrSize }}
//         qrSize={qrSize}
//         QRData={`https://blitzwalletapp.com/u/${globalContactsInformation.myProfile.uniqueName}`}
//       />

//       {/* <View style={styles.buttonContainer}>
//         <CustomButton
//           actionFunction={handleShareQR}
//           textContent={'Share QR Code'}
//         />

//         <TouchableOpacity
//           style={styles.button}
//           onPress={handleScanQR}
//           activeOpacity={0.7}
//         >
//           <ThemeImage
//             styles={{ width: 25, height: 25, marginRight: 10 }}
//             lightModeIcon={ICONS.scanQrCodeDark}
//             darkModeIcon={ICONS.scanQrCodeLight}
//             lightsOutIcon={ICONS.scanQrCodeLight}
//           />
//           <ThemeText styles={styles.buttonText} content="Scan QR Code" />
//         </TouchableOpacity>
//       </View> */}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 20,
//   },
//   username: {
//     fontSize: 20,
//     fontWeight: '500',
//     color: '#000',
//     marginTop: 20,
//     marginBottom: 30,
//   },
//   buttonContainer: {
//     width: '100%',
//     gap: 16,
//     paddingHorizontal: 20,
//     marginTop: 30,
//   },
//   button: {
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     backgroundColor: 'transparent',
//     alignItems: 'center',
//     flexDirection: 'row',
//     justifyContent: 'center',
//   },
//   buttonText: {},
// });
