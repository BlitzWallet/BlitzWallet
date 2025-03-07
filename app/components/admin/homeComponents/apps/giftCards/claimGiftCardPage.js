// import {StyleSheet, TouchableOpacity, View} from 'react-native';
// import {
//   GlobalThemeView,
//   ThemeText,
// } from '../../../../../functions/CustomElements';
// import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import {CENTER, ICONS, SIZES} from '../../../../../constants';
// import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
// import * as WebBrowser from 'expo-web-browser';
// import CustomButton from '../../../../../functions/CustomElements/button';
// import handleBackPress from '../../../../../hooks/handleBackPress';
// import {useCallback, useEffect} from 'react';

// export default function ClaimGiftCard(props) {
//   const selectedItem = props.route?.params?.selectedItem;
//   const navigate = props.navigation;

//   const handleBackPressFunction = useCallback(() => {
//     navigate.goBack();
//     return true;
//   }, [navigate]);

//   useEffect(() => {
//     handleBackPress(handleBackPressFunction);
//   }, [handleBackPressFunction]);

//   return (
//     <GlobalThemeView useStandardWidth={true}>
//       <View style={styles.topBar}>
//         <TouchableOpacity
//           onPress={() => {
//             props.navigation.goBack();
//           }}
//           style={{marginRight: 'auto'}}>
//           <ThemeImage
//             lightModeIcon={ICONS.smallArrowLeft}
//             darkModeIcon={ICONS.smallArrowLeft}
//             lightsOutIcon={ICONS.arrow_small_left_white}
//           />
//         </TouchableOpacity>
//       </View>
//       <ThemeText
//         styles={{fontSize: SIZES.xxLarge, textAlign: 'center'}}
//         content={selectedItem.name}
//       />
//       <FormattedSatText
//         neverHideBalance={true}
//         frontText={'Cost: '}
//         styles={{
//           includeFontPadding: false,
//         }}
//         balance={selectedItem.amountSats}
//       />
//       <ThemeText
//         styles={{textAlign: 'center'}}
//         content={`Quantitiy: ${selectedItem.quantity}`}
//       />
//       <CustomButton
//         buttonStyles={{
//           width: 'auto',
//           ...CENTER,

//           marginVertical: 20,
//         }}
//         textStyles={{
//           paddingVertical: 10,
//         }}
//         textContent={'Get claim information'}
//         actionFunction={() => {
//           (async () => {
//             try {
//               await WebBrowser.openBrowserAsync(
//                 selectedItem.claimData.claimLink,
//               );
//             } catch (err) {
//               console.log(err, 'OPENING LINK ERROR');
//             }
//           })();
//         }}
//       />
//     </GlobalThemeView>
//   );
// }
// const styles = StyleSheet.create({
//   topBar: {
//     width: '100%',
//     flexDirection: 'row',
//     alignItems: 'center',
//     ...CENTER,
//   },
// });
