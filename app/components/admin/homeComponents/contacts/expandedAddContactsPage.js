import { memo, useEffect, useMemo } from 'react';
import ExpandedContactsPage from './expandedContactPage';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { CENTER, COLORS, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import ContactAvatar from './internalComponents/contactAvatar';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useExpandedNavbar } from './hooks/useExpandedNavbar';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import AddContactsPage from './addContactsPage';
import ContactRingAvatar from './internalComponents/contactsRingAvatar';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';

// Memoized shared header component. Contacts with a user id get the ID image
// as a badge that swaps with the photo when tapped (ContactRingAvatar).
const SharedHeader = memo(({ selectedContact, imageData, isContactAdded }) => {
  const size = isContactAdded ? 88 : 96;
  const fontSize = isContactAdded ? 28 : 32;
  const containerStyle = isContactAdded
    ? styles.addedImageContainer
    : styles.profileImageContainer;
  const name = selectedContact?.name?.trim() || selectedContact?.uniqueName;

  if (selectedContact?.isLNURL) {
    return (
      <View style={containerStyle}>
        <ContactAvatar
          name={name}
          seed={selectedContact.uuid}
          uri={imageData?.localUri}
          updated={imageData?.updated}
          size={size}
          fontSize={fontSize}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <ContactRingAvatar contactUUID={selectedContact.uuid} size={size}>
        <ContactAvatar
          fill
          name={name}
          seed={selectedContact.uuid}
          uri={imageData?.localUri}
          updated={imageData?.updated}
          fontSize={fontSize}
        />
      </ContactRingAvatar>
    </View>
  );
});

// Memoized navbar
const MemoizedNavBar = memo(
  ({
    onBack,
    selectedContact,
    isContactAdded,
    handleFavortie,
    handleSettings,
  }) => {
    return (
      <TopBar
        onBack={onBack}
        right={
          selectedContact &&
          isContactAdded && (
            <View style={styles.topBar}>
              <IconButton
                icon={'Star'}
                label="contacts.expandedContactPage.favoriteLabel"
                onPress={() => {
                  handleFavortie({ selectedContact });
                }}
                fill={selectedContact?.isFavorite}
              />
              <IconButton
                onPress={() => handleSettings({ selectedContact })}
                icon={'Pencil'}
                label="contacts.expandedContactPage.editLabel"
              />
            </View>
          )
        }
      />
    );
  },
);

export default function ExpandedAddContactsPage(props) {
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const navigate = useNavigation();
  const { cache, refreshCacheObject } = useImageCache();
  const { handleFavortie, handleSettings } = useExpandedNavbar();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  useEffect(() => {
    // make sure to refresh cache object so profile image shows
    refreshCacheObject();
  }, []);

  const newContact = props.route.params?.newContact;

  // Memoize contact lookup
  const selectedContact = useMemo(() => {
    return decodedAddedContacts.find(
      contact =>
        (contact.uuid === newContact?.uuid && contact.isAdded) ||
        (contact.isLNURL &&
          contact.receiveAddress.toLowerCase() ===
            newContact.receiveAddress?.toLowerCase()),
    );
  }, [decodedAddedContacts, newContact]);

  const isContactAdded = !!selectedContact;
  const imageData = cache[newContact?.uuid];
  const contactTransactions = contactsMessags[newContact?.uuid]?.messages || [];

  // Memoize back handler
  const handleBack = useMemo(() => {
    return () => keyboardGoBack(navigate);
  }, [navigate]);

  const themeBottomPadding = useMemo(() => {
    return { paddingBottom: isContactAdded ? 0 : bottomPadding };
  }, [bottomPadding, isContactAdded]);

  return (
    <GlobalThemeView styles={themeBottomPadding} useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <MemoizedNavBar
          onBack={handleBack}
          selectedContact={selectedContact}
          isContactAdded={isContactAdded}
          handleFavortie={handleFavortie}
          handleSettings={handleSettings}
        />
        <CustomScrollView
          contentContainerStyle={{
            paddingBottom: isContactAdded ? bottomPadding : 0,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={isContactAdded && !!contactTransactions.length}
        >
          <SharedHeader
            selectedContact={newContact}
            imageData={imageData}
            isContactAdded={isContactAdded}
          />

          {isContactAdded ? (
            <ExpandedContactsPage
              uuid={selectedContact.uuid}
              hideProfileImage={true}
            />
          ) : (
            <AddContactsPage selectedContact={newContact} />
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  topBar: {
    flexDirection: 'row',
    gap: 10,
  },
  profileImageContainer: {
    ...CENTER,
    marginTop: 40,
  },
  addedImageContainer: {
    ...CENTER,
    marginTop: 8,
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
