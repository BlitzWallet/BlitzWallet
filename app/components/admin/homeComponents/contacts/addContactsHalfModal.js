import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  unstable_batchedUpdates,
  View,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {CENTER} from '../../../../constants/styles';
import GetThemeColors from '../../../../hooks/themeColors';
import {COLORS, EMAIL_REGEX, FONT, ICONS, SIZES} from '../../../../constants';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import useDebounce from '../../../../hooks/useDebounce';
import {useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {searchUsers} from '../../../../../db';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import CustomButton from '../../../../functions/CustomElements/button';
import {atob} from 'react-native-quick-base64';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import {useKeysContext} from '../../../../../context-store/keys';
import {keyboardNavigate} from '../../../../functions/customNavigation';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import sha256Hash from '../../../../functions/hash';
import ContactProfileImage from './internalComponents/profileImage';

export default function AddContactsHalfModal(props) {
  const {contactsPrivateKey} = useKeysContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {globalContactsInformation} = useGlobalContacts();
  const [searchInput, setSearchInput] = useState('');
  const [users, setUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const sliderHight = props.slideHeight;
  const navigate = useNavigation();
  const keyboardRef = useRef(null);

  const debouncedSearch = useDebounce(async term => {
    const results = await searchUsers(term);
    const newUsers = results
      .map((savedContact, id) => {
        if (!savedContact) {
          return false;
        }
        if (
          savedContact.uniqueName ===
          globalContactsInformation.myProfile.uniqueName
        )
          return false;
        if (!savedContact.receiveAddress) return false;
        return savedContact;
      })
      .filter(Boolean);
    unstable_batchedUpdates(() => {
      setIsSearching(false);
      setUsers(newUsers);
    });
  }, 500);

  const handleSearch = term => {
    setSearchInput(term);
    if (term.includes('@')) return;
    term && setIsSearching(true);
    debouncedSearch(term);
  };

  const parseContact = data => {
    try {
      const decoded = atob(data);
      const parsedData = JSON.parse(decoded);
      if (!parsedData?.receiveAddress) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Not able to find contact',
        });
        return;
      }

      const newContact = {
        name: parsedData.name || '',
        bio: parsedData.bio || '',
        uniqueName: parsedData.uniqueName,
        isFavorite: false,
        transactions: [],
        unlookedTransactions: 0,
        uuid: parsedData.uuid,
        receiveAddress: parsedData.receiveAddress,
        isAdded: true,
        profileImage: '',
      };
      navigate.replace('ExpandedAddContactsPage', {newContact: newContact});
    } catch (err) {
      console.log('parse contact half modal error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Not able to find contact',
      });
    }
  };

  const clearHalfModalForLNURL = () => {
    if (!EMAIL_REGEX.test(searchInput)) return;

    navigate.replace('ExpandedAddContactsPage', {
      newContact: {
        name: searchInput.split('@')[0],
        bio: '',
        uniqueName: null,
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
  };

  return (
    <TouchableWithoutFeedback>
      <View style={styles.container}>
        <View style={styles.innerContainer}>
          <View style={styles.titleContainer}>
            <ThemeText styles={styles.titleText} content={'Add contact'} />
            {isSearching && (
              <ActivityIndicator
                size={'small'}
                color={
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                }
              />
            )}
          </View>
          <CustomSearchInput
            placeholderText={'Search username or LNURL'}
            setInputText={handleSearch}
            inputText={searchInput}
            textInputRef={keyboardRef}
            blurOnSubmit={false}
            containerStyles={{justifyContent: 'center'}}
            onSubmitEditingFunction={() => {
              clearHalfModalForLNURL();
            }}
            buttonComponent={
              <TouchableOpacity
                onPress={() => {
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
                }}>
                <ThemeImage
                  darkModeIcon={ICONS.scanQrCodeBlue}
                  lightModeIcon={ICONS.scanQrCodeBlue}
                  lightsOutIcon={ICONS.scanQrCodeDark}
                />
              </TouchableOpacity>
            }
          />

          {searchInput.includes('@') ? (
            <ScrollView
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                alignItems: 'center',
                marginTop: 10,
              }}>
              <ThemeText content={'You are about to add'} />
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
                textContent={'Continue'}
              />
            </ScrollView>
          ) : (
            <FlatList
              key={sha256Hash(users.join('') + `${isSearching}`)}
              showsVerticalScrollIndicator={false}
              data={users}
              renderItem={({item}) => (
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
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
function ContactListItem(props) {
  const {textColor, backgroundOffset} = GetThemeColors();
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
          navigate.replace('ExpandedAddContactsPage', {newContact: newContact}),
        );
      }}>
      <View style={[styles.contactListContainer, {}]}>
        <View
          style={[
            styles.contactListLetterImage,
            {
              backgroundColor: backgroundOffset,
            },
          ]}>
          <ContactProfileImage
            uri={newContact.profileImage}
            darkModeType={props.darkModeType}
            theme={props.theme}
          />
        </View>
        <View>
          <ThemeText
            styles={{includeFontPadding: false}}
            content={newContact.uniqueName}
          />
          <ThemeText
            styles={{includeFontPadding: false, fontSize: SIZES.small}}
            content={newContact.name || 'No name set'}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  innerContainer: {flex: 1, width: '90%', ...CENTER},

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
    height: 30,
    width: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },
});
