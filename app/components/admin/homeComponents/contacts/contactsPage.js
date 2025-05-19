import {useNavigation} from '@react-navigation/native';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../constants';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {encriptMessage} from '../../../../functions/messaging/encodingAndDecodingMessages';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import Icon from '../../../../functions/CustomElements/Icon';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {keyboardNavigate} from '../../../../functions/customNavigation';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import ContactProfileImage from './internalComponents/profileImage';
import {useImageCache} from '../../../../../context-store/imageCache';

export default function ContactsPage({navigation}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {cache} = useImageCache();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {decodedAddedContacts, globalContactsInformation, contactsMessags} =
    useGlobalContacts();
  const [inputText, setInputText] = useState('');
  const hideUnknownContacts = masterInfoObject.hideUnknownContacts;
  const tabsNavigate = navigation.navigate;
  const navigate = useNavigation();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const myProfile = globalContactsInformation.myProfile;
  const didEditProfile = globalContactsInformation.myProfile.didEditProfile;

  const handleBackPressFunction = useCallback(() => {
    tabsNavigate('Home');
  }, [tabsNavigate]);

  useHandleBackPressNew(handleBackPressFunction);

  console.log(
    decodedAddedContacts.filter(
      contact => !hideUnknownContacts || contact.isAdded,
    ).length !== 0 && myProfile.didEditProfile,
    'TESDFSD',
  );
  const pinnedContacts = useMemo(() => {
    return decodedAddedContacts
      .filter(contact => contact.isFavorite)
      .map((contact, id) => {
        return (
          <PinnedContactElement
            cache={cache}
            key={contact.uuid}
            contact={contact}
          />
        );
      });
  }, [decodedAddedContacts, contactsMessags]);

  const contactElements = useMemo(() => {
    return decodedAddedContacts
      .filter(contact => {
        return (
          (contact.name?.toLowerCase()?.startsWith(inputText.toLowerCase()) ||
            contact?.uniqueName
              ?.toLowerCase()
              ?.startsWith(inputText.toLowerCase())) &&
          !contact.isFavorite &&
          (!hideUnknownContacts || contact.isAdded)
        );
      })
      .sort((a, b) => {
        const earliset_A = contactsMessags[a.uuid]?.lastUpdated;
        const earliset_B = contactsMessags[b.uuid]?.lastUpdated;
        return (earliset_B || 0) - (earliset_A || 0);
      })
      .map((contact, id) => {
        return (
          <ContactElement cache={cache} key={contact.uuid} contact={contact} />
        );
      });
  }, [decodedAddedContacts, inputText, hideUnknownContacts, contactsMessags]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
      {myProfile.didEditProfile && (
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              keyboardNavigate(() => {
                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'Please connect to the internet to use this feature',
                  });
                  return;
                }
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'addContacts',
                  sliderHight: 0.4,
                });
              });
            }}>
            <Icon
              name={'addContactsIcon'}
              width={30}
              height={30}
              color={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              offsetColor={
                theme
                  ? darkModeType
                    ? COLORS.lightsOutBackground
                    : COLORS.darkModeBackground
                  : COLORS.lightModeBackground
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              crashlyticsLogReport(
                'Navigating to mycontacts profile page from contacts page',
              );
              keyboardNavigate(() => {
                navigate.navigate('MyContactProfilePage', {});
              });
            }}>
            <View
              style={{
                ...styles.profileImageContainer,
                backgroundColor: backgroundOffset,
              }}>
              <ContactProfileImage
                updated={cache[masterInfoObject?.uuid]?.updated}
                uri={cache[masterInfoObject?.uuid]?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
          </TouchableOpacity>
        </View>
      )}
      {decodedAddedContacts.filter(
        contact => !hideUnknownContacts || contact.isAdded,
      ).length !== 0 && myProfile.didEditProfile ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: pinnedContacts.length ? 0 : 10,
            paddingBottom: 10,
          }}
          style={{flex: 1, overflow: 'hidden'}}
          stickyHeaderIndices={[pinnedContacts.length ? 1 : 0]}>
          {pinnedContacts.length != 0 && (
            <View style={{height: 120}}>
              <ScrollView
                showsHorizontalScrollIndicator={false}
                horizontal
                contentContainerStyle={styles.pinnedContactsContainer}>
                {pinnedContacts}
              </ScrollView>
            </View>
          )}
          <CustomSearchInput
            placeholderText={'Search added contacts'}
            inputText={inputText}
            setInputText={setInputText}
            containerStyles={{width: '100%', backgroundColor}}
          />
          {contactElements}
        </ScrollView>
      ) : (
        <View style={styles.noContactsContainer}>
          <Icon
            width={250}
            height={200}
            color={theme ? COLORS.darkModeText : COLORS.primary}
            name={'qusetionContacts'}
          />
          <ThemeText
            styles={{...styles.noContactsText}}
            content={
              didEditProfile
                ? 'You have no contacts.'
                : 'Edit your profile to begin using contacts.'
            }
          />

          <CustomButton
            buttonStyles={{
              ...CENTER,
              width: 'auto',
            }}
            actionFunction={() => {
              if (!isConnectedToTheInternet) {
                navigate.navigate('ErrorScreen', {
                  errorMessage:
                    'Please connect to the internet to use this feature',
                });
                return;
              }
              if (didEditProfile) {
                //navigate to add contacts popup
                navigation.navigate('CustomHalfModal', {
                  wantedContent: 'addContacts',
                  sliderHight: 0.4,
                });
              } else {
                navigation.navigate('EditMyProfilePage', {
                  pageType: 'myProfile',
                  fromSettings: false,
                });
              }
            }}
            textContent={`${didEditProfile ? 'Add contact' : 'Edit profile'}`}
          />
        </View>
      )}
    </CustomKeyboardAvoidingView>
  );
}
function PinnedContactElement(props) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
    contactsMessags,
  } = useGlobalContacts();
  const {backgroundOffset} = GetThemeColors();
  const contact = props.contact;
  const navigate = useNavigation();
  const dimenions = useWindowDimensions();
  const hasUnlookedTransaction =
    contactsMessags[contact.uuid]?.messages.length &&
    contactsMessags[contact.uuid]?.messages.filter(
      savedMessage => !savedMessage.message.wasSeen,
    ).length > 0;
  return (
    <TouchableOpacity
      onLongPress={() => {
        if (!contact.isAdded) return;
        navigate.navigate('ContactsPageLongPressActions', {
          contact: contact,
        });
      }}
      key={contact.uuid}
      onPress={() =>
        navigateToExpandedContact(
          contact,
          decodedAddedContacts,
          globalContactsInformation,
          toggleGlobalContactsInformation,
          contactsPrivateKey,
          publicKey,
          navigate,
        )
      }>
      <View
        style={{
          ...styles.pinnedContact,
          width: (dimenions.width * 0.95) / 4.5,
          height: (dimenions.width * 0.95) / 4.5,
        }}>
        <View
          style={[
            styles.pinnedContactImageContainer,
            {
              backgroundColor: backgroundOffset,
              position: 'relative',
            },
          ]}>
          <ContactProfileImage
            updated={
              contact.isLNURL
                ? new Date().toISOString()
                : props.cache[contact.uuid]?.updated
            }
            uri={
              contact.isLNURL
                ? contact.profileImage
                : props.cache[contact.uuid]?.localUri
            }
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>

        <View
          style={{
            width: '100%',
            alignItems: 'center',
            flexDirection: 'row',
          }}>
          {hasUnlookedTransaction && (
            <View
              style={{
                ...styles.hasNotification,
                backgroundColor:
                  darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
                marginRight: 1,
              }}
            />
          )}
          <ThemeText
            CustomEllipsizeMode={'tail'}
            CustomNumberOfLines={1}
            styles={{textAlign: 'center', fontSize: SIZES.small, flex: 1}}
            content={
              !!contact.name.length
                ? contact.name.trim()
                : contact.uniqueName.trim()
            }
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
export function ContactElement(props) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
    contactsMessags,
  } = useGlobalContacts();

  const contact = props.contact;
  const navigate = useNavigation();
  const hasUnlookedTransaction =
    contactsMessags[contact.uuid]?.messages.length &&
    contactsMessags[contact.uuid]?.messages.filter(
      savedMessage => !savedMessage.message.wasSeen,
    ).length > 0;

  return (
    <TouchableOpacity
      onLongPress={() => {
        if (!contact.isAdded) return;
        if (!isConnectedToTheInternet) {
          navigate.navigate('ErrorScreen', {
            errorMessage:
              'Please reconnect to the internet to use this feature',
          });
          return;
        }

        navigate.navigate('ContactsPageLongPressActions', {
          contact: contact,
        });
      }}
      key={contact.uuid}
      onPress={() =>
        navigateToExpandedContact(
          contact,
          decodedAddedContacts,
          globalContactsInformation,
          toggleGlobalContactsInformation,
          contactsPrivateKey,
          publicKey,
          navigate,
        )
      }>
      <View style={{marginTop: 10}}>
        <View style={styles.contactRowContainer}>
          <View
            style={[
              styles.contactImageContainer,
              {
                backgroundColor: backgroundOffset,
                position: 'relative',
              },
            ]}>
            <ContactProfileImage
              updated={
                contact.isLNURL
                  ? new Date().toISOString()
                  : props.cache[contact.uuid]?.updated
              }
              uri={
                contact.isLNURL
                  ? contact.profileImage
                  : props.cache[contact.uuid]?.localUri
              }
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <View
            style={{
              flex: 1,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <ThemeText
                CustomEllipsizeMode={'tail'}
                CustomNumberOfLines={1}
                styles={{
                  flex: 1,
                  width: '100%',
                  marginRight: 5,
                }}
                content={
                  !!contact.name.length ? contact.name : contact.uniqueName
                }
              />
              {hasUnlookedTransaction && (
                <View
                  style={[
                    styles.hasNotification,
                    {
                      marginRight: 5,
                      backgroundColor:
                        darkModeType && theme
                          ? COLORS.darkModeText
                          : COLORS.primary,
                    },
                  ]}
                />
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <ThemeText
                  styles={{
                    fontSize: SIZES.small,
                    marginRight: 5,
                  }}
                  content={
                    !!contactsMessags[contact.uuid]?.messages?.length
                      ? createFormattedDate(
                          contactsMessags[contact.uuid].lastUpdated,
                        )
                      : ''
                  }
                />
                <ThemeImage
                  styles={{
                    width: 20,
                    height: 20,
                    transform: [{rotate: '180deg'}],
                  }}
                  darkModeIcon={ICONS.leftCheveronIcon}
                  lightModeIcon={ICONS.leftCheveronIcon}
                  lightsOutIcon={ICONS.left_cheveron_white}
                />
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <ThemeText
                CustomNumberOfLines={2}
                styles={{
                  fontSize: SIZES.small,
                }}
                content={
                  !!contactsMessags[contact.uuid]?.messages?.length
                    ? formatMessage(
                        contactsMessags[contact.uuid]?.messages[0],
                      ) || ' '
                    : ' '
                }
              />
              {!contact.isAdded && (
                <ThemeText
                  styles={{
                    fontSize: SIZES.small,
                    color:
                      darkModeType && theme
                        ? COLORS.darkModeText
                        : COLORS.primary,
                    marginLeft: 'auto',
                  }}
                  content={'Unknown sender'}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

async function navigateToExpandedContact(
  contact,
  decodedAddedContacts,
  globalContactsInformation,
  toggleGlobalContactsInformation,
  contactsPrivateKey,
  publicKey,
  navigate,
) {
  crashlyticsLogReport('Naivgating to exapanded contact from contacts page');
  if (!contact.isAdded) {
    let newAddedContacts = [...decodedAddedContacts];
    const indexOfContact = decodedAddedContacts.findIndex(
      obj => obj.uuid === contact.uuid,
    );

    let newContact = newAddedContacts[indexOfContact];

    newContact['isAdded'] = true;

    toggleGlobalContactsInformation(
      {
        myProfile: {...globalContactsInformation.myProfile},
        addedContacts: encriptMessage(
          contactsPrivateKey,
          publicKey,
          JSON.stringify(newAddedContacts),
        ),
      },
      true,
    );
  }

  navigate.navigate('ExpandedContactsPage', {
    uuid: contact.uuid,
  });
}

function createFormattedDate(time) {
  const date = new Date(time);

  // Get the current date
  const currentDate = new Date();

  // Calculate the difference in milliseconds between the current date and the timestamp
  const differenceMs = currentDate - date;

  // Convert milliseconds to days
  const differenceDays = differenceMs / (1000 * 60 * 60 * 24);

  // Define an array of day names
  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  // Format the time if it's more than one day old
  let formattedTime;

  if (differenceDays < 1) {
    // Extract hours, minutes, and AM/PM from the date
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert hours from 24-hour to 12-hour format
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;

    // Add leading zero to minutes if necessary
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    // Create the formatted time string
    formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;
  } else if (differenceDays < 2) {
    formattedTime = 'Yesterday';
  } else {
    if (differenceDays <= 7) {
      formattedTime = daysOfWeek[date.getDay()];
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear() % 100;
      formattedTime = `${month}/${day}/${year}`;
    }
  }

  return formattedTime;
}

function formatMessage(message) {
  let formattedMessage = ' ';
  const savedMessageDescription = message.message.description;
  const messageData = message.message;

  if (savedMessageDescription) {
    formattedMessage = savedMessageDescription;
  }
  return String(formattedMessage);
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  profileImageContainer: {
    position: 'relative',
    width: 35,
    height: 35,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    overflow: 'hidden',
  },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
    ...CENTER,
  },

  hasNotification: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },

  noContactsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noContactsText: {
    textAlign: 'center',
    width: 250,
    marginTop: 10,
    marginBottom: 20,
  },

  pinnedContact: {
    // height: 'auto',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  pinnedContactsContainer: {
    flexDirection: 'row',
  },
  pinnedContactImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    overflow: 'hidden',
  },

  contactRowContainer: {
    width: '100%',

    // overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
    // marginVertical: 5,
  },

  contactImageContainer: {
    width: 45,
    height: 45,
    backgroundColor: COLORS.opaicityGray,
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 30,
    marginRight: 10,
    overflow: 'hidden',
  },
});
