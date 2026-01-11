import { memo, useEffect, useMemo } from 'react';
import ExpandedContactsPage from './expandedContactPage';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER, COLORS, ICONS } from '../../../../constants';
import ContactProfileImage from './internalComponents/profileImage';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useExpandedNavbar } from './hooks/useExpandedNavbar';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import AddContactsPage from './addContactsPage';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

// Memoized shared header component
const SharedHeader = memo(
  ({
    selectedContact,
    imageData,
    theme,
    darkModeType,
    backgroundOffset,
    isContactAdded,
    isEditingMyProfile,
    navigate,
  }) => {
    return (
      <View style={styles.profileImageContainer}>
        <View
          style={[
            styles.profileImage,
            {
              backgroundColor: backgroundOffset,
            },
          ]}
        >
          <ContactProfileImage
            updated={imageData?.updated}
            uri={imageData?.localUri}
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>
      </View>
    );
  },
);

// Memoized navbar
const MemoizedNavBar = memo(
  ({
    onBack,
    theme,
    darkModeType,
    selectedContact,
    backgroundColor,
    isContactAdded,
    handleFavortie,
    handleSettings,
  }) => {
    return (
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButtonContainer} onPress={onBack}>
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>
        {selectedContact && isContactAdded && (
          <TouchableOpacity
            style={styles.starContianer}
            onPress={() => {
              handleFavortie({ selectedContact });
            }}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              fill={
                selectedContact.isFavorite
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.primary
                  : backgroundColor
              }
              iconName={'Star'}
            />
          </TouchableOpacity>
        )}
        {selectedContact && isContactAdded && (
          <TouchableOpacity onPress={() => handleSettings({ selectedContact })}>
            <ThemeIcon iconName={'Settings'} />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

export default function ExpandedAddContactsPage(props) {
  const { decodedAddedContacts, globalContactsInformation, contactsMessags } =
    useGlobalContacts();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { cache, refreshCacheObject } = useImageCache();
  const { handleFavortie, handleSettings } = useExpandedNavbar();
  const { bottomPadding } = useGlobalInsets();

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

  const isSelf = useMemo(() => {
    return (
      newContact.uniqueName?.toLowerCase() ===
      globalContactsInformation?.myProfile?.uniqueName?.toLowerCase()
    );
  }, [newContact.uniqueName, globalContactsInformation?.myProfile?.uniqueName]);

  const isContactAdded = !!selectedContact;
  const imageData = cache[newContact?.uuid];
  const contactTransactions = contactsMessags[newContact?.uuid]?.messages || [];

  // Memoize back handler
  const handleBack = useMemo(() => {
    return () => keyboardGoBack(navigate);
  }, [navigate]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <MemoizedNavBar
        theme={theme}
        darkModeType={darkModeType}
        onBack={handleBack}
        selectedContact={selectedContact}
        backgroundColor={backgroundColor}
        isContactAdded={isContactAdded}
        handleFavortie={handleFavortie}
        handleSettings={handleSettings}
      />

      <ScrollView
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
          theme={theme}
          darkModeType={darkModeType}
          backgroundOffset={backgroundOffset}
          isContactAdded={isContactAdded}
          isEditingMyProfile={isSelf}
          navigate={navigate}
        />

        {isContactAdded ? (
          <ExpandedContactsPage
            uuid={selectedContact.uuid}
            hideProfileImage={true}
          />
        ) : (
          <AddContactsPage selectedContact={newContact} />
        )}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  profileImageContainer: {
    ...CENTER,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
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
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backButtonContainer: { marginRight: 'auto' },
  starContianer: { marginRight: 5 },
});
