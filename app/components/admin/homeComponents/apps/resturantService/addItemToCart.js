// import {
//   Text,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
//   View,
// } from 'react-native';
// import {
//   BTN,
//   CENTER,
//   COLORS,
//   FONT,
//   SHADOWS,
//   SIZES,
// } from '../../../../../constants';
// import {useGlobalContextProvider} from '../../../../../../context-store/context';
// import {useNavigation} from '@react-navigation/native';
// import {
//   getLocalStorageItem,
//   setLocalStorageItem,
// } from '../../../../../functions';
// import {useGlobalThemeContext} from '../../../../../../context-store/theme';

// export default function AddResturantItemToCart({
//   route: {
//     params: {selectedItem, setCartItems},
//   },
// }) {
//   const {theme} = useGlobalThemeContext();
//   const navigate = useNavigation();

//   return (
//     <TouchableWithoutFeedback onPress={navigate.goBack}>
//       <View
//         style={{
//           backgroundColor: COLORS.opaicityGray,
//           flex: 1,
//           alignItems: 'center',
//           justifyContent: 'center',
//         }}>
//         <View
//           style={{
//             width: '80%',
//             backgroundColor: theme
//               ? COLORS.darkModeBackground
//               : COLORS.lightModeBackground,
//             borderRadius: 8,
//           }}>
//           <Text
//             style={{
//               textAlign: 'center',
//               marginVertical: 10,
//               fontWeight: 'bold',
//               fontSize: SIZES.large,
//               color: theme ? COLORS.darkModeText : COLORS.lightModeText,
//             }}>
//             {selectedItem.name}
//           </Text>

//           <TouchableOpacity
//             onPress={() =>
//               addItemToCart({selectedItem, setCartItems, navigate})
//             }
//             style={{
//               backgroundColor: COLORS.primary,
//               ...CENTER,

//               paddingVertical: 10,
//               paddingHorizontal: 20,
//               borderRadius: 4,
//               marginBottom: 10,
//             }}>
//             <Text
//               style={{
//                 color: COLORS.darkModeText,
//                 fontSize: SIZES.medium,
//                 fontFamily: FONT.Title_Regular,
//                 textAlign: 'center',
//               }}>
//               Add to cart
//             </Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </TouchableWithoutFeedback>
//   );
// }

// async function addItemToCart({selectedItem, setCartItems, navigate}) {
//   // this needs to be a bit more complex || just made it a deep copy but have not tried logigc yet
//   setCartItems(prev => {
//     const isInCart =
//       prev.filter(item => JSON.stringify(item) === JSON.stringify(selectedItem))
//         .length != 0;
//     if (isInCart) {
//       return prev.map(item => {
//         if (item.name === selectedItem.name) {
//           let prevQuantitiy = item.quantity || 0;
//           return {...item, quantity: (prevQuantitiy += 1)};
//         } else return item;
//       });
//     } else {
//       const newCartItems = prev.concat([selectedItem]);
//       setLocalStorageItem(
//         'resturantCartItems',
//         JSON.stringify({dateAdded: new Date(), data: newCartItems}),
//       );
//       return newCartItems;
//     }
//   });
//   navigate.goBack();
// }
