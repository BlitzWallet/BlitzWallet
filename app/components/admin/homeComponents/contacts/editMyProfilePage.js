import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  SIZES,
  VALID_USERNAME_REGEX,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState, useRef } from 'react';
import { encriptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import { isValidUniqueName } from '../../../../../db';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useKeysContext } from '../../../../../context-store/keys';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import ContactProfileImage from './internalComponents/profileImage';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useProfileImage } from './hooks/useProfileImage';
import EditProfileTextInput from './internalComponents/editProfileTextItems';
import { areImagesSame } from './utils/imageComparison';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function EditMyProfilePage(props) {
  const navigate = useNavigation();
  const {
    decodedAddedContacts,
    toggleGlobalContactsInformation,
    globalContactsInformation,
    deleteContact,
  } = useGlobalContacts();

  const { t } = useTranslation();

  const pageType = props?.pageType || props.route?.params?.pageType;
  const fromSettings = props.fromSettings || props.route?.params?.fromSettings;
  const hideProfileImage = props?.hideProfileImage;
  const isEditingMyProfile = pageType.toLowerCase() === 'myprofile';
  const providedContact =
    !isEditingMyProfile &&
    (props?.selectedAddedContact || props.route?.params?.selectedAddedContact);
  const myContact = globalContactsInformation.myProfile;
  const isFirstTimeEditing = myContact.didEditProfile;

  const selectedAddedContact = props.fromInitialAdd
    ? providedContact
    : decodedAddedContacts.find(
        contact => contact.uuid === providedContact?.uuid,
      );

  useHandleBackPressNew();

  const deleteUser = shouldDelete => {
    if (shouldDelete) {
      deleteContact(selectedAddedContact);
      navigate.popTo('HomeAdmin');
    }
  };

  if (hideProfileImage) {
    return (
      <InnerContent
        isEditingMyProfile={isEditingMyProfile}
        selectedAddedContact={selectedAddedContact}
        fromInitialAdd={props.fromInitialAdd}
        fromSettings={fromSettings}
        hideProfileImage={true}
      />
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={fromSettings ? t('contacts.editMyProfilePage.navTitle') : ''}
        customBackFunction={() => {
          if (!isFirstTimeEditing) {
            toggleGlobalContactsInformation(
              {
                myProfile: {
                  ...globalContactsInformation.myProfile,
                  didEditProfile: true,
                },
                addedContacts: globalContactsInformation.addedContacts,
              },
              true,
            );
          }
          keyboardGoBack(navigate);
        }}
        iconNew="Trash2"
        leftImageFunction={() =>
          navigate.navigate('ConfirmActionPage', {
            confirmMessage: t('contacts.editMyProfilePage.deleateWarning'),
            confirmFunction: () => deleteUser(true),
            cancelFunction: () => deleteUser(false),
          })
        }
        showLeftImage={!isEditingMyProfile}
      />
      <InnerContent
        isEditingMyProfile={isEditingMyProfile}
        selectedAddedContact={selectedAddedContact}
        fromInitialAdd={props.fromInitialAdd}
        fromSettings={fromSettings}
        hideProfileImage={false}
      />
    </CustomKeyboardAvoidingView>
  );
}

// Extracted shared input fields component
function ProfileInputFields({
  inputs,
  changeInputText,
  setIsKeyboardActive,
  nameRef,
  uniquenameRef,
  bioRef,
  receiveAddressRef,
  isEditingMyProfile,
  selectedAddedContact,
  myContact,
  theme,
  darkModeType,
  textInputColor,
  textInputBackground,
  textColor,
  navigate,
  t,
}) {
  return (
    <>
      <EditProfileTextInput
        label={t('contacts.editMyProfilePage.nameInputDesc')}
        placeholder={t('contacts.editMyProfilePage.nameInputPlaceholder')}
        value={inputs.name}
        onChangeText={text => changeInputText(text, 'name')}
        onFocus={() => setIsKeyboardActive(true)}
        onBlur={() => setIsKeyboardActive(false)}
        inputRef={nameRef}
        maxLength={30}
        theme={theme}
        darkModeType={darkModeType}
        textInputColor={textInputColor}
        textInputBackground={textInputBackground}
        textColor={textColor}
      />

      {selectedAddedContact?.isLNURL && (
        <EditProfileTextInput
          label={t('contacts.editMyProfilePage.lnurlInputDesc')}
          placeholder={t('contacts.editMyProfilePage.lnurlInputPlaceholder')}
          value={inputs.receiveAddress}
          onChangeText={text => changeInputText(text, 'receiveAddress')}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          inputRef={receiveAddressRef}
          maxLength={200}
          multiline={false}
          minHeight={60}
          theme={theme}
          darkModeType={darkModeType}
          textInputColor={textInputColor}
          textInputBackground={textInputBackground}
          textColor={textColor}
        />
      )}

      {isEditingMyProfile && (
        <EditProfileTextInput
          label={t('contacts.editMyProfilePage.uniqueNameInputDesc')}
          placeholder={myContact.uniqueName}
          value={inputs.uniquename}
          onChangeText={text => changeInputText(text, 'uniquename')}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          inputRef={uniquenameRef}
          maxLength={30}
          theme={theme}
          darkModeType={darkModeType}
          textInputColor={textInputColor}
          textInputBackground={textInputBackground}
          textColor={textColor}
          showInfoIcon={true}
          onInfoPress={() =>
            navigate.navigate('InformationPopup', {
              textContent: t(
                'wallet.receivePages.editLNURLContact.informationMessage',
              ),
              buttonText: t('constants.understandText'),
            })
          }
        />
      )}

      <EditProfileTextInput
        label={t('contacts.editMyProfilePage.bioInputDesc')}
        placeholder={t('contacts.editMyProfilePage.bioInputPlaceholder')}
        value={inputs.bio}
        onChangeText={text => changeInputText(text, 'bio')}
        onFocus={() => setIsKeyboardActive(true)}
        onBlur={() => setIsKeyboardActive(false)}
        inputRef={bioRef}
        maxLength={150}
        multiline={true}
        minHeight={60}
        maxHeight={100}
        theme={theme}
        darkModeType={darkModeType}
        textInputColor={textInputColor}
        textInputBackground={textInputBackground}
        textColor={textColor}
        containerStyle={{ marginBottom: 10 }}
      />
    </>
  );
}

function InnerContent({
  isEditingMyProfile,
  selectedAddedContact,
  fromInitialAdd,
  fromSettings,
  hideProfileImage = false,
}) {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { cache, refreshCacheObject } = useImageCache();
  const { backgroundOffset, textInputColor, textInputBackground, textColor } =
    GetThemeColors();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
  } = useGlobalContacts();
  const { t } = useTranslation();
  const {
    isAddingImage,
    deleteProfilePicture,
    getProfileImage,
    saveProfileImage,
  } = useProfileImage();

  const nameRef = useRef(null);
  const uniquenameRef = useRef(null);
  const bioRef = useRef(null);
  const receiveAddressRef = useRef(null);
  const didCallImagePicker = useRef(null);
  const myContact = globalContactsInformation.myProfile;

  const myContactName = myContact?.name || '';
  const myContactBio = myContact?.bio || '';
  const myContactUniqueName = myContact?.uniqueName || '';
  const isFirstTimeEditing = myContact.didEditProfile;

  const selectedAddedContactName = selectedAddedContact?.name || '';
  const selectedAddedContactBio = selectedAddedContact?.bio || '';
  const selectedAddedContactUniqueName = selectedAddedContact?.uniqueName || '';
  const selectedAddedContactReceiveAddress =
    selectedAddedContact?.receiveAddress || '';

  const [isSaving, setIsSaving] = useState(false);
  const [inputs, setInputs] = useState(() => ({
    name: isFirstTimeEditing
      ? isEditingMyProfile
        ? myContactName || ''
        : selectedAddedContactName || ''
      : '',
    bio: isFirstTimeEditing
      ? isEditingMyProfile
        ? myContactBio || ''
        : selectedAddedContactBio || ''
      : '',
    uniquename: isFirstTimeEditing
      ? isEditingMyProfile
        ? myContactUniqueName || ''
        : selectedAddedContactUniqueName || ''
      : '',
    receiveAddress: selectedAddedContactReceiveAddress || '',
  }));

  // Remove the entire useEffect
  const [tempImage, setTempImage] = useState({
    uri: null,
    comparison: null,
    updated: 0,
    shouldDelete: false,
  });

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();

  const navigate = useNavigation();

  function changeInputText(text, type) {
    setInputs(prev => {
      return { ...prev, [type]: text };
    });
  }

  const myProfileImage = cache[myContact?.uuid];
  const selectedAddedContactImage = cache[selectedAddedContact?.uuid];
  const hasImage = tempImage.shouldDelete
    ? false
    : tempImage.uri
    ? true
    : isEditingMyProfile
    ? !!myProfileImage?.localUri
    : !!selectedAddedContactImage?.localUri;

  const hasChangedInfo = isEditingMyProfile
    ? myContactName !== inputs.name ||
      myContactBio !== inputs.bio ||
      myContactUniqueName !== inputs.uniquename ||
      tempImage.uri ||
      tempImage.shouldDelete
    : selectedAddedContactName !== inputs.name ||
      selectedAddedContactBio !== inputs.bio ||
      selectedAddedContactUniqueName !== inputs.uniquename ||
      selectedAddedContactReceiveAddress !== inputs.receiveAddress ||
      fromInitialAdd ||
      tempImage.uri ||
      tempImage.shouldDelete;

  console.log(
    hasChangedInfo,
    'has info changed',
    selectedAddedContactName,
    inputs.name,
    selectedAddedContactBio,
    inputs.bio,
    selectedAddedContactUniqueName,
    inputs.uniquename,
    selectedAddedContactReceiveAddress,
    inputs.receiveAddress,
    fromInitialAdd,
    tempImage.uri,
    tempImage.shouldDelete,
  );

  const handleDeleteProfilePicture = () => {
    setTempImage({
      uri: null,
      comparison: null,
      updated: 0,
      shouldDelete: true,
    });
  };

  const addProfilePicture = async () => {
    if (didCallImagePicker.current) return;
    didCallImagePicker.current = true;
    const response = await getProfileImage();
    if (response?.imgURL && response?.comparison) {
      setTempImage({
        comparison: response?.comparison,
        uri: response?.imgURL,
        updated: Date.now(),
      });
    }
    didCallImagePicker.current = false;
  };

  useEffect(() => {
    if (!fromInitialAdd) return;
    if (hasImage) return;
    // Making sure to update UI for new contacts image
    refreshCacheObject();
  }, []);

  // Shared props for ProfileInputFields
  const inputFieldsProps = {
    inputs,
    changeInputText,
    setIsKeyboardActive,
    nameRef,
    uniquenameRef,
    bioRef,
    receiveAddressRef,
    isEditingMyProfile,
    selectedAddedContact,
    myContact,
    theme,
    darkModeType,
    textInputColor,
    textInputBackground,
    textColor,
    navigate,
    t,
  };

  if (hideProfileImage) {
    return (
      <>
        <View style={styles.hideProfileContainer}>
          <ProfileInputFields {...inputFieldsProps} />
        </View>
        <CustomButton
          buttonStyles={{
            width: 'auto',
            ...CENTER,
            marginTop: 10,
            marginBottom: isKeyboardActive
              ? CONTENT_KEYBOARD_OFFSET
              : bottomPadding,
          }}
          useLoading={isSaving}
          actionFunction={saveChanges}
          textContent={
            hasChangedInfo
              ? fromInitialAdd
                ? t('contacts.editMyProfilePage.addContactBTN')
                : t('constants.save')
              : t('constants.back')
          }
        />
      </>
    );
  }

  return (
    <View
      style={[
        styles.innerContainer,
        fromSettings && { maxWidth: MAX_CONTENT_WIDTH, width: '100%' },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          width: fromSettings ? INSET_WINDOW_WIDTH : '100%',
          ...CENTER,
        }}
      >
        <TouchableOpacity
          activeOpacity={
            (isEditingMyProfile || selectedAddedContact.isLNURL) &&
            !isAddingImage
              ? 0.2
              : 1
          }
          onPress={() => {
            if (!isEditingMyProfile && !selectedAddedContact.isLNURL) return;
            if (isAddingImage) return;
            if (!hasImage) {
              addProfilePicture(isEditingMyProfile, selectedAddedContact);
              return;
            }
            navigate.navigate('AddOrDeleteContactImage', {
              addPhoto: () =>
                addProfilePicture(isEditingMyProfile, selectedAddedContact),
              deletePhoto: handleDeleteProfilePicture,
              hasImage: hasImage,
            });
          }}
        >
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
                updated={
                  tempImage.shouldDelete
                    ? null
                    : tempImage.uri
                    ? tempImage.comparison?.updated
                    : isEditingMyProfile
                    ? myProfileImage?.updated
                    : selectedAddedContactImage?.updated
                }
                uri={
                  tempImage.shouldDelete
                    ? null
                    : tempImage.uri
                    ? tempImage.comparison?.uri
                    : isEditingMyProfile
                    ? myProfileImage?.localUri
                    : selectedAddedContactImage?.localUri
                }
                darkModeType={darkModeType}
                theme={theme}
              />
            )}
          </View>
          {(isEditingMyProfile || selectedAddedContact.isLNURL) && (
            <View style={styles.selectFromPhotos}>
              <ThemeIcon
                colorOverride={COLORS.lightModeText}
                size={20}
                iconName={hasImage ? 'X' : 'Image'}
              />
            </View>
          )}
        </TouchableOpacity>

        <ProfileInputFields {...inputFieldsProps} />

        <CustomButton
          buttonStyles={{
            width: 'auto',
            ...CENTER,
            marginTop: 'auto',
            marginBottom: isKeyboardActive
              ? CONTENT_KEYBOARD_OFFSET
              : bottomPadding,
          }}
          actionFunction={saveChanges}
          useLoading={isSaving}
          textContent={
            hasChangedInfo
              ? fromInitialAdd
                ? t('contacts.editMyProfilePage.addContactBTN')
                : t('constants.save')
              : t('constants.back')
          }
        />
      </ScrollView>
    </View>
  );

  async function saveChanges() {
    try {
      if (
        inputs.name.length >= 30 ||
        inputs.bio.length >= 150 ||
        inputs.uniquename.length >= 30 ||
        (selectedAddedContact?.isLNURL &&
          inputs.receiveAddress.length >= 200) ||
        isAddingImage
      )
        return;

      setIsSaving(true);

      // delete or save new image
      if (tempImage.shouldDelete) {
        await deleteProfilePicture(isEditingMyProfile, selectedAddedContact);
      } else if (tempImage.uri && tempImage.comparison) {
        const areImagesTheSame = await areImagesSame(
          tempImage.comparison?.uri,
          isEditingMyProfile
            ? myProfileImage?.localUri
            : selectedAddedContactImage?.localUri,
        );
        if (!areImagesTheSame) {
          await saveProfileImage(
            tempImage,
            isEditingMyProfile,
            selectedAddedContact,
          );
        }
      }

      const uniqueName =
        isEditingMyProfile && !isFirstTimeEditing
          ? inputs.uniquename || myContact.uniqueName
          : inputs.uniquename;

      console.log(selectedAddedContact, 'tt', isEditingMyProfile);

      if (isEditingMyProfile) {
        if (
          myContact?.bio === inputs.bio &&
          myContact?.name === inputs.name &&
          myContact?.uniqueName === inputs.uniquename &&
          isFirstTimeEditing
        ) {
          navigate.goBack();
        } else {
          if (!VALID_USERNAME_REGEX.test(uniqueName)) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t(
                'contacts.editMyProfilePage.unqiueNameRegexError',
              ),
            });
            return;
          }
          if (myContact?.uniqueName != uniqueName) {
            const isFreeUniqueName = await isValidUniqueName(
              'blitzWalletUsers',
              inputs.uniquename.trim(),
            );
            if (!isFreeUniqueName) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(
                  'contacts.editMyProfilePage.usernameAlreadyExistsError',
                ),
              });
              return;
            }
          }
          toggleGlobalContactsInformation(
            {
              myProfile: {
                ...globalContactsInformation.myProfile,
                name: inputs.name.trim(),
                nameLower: inputs.name.trim().toLowerCase(),
                bio: inputs.bio,
                uniqueName: uniqueName.trim(),
                uniqueNameLower: uniqueName.trim().toLowerCase(),
                didEditProfile: true,
              },
              addedContacts: globalContactsInformation.addedContacts,
            },
            true,
          );
          navigate.goBack();
        }
      } else {
        console.log(selectedAddedContact, 'testing');
        if (fromInitialAdd) {
          let tempContact = JSON.parse(JSON.stringify(selectedAddedContact));
          tempContact.name = inputs.name.trim();
          tempContact.nameLower = inputs.name.trim().toLowerCase();
          tempContact.bio = inputs.bio;
          tempContact.isAdded = true;
          tempContact.unlookedTransactions = 0;
          if (selectedAddedContact.isLNURL) {
            tempContact.receiveAddress = inputs.receiveAddress;
          }

          let newAddedContacts = JSON.parse(
            JSON.stringify(decodedAddedContacts),
          );
          const isContactInAddedContacts = newAddedContacts.filter(
            addedContact => addedContact.uuid === tempContact.uuid,
          ).length;

          if (isContactInAddedContacts) {
            newAddedContacts = newAddedContacts.map(addedContact => {
              if (addedContact.uuid === tempContact.uuid) {
                return {
                  ...addedContact,
                  name: tempContact.name,
                  nameLower: tempContact.nameLower,
                  bio: tempContact.bio,
                  unlookedTransactions: 0,
                  isAdded: true,
                };
              } else return addedContact;
            });
          } else newAddedContacts.push(tempContact);
          console.log(tempContact, newAddedContacts);
          toggleGlobalContactsInformation(
            {
              myProfile: {
                ...globalContactsInformation.myProfile,
              },
              addedContacts: encriptMessage(
                contactsPrivateKey,
                publicKey,
                JSON.stringify(newAddedContacts),
              ),
            },
            true,
          );

          return;
        }
        if (
          selectedAddedContact?.bio === inputs.bio &&
          selectedAddedContact?.name === inputs.name &&
          selectedAddedContact?.receiveAddress === inputs.receiveAddress
        )
          navigate.goBack();
        else {
          let newAddedContacts = [...decodedAddedContacts];
          const indexOfContact = decodedAddedContacts.findIndex(
            obj => obj.uuid === selectedAddedContact.uuid,
          );

          let contact = newAddedContacts[indexOfContact];

          contact['name'] = inputs.name.trim();
          contact['nameLower'] = inputs.name.trim().toLowerCase();
          contact['bio'] = inputs.bio.trim();
          if (
            selectedAddedContact.isLNURL &&
            selectedAddedContact?.receiveAddress !== inputs.receiveAddress
          ) {
            contact['receiveAddress'] = inputs.receiveAddress.trim();
          }
          console.log(contact, newAddedContacts);

          toggleGlobalContactsInformation(
            {
              myProfile: {
                ...globalContactsInformation.myProfile,
              },
              addedContacts: encriptMessage(
                contactsPrivateKey,
                publicKey,
                JSON.stringify(newAddedContacts),
              ),
            },
            true,
          );
          navigate.goBack();
        }
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsSaving(false);
    }
  }
}

const styles = StyleSheet.create({
  hideProfileContainer: {
    flex: 1,
    alignItems: 'center',
    width: '95%',
    ...CENTER,
  },
  innerContainer: {
    flex: 1,
    width: '95%',
    ...CENTER,
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
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },

  textInput: {
    fontSize: SIZES.medium,
    padding: 10,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  textInputContainer: { width: '100%' },
  textInputContainerDescriptionText: {
    includeFontPadding: false,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',

    paddingRight: 10,
    paddingVertical: 8,
  },
  infoIcon: {
    width: 20,
    height: 20,
    marginLeft: 5,
  },
});
