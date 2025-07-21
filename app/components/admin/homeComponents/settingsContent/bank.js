// import {StyleSheet, View, FlatList, Keyboard, Platform} from 'react-native';
// import {FONT, ICONS, SIZES} from '../../../../constants';
// import {useNavigation} from '@react-navigation/native';
// import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
// import getFormattedHomepageTxs from '../../../../functions/combinedTransactions';
// import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
// import {useTranslation} from 'react-i18next';
// import CustomButton from '../../../../functions/CustomElements/button';
// import {useSafeAreaInsets} from 'react-native-safe-area-context';
// import {ANDROIDSAFEAREA, CENTER} from '../../../../constants/styles';
// import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
// import {useNodeContext} from '../../../../../context-store/nodeContext';
// import {useAppStatus} from '../../../../../context-store/appStatus';
// import GetThemeColors from '../../../../hooks/themeColors';
// import {useUpdateHomepageTransactions} from '../../../../hooks/updateHomepageTransactions';
// import {useGlobalContextProvider} from '../../../../../context-store/context';
// import {useGlobalThemeContext} from '../../../../../context-store/theme';
// import {useEffect, useState} from 'react';
// import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';

// export default function LiquidWallet() {
//   const {isConnectedToTheInternet} = useAppStatus();
//   const {liquidNodeInformation} = useNodeContext();
//   const {theme, darkModeType} = useGlobalThemeContext();
//   const {masterInfoObject} = useGlobalContextProvider();
//   const navigate = useNavigation();
//   const {t} = useTranslation();
//   const insets = useSafeAreaInsets();
//   const {backgroundColor} = GetThemeColors();
//   const [txs, setTxs] = useState([]);

//   const currentTime = useUpdateHomepageTransactions();
//   const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
//   const bottomPadding = Platform.select({
//     ios: insets.bottom,
//     android: ANDROIDSAFEAREA,
//   });

//   useEffect(() => {
//     const formattedTxs = getFormattedHomepageTxs({
//       currentTime,
//       liquidNodeInformation,
//       navigate,
//       isBankPage: true,
//       noTransactionHistoryText: t('wallet.no_transaction_history'),
//       todayText: t('constants.today'),
//       yesterdayText: t('constants.yesterday'),
//       dayText: t('constants.day'),
//       monthText: t('constants.month'),
//       yearText: t('constants.year'),
//       agoText: t('transactionLabelText.ago'),
//       theme,
//       darkModeType,
//       userBalanceDenomination,
//     });
//     setTxs(formattedTxs);
//   }, [
//     currentTime,
//     liquidNodeInformation,
//     navigate,
//     theme,
//     darkModeType,
//     userBalanceDenomination,
//   ]);

//   return (
//     <GlobalThemeView useStandardWidth={true} styles={styles.container}>
//       <CustomSettingsTopBar
//         shouldDismissKeyboard={true}
//         showLeftImage={true}
//         leftImageBlue={ICONS.settingsIcon}
//         LeftImageDarkMode={ICONS.settingsWhite}
//         containerStyles={{marginBottom: 0}}
//         label={t('settings.bank.text1')}
//         leftImageFunction={() => {
//           if (!isConnectedToTheInternet) {
//             navigate.navigate('ErrorScreen', {
//               errorMessage: t('errormessages.nointernet'),
//             });
//             return;
//           }
//           navigate.navigate('LiquidSettingsPage');
//         }}
//       />
//       <View
//         key={'balance'}
//         style={{
//           ...styles.stickyHeader,
//           backgroundColor: backgroundColor,
//         }}>
//         <ThemeText
//           content={t('constants.balance')}
//           styles={styles.amountText}
//         />
//         <FormattedSatText
//           styles={{...styles.valueText}}
//           balance={liquidNodeInformation.userBalance}
//         />
//       </View>
//       {!txs.length ? (
//         <FullLoadingScreen />
//       ) : (
//         <FlatList
//           style={{flex: 1, width: '100%'}}
//           contentContainerStyle={{paddingBottom: bottomPadding + 60}}
//           initialNumToRender={20}
//           maxToRenderPerBatch={20}
//           windowSize={3}
//           showsVerticalScrollIndicator={false}
//           data={txs}
//           renderItem={({item, index}) => item}
//         />
//       )}

//       <CustomButton
//         buttonStyles={{
//           width: 'auto',
//           position: 'absolute',
//           bottom: bottomPadding,
//         }}
//         textContent={t('settings.bank.text2')}
//         actionFunction={() =>
//           navigate.navigate('CustomHalfModal', {
//             wantedContent: 'liquidAddressModal',
//             sliderHight: 0.6,
//           })
//         }
//       />
//     </GlobalThemeView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: 'center',
//     paddingBottom: 0,
//   },

//   amountText: {
//     textTransform: 'uppercase',
//     marginBottom: 0,
//     textAlign: 'center',
//   },
//   stickyHeader: {
//     paddingVertical: 10,
//   },
//   valueText: {
//     fontSize: SIZES.xxLarge,
//     includeFontPadding: false,
//   },
// });
