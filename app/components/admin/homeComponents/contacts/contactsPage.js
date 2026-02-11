import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
} from '../../../../constants';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
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
import { formatDisplayName } from './utils/formatListDisplayName';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import ProfileImageSettingsNavigator from '../../../../functions/CustomElements/profileSettingsNavigator';

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
    giftCardsList,
  } = useGlobalContacts();
  const scrollViewRef = useRef(null);
  const { serverTimeOffset } = useServerTime();
  const getServerTime = useServerTimeOnly();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const hideUnknownContacts = masterInfoObject.hideUnknownContacts;
  const tabsNavigate = navigation.navigate;
  const navigate = useNavigation();
  const myProfile = globalContactsInformation.myProfile;
  const didEditProfile = myProfile?.didEditProfile;

  useFocusEffect(
    useCallback(() => {
      if (!navigation) return;
      const listenerID = navigation?.addListener('tabPress', () => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
      });

      return navigation?.removeListener?.('click', listenerID);
    }, [navigation]),
  );

  // Use custom hooks for processed data
  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );
  const filteredContacts =
    useFilteredContacts(
      contactInfoList,
      inputText.trim(),
      hideUnknownContacts,
    ) ?? [];

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

  const showAddContactRowItem =
    !contactInfoList?.length ||
    filteredContacts?.length ||
    (contactInfoList?.length &&
      !filteredContacts?.length &&
      !inputText?.trim()?.length);

  const showHighlightedGifts = useMemo(() => {
    return giftCardsList && !!giftCardsList?.length;
  }, [giftCardsList]);

  const navigateToExpandedContact = useCallback(
    async contact => {
      try {
        crashlyticsLogReport(
          'Navigating to expanded contact from contacts page',
        );
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
      } catch (err) {
        console.log('error navigating to expanded contact', err);
        requestAnimationFrame(() => {
          navigate.navigate('ExpandedContactsPage', {
            uuid: contact.uuid,
          });
        });
      }
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
    console.log('RERENDERING CONTACTS ELEMENTS');
    console.log('_------------------------------');
    const currentTime = getServerTime();
    let contacts = filteredContacts.map((item, index) => (
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
        isLastElement={index === filteredContacts.length - 1}
      />
    ));
    if (showAddContactRowItem) {
      contacts.unshift(
        <AddContactRowItem
          key={'add-cotnacts-row-item'}
          theme={theme}
          darkModeType={darkModeType}
          backgroundOffset={backgroundOffset}
          isConnectedToTheInternet={isConnectedToTheInternet}
          navigate={navigate}
          numberOfContacts={filteredContacts?.length}
          t={t}
        />,
      );
    }
    return contacts;
  }, [
    filteredContacts,
    cache,
    darkModeType,
    theme,
    backgroundOffset,
    navigateToExpandedContact,
    isConnectedToTheInternet,
    navigate,
    getServerTime,
    serverTimeOffset,
    showAddContactRowItem,
    t,
  ]);

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
      {(didEditProfile || hasContacts) && (
        <View style={memoizedStyles.topBar}>
          <TouchableOpacity
            onPress={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'ViewAllGiftCards',
              })
            }
            style={[
              memoizedStyles.giftContainer,
              {
                backgroundColor: !showHighlightedGifts
                  ? backgroundOffset
                  : theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary,
                zIndex: 99,
              },
            ]}
          >
            <ThemeImage
              styles={{
                width: 18,
                height: 18,
                tintColor: !showHighlightedGifts
                  ? textColor
                  : theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText,
              }}
              lightModeIcon={ICONS.giftCardIcon}
              darkModeIcon={ICONS.giftCardIcon}
              lightsOutIcon={ICONS.giftCardIcon}
            />
          </TouchableOpacity>
          <ThemeText
            CustomNumberOfLines={1}
            content={t('contacts.contactsPage.contactsHeader')}
            styles={memoizedStyles.headerText}
          />
          <ProfileImageSettingsNavigator />
        </View>
      )}
      {hasContacts && didEditProfile ? (
        <ScrollView
          ref={scrollViewRef}
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
                textContent={t('constants.search')}
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
      () => (screenDimensions.width * 0.95) / 4 - 15,
      [screenDimensions.width],
    );

    const blockItemView = useMemo(
      () => ({
        ...memoizedStyles.pinnedContact,
        width: containerSize,
      }),
      [containerSize],
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
        width: '100%',
        marginBottom: 5,
        height: containerSize,
      }),
      [containerSize],
    );

    const pinnedContactTextContinaer = useMemo(() => {
      return {
        maxWidth: containerSize - (hasUnlookedTransaction ? 25 : 0),
      };
    }, [containerSize, hasUnlookedTransaction]);

    const notificationStyle = useMemo(
      () => ({
        ...memoizedStyles.hasNotification,
        backgroundColor:
          darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        position: 'absolute',
        transform: [{ translateX: -(textWidth / 2 + 5 + 2) }],
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
        onLongPress={handleLongPress}
        onPress={handlePress}
        style={blockItemView}
      >
        <View style={pinnedContactStyle}>
          <View style={imageContainerStyle}>
            <ContactProfileImage
              updated={cache[contact.uuid]?.updated}
              uri={cache[contact.uuid]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
        </View>
        <View style={memoizedStyles.pinnedContactNotificationContainer}>
          {hasUnlookedTransaction && <View style={notificationStyle} />}
          <View style={pinnedContactTextContinaer} onLayout={handleTextLayout}>
            <ThemeText
              CustomEllipsizeMode="tail"
              CustomNumberOfLines={1}
              styles={memoizedStyles.pinnedContactName}
              content={formatDisplayName(contact)}
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
    isLastElement,
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

    const formattedDate = lastUpdated
      ? createFormattedDate(
          lastUpdated - serverTimeOffset,
          currentTime - serverTimeOffset,
          t,
        )
      : '';

    return (
      <TouchableOpacity
        style={[
          memoizedStyles.contactRowContainer,
          // !isLastElement && {
          //   borderBottomWidth: 1,
          //   borderBottomColor: backgroundOffset,
          // },
        ]}
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
            <View style={memoizedStyles.rowNameAndUnkonwnContainer}>
              <ThemeText
                CustomEllipsizeMode="tail"
                CustomNumberOfLines={1}
                styles={{
                  includeFontPadding: false,
                  flexShrink: 1,
                }}
                content={formatDisplayName(contact)}
              />
              {!contact.isAdded && (
                <ThemeText
                  CustomEllipsizeMode="tail"
                  CustomNumberOfLines={1}
                  styles={{
                    flexShrink: 1,
                    fontSize: SIZES.small,
                    color:
                      darkModeType && theme
                        ? COLORS.darkModeText
                        : COLORS.primary,
                    includeFontPadding: false,
                  }}
                  content={t('contacts.contactsPage.unknownSender')}
                />
              )}
            </View>

            {hasUnlookedTransaction && <View style={notificationStyle} />}
            <ThemeText
              styles={memoizedStyles.contactDateText}
              content={formattedDate}
            />
            <ThemeIcon size={20} iconName={'ChevronRight'} />
          </View>

          {!!formatMessage(firstMessage) && contact.isAdded && (
            <View style={memoizedStyles.contactsRowInlineStyle}>
              <ThemeText
                CustomNumberOfLines={2}
                styles={{ fontSize: SIZES.small, flexShrink: 1 }}
                content={formatMessage(firstMessage)}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  },
);

const AddContactRowItem = memo(
  ({
    darkModeType,
    theme,
    backgroundOffset,
    t,
    isConnectedToTheInternet,
    navigate,
    numberOfContacts,
  }) => {
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

    const imageContainerStyle = useMemo(
      () => ({
        ...memoizedStyles.contactImageContainer,
        backgroundColor:
          theme && darkModeType ? backgroundOffset : COLORS.primary,
      }),
      [backgroundOffset, theme, darkModeType],
    );

    return (
      <TouchableOpacity
        style={[
          memoizedStyles.contactRowContainer,
          numberOfContacts && {
            borderBottomWidth: 1,
            borderBottomColor: backgroundOffset,
          },
        ]}
        onPress={goToAddContact}
        key={'Add-contacts-row-item'}
      >
        <View style={imageContainerStyle}>
          <ThemeIcon
            colorOverride={COLORS.darkModeText}
            size={25}
            iconName={'Plus'}
          />
        </View>
        <View style={memoizedStyles.globalContainer}>
          <ThemeText
            CustomEllipsizeMode="tail"
            CustomNumberOfLines={1}
            styles={{
              color: theme ? COLORS.darkModeText : COLORS.primary,
              includeFontPadding: false,
            }}
            content={t('contacts.contactsPage.addContactsText')}
          />
        </View>
      </TouchableOpacity>
    );
  },
);

const memoizedStyles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  headerText: {
    flexShrink: 1,
    width: '100%',
    textAlign: 'center',
    fontSize: SIZES.large,
    paddingHorizontal: 90,
    position: 'absolute',
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
    // minHeight: 40,
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
  pinnedContactsScrollviewContainer: {
    marginBottom: 10,
  },
  pinnedContact: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  pinnedContactsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  pinnedContactNotificationContainer: {
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  pinnedContactName: {
    fontSize: SIZES.small,
    flexShrink: 1,
    includeFontPadding: false,
  },
  pinnedContactImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  contactRowContainer: {
    width: '95%',
    flexDirection: 'row',
    alignItems: 'center',

    ...CENTER,
    paddingVertical: 10,
  },
  rowNameAndUnkonwnContainer: {
    flexDirection: 'column',
    flexGrow: 1,
    marginRight: 5,
  },
  contactDateText: {
    fontSize: SIZES.small,
    marginRight: 5,
    includeFontPadding: false,
  },
  contactArrowIcon: {
    width: 20,
    height: 20,
    transform: [{ rotate: '180deg' }],
  },
  contactsRowInlineStyle: {
    width: '100%',
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
    flexShrink: 1,
    height: 35,
    width: 35,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftText: {
    flexShrink: 1,
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
  },
  addContactIcon: { transform: [{ rotate: '45deg' }], width: 25, height: 25 },
});
