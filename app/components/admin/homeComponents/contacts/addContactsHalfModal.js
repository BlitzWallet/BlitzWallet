import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER } from '../../../../constants/styles';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  EMAIL_REGEX,
  SIZES,
  VALID_URL_REGEX,
  VALID_USERNAME_REGEX,
} from '../../../../constants';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import useDebounce from '../../../../hooks/useDebounce';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { searchUsers } from '../../../../../db';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import { useKeysContext } from '../../../../../context-store/keys';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ContactProfileImage from './internalComponents/profileImage';
import { getCachedProfileImage } from '../../../../functions/cachedImage';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useTranslation } from 'react-i18next';
import getDeepLinkUser from './internalComponents/getDeepLinkUser';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function AddContactsHalfModal({
  slideHeight,
  setIsKeyboardActive,
  startingSearchValue,
  handleBackPressFunction,
}) {
  const { contactsPrivateKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { globalContactsInformation } = useGlobalContacts();
  const [searchInput, setSearchInput] = useState(startingSearchValue || '');
  const [users, setUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const sliderHight = slideHeight;
  const navigate = useNavigation();
  const keyboardRef = useRef(null);
  const { refreshCacheObject } = useImageCache();
  const searchTrackerRef = useRef(null);
  const didClickCamera = useRef(null);
  const { t } = useTranslation();

  const isUsingLNURL =
    searchInput?.includes('@') && searchInput?.indexOf('@') !== 0;

  useEffect(() => {
    if (startingSearchValue) {
      handleSearch(startingSearchValue);
    }
  }, []);

  const handleSearchTrackerRef = () => {
    const requestUUID = customUUID();
    searchTrackerRef.current = requestUUID; // Simply store the latest UUID
    return requestUUID;
  };

  useFocusEffect(
    useCallback(() => {
      if (!keyboardRef.current.isFocused()) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            keyboardRef.current.focus();
          });
        });
      }
    }, []),
  );

  const handleTextInputBlur = () => {
    setIsKeyboardActive(false);
    if (!searchInput && !didClickCamera.current) {
      handleBackPressFunction?.();
    }
    didClickCamera.current = false;
  };

  const debouncedSearch = useDebounce(async (term, requestUUID) => {
    // Block request if user has moved on
    if (searchTrackerRef.current !== requestUUID) {
      return;
    }

    const searchTerm = term.replace(/@/g, '');
    if (searchTerm && VALID_USERNAME_REGEX.test(searchTerm)) {
      const results = await searchUsers(searchTerm);
      const newUsers = (
        await Promise.all(
          results.map(async savedContact => {
            if (!savedContact) return false;
            if (
              savedContact.uniqueName ===
              globalContactsInformation.myProfile.uniqueName
            )
              return false;
            if (!savedContact?.uuid) return false;

            let responseData;

            if (
              savedContact.hasProfileImage ||
              typeof savedContact.hasProfileImage === 'boolean'
            ) {
              responseData = await getCachedProfileImage(savedContact.uuid);
              console.log(responseData, 'response');
            }

            if (!responseData) return savedContact;
            else
              return {
                ...savedContact,
                ...responseData,
              };
          }),
        )
      ).filter(Boolean);

      refreshCacheObject();
      setIsSearching(false);
      setUsers(newUsers);
    } else {
      setIsSearching(false);
    }
  }, 650);

  const handleSearch = term => {
    setSearchInput(term);
    handleSearchTrackerRef();
    if (isUsingLNURL) {
      searchTrackerRef.current = null;
      setIsSearching(false);
      return;
    }

    if (term.length === 0 || term === '@') {
      searchTrackerRef.current = null;
      setUsers([]);
      setIsSearching(false);
      return;
    }

    if (term.length > 0) {
      const requestUUID = handleSearchTrackerRef();
      setIsSearching(true);
      debouncedSearch(term, requestUUID);
    }
  };

  const parseContact = async data => {
    try {
      setIsSearching(true);
      let newContact;
      if (VALID_URL_REGEX.test(data)) {
        const {
          didWork,
          reason,
          data: userProfile,
        } = await getDeepLinkUser({
          deepLinkContent: data,
          userProfile: globalContactsInformation.myProfile,
        });

        if (!didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(reason),
          });
          return;
        }
        newContact = userProfile;
      } else {
        const decoded = atob(data);
        const parsedData = JSON.parse(decoded);
        const {
          didWork,
          reason,
          data: userProfile,
        } = await getDeepLinkUser({
          deepLinkContent: `blitz-wallet/u/${parsedData.uniqueName}`,
          userProfile: globalContactsInformation.myProfile,
        });

        if (!didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(reason),
          });
          return;
        }
        newContact = userProfile;
      }

      await getCachedProfileImage(newContact.uuid);

      navigate.replace('ExpandedAddContactsPage', { newContact: newContact });
    } catch (err) {
      setIsSearching(false);
      console.log('parse contact half modal error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.addContactsHalfModal.noContactsMessage'),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const clearHalfModalForLNURL = () => {
    if (!EMAIL_REGEX.test(searchInput)) return;

    keyboardNavigate(() => {
      navigate.replace('ExpandedAddContactsPage', {
        newContact: {
          name: searchInput.split('@')[0],
          bio: '',
          uniqueName: '',
          isFavorite: false,
          transactions: [],
          unlookedTransactions: 0,
          receiveAddress: searchInput,
          isAdded: true,
          isLNURL: true,
          profileImage: '',
          uuid: customUUID(),
        },
      });
    });
  };

  return (
    <View style={styles.innerContainer}>
      <View style={styles.titleContainer}>
        <ThemeText
          styles={styles.titleText}
          content={t('contacts.addContactsHalfModal.title')}
        />
        {isSearching && (
          <ActivityIndicator
            size={'small'}
            color={theme && darkModeType ? COLORS.darkModeText : COLORS.primary}
          />
        )}
      </View>
      <CustomSearchInput
        placeholderText={t('contacts.addContactsHalfModal.searchPlaceholder')}
        setInputText={handleSearch}
        inputText={searchInput}
        textInputRef={keyboardRef}
        blurOnSubmit={false}
        containerStyles={{
          justifyContent: 'center',
          marginBottom: CONTENT_KEYBOARD_OFFSET,
        }}
        textInputStyles={{ paddingRight: 45 }}
        onSubmitEditingFunction={() => {
          clearHalfModalForLNURL();
        }}
        buttonComponent={
          <TouchableOpacity
            onPress={() => {
              didClickCamera.current = true;
              keyboardNavigate(() =>
                navigate.navigate('CameraModal', {
                  updateBitcoinAdressFunc: parseContact,
                  fromPage: 'addContact',
                }),
              );
            }}
            style={{
              position: 'absolute',
              right: 10,
              zIndex: 1,
            }}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.lightModeText : COLORS.primary
              }
              iconName={'ScanQrCode'}
            />
          </TouchableOpacity>
        }
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={handleTextInputBlur}
      />

      {isUsingLNURL ? (
        <ScrollView
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <ThemeText
            content={t('contacts.addContactsHalfModal.lnurlAddMessage')}
          />
          <ThemeText content={searchInput} />

          <CustomButton
            buttonStyles={{
              width: 'auto',
              ...CENTER,
              marginTop: 25,
            }}
            actionFunction={() => {
              clearHalfModalForLNURL();
            }}
            textContent={t('constants.continue')}
          />
        </ScrollView>
      ) : (
        <>
          {users.length ? (
            <FlatList
              showsVerticalScrollIndicator={false}
              data={users}
              renderItem={({ item }) => (
                <ContactListItem
                  savedContact={item}
                  contactsPrivateKey={contactsPrivateKey}
                  theme={theme}
                  darkModeType={darkModeType}
                />
              )}
              keyExtractor={item => item?.uniqueName}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
            />
          ) : (
            <ThemeText
              styles={{ textAlign: 'center', marginTop: 10 }}
              content={
                isSearching && searchInput.length > 0
                  ? ''
                  : searchInput.length > 0 && searchInput !== '@'
                  ? t('contacts.addContactsHalfModal.noProfilesFound')
                  : t('contacts.addContactsHalfModal.startTypingMessage')
              }
            />
          )}
        </>
      )}
    </View>
  );
}
function ContactListItem(props) {
  const { textColor, backgroundOffset } = GetThemeColors();
  const navigate = useNavigation();

  const newContact = {
    ...props.savedContact,
    isFavorite: false,
    transactions: [],
    unlookedTransactions: 0,
    isAdded: true,
  };

  return (
    <TouchableOpacity
      onPress={() => {
        keyboardNavigate(() =>
          navigate.replace('ExpandedAddContactsPage', {
            newContact: newContact,
          }),
        );
      }}
    >
      <View style={[styles.contactListContainer, {}]}>
        <View
          style={[
            styles.contactListLetterImage,
            {
              backgroundColor: backgroundOffset,
            },
          ]}
        >
          <ContactProfileImage
            updated={newContact.updated}
            uri={newContact.localUri}
            darkModeType={props.darkModeType}
            theme={props.theme}
          />
        </View>
        <View>
          <ThemeText
            styles={{ includeFontPadding: false }}
            content={newContact.uniqueName}
          />
          <ThemeText
            styles={{ includeFontPadding: false, fontSize: SIZES.small }}
            content={newContact.name || 'No name set'}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  innerContainer: { flex: 1, width: '90%', ...CENTER },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
    flexDirection: 'row',
  },

  titleText: {
    fontSize: SIZES.large,
    textAlign: 'left',
    marginRight: 10,
  },

  contactListContainer: {
    width: '100%',
    paddingVertical: 10,

    flexDirection: 'row',
    alignItems: 'center',
  },

  contactListLetterImage: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
});
