// import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
// import {
//   GlobalThemeView,
//   ThemeText,
// } from '../../../../../functions/CustomElements';
// import {useNavigation} from '@react-navigation/native';
// import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import {CENTER, ICONS} from '../../../../../constants';
// import {useEffect, useState} from 'react';
// import {copyToClipboard, getLocalStorageItem} from '../../../../../functions';
// import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
// import {Buffer} from 'buffer';
// import {useToast} from '../../../../../../context-store/toastManager';

// export default function HistoricalOnChainPayments() {
//   const {showToast} = useToast();
//   const navigate = useNavigation();
//   const [historicalTransactions, setHistoricalTransactions] = useState([]);
//   useEffect(() => {
//     (async () => {
//       const sentBTCPayments =
//         JSON.parse(await getLocalStorageItem('refundedBTCtransactions')) || [];

//       setHistoricalTransactions(sentBTCPayments);
//     })();
//   }, []);

//   const txElements = historicalTransactions.map((transaction, id) => {
//     return (
//       <View key={id}>
//         <ThemeText
//           styles={{marginBottom: 10}}
//           content={`Date: ${new Date(transaction.date).toLocaleDateString()}`}
//         />

//         <ThemeText content={`Address: `} />
//         <ThemeText
//           styles={{marginBottom: 10}}
//           content={`${transaction.toAddress}`}
//         />

//         <ThemeText content={`txID: `} />
//         <TouchableOpacity
//           onPress={() => {
//             copyToClipboard(
//               Buffer.from(transaction.txid).toString('hex'),
//               showToast,
//             );
//           }}>
//           <ThemeText
//             content={`${Buffer.from(transaction.txid).toString('hex')}`}
//           />
//         </TouchableOpacity>
//       </View>
//     );
//   });
//   return (
//     <GlobalThemeView useStandardWidth={true}>
//       <View style={styles.topbar}>
//         <TouchableOpacity
//           onPress={() => {
//             navigate.goBack();
//           }}>
//           <ThemeImage
//             lightsOutIcon={ICONS.arrow_small_left_white}
//             darkModeIcon={ICONS.smallArrowLeft}
//             lightModeIcon={ICONS.smallArrowLeft}
//           />
//         </TouchableOpacity>
//       </View>
//       {historicalTransactions.length != 0 ? (
//         <ScrollView contentContainerStyle={{width: '90%', ...CENTER}}>
//           {txElements}
//         </ScrollView>
//       ) : (
//         <FullLoadingScreen
//           showLoadingIcon={false}
//           text={'You have not sent any on-chain payments'}
//         />
//       )}
//     </GlobalThemeView>
//   );
// }

// const styles = StyleSheet.create({
//   topbar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 20,
//   },
// });
