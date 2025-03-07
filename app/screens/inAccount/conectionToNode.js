// import {
//   StyleSheet,
//   Text,
//   View,
//   Image,
//   TouchableWithoutFeedback,
// } from 'react-native';
// import {COLORS, FONT, ICONS, SIZES, SHADOWS} from '../../constants';
// import {useEffect, useState} from 'react';
// import {nodeInfo} from '@breeztech/react-native-breez-sdk';
// import {useNavigation} from '@react-navigation/native';
// import {formatBalanceAmount} from '../../functions';
// import handleBackPress from '../../hooks/handleBackPress';
// import GetThemeColors from '../../hooks/themeColors';
// import {ThemeText} from '../../functions/CustomElements';
// import ThemeImage from '../../functions/CustomElements/themeImage';
// import {useNodeContext} from '../../../context-store/nodeContext';

// export function ConnectionToNode() {
//   const navigate = useNavigation();

//   const {nodeInformation, liquidNodeInformation} = useNodeContext();
//   const {backgroundOffset} = GetThemeColors();

//   function handleBackPressFunction() {
//     navigate.goBack();
//     return true;
//   }
//   useEffect(() => {
//     handleBackPress(handleBackPressFunction);
//   }, []);

//   return (
//     <TouchableWithoutFeedback onPress={() => navigate.goBack()}>
//       <View style={styles.globalContainer}>
//         <View
//           style={[
//             styles.innerContainer,
//             {
//               backgroundColor: backgroundOffset,
//             },
//           ]}>
//           <View style={styles.topContainer}>
//             <ThemeImage
//               styles={styles.topContainerImg}
//               lightModeIcon={ICONS.connectionIcon}
//               darkModeIcon={ICONS.connectionIcon}
//               lightsOutIcon={ICONS.connectionWhite}
//             />

//             <ThemeText
//               styles={{...styles.topContainerText}}
//               content={
//                 nodeInformation.didConnectToNode ? 'Connected' : 'Not Connected'
//               }
//             />
//           </View>
//           <ThemeText
//             styles={{...styles.itemText}}
//             content={`Block Height: ${
//               nodeInformation.didConnectToNode
//                 ? formatBalanceAmount(nodeInformation?.blockHeight)
//                 : 'N/A'
//             }`}
//           />
//           <ThemeText
//             styles={{...styles.itemText}}
//             content={`Max Payable: ${
//               nodeInformation.didConnectToNode
//                 ? formatBalanceAmount(nodeInformation?.userBalance)
//                 : 'N/A'
//             }`}
//           />
//           <ThemeText
//             styles={{...styles.itemText}}
//             content={`Max Receivable: ${
//               nodeInformation.didConnectToNode
//                 ? formatBalanceAmount(
//                     nodeInformation?.inboundLiquidityMsat / 1000,
//                   )
//                 : 'N/A'
//             }`}
//           />
//           <ThemeText
//             styles={{...styles.itemText}}
//             content={`On-chain Balance: ${
//               nodeInformation.didConnectToNode
//                 ? formatBalanceAmount(nodeInformation?.onChainBalance / 1000)
//                 : 'N/A'
//             }`}
//           />
//         </View>
//       </View>
//     </TouchableWithoutFeedback>
//   );
// }

// const styles = StyleSheet.create({
//   globalContainer: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',

//     backgroundColor: COLORS.halfModalBackgroundColor,
//   },
//   innerContainer: {
//     width: '90%',
//     height: 300,

//     padding: 20,
//     borderRadius: 8,
//   },
//   topContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 15,
//   },

//   topContainerImg: {
//     width: 30,
//     height: 30,
//     marginRight: 10,
//   },
//   topContainerText: {
//     fontSize: SIZES.large,
//   },
//   itemText: {
//     marginBottom: 10,
//   },
// });
