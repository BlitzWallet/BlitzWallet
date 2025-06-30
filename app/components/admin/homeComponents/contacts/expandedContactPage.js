import {
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Share,
} from 'react-native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useMemo} from 'react';
import {
  decryptMessage,
  encriptMessage,
} from '../../../../functions/messaging/encodingAndDecodingMessages';
import ContactsTransactionItem from './internalComponents/contactsTransactions';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import Icon from '../../../../functions/CustomElements/Icon';
import {queueSetCashedMessages} from '../../../../functions/messaging/cachedMessages';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomSendAndRequsetBTN from '../../../../functions/CustomElements/sendRequsetCircleBTN';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import ContactProfileImage from './internalComponents/profileImage';
import {useImageCache} from '../../../../../context-store/imageCache';
import {useGlobalInsets} from '../../../../../context-store/insetsProvider';

export default function ExpandedContactsPage(props) {
  const navigate = useNavigation();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    backgroundOffset,
    backgroundColor,
    textInputColor,
    textInputBackground,
  } = GetThemeColors();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
    contactsMessags,
  } = useGlobalContacts();
  const {bottomPadding} = useGlobalInsets();
  const {cache} = useImageCache();
  const currentTime = new Date();
  const selectedUUID = props?.route?.params?.uuid || props?.uuid;
  const myProfile = globalContactsInformation?.myProfile;

  const [selectedContact] = useMemo(
    () =>
      decodedAddedContacts.filter(contact => contact?.uuid === selectedUUID),
    [decodedAddedContacts, selectedUUID],
  );
  const imageData = cache[selectedContact.uuid];
  const contactTransactions = contactsMessags[selectedUUID]?.messages || []; //selectedContact?.transactions;
  useHandleBackPressNew();
  useEffect(() => {
    //listening for messages when you're on the contact
    async function updateSeenTransactions() {
      const hasUnlookedTransaction = contactTransactions.filter(
        globalMessage => {
          return !globalMessage.message.wasSeen;
        },
      );

      if (!hasUnlookedTransaction.length) return;

      let newMessagesList = [];

      for (const savedMessage of hasUnlookedTransaction) {
        newMessagesList.push({
          ...savedMessage,
          message: {...savedMessage.message, wasSeen: true},
        });
      }
      queueSetCashedMessages({
        newMessagesList,
        myPubKey: globalContactsInformation.myProfile.uuid,
      });
    }
    updateSeenTransactions();
    return;
  }, [contactTransactions]);

  return (
    <GlobalThemeView useStandardWidth={true} styles={{paddingBottom: 0}}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={{marginRight: 'auto'}}
          onPress={navigate.goBack}>
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        {selectedContact && (
          <TouchableOpacity
            style={{marginRight: 5}}
            onPress={() => {
              (async () => {
                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'Please reconnect to the internet to use this feature',
                  });
                  return;
                }
                if (!selectedContact) return;
                toggleGlobalContactsInformation(
                  {
                    myProfile: {...globalContactsInformation.myProfile},
                    addedContacts: encriptMessage(
                      contactsPrivateKey,
                      publicKey,
                      JSON.stringify(
                        [
                          ...JSON.parse(
                            decryptMessage(
                              contactsPrivateKey,
                              publicKey,
                              globalContactsInformation.addedContacts,
                            ),
                          ),
                        ].map(savedContact => {
                          if (savedContact.uuid === selectedContact.uuid) {
                            return {
                              ...savedContact,
                              isFavorite: !savedContact.isFavorite,
                            };
                          } else return savedContact;
                        }),
                      ),
                    ),
                  },
                  true,
                );
              })();
            }}>
            <Icon
              width={25}
              height={25}
              name={'didPinContactStar'}
              color={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              offsetColor={
                selectedContact.isFavorite
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.primary
                  : backgroundColor
              }
            />
          </TouchableOpacity>
        )}
        {selectedContact && (
          <TouchableOpacity
            onPress={() => {
              if (!isConnectedToTheInternet) {
                navigate.navigate('ErrorScreen', {
                  errorMessage:
                    'Please reconnect to the internet to use this feature',
                });
                return;
              }
              if (!selectedContact) return;
              navigate.navigate('EditMyProfilePage', {
                pageType: 'addedContact',
                selectedAddedContact: selectedContact,
              });
            }}>
            <ThemeImage
              darkModeIcon={ICONS.settingsIcon}
              lightModeIcon={ICONS.settingsIcon}
              lightsOutIcon={ICONS.settingsWhite}
            />
          </TouchableOpacity>
        )}
      </View>
      {!selectedContact ? (
        <FullLoadingScreen
          text={'Unable to load contact'}
          textStyles={{testAlign: 'center'}}
        />
      ) : (
        <>
          <TouchableOpacity
            activeOpacity={
              !selectedContact?.isLNURL && selectedContact?.uniqueName ? 0.2 : 1
            }
            onPress={() => {
              if (selectedContact?.isLNURL || !selectedContact?.uniqueName)
                return;
              Share.share({
                title: 'Blitz Contact',
                message: `https://blitz-wallet.com/u/${selectedContact?.uniqueName}`,
              });
            }}
            style={{...CENTER}}>
            <View
              style={[
                styles.profileImage,
                {
                  backgroundColor: backgroundOffset,
                },
              ]}>
              <ContactProfileImage
                updated={imageData?.updated}
                uri={imageData?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
            {!selectedContact?.isLNURL && selectedContact?.uniqueName && (
              <View style={styles.selectFromPhotos}>
                <ThemeImage
                  styles={{width: 20, height: 20}}
                  darkModeIcon={ICONS.shareBlack}
                  lightModeIcon={ICONS.shareBlack}
                  lightsOutIcon={ICONS.shareBlack}
                />
              </View>
            )}
          </TouchableOpacity>
          <ThemeText
            styles={styles.profileName}
            content={selectedContact.name || selectedContact.uniqueName}
          />
          <View
            style={{
              ...styles.buttonGlobalContainer,
              marginBottom: selectedContact?.bio ? 10 : 0,
            }}>
            <CustomSendAndRequsetBTN
              btnType={'send'}
              btnFunction={() => {
                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'Please reconnect to the internet to use this feature',
                  });
                  return;
                }
                navigate.navigate('SendAndRequestPage', {
                  selectedContact: selectedContact,
                  paymentType: 'send',
                });
              }}
              arrowColor={
                theme
                  ? darkModeType
                    ? COLORS.lightsOutBackground
                    : COLORS.darkModeBackground
                  : COLORS.primary
              }
              containerBackgroundColor={COLORS.darkModeText}
              containerStyles={{marginRight: 30}}
            />

            <CustomSendAndRequsetBTN
              btnType={'receive'}
              activeOpacity={selectedContact.isLNURL ? 1 : undefined}
              btnFunction={() => {
                if (selectedContact.isLNURL) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'You can only request money from Blitz contacts, not LNURL addresses.',
                  });
                  return;
                }
                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'Please reconnect to the internet to use this feature',
                  });
                  return;
                }
                navigate.navigate('SendAndRequestPage', {
                  selectedContact: selectedContact,
                  paymentType: 'request',
                });
              }}
              arrowColor={
                theme
                  ? darkModeType
                    ? COLORS.lightsOutBackground
                    : COLORS.darkModeBackground
                  : COLORS.primary
              }
              containerBackgroundColor={COLORS.darkModeText}
              containerStyles={{opacity: selectedContact.isLNURL ? 0.5 : 1}}
            />
          </View>
          {selectedContact?.bio && (
            <View
              style={[
                styles.bioContainer,
                {marginTop: 10, backgroundColor: textInputBackground},
              ]}>
              <ScrollView
                contentContainerStyle={{
                  alignItems: selectedContact.bio ? null : 'center',
                  flexGrow: selectedContact.bio ? null : 1,
                }}
                showsVerticalScrollIndicator={false}>
                <ThemeText
                  styles={{...styles.bioText, color: textInputColor}}
                  content={selectedContact?.bio}
                />
              </ScrollView>
            </View>
          )}

          {contactTransactions.length != 0 ? (
            <View style={{flex: 1, alignItems: 'center'}}>
              <FlatList
                showsVerticalScrollIndicator={false}
                style={{
                  width: '100%',
                }}
                contentContainerStyle={{
                  paddingTop: selectedContact?.bio ? 10 : 20,
                  paddingBottom: bottomPadding,
                }}
                data={contactTransactions.slice(0, 50)}
                renderItem={({item, index}) => {
                  return (
                    <ContactsTransactionItem
                      key={index}
                      transaction={item}
                      id={index}
                      selectedContact={selectedContact}
                      myProfile={myProfile}
                      currentTime={currentTime}
                    />
                  );
                }}
              />
            </View>
          ) : (
            <View style={{flex: 1, alignItems: 'center', marginTop: 30}}>
              <ThemeText content={'No Transactions'} />
            </View>
          )}
        </>
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    // borderWidth: 5,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  profileName: {
    fontSize: SIZES.large,
    marginBottom: 20,
    ...CENTER,
  },
  buttonGlobalContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',

    marginBottom: 10,
  },

  bioContainer: {
    width: '90%',
    minHeight: 60,
    maxHeight: 80,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.darkModeText,

    ...CENTER,
  },
  bioText: {
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  selectFromPhotos: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 12.5,
    bottom: 12.5,
    zIndex: 2,
  },
});
