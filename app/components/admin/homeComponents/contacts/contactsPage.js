import {useNavigation} from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../constants';
import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {encriptMessage} from '../../../../functions/messaging/encodingAndDecodingMessages';
import {
  CustomKeyboardAvoidingView,
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
import {
  createFormattedDate,
  formatMessage,
} from './contactsPageComponents/utilityFunctions';
import {
  useFilteredContacts,
  useProcessedContacts,
} from './contactsPageComponents/hooks';

export default function ContactsPage({navigation}) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {cache} = useImageCache();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    contactsMessags,
    toggleGlobalContactsInformation,
  } = useGlobalContacts();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const dimensions = useWindowDimensions();
  const [inputText, setInputText] = useState('');
  const hideUnknownContacts = masterInfoObject.hideUnknownContacts;
  const tabsNavigate = navigation.navigate;
  const navigate = useNavigation();
  const myProfile = globalContactsInformation.myProfile;
  const didEditProfile = myProfile.didEditProfile;

  // Use custom hooks for processed data
  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );
  const filteredContacts = useFilteredContacts(
    contactInfoList,
    inputText,
    hideUnknownContacts,
  );

  const profileContainerStyle = useMemo(
    () => ({
      backgroundColor: backgroundOffset,
    }),
    [backgroundOffset],
  );

  const searchInputStyle = useMemo(
    () => ({
      width: '100%',
      backgroundColor,
    }),
    [backgroundColor],
  );

  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: contactInfoList.some(c => c.contact.isFavorite) ? 0 : 10,
      paddingBottom: 10,
    }),
    [contactInfoList],
  );

  const navigateToExpandedContact = useCallback(
    async contact => {
      crashlyticsLogReport('Navigating to expanded contact from contacts page');
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
    },
    [
      decodedAddedContacts,
      globalContactsInformation,
      toggleGlobalContactsInformation,
      contactsPrivateKey,
      publicKey,
      navigate,
    ],
  );

  const pinnedContacts = useMemo(() => {
    return contactInfoList
      .filter(contact => contact.contact.isFavorite)
      .map(contact => (
        <PinnedContactElement
          key={contact.contact.uuid}
          contact={contact.contact}
          hasUnlookedTransaction={contact.hasUnlookedTransaction}
          cache={cache}
          darkModeType={darkModeType}
          theme={theme}
          backgroundOffset={backgroundOffset}
          navigateToExpandedContact={navigateToExpandedContact}
          dimensions={dimensions}
          navigate={navigate}
        />
      ));
  }, [
    contactInfoList,
    cache,
    darkModeType,
    theme,
    backgroundOffset,
    navigateToExpandedContact,
    dimensions,
    navigate,
  ]);

  const contactElements = useMemo(() => {
    return filteredContacts.map(item => (
      <ContactElement
        key={item.contact.uuid}
        contact={item.contact}
        hasUnlookedTransaction={item.hasUnlookedTransaction}
        lastUpdated={item.lastUpdated}
        firstMessage={item.firstMessage}
        cache={cache}
        darkModeType={darkModeType}
        theme={theme}
        backgroundOffset={backgroundOffset}
        navigateToExpandedContact={navigateToExpandedContact}
        isConnectedToTheInternet={isConnectedToTheInternet}
        navigate={navigate}
      />
    ));
  }, [
    filteredContacts,
    cache,
    darkModeType,
    theme,
    backgroundOffset,
    navigateToExpandedContact,
    isConnectedToTheInternet,
    navigate,
  ]);

  const goToAddContact = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Please connect to the internet to use this feature',
      });
    } else {
      keyboardNavigate(() =>
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'addContacts',
          sliderHight: 0.4,
        }),
      );
    }
  }, [isConnectedToTheInternet, navigate]);

  const goToMyProfile = useCallback(() => {
    keyboardNavigate(() => navigate.navigate('MyContactProfilePage', {}));
  }, [navigate]);

  const handleBackPressFunction = useCallback(() => {
    tabsNavigate('Home');
  }, [tabsNavigate]);

  const handleButtonPress = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Please connect to the internet to use this feature',
      });
      return;
    }
    if (didEditProfile) {
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
  }, [isConnectedToTheInternet, didEditProfile, navigate, navigation]);

  useHandleBackPressNew(handleBackPressFunction);

  const hasContacts =
    decodedAddedContacts.filter(
      contact => !hideUnknownContacts || contact.isAdded,
    ).length !== 0;

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
      {didEditProfile && (
        <View style={memoizedStyles.topBar}>
          <TouchableOpacity onPress={goToAddContact}>
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
          <TouchableOpacity onPress={goToMyProfile}>
            <View
              style={[
                memoizedStyles.profileImageContainer,
                profileContainerStyle,
              ]}>
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
      {hasContacts && myProfile.didEditProfile ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollContentStyle}
          style={{flex: 1, overflow: 'hidden'}}
          stickyHeaderIndices={[pinnedContacts.length ? 1 : 0]}>
          {pinnedContacts.length !== 0 && (
            <View style={{height: 120}}>
              <ScrollView
                showsHorizontalScrollIndicator={false}
                horizontal
                contentContainerStyle={memoizedStyles.pinnedContactsContainer}>
                {pinnedContacts}
              </ScrollView>
            </View>
          )}
          <CustomSearchInput
            placeholderText={'Search added contacts'}
            inputText={inputText}
            setInputText={setInputText}
            containerStyles={searchInputStyle}
          />
          {contactElements}
        </ScrollView>
      ) : (
        <View style={memoizedStyles.noContactsContainer}>
          <Icon
            width={250}
            height={200}
            color={theme ? COLORS.darkModeText : COLORS.primary}
            name={'qusetionContacts'}
          />
          <ThemeText
            styles={memoizedStyles.noContactsText}
            content={
              didEditProfile
                ? 'You have no contacts.'
                : 'Edit your profile to begin using contacts.'
            }
          />
          <CustomButton
            buttonStyles={CENTER}
            actionFunction={handleButtonPress}
            textContent={didEditProfile ? 'Add contact' : 'Edit profile'}
          />
        </View>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const PinnedContactElement = memo(
  ({
    contact,
    hasUnlookedTransaction,
    cache,
    darkModeType,
    theme,
    backgroundOffset,
    navigateToExpandedContact,
    dimensions,
    navigate,
  }) => {
    const [textWidth, setTextWidth] = useState(0);

    // Memoize calculated dimensions
    const containerSize = useMemo(
      () => (dimensions.width * 0.95) / 4.5,
      [dimensions.width],
    );

    const imageContainerStyle = useMemo(
      () => ({
        ...memoizedStyles.pinnedContactImageContainer,
        backgroundColor: backgroundOffset,
      }),
      [backgroundOffset],
    );

    const pinnedContactStyle = useMemo(
      () => ({
        ...memoizedStyles.pinnedContact,
        width: containerSize,
        height: containerSize,
      }),
      [containerSize],
    );

    const notificationStyle = useMemo(
      () => ({
        ...memoizedStyles.hasNotification,
        backgroundColor:
          darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        position: 'absolute',
        left: '50%',
        transform: [{translateX: -(textWidth / 2 + 5 + 10)}],
      }),
      [darkModeType, theme, textWidth],
    );

    const handleLongPress = useCallback(() => {
      if (!contact.isAdded) return;
      navigate.navigate('ContactsPageLongPressActions', {
        contact: contact,
      });
    }, [contact, navigate]);

    const handlePress = useCallback(() => {
      navigateToExpandedContact(contact);
    }, [contact, navigateToExpandedContact]);

    const handleTextLayout = useCallback(event => {
      setTextWidth(event.nativeEvent.layout.width);
    }, []);

    return (
      <TouchableOpacity onLongPress={handleLongPress} onPress={handlePress}>
        <View style={pinnedContactStyle}>
          <View style={imageContainerStyle}>
            <ContactProfileImage
              updated={cache[contact.uuid]?.updated}
              uri={cache[contact.uuid]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>

          <View
            style={{
              width: '100%',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}>
            {hasUnlookedTransaction && <View style={notificationStyle} />}
            <View
              style={{
                maxWidth: containerSize - (hasUnlookedTransaction ? 25 : 0),
              }}
              onLayout={handleTextLayout}>
              <ThemeText
                CustomEllipsizeMode="tail"
                CustomNumberOfLines={1}
                styles={{
                  fontSize: SIZES.small,
                  textAlign: 'center',
                }}
                content={
                  contact.name?.length
                    ? contact.name.trim()
                    : contact.uniqueName.trim()
                }
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

const ContactElement = memo(
  ({
    contact,
    hasUnlookedTransaction,
    lastUpdated,
    firstMessage,
    cache,
    darkModeType,
    theme,
    backgroundOffset,
    navigateToExpandedContact,
    isConnectedToTheInternet,
    navigate,
  }) => {
    const imageContainerStyle = useMemo(
      () => ({
        ...memoizedStyles.contactImageContainer,
        backgroundColor: backgroundOffset,
      }),
      [backgroundOffset],
    );

    const notificationStyle = useMemo(
      () => ({
        ...memoizedStyles.hasNotification,
        marginRight: 5,
        backgroundColor:
          darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
      }),
      [darkModeType, theme],
    );

    const handleLongPress = useCallback(() => {
      if (!contact.isAdded) return;
      if (!isConnectedToTheInternet) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Please reconnect to the internet to use this feature',
        });
        return;
      }
      navigate.navigate('ContactsPageLongPressActions', {
        contact: contact,
      });
    }, [contact, isConnectedToTheInternet, navigate]);

    const handlePress = useCallback(() => {
      navigateToExpandedContact(contact);
    }, [contact, navigateToExpandedContact]);

    return (
      <TouchableOpacity onLongPress={handleLongPress} onPress={handlePress}>
        <View style={{marginTop: 10}}>
          <View style={memoizedStyles.contactRowContainer}>
            <View style={imageContainerStyle}>
              <ContactProfileImage
                updated={cache[contact.uuid]?.updated}
                uri={cache[contact.uuid]?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
            <View style={{flex: 1}}>
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
                    contact.name?.length ? contact.name : contact.uniqueName
                  }
                />
                {hasUnlookedTransaction && <View style={notificationStyle} />}
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
                      lastUpdated ? createFormattedDate(lastUpdated) : ''
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
                    lastUpdated ? formatMessage(firstMessage) || ' ' : ' '
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
  },
);

const memoizedStyles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
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
