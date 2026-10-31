import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CENTER } from '../../../../constants/styles';
import {
  EMAIL_REGEX,
  MAX_WEB_CONTENT_WIDTH,
  VALID_URL_REGEX,
  VALID_USERNAME_REGEX,
} from '../../../../constants';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import useDebounce from '../../../../hooks/useDebounce';
import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { searchUsers } from '../../../../../db';
import CustomButton from '../../../../functions/CustomElements/button';
import customUUID from '../../../../functions/customUUID';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import ContactAvatar from './internalComponents/contactAvatar';
import { getCachedProfileImage } from '../../../../functions/cachedImage';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useTranslation } from 'react-i18next';
import getDeepLinkUser from './internalComponents/getDeepLinkUser';
import { isBlitzLNURLAddress } from '../../../../functions/lnurl';
import getPhonePaymentAddress, {
  isPhonePaymentNumber,
} from '../../../../functions/sendBitcoin/getPhonePaymentAddress';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { SheetTitle } from '../savings/savingsSheetParts';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import AnimatedStep from '../../../../functions/CustomElements/redesign/AnimatedStep';

export default function AddContactsHalfModal({
  slideHeight,
  setIsKeyboardActive,
  startingSearchValue,
  handleBackPressFunction,
  isScreenActive,
}) {
  return (
    <AddContactContent
      setIsKeyboardActive={setIsKeyboardActive}
      startingSearchValue={startingSearchValue}
      handleBackPressFunction={handleBackPressFunction}
      onContactAdded={null}
      isScreenActive={isScreenActive}
    />
  );
}

export function AddContactContent({
  setIsKeyboardActive,
  startingSearchValue,
  handleBackPressFunction,
  onContactAdded,
  isScreenActive,
}) {
  const { globalContactsInformation } = useGlobalContactsInfo();
  const [searchInput, setSearchInput] = useState(startingSearchValue || '');
  const [users, setUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [remoteLoadingMessage, setRemoteLoadingMessage] = useState('');
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { refreshCacheObject } = useImageCache();
  const searchTrackerRef = useRef(null);

  const searchCacheRef = useRef(new Map()); // normalizedTerm -> resolved users[]
  const didClickCamera = useRef(null);
  const isAddingRef = useRef(false);
  const { t } = useTranslation();
  const isFocused = useRef(false);

  const isUsingLNURL =
    searchInput?.includes('@') && searchInput?.indexOf('@') !== 0;
  const isPhoneNumber = isPhonePaymentNumber(searchInput);

  useEffect(() => {
    isFocused.current = true;
    if (startingSearchValue) {
      handleSearch(startingSearchValue);
    }
    return () => {
      isFocused.current = false;
    };
  }, []);

  const handleSearchTrackerRef = () => {
    const requestUUID = customUUID();
    searchTrackerRef.current = requestUUID; // Simply store the latest UUID
    return requestUUID;
  };

  const getSearchCacheKey = term => term.replace(/@/g, '').trim().toLowerCase();

  const handleTextInputBlur = () => {
    if (setIsKeyboardActive) setIsKeyboardActive(false);
    // The field stays mounted while a lookup runs, so a blur then is not a dismissal.
    if (!searchInput && !didClickCamera.current && !remoteLoadingMessage) {
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
    if (searchTerm) {
      const results = await searchUsers(searchTerm);
      const newUsers = (
        await Promise.all(
          results.map(async savedContact => {
            if (!savedContact) return false;
            const uniqueName = savedContact?.uniqueName;
            const contactUUID = savedContact?.uuid;
            const hasProfileImage = savedContact?.hasProfileImage;
            if (uniqueName === globalContactsInformation.myProfile.uniqueName)
              return false;
            if (!contactUUID) return false;

            let responseData;

            if (hasProfileImage || typeof hasProfileImage === 'boolean') {
              responseData = await getCachedProfileImage(contactUUID);
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
      searchCacheRef.current.set(getSearchCacheKey(term), newUsers);
      setIsSearching(false);
      setUsers(newUsers);
    } else {
      setIsSearching(false);
    }
  }, 450);

  const handleSearch = term => {
    setSearchInput(term);
    handleSearchTrackerRef();
    if (isUsingLNURL) {
      searchTrackerRef.current = null;
      setIsSearching(false);
      return;
    }

    if (isPhonePaymentNumber(term)) {
      searchTrackerRef.current = null;
      setUsers([]);
      setIsSearching(false);
      return;
    }

    if (term.length === 0 || term === '@') {
      searchTrackerRef.current = null;
      setUsers([]);
      setIsSearching(false);
      return;
    }

    const cacheKey = getSearchCacheKey(term);
    if (cacheKey && searchCacheRef.current.has(cacheKey)) {
      searchTrackerRef.current = null; // cancel any in-flight/pending search
      setUsers(searchCacheRef.current.get(cacheKey));
      setIsSearching(false);
      return;
    }

    if (term.length > 0) {
      const requestUUID = handleSearchTrackerRef();
      setIsSearching(true);
      debouncedSearch(term, requestUUID);
    }
  };

  const resolveBlitzLNURLContact = async address => {
    const username = address.split('@')[0];
    return await getDeepLinkUser({
      deepLinkContent: `blitz-wallet/u/${username}`,
      userProfile: globalContactsInformation.myProfile,
    });
  };

  const parseContact = async data => {
    try {
      const sanitizedData = data.trim();
      setIsSearching(true);
      setRemoteLoadingMessage(
        t('contacts.addContactsHalfModal.loadingMessage'),
      );
      let newContact;
      if (isBlitzLNURLAddress(sanitizedData)) {
        const {
          didWork,
          reason,
          data: userProfile,
        } = await resolveBlitzLNURLContact(sanitizedData);

        if (!didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(reason),
          });
          return;
        }
        newContact = userProfile;
      } else if (VALID_URL_REGEX.test(sanitizedData)) {
        const {
          didWork,
          reason,
          data: userProfile,
        } = await getDeepLinkUser({
          deepLinkContent: sanitizedData,
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
        const decoded = atob(sanitizedData);
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

      setRemoteLoadingMessage(t('contacts.addContactsHalfModal.profileImage'));
      await getCachedProfileImage(newContact.uuid);

      if (!isFocused.current) {
        console.log('Page is not focused, do not navigate');
        return;
      }
      if (onContactAdded) {
        onContactAdded(newContact);
      } else {
        navigate.replace('ExpandedAddContactsPage', { newContact: newContact });
      }
    } catch (err) {
      setIsSearching(false);
      console.log('parse contact half modal error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.addContactsHalfModal.noContactsMessage'),
      });
    } finally {
      setIsSearching(false);
      setRemoteLoadingMessage('');
    }
  };

  const clearHalfModalForLNURL = async () => {
    if (!EMAIL_REGEX.test(searchInput)) return;

    if (isBlitzLNURLAddress(searchInput)) {
      setIsSearching(true);
      setRemoteLoadingMessage(
        t('contacts.addContactsHalfModal.loadingMessage'),
      );
      try {
        const {
          didWork,
          reason,
          data: userProfile,
        } = await resolveBlitzLNURLContact(searchInput);

        if (!didWork) {
          navigate.navigate('ErrorScreen', { errorMessage: t(reason) });
          return;
        }

        setRemoteLoadingMessage(
          t('contacts.addContactsHalfModal.profileImage'),
        );
        await getCachedProfileImage(userProfile.uuid);

        if (!isFocused.current) return;

        if (onContactAdded) {
          onContactAdded(userProfile);
        } else {
          handleBackPressFunction(() => {
            navigate.replace('ExpandedAddContactsPage', {
              newContact: userProfile,
            });
          });
        }
      } catch (err) {
        console.log('clearHalfModalForLNURL blitz error', err);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('contacts.addContactsHalfModal.noContactsMessage'),
        });
      } finally {
        setIsSearching(false);
        setRemoteLoadingMessage('');
      }
      return;
    }
    setRemoteLoadingMessage(t('contacts.addContactsHalfModal.loadingMessage'));

    const newContact = {
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
    };

    if (onContactAdded) {
      onContactAdded(newContact);
    } else {
      handleBackPressFunction(() => {
        navigate.replace('ExpandedAddContactsPage', {
          newContact: newContact,
        });
      });
    }
  };

  const clearHalfModalForPhone = async () => {
    setIsSearching(true);
    setRemoteLoadingMessage(t('contacts.addContactsHalfModal.loadingMessage'));
    try {
      const enteredNumber = searchInput.trim();
      const receiveAddress = await getPhonePaymentAddress(enteredNumber);

      if (!receiveAddress) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('contacts.addContactsHalfModal.noContactsMessage'),
        });
        return;
      }

      const name = isUsingLNURL
        ? searchInput.split('@')?.[0] || ''
        : enteredNumber;

      const newContact = {
        name,
        bio: '',
        uniqueName: '',
        isFavorite: false,
        transactions: [],
        unlookedTransactions: 0,
        receiveAddress,
        isAdded: true,
        isLNURL: true,
        profileImage: '',
        uuid: customUUID(),
      };

      if (!isFocused.current) return;

      if (onContactAdded) {
        onContactAdded(newContact);
      } else {
        handleBackPressFunction(() => {
          navigate.replace('ExpandedAddContactsPage', {
            newContact: newContact,
          });
        });
      }
    } catch (err) {
      console.log('clearHalfModalForPhone error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.addContactsHalfModal.noContactsMessage'),
      });
    } finally {
      setIsSearching(false);
      setRemoteLoadingMessage('');
    }
  };

  // The field stays live during a lookup, so block a second submit until it ends.
  const handleAddPress = async () => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;
    try {
      if (isPhoneNumber) {
        await clearHalfModalForPhone();
      } else {
        await clearHalfModalForLNURL();
      }
    } finally {
      isAddingRef.current = false;
    }
  };

  const noUserProfiles = searchInput.length > 0 && searchInput !== '@';
  const showAddressStep = isUsingLNURL || isPhoneNumber;

  const step = remoteLoadingMessage.length
    ? 'loading'
    : showAddressStep
    ? 'address'
    : isSearching
    ? 'loading'
    : users.length
    ? 'results'
    : noUserProfiles
    ? 'noMatch'
    : 'hint';

  return (
    <View style={[styles.innerContainer, { width: contentWidth }]}>
      <SheetTitle first title={t('contacts.addContactsHalfModal.title')} />
      <View style={styles.search}>
        <SearchField
          placeholder={t('contacts.addContactsHalfModal.searchPlaceholder')}
          value={searchInput}
          onChangeText={handleSearch}
          pill
          autoFocus={true}
          containerStyles={{ flexShrink: 1 }}
          onFocus={() => setIsKeyboardActive && setIsKeyboardActive(true)}
          onBlur={handleTextInputBlur}
          blurOnSubmit={false}
          onSubmitEditingFunction={handleAddPress}
        />
        <IconButton
          size={52}
          tone="disc"
          icon={'ScanLine'}
          label="contacts.addContactsHalfModal.scanLabel"
          onPress={() => {
            didClickCamera.current = true;
            if (isScreenActive) isScreenActive.current = false;
            keyboardNavigate(() =>
              navigate.navigate('CameraModal', {
                updateBitcoinAdressFunc: parseContact,
                fromPage: 'addContact',
              }),
            );
          }}
        />
      </View>

      <View style={styles.steps}>
        <AnimatedStep active={step === 'hint'} direction={1} fadeOnly>
          <View style={styles.hint}>
            <EmptyState
              icon={'UserPlus'}
              iconTone="ink"
              showTitle={false}
              sub={t('contacts.addContactsHalfModal.startTypingMessage')}
            />
          </View>
        </AnimatedStep>

        <AnimatedStep active={step === 'noMatch'} direction={1} fadeOnly>
          <View style={styles.noMatch}>
            <EmptyState
              icon={'Search'}
              title={t('contacts.addContactsHalfModal.noProfilesFound')}
              sub={t('contacts.addContactsHalfModal.noProfilesHint')}
            />
          </View>
        </AnimatedStep>

        <AnimatedStep active={step === 'results'} direction={1} fadeOnly>
          <SectionHeader
            first
            style={styles.sectionHeader}
            title={t('contacts.addContactsHalfModal.blitzUsers')}
          />
          <ListCard dividerInset={LIST_DIVIDER_INSET} style={styles.results}>
            <FlatList
              showsVerticalScrollIndicator={false}
              data={users}
              ItemSeparatorComponent={ListDivider}
              renderItem={({ item }) => (
                <ContactListItem
                  savedContact={item}
                  onContactAdded={onContactAdded}
                  handleBackPressFunction={handleBackPressFunction}
                />
              )}
              keyExtractor={item => item?.uniqueName}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
            />
          </ListCard>
        </AnimatedStep>

        <AnimatedStep active={step === 'address'} direction={1} fadeOnly>
          <View style={styles.address}>
            <ListCard style={styles.card}>
              <ListRow
                lead={<Disc icon={'AtSign'} size={44} tone="white" />}
                title={searchInput}
                titleStyle={styles.rowTitle}
                minHeight={76}
                paddingVertical={16}
                sub={
                  isUsingLNURL
                    ? t('contacts.addContactsHalfModal.lightningAddress')
                    : t('wallet.halfModal.mobileMoneyTitle')
                }
              />
            </ListCard>
            <CustomButton
              buttonStyles={styles.continueButton}
              actionFunction={handleAddPress}
              textContent={t('constants.continue')}
              size={'regular'}
            />
          </View>
        </AnimatedStep>

        <AnimatedStep active={step === 'loading'} direction={1} fadeOnly>
          <FullLoadingScreen
            showText={!!remoteLoadingMessage}
            textStyles={{ textAlign: 'center' }}
            text={remoteLoadingMessage}
          />
        </AnimatedStep>
      </View>
    </View>
  );
}

function ContactListItem({
  savedContact,
  onContactAdded,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();

  const newContact = {
    ...savedContact,
    isFavorite: false,
    transactions: [],
    unlookedTransactions: 0,
    isAdded: true,
  };

  const handleContactPress = () => {
    if (onContactAdded) {
      onContactAdded(newContact);
    } else {
      handleBackPressFunction(() => {
        navigate.replace('ExpandedAddContactsPage', {
          newContact: newContact,
        });
      });
    }
  };

  const name = newContact.name || t('contacts.addContactsHalfModal.noName');

  return (
    <ListRow
      onPress={handleContactPress}
      minHeight={64}
      titleStyle={styles.rowTitle}
      lead={
        <ContactAvatar
          name={newContact.name || newContact.uniqueName}
          seed={newContact.uuid}
          uri={newContact.localUri}
          updated={newContact.updated}
        />
      }
      title={name}
      sub={`@${newContact.uniqueName}`}
      showChevron
      chevronSize={18}
    />
  );
}

const LIST_DIVIDER_INSET = 68;

const styles = StyleSheet.create({
  innerContainer: { flex: 1, ...CENTER },
  search: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 16 },
  steps: { flex: 1 },
  hint: { marginTop: 56 },
  noMatch: { marginTop: 40 },
  sectionHeader: { marginTop: 20 },
  results: { flexShrink: 1 },
  address: { flex: 1, marginTop: 20 },
  card: { width: '100%' },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  continueButton: { marginTop: 'auto' },
});
