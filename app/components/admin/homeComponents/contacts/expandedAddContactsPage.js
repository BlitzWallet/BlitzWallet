import { memo, useMemo } from 'react';
import ExpandedContactsPage from './expandedContactPage';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import EditMyProfilePage from './editMyProfilePage';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER, COLORS, ICONS } from '../../../../constants';
import ContactProfileImage from './internalComponents/profileImage';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useProfileImage } from './hooks/useProfileImage';
import { useExpandedNavbar } from './hooks/useExpandedNavbar';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { Image } from 'expo-image';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import Icon from '../../../../functions/CustomElements/Icon';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';

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
    const { isAddingImage, addProfilePicture, deleteProfilePicture } =
      useProfileImage();
    const hasImage = !!imageData?.localUri;

    return (
      <TouchableOpacity
        activeOpacity={
          (isContactAdded && !isAddingImage) || !selectedContact.isLNURL
            ? 1
            : 0.2
        }
        onPress={() => {
          if (!isEditingMyProfile && !selectedContact.isLNURL) return;
          if (isAddingImage) return;
          if (!hasImage) {
            addProfilePicture(isEditingMyProfile, selectedContact);
            return;
          }
          navigate.navigate('AddOrDeleteContactImage', {
            addPhoto: () =>
              addProfilePicture(isEditingMyProfile, selectedContact),
            deletePhoto: () =>
              deleteProfilePicture(isEditingMyProfile, selectedContact),
            hasImage: hasImage,
          });
        }}
      >
        <View style={styles.profileImageContainer}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundOffset,
              },
            ]}
          >
            {isAddingImage ? (
              <FullLoadingScreen showText={false} />
            ) : (
              <ContactProfileImage
                updated={imageData?.updated}
                uri={imageData?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            )}
          </View>
          {(isEditingMyProfile || selectedContact.isLNURL) &&
            !isContactAdded && (
              <View style={styles.selectFromPhotos}>
                <Image
                  source={
                    hasImage ? ICONS.xSmallIconBlack : ICONS.ImagesIconDark
                  }
                  style={{ width: 20, height: 20 }}
                />
              </View>
            )}
        </View>
      </TouchableOpacity>
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
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        {selectedContact && isContactAdded && (
          <TouchableOpacity
            style={styles.starContianer}
            onPress={() => {
              handleFavortie({ selectedContact });
            }}
          >
            <Icon
              width={25}
              height={25}
              name={'didPinContactStar'}
              color={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              offsetColor={
                selectedContact.isFavorite
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.primary
                  : backgroundColor
              }
            />
          </TouchableOpacity>
        )}
        {selectedContact && isContactAdded && (
          <TouchableOpacity onPress={() => handleSettings({ selectedContact })}>
            <ThemeImage
              darkModeIcon={ICONS.settingsIcon}
              lightModeIcon={ICONS.settingsIcon}
              lightsOutIcon={ICONS.settingsWhite}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

export default function ExpandedAddContactsPage(props) {
  const { decodedAddedContacts, globalContactsInformation } =
    useGlobalContacts();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { cache } = useImageCache();
  const { handleFavortie, handleSettings } = useExpandedNavbar();
  const { bottomPadding } = useGlobalInsets();

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

  // Memoize back handler
  const handleBack = useMemo(() => {
    return () => keyboardGoBack(navigate);
  }, [navigate]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
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
          <EditMyProfilePage
            pageType={isSelf ? 'myProfile' : 'addedContact'}
            selectedAddedContact={newContact}
            fromInitialAdd={!isSelf}
            hideProfileImage={true}
          />
        )}
      </ScrollView>
    </CustomKeyboardAvoidingView>
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
