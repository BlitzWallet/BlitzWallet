import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
} from '../../../../constants';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { encriptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import Icon from '../../../../functions/CustomElements/Icon';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useKeysContext } from '../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import ContactProfileImage from './internalComponents/profileImage';
import { useImageCache } from '../../../../../context-store/imageCache';
import {
  createFormattedDate,
  formatMessage,
} from './contactsPageComponents/utilityFunctions';
import {
  useFilteredContacts,
  useProcessedContacts,
} from './contactsPageComponents/hooks';
import {
  useServerTime,
  useServerTimeOnly,
} from '../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { TAB_ITEM_HEIGHT } from '../../../../../navigation/tabs';

export default function ContactsPage({ navigation }) {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { cache } = useImageCache();
  const { isConnectedToTheInternet, screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    contactsMessags,
    toggleGlobalContactsInformation,
  } = useGlobalContacts();
  const { serverTimeOffset } = useServerTime();
  const getServerTime = useServerTimeOnly();
  const currentTime = getServerTime();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
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
    cache,
  );
  const filteredContacts = useFilteredContacts(
    contactInfoList,
    inputText.trim(),
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
      paddingBottom: CONTENT_KEYBOARD_OFFSET,
      backgroundColor,
    }),
    [backgroundColor],
  );

  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: contactInfoList.some(c => c.contact.isFavorite) ? 0 : 10,
      paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 10,
    }),
    [contactInfoList, bottomPadding],
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
            myProfile: { ...globalContactsInformation.myProfile },
            addedContacts: encriptMessage(
              contactsPrivateKey,
              publicKey,
              JSON.stringify(newAddedContacts),
            ),
          },
          true,
        );
      }
      requestAnimationFrame(() => {
        navigate.navigate('ExpandedContactsPage', {
          uuid: contact.uuid,
        });
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
          // dimensions={dimensions}
          navigate={navigate}
          screenDimensions={screenDimensions}
        />
      ));
  }, [
    contactInfoList,
    cache,
    darkModeType,
    theme,
    backgroundOffset,
    navigateToExpandedContact,
    // dimensions,
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
        currentTime={currentTime}
        serverTimeOffset={serverTimeOffset}
        t={t}
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
    currentTime,
    serverTimeOffset,
    t,
  ]);

  const goToAddContact = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
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
        errorMessage: t('errormessages.nointernet'),
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

  useFocusEffect(
    useCallback(() => {
      return () => {
        //clears text input when user leavs page
        setInputText('');
      };
    }, []),
  );

  useHandleBackPressNew(handleBackPressFunction);

  const hasContacts =
    decodedAddedContacts.filter(
      contact => !hideUnknownContacts || contact.isAdded,
    ).length !== 0;

  const stickyHeaderIndicesValue = useMemo(() => {
    return [pinnedContacts.length ? 1 : 0];
  }, [pinnedContacts]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      {didEditProfile && (
        <View style={memoizedStyles.topBar}>
          <TouchableOpacity
            onPress={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'ViewAllGiftCards',
              })
            }
            style={[
              memoizedStyles.giftContainer,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <ThemeText
              styles={memoizedStyles.giftText}
              content={t('wallet.contactsPage.giftsText')}
            />
            <Icon
              color={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              name={'giftIcon'}
            />
          </TouchableOpacity>
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
              ]}
            >
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
          style={memoizedStyles.contactsPageWithContactsScrollview}
          stickyHeaderIndices={stickyHeaderIndicesValue}
          keyboardShouldPersistTaps={
            contactElements.length ? 'never' : 'always'
          }
        >
          {pinnedContacts.length !== 0 && (
            <View style={memoizedStyles.pinnedContactsScrollviewContainer}>
              <ScrollView
                showsHorizontalScrollIndicator={false}
                horizontal
                contentContainerStyle={memoizedStyles.pinnedContactsContainer}
              >
                {pinnedContacts}
              </ScrollView>
            </View>
          )}
          <CustomSearchInput
            placeholderText={t(
              'contacts.contactsPage.searchContactsPlaceholder',
            )}
            inputText={inputText}
            setInputText={setInputText}
            containerStyles={searchInputStyle}
          />
          {contactElements.length ? (
            contactElements
          ) : inputText.trim() ? (
            <View style={memoizedStyles.noResultsContainer}>
              <ThemeText
                content={
                  `"${inputText}" ` + t('contacts.contactsPage.notFound')
                }
                styles={memoizedStyles.noResultsTitle}
              />
              <ThemeText
                content={t('contacts.contactsPage.noContactSearch')}
                styles={memoizedStyles.noResultsSubtitle}
              />
              <CustomButton
                actionFunction={() =>
                  keyboardNavigate(() =>
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'addContacts',
                      sliderHight: 0.4,
                      startingSearchValue: inputText.trim(),
                    }),
                  )
                }
                textContent={t('contacts.contactsPage.addContactButton')}
              />
            </View>
          ) : null}
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
                ? t('contacts.contactsPage.noContactsMessage')
                : t('contacts.contactsPage.editContactProfileMessage')
            }
          />
          <CustomButton
            buttonStyles={CENTER}
            actionFunction={handleButtonPress}
            textContent={
              didEditProfile
                ? t('contacts.contactsPage.addContactButton')
                : t('contacts.contactsPage.editContactButton')
            }
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
    // dimensions,
    navigate,
    screenDimensions,
  }) => {
    const [textWidth, setTextWidth] = useState(0);

    // Memoize calculated dimensions
    const containerSize = useMemo(
      () => (screenDimensions.width * 0.95) / 4.5,
      [screenDimensions.width],
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

    const pinnedContactTextContinaer = useMemo(() => {
      return {
        maxWidth: containerSize - (hasUnlookedTransaction ? 25 : 0),
      };
    }, [containerSize]);

    const notificationStyle = useMemo(
      () => ({
        ...memoizedStyles.hasNotification,
        backgroundColor:
          darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        position: 'absolute',
        left: '50%',
        transform: [{ translateX: -(textWidth / 2 + 5 + 10) }],
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
      <TouchableOpacity
        style={pinnedContactStyle}
        onLongPress={handleLongPress}
        onPress={handlePress}
      >
        <View style={imageContainerStyle}>
          <ContactProfileImage
            updated={cache[contact.uuid]?.updated}
            uri={cache[contact.uuid]?.localUri}
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>

        <View style={memoizedStyles.pinnedContactNotificationContainer}>
          {hasUnlookedTransaction && <View style={notificationStyle} />}
          <View style={pinnedContactTextContinaer} onLayout={handleTextLayout}>
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
    currentTime,
    serverTimeOffset,
    t,
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
          errorMessage: t('errormessages.nointernet'),
        });
        return;
      }
      navigate.navigate('ContactsPageLongPressActions', { contact });
    }, [contact, isConnectedToTheInternet, navigate]);

    const handlePress = useCallback(() => {
      navigateToExpandedContact(contact);
    }, [contact, navigateToExpandedContact]);

    const displayName = contact.name?.length
      ? contact.name
      : contact.uniqueName;
    const formattedDate = lastUpdated
      ? createFormattedDate(
          lastUpdated - serverTimeOffset,
          currentTime - serverTimeOffset,
          t,
        )
      : '';

    return (
      <TouchableOpacity
        style={memoizedStyles.contactRowContainer}
        onLongPress={handleLongPress}
        onPress={handlePress}
      >
        <View style={imageContainerStyle}>
          <ContactProfileImage
            updated={cache[contact.uuid]?.updated}
            uri={cache[contact.uuid]?.localUri}
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>
        <View style={memoizedStyles.globalContainer}>
          <View style={memoizedStyles.contactsRowInlineStyle}>
            <ThemeText
              CustomEllipsizeMode="tail"
              CustomNumberOfLines={1}
              styles={{ flex: 1, marginRight: 5 }}
              content={displayName}
            />
            {hasUnlookedTransaction && <View style={notificationStyle} />}
            <ThemeText
              styles={{ fontSize: SIZES.small, marginRight: 5 }}
              content={formattedDate}
            />
            <ThemeImage
              styles={{
                width: 20,
                height: 20,
                transform: [{ rotate: '180deg' }],
              }}
              darkModeIcon={ICONS.leftCheveronIcon}
              lightModeIcon={ICONS.leftCheveronIcon}
              lightsOutIcon={ICONS.left_cheveron_white}
            />
          </View>

          <View style={memoizedStyles.contactsRowInlineStyle}>
            <ThemeText
              CustomNumberOfLines={2}
              styles={{ fontSize: SIZES.small }}
              content={lastUpdated ? formatMessage(firstMessage) || ' ' : ' '}
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
                content={t('contacts.contactsPage.unknownSender')}
              />
            )}
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
  contactsPageWithContactsScrollview: {
    flex: 1,
    overflow: 'hidden',
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
  pinnedContactsScrollviewContainer: { height: 120 },
  pinnedContact: {
    marginHorizontal: 5,
    alignItems: 'center',
  },
  pinnedContactsContainer: {
    flexDirection: 'row',
  },
  pinnedContactNotificationContainer: {
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
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
    marginTop: 10,
  },
  contactsRowInlineStyle: {
    flexDirection: 'row',
    alignItems: 'center',
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

  giftContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 'auto',
  },
  giftText: {
    marginRight: 5,
    includeFontPadding: false,
  },
  noResultsContainer: {
    // flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  noResultsTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
  },
  noResultsSubtitle: {
    fontSize: SIZES.small,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 24,
    // Add your theme color
  },
});
