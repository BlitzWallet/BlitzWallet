import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import ContactAvatar from './internalComponents/contactAvatar';
import { useImageCacheEntry } from '../../../../../context-store/imageCache';
import {
  useFilteredContacts,
  useProcessedContacts,
} from './contactsPageComponents/hooks';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { TAB_ITEM_HEIGHT } from '../../../../../navigation/tabs';
import { formatDisplayName } from './utils/formatListDisplayName';
import { useNavigateToContact } from './utils/navigateToExpandedContact';
import PageTitle from '../../../../functions/CustomElements/redesign/PageTitle';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

export default function ContactsPage({ navigation }) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const { bottomPadding } = useGlobalInsets();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    contactsMessags,
    giftCardsList,
  } = useGlobalContacts();
  const scrollViewRef = useRef(null);
  const { tokens } = GetThemeColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [inputText, setInputText] = useState('');
  const hideUnknownContacts = masterInfoObject.hideUnknownContacts;
  const navigate = useNavigation();
  const myProfile = globalContactsInformation.myProfile;
  const didEditProfile = myProfile?.didEditProfile;
  useFocusEffect(
    useCallback(() => {
      if (!navigation) return;
      return navigation?.addListener('tabPress', () => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
      });
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

  const navigateToExpandedContact = useNavigateToContact();

  const pinnedContacts = useMemo(() => {
    return contactInfoList
      .filter(contact => contact.contact.isFavorite)
      .map(contact => (
        <PinnedContactElement
          key={contact.contact.uuid}
          contact={contact.contact}
          hasUnlookedTransaction={contact.hasUnlookedTransaction}
          tokens={tokens}
          navigateToExpandedContact={navigateToExpandedContact}
        />
      ));
  }, [contactInfoList, tokens, navigateToExpandedContact]);

  const contactElements = useMemo(() => {
    return filteredContacts.map(item => (
      <ContactElement
        key={item.contact.uuid}
        contact={item.contact}
        hasUnlookedTransaction={item.hasUnlookedTransaction}
        tokens={tokens}
        navigateToExpandedContact={navigateToExpandedContact}
      />
    ));
  }, [filteredContacts, tokens, navigateToExpandedContact, t]);

  const openAddContact = useCallback(
    extraParams => {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'addContacts',
        sliderHight: ADD_CONTACT_SHEET_HEIGHT,
        ...extraParams,
      });
    },
    [navigate],
  );

  const handleButtonPress = useCallback(() => {
    keyboardNavigate(() => {
      if (!isConnectedToTheInternet) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.nointernet'),
        });
        return;
      }
      if (didEditProfile) {
        navigation.navigate('CustomHalfModal', {
          wantedContent: 'addContacts',
          sliderHight: ADD_CONTACT_SHEET_HEIGHT,
        });
      } else {
        navigation.navigate('EditMyProfilePage', {
          pageType: 'myProfile',
          fromSettings: false,
        });
      }
    });
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

  const showHighlightedGifts = useMemo(() => {
    return giftCardsList && !!giftCardsList?.length;
  }, [giftCardsList]);

  const header = (
    <View style={memoizedStyles.header}>
      <PageTitle text={t('tabs.contacts')} />
      <View style={memoizedStyles.headerButtons}>
        {showHighlightedGifts && (
          <IconButton
            icon={'Gift'}
            label="contacts.contactsPage.giftCards"
            onPress={() =>
              keyboardNavigate(() => navigate.navigate('ViewAllGiftCards'))
            }
          />
        )}
        <IconButton
          icon={'UserPlus'}
          label="contacts.addContactsHalfModal.title"
          onPress={handleButtonPress}
        />
      </View>
    </View>
  );

  if (!hasContacts || !didEditProfile) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[memoizedStyles.container, { width: contentWidth }]}>
          {header}
          <View style={memoizedStyles.empty}>
            <EmptyState
              icon={didEditProfile ? 'UsersRound' : 'UserRoundPen'}
              title={
                didEditProfile
                  ? t('contacts.contactsPage.noContent.addContactstitle')
                  : t('contacts.contactsPage.noContent.editProfileTitle')
              }
              sub={
                didEditProfile
                  ? t('contacts.contactsPage.noContent.addContactsDescription')
                  : t('contacts.contactsPage.noContent.editProfileDescription')
              }
              onRetry={handleButtonPress}
              retryText={
                didEditProfile
                  ? t('contacts.contactsPage.addContactButton')
                  : t('contacts.contactsPage.editContactButton')
              }
            />
          </View>
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[memoizedStyles.container, { width: contentWidth }]}>
        {header}

        <SearchField
          placeholder={t('contacts.contactsPage.searchContactsPlaceholder')}
          value={inputText}
          onChangeText={setInputText}
          pill
        />
        <CustomScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 40,
          }}
        >
          {pinnedContacts.length !== 0 && filteredContacts.length !== 0 && (
            <>
              <SectionHeader title={t('contacts.contactsPage.favorites')} />
              <View style={memoizedStyles.pinnedContactsContainer}>
                {pinnedContacts}
              </View>
            </>
          )}

          {contactElements.length ? (
            <View>
              <SectionHeader title={t('contacts.contactsPage.allContacts')} />
              <ListCard dividerInset={LIST_DIVIDER_INSET}>
                {contactElements}
              </ListCard>
            </View>
          ) : inputText.trim() ? (
            <View style={memoizedStyles.noResultsContainer}>
              <EmptyState
                icon={'Search'}
                title={`"${inputText}" ` + t('contacts.contactsPage.notFound')}
                sub={t('contacts.contactsPage.noContactSearch')}
                onRetry={() =>
                  keyboardNavigate(() =>
                    openAddContact({ startingSearchValue: inputText.trim() }),
                  )
                }
                retryText={t('constants.search')}
              />
            </View>
          ) : null}
        </CustomScrollView>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

// Round 56 avatar over a first name, 72 wide (People.dc.html "Favorites").
// The unread dot sits beside the name.
const PinnedContactElement = memo(
  ({ contact, hasUnlookedTransaction, tokens, navigateToExpandedContact }) => {
    const imageEntry = useImageCacheEntry(contact.uuid);
    const displayName = formatDisplayName(contact);

    const handlePress = useCallback(() => {
      keyboardNavigate(() => {
        navigateToExpandedContact(contact, 'contacts');
      });
    }, [contact, navigateToExpandedContact]);

    return (
      <TouchableOpacity
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        style={memoizedStyles.pinnedContact}
      >
        <ContactAvatar
          name={displayName}
          seed={contact.uuid}
          uri={imageEntry?.localUri}
          updated={imageEntry?.updated}
          size={56}
          fontSize={18}
        />
        <View style={memoizedStyles.pinnedContactNameRow}>
          {hasUnlookedTransaction && (
            <View
              style={[
                memoizedStyles.unreadDot,
                { backgroundColor: tokens.accent },
              ]}
            />
          )}
          <ThemeText
            CustomEllipsizeMode="tail"
            CustomNumberOfLines={1}
            styles={memoizedStyles.pinnedContactName}
            content={displayName.split(/\s+/)[0]}
          />
        </View>
      </TouchableOpacity>
    );
  },
);

const ContactElement = memo(
  ({ contact, hasUnlookedTransaction, tokens, navigateToExpandedContact }) => {
    const imageEntry = useImageCacheEntry(contact.uuid);
    const displayName = formatDisplayName(contact);

    const handlePress = useCallback(() => {
      keyboardNavigate(() => {
        navigateToExpandedContact(contact);
      });
    }, [contact, navigateToExpandedContact]);

    return (
      <ListRow
        onPress={handlePress}
        minHeight={64}
        titleStyle={memoizedStyles.rowTitle}
        lead={
          <ContactAvatar
            name={displayName}
            seed={contact.uuid}
            uri={imageEntry?.localUri}
            updated={imageEntry?.updated}
          />
        }
        title={displayName}
        sub={!contact.isLNURL && `@${contact.uniqueName}`}
        trailing={
          hasUnlookedTransaction && (
            <View
              style={[
                memoizedStyles.unreadDot,
                { backgroundColor: tokens.accent },
              ]}
            />
          )
        }
        showChevron={true}
        chevronSize={18}
      />
    );
  },
);

const ADD_CONTACT_SHEET_HEIGHT = 0.7;
// Text starts at 40 avatar + 12 gap + 16 card padding.
const LIST_DIVIDER_INSET = 68;

const memoizedStyles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  header: {
    marginTop: 10,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 45,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  empty: {
    marginTop: 130,
    alignItems: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pinnedContactsContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 4,
    paddingHorizontal: 6,
    flexWrap: 'wrap',
  },
  pinnedContact: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  pinnedContactNameRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pinnedContactName: {
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
    includeFontPadding: false,
  },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
});
