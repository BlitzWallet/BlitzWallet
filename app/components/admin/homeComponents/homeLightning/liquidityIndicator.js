// import {StyleSheet, TouchableOpacity, View} from 'react-native';
// import {COLORS, HIDDEN_BALANCE_TEXT} from '../../../../constants';
// import {useEffect, useState} from 'react';
// import {useGlobalContextProvider} from '../../../../../context-store/context';
// import {formatBalanceAmount, numberConverter} from '../../../../functions';
// import ThemeText from '../../../../functions/CustomElements/textTheme';
// import {useTranslation} from 'react-i18next';
// import {useGlobalThemeContext} from '../../../../../context-store/theme';
// import {useNodeContext} from '../../../../../context-store/nodeContext';

// export default function LiquidityIndicator() {
//   const {masterInfoObject} = useGlobalContextProvider();
//   const {nodeInformation,fiatStats} = useNodeContext();
//   const {theme, darkModeType} = useGlobalThemeContext();
//   const [sendWitdh, setsendWitdh] = useState(0);
//   const [showLiquidyAmount, setShowLiquidyAmount] = useState(false);
//   const {t} = useTranslation();

//   const userBalance = nodeInformation.userBalance;

//   useEffect(() => {
//     if (
//       isNaN(nodeInformation.userBalance) ||
//       isNaN(nodeInformation.inboundLiquidityMsat)
//     )
//       return;
//     const calculatedWidth = (
//       (nodeInformation.userBalance /
//         (nodeInformation.inboundLiquidityMsat / 1000 +
//           nodeInformation.userBalance)) *
//       150
//     ).toFixed(0);
//     setsendWitdh(Number(calculatedWidth));
//   }, [userBalance]);

//   return (
//     <TouchableOpacity
//       onPress={() => {
//         setShowLiquidyAmount(prev => !prev);
//       }}>
//       <View style={styles.container}>
//         <ThemeText
//           content={
//             showLiquidyAmount
//               ? masterInfoObject.userBalanceDenomination != 'hidden'
//                 ? formatBalanceAmount(
//                     numberConverter(
//                       nodeInformation.userBalance,
//                       masterInfoObject.userBalanceDenomination,
//                       undefined,
//                       fiatStats,
//                     ),
//                   )
//                 : HIDDEN_BALANCE_TEXT
//               : t('constants.send')
//           }
//           styles={{
//             ...styles.typeText,
//             color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
//           }}
//         />

//         <View
//           style={[
//             styles.sliderBar,
//             {
//               backgroundColor: theme
//                 ? COLORS.darkModeText
//                 : COLORS.lightModeText,
//             },
//           ]}>
//           <View
//             style={[
//               styles.sendIndicator,
//               {
//                 width: isNaN(sendWitdh) ? 0 : sendWitdh,
//                 backgroundColor:
//                   theme && darkModeType
//                     ? COLORS.giftcardlightsout3
//                     : COLORS.primary,
//               },
//             ]}></View>
//         </View>

//         <ThemeText
//           content={
//             showLiquidyAmount
//               ? masterInfoObject.userBalanceDenomination != 'hidden'
//                 ? formatBalanceAmount(
//                     numberConverter(
//                       nodeInformation.inboundLiquidityMsat / 1000,
//                       masterInfoObject.userBalanceDenomination,
//                       nodeInformation,
//                     ),
//                   )
//                 : HIDDEN_BALANCE_TEXT
//               : t('constants.receive')
//           }
//           styles={{...styles.typeText}}
//         />
//       </View>
//     </TouchableOpacity>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     width: '95%',

//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   typeText: {
//     width: 'auto',
//     textAlign: 'center',
//   },

//   sliderBar: {
//     height: 8,
//     width: 150,

//     position: 'relative',
//     backgroundColor: 'black',

//     marginHorizontal: 10,
//     borderRadius: 8,
//     overflow: 'hidden',
//   },

//   sendIndicator: {
//     height: '100%',
//     maxWidth: 110,
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     zIndex: 1,
//     backgroundColor: COLORS.primary,
//   },
// });
