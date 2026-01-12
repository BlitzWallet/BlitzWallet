// import {
//   StyleSheet,
//   View,
//   TouchableOpacity,
//   Image,
//   ScrollView,
//   Share,
//   FlatList,
// } from 'react-native';
// import { CENTER, COLORS, ICONS, SIZES } from '../../../../constants';
// import { useNavigation } from '@react-navigation/native';
// import { useCallback, useEffect, useMemo, useState } from 'react';
// import {
//   GlobalThemeView,
//   ThemeText,
// } from '../../../../functions/CustomElements';
// import { useGlobalContacts } from '../../../../../context-store/globalContacts';
// import GetThemeColors from '../../../../hooks/themeColors';
// import ThemeImage from '../../../../functions/CustomElements/themeImage';
// import ProfilePageTransactions from './internalComponents/profilePageTransactions';
// import { useGlobalThemeContext } from '../../../../../context-store/theme';
// import { useAppStatus } from '../../../../../context-store/appStatus';
// import MaxHeap from '../../../../functions/minHeap';
// import ContactProfileImage from './internalComponents/profileImage';
// import { useImageCache } from '../../../../../context-store/imageCache';
// import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
// import { useTranslation } from 'react-i18next';
// import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
// import CustomButton from '../../../../functions/CustomElements/button';

// export default function MyContactProfilePage({ navigation }) {
//   const { isConnectedToTheInternet } = useAppStatus();
//   const { cache } = useImageCache();
//   const { theme, darkModeType } = useGlobalThemeContext();
//   const { globalContactsInformation, decodedAddedContacts, contactsMessags } =
//     useGlobalContacts();
//   const { backgroundOffset, textInputBackground, textInputColor } =
//     GetThemeColors();
//   const navigate = useNavigation();
//   const currentTime = new Date();
//   const [allPayments, setAllPayments] = useState([]);
//   const [displayedPayments, setDisplayedPayments] = useState([]);
//   const [currentPage, setCurrentPage] = useState(1);
//   const { t } = useTranslation();
//   const { bottomPadding } = useGlobalInsets();

//   const ITEMS_PER_PAGE = 10;

//   const myContact = globalContactsInformation.myProfile;

//   useEffect(() => {
//     const messageHeap = new MaxHeap();

//     for (let contact of Object.keys(contactsMessags)) {
//       if (contact === 'lastMessageTimestamp') continue;
//       const data = contactsMessags[contact];
//       const selectedAddedContact = decodedAddedContacts.find(
//         contactElement => contactElement.uuid === contact,
//       );

//       for (let message of data.messages) {
//         const timestamp = message.timestamp;

//         const messageObj = {
//           transaction: message,
//           selectedProfileImage: selectedAddedContact?.profileImage || null,
//           name:
//             selectedAddedContact?.name ||
//             selectedAddedContact?.uniqueName ||
//             'Unknown',
//           contactUUID: selectedAddedContact?.uuid || contact,
//           time: timestamp,
//           key: message.message.uuid || timestamp.toString(),
//           timeDiff: currentTime - timestamp,
//         };

//         messageHeap.add(messageObj);
//       }
//     }

//     const result = [];
//     while (!messageHeap.isEmpty()) {
//       result.push(messageHeap.poll());
//     }

//     if (!result.length) return;

//     setAllPayments(result);
//     setDisplayedPayments(result.slice(0, ITEMS_PER_PAGE));
//     setCurrentPage(1);
//   }, [decodedAddedContacts, contactsMessags]);

//   const handleLoadMore = () => {
//     const nextPage = currentPage + 1;
//     const startIndex = currentPage * ITEMS_PER_PAGE;
//     const endIndex = startIndex + ITEMS_PER_PAGE;
//     const newItems = allPayments.slice(startIndex, endIndex);

//     setDisplayedPayments([...displayedPayments, ...newItems]);
//     setCurrentPage(nextPage);
//   };

//   const hasTransactions = useMemo(() => {
//     const keys = Object.keys(contactsMessags || {});
//     return keys.length > 1;
//   }, [contactsMessags]);

//   const hasMoreItems = displayedPayments.length < allPayments.length;

//   const ListHeaderComponent = useCallback(
//     () => (
//       <View style={styles.innerContainer}>
//         <TouchableOpacity
//           onPress={() => {
//             navigation.navigate('CustomHalfModal', {
//               wantedContent: 'myProfileQRcode',
//               sliderHight: 0.6,
//             });
//           }}
//         >
//           <View>
//             <View
//               style={[
//                 styles.profileImage,
//                 {
//                   backgroundColor: backgroundOffset,
//                 },
//               ]}
//             >
//               <ContactProfileImage
//                 updated={cache[myContact.uuid]?.updated}
//                 uri={cache[myContact.uuid]?.localUri}
//                 darkModeType={darkModeType}
//                 theme={theme}
//               />
//             </View>
//             <View style={styles.scanProfileImage}>
//               <Image
//                 source={ICONS.scanQrCodeDark}
//                 style={{ width: 18, height: 18 }}
//               />
//             </View>
//           </View>
//         </TouchableOpacity>

//         <ThemeText
//           styles={{
//             ...styles.uniqueNameText,
//             marginBottom: myContact?.name ? 0 : 10,
//           }}
//           content={myContact.uniqueName}
//         />

//         {myContact?.name && (
//           <ThemeText
//             styles={{ ...styles.nameText }}
//             content={myContact?.name}
//           />
//         )}

//         <View
//           style={[
//             styles.bioContainer,
//             { marginTop: 10, backgroundColor: textInputBackground },
//           ]}
//         >
//           <ScrollView
//             contentContainerStyle={{
//               alignItems: myContact.bio ? null : 'center',
//               flexGrow: myContact.bio ? null : 1,
//             }}
//             showsVerticalScrollIndicator={false}
//           >
//             <ThemeText
//               styles={{ ...styles.bioText, color: textInputColor }}
//               content={myContact?.bio || t('constants.noBioSet')}
//             />
//           </ScrollView>
//         </View>
//       </View>
//     ),
//     [
//       cache[myContact.uuid]?.updated,
//       cache[myContact.uuid]?.localUri,
//       theme,
//       darkModeType,
//       myContact?.uniqueName,
//       myContact?.name,
//       myContact?.bio,
//     ],
//   );

//   const ListFooterComponent = () => {
//     if (!hasMoreItems || allPayments.length === 0) return null;

//     return (
//       <CustomButton
//         buttonStyles={styles.loadMoreButton}
//         actionFunction={handleLoadMore}
//         textContent={t('constants.loadMore')}
//       />
//     );
//   };

//   return (
//     <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
//       <View style={styles.topBar}>
//         <TouchableOpacity onPress={navigate.goBack}>
//           <ThemeImage
//             darkModeIcon={ICONS.smallArrowLeft}
//             lightModeIcon={ICONS.smallArrowLeft}
//             lightsOutIcon={ICONS.arrow_small_left_white}
//           />
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={{ marginLeft: 'auto', marginRight: 5 }}
//           onPress={() => {
//             Share.share({
//               message: `${t('share.contact')}\nhttps://blitzwalletapp.com/u/${
//                 myContact.uniqueName
//               }`,
//             });
//           }}
//         >
//           <ThemeImage
//             darkModeIcon={ICONS.share}
//             lightModeIcon={ICONS.share}
//             lightsOutIcon={ICONS.shareWhite}
//           />
//         </TouchableOpacity>
//         <TouchableOpacity
//           onPress={() => {
//             if (!isConnectedToTheInternet) {
//               navigate.navigate('ErrorScreen', {
//                 errorMessage: t('errormessages.nointernet'),
//               });
//               return;
//             }
//             navigate.navigate('EditMyProfilePage', {
//               pageType: 'myProfile',
//               fromSettings: false,
//             });
//           }}
//         >
//           <ThemeImage
//             darkModeIcon={ICONS.settingsIcon}
//             lightModeIcon={ICONS.settingsIcon}
//             lightsOutIcon={ICONS.settingsWhite}
//           />
//         </TouchableOpacity>
//       </View>

//       {hasTransactions ? (
//         <FlatList
//           showsVerticalScrollIndicator={false}
//           contentContainerStyle={{
//             paddingBottom: bottomPadding,
//           }}
//           ListHeaderComponent={ListHeaderComponent}
//           ListFooterComponent={ListFooterComponent}
//           data={displayedPayments}
//           keyExtractor={item => item.key}
//           renderItem={({ item }) => (
//             <ProfilePageTransactions
//               transaction={item}
//               currentTime={currentTime}
//               theme={theme}
//               darkModeType={darkModeType}
//               cache={cache}
//             />
//           )}
//           maxToRenderPerBatch={10}
//           updateCellsBatchingPeriod={50}
//           initialNumToRender={10}
//         />
//       ) : (
//         <View style={{ flex: 1 }}>
//           <ListHeaderComponent />
//           <ThemeText
//             styles={styles.txPlaceholder}
//             content={t('constants.noTransactions')}
//           />
//         </View>
//       )}
//     </GlobalThemeView>
//   );
// }

// const styles = StyleSheet.create({
//   topBar: {
//     width: '100%',
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 15,
//   },

//   innerContainer: {
//     width: '100%',
//     alignItems: 'center',
//   },
//   uniqueNameText: {
//     fontSize: SIZES.xxLarge,
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
//   scanProfileImage: {
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
//   nameText: {
//     textAlign: 'center',
//     marginBottom: 10,
//   },
//   bioContainer: {
//     width: '90%',
//     minHeight: 60,
//     maxHeight: 80,
//     borderRadius: 8,
//     padding: 10,
//     backgroundColor: COLORS.darkModeText,
//   },
//   bioText: {
//     marginBottom: 'auto',
//     marginTop: 'auto',
//   },
//   txPlaceholder: {
//     marginTop: 20,
//     textAlign: 'center',
//     width: INSET_WINDOW_WIDTH,
//     ...CENTER,
//   },
//   loadMoreButton: {
//     alignSelf: 'center',
//     marginTop: 15,
//   },
// });
