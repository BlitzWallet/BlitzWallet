import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  EMAIL_REGEX,
  SIZES,
  VALID_NAME_BIO_REGEX,
} from '../../../../constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useEffect, useState, useRef, useCallback } from 'react';
import { encriptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { isValidUniqueName } from '../../../../../db';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useKeysContext } from '../../../../../context-store/keys';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';

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
import { useGlobalContextProvider } from '../../../../../context-store/context';

export default function EditMyProfilePage(props) {
  const navigate = useNavigation();
  const {
    decodedAddedContacts,
    toggleGlobalContactsInformation,
    globalContactsInformation,
    deleteContact,
  } = useGlobalContactsInfo();

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

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isFirstTimeEditing || !isEditingMyProfile) return;
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
      };
    }, [
      isFirstTimeEditing,
      globalContactsInformation,
      toggleGlobalContactsInformation,
      isEditingMyProfile,
    ]),
  );

  const selectedAddedContact = props.fromInitialAdd
    ? providedContact
    : decodedAddedContacts.find(
        contact => contact.uuid === providedContact?.uuid,
      );

  const deleteUser = shouldDelete => {
    if (shouldDelete) {
      deleteContact(selectedAddedContact);
      navigate.popTo('HomeAdmin');
    }
  };

  if (hideProfileImage) {
    return (
      <View style={{ flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER }}>
        <InnerContent
          isEditingMyProfile={isEditingMyProfile}
          selectedAddedContact={selectedAddedContact}
          fromInitialAdd={props.fromInitialAdd}
          fromSettings={fromSettings}
          hideProfileImage={true}
        />
      </View>
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
        customBackFunction={() => keyboardGoBack(navigate)}
        iconNew="Trash2"
        leftImageFunction={() =>
          navigate.navigate('ConfirmActionPage', {
            confirmMessage: t('contacts.editMyProfilePage.deleteWarning'),
            confirmFunction: () => deleteUser(true),
            cancelFunction: () => deleteUser(false),
          })
        }
        showLeftImage={!isEditingMyProfile}
      />
      <View
        style={{
          flex: 1,
          width: fromSettings ? '100%' : INSET_WINDOW_WIDTH,
          ...CENTER,
        }}
      >
        <InnerContent
          isEditingMyProfile={isEditingMyProfile}
          selectedAddedContact={selectedAddedContact}
          fromInitialAdd={props.fromInitialAdd}
          fromSettings={fromSettings}
          hideProfileImage={false}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

// ─── Contact-mode input fields ───────────────────────────────────

function ProfileInputFields({
  inputs,
  changeInputText,
  setIsKeyboardActive,
  nameRef,
  bioRef,
  receiveAddressRef,
  isEditingMyProfile,
  selectedAddedContact,
  theme,
  darkModeType,
  textInputColor,
  textInputBackground,
  textColor,
  navigate,
  t,
}) {
  const hasLNURL = !isEditingMyProfile && selectedAddedContact?.isLNURL;
  const bioIsLast = !isEditingMyProfile;

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
        showDivider={true}
      />

      {hasLNURL && (
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
          showDivider={true}
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
        showDivider={!bioIsLast}
      />
    </>
  );
}

// ─── My profile nav rows ──────────────────────────────────────────────────────

function MyProfileRows({
  myContact,
  backgroundOffset,
  textColor,
  navigate,
  masterInfoObject,
  t,
}) {
  const receiveCurrencyValue =
    masterInfoObject.lnurlReceiveCurrency === 'usd'
      ? t('constants.dollars_upper')
      : t('constants.bitcoin_upper');

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: backgroundOffset, marginTop: 12 },
      ]}
    >
      {/* Name */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigate.navigate('EditProfileFieldPage', { fieldKey: 'name' })
        }
        style={styles.navRow}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.navRowValue}
          content={t('contacts.editMyProfilePage.nameInputDesc')}
        />
        <ThemeText
          styles={styles.navRowLabel}
          content={myContact?.name || t('contacts.splitBill.noName')}
          CustomNumberOfLines={1}
          CustomEllipsizeMode="tail"
        />
        <ThemeIcon iconName="ChevronRight" size={16} />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: textColor }]} />

      {/* Username */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigate.navigate('EditProfileFieldPage', { fieldKey: 'uniquename' })
        }
        style={styles.navRow}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.navRowValue}
          content={t('contacts.editMyProfilePage.uniqueNameInputDesc')}
        />
        <ThemeText
          styles={styles.navRowLabel}
          content={myContact?.uniqueName || ''}
          CustomNumberOfLines={1}
          CustomEllipsizeMode="tail"
        />
        <ThemeIcon iconName="ChevronRight" size={16} />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: textColor }]} />

      {/* Bio */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigate.navigate('EditProfileFieldPage', { fieldKey: 'bio' })
        }
        style={styles.navRow}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.navRowValue}
          content={t('contacts.editMyProfilePage.bioInputDesc')}
        />
        <ThemeText
          styles={styles.navRowLabel}
          content={myContact?.bio || t('constants.noBioSet')}
          CustomNumberOfLines={1}
          CustomEllipsizeMode="tail"
        />
        <ThemeIcon iconName="ChevronRight" size={16} />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: textColor }]} />

      {/* Lightning Address */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'lnurlReceiveCurrencySelect',
          })
        }
        style={styles.navRow}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.navRowValue}
          content={t('contacts.editMyProfilePage.lightningAddress')}
        />
        <ThemeText styles={styles.navRowLabel} content={receiveCurrencyValue} />
        <ThemeIcon iconName="ChevronRight" size={16} />
      </TouchableOpacity>
    </View>
  );
}

// ─── InnerContent ─────────────────────────────────────────────────────────────

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
  const { masterInfoObject } = useGlobalContextProvider();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
  } = useGlobalContactsInfo();
  const { t } = useTranslation();
  const {
    isAddingImage,
    deleteProfilePicture,
    getProfileImage,
    saveProfileImage,
  } = useProfileImage();

  // Contact-mode refs (unused in myProfile path but kept for contact path)
  const nameRef = useRef(null);
  const bioRef = useRef(null);
  const receiveAddressRef = useRef(null);
  const didCallImagePicker = useRef(null);
  const myContact = globalContactsInformation.myProfile;

  const selectedAddedContactName = selectedAddedContact?.name || '';
  const selectedAddedContactBio = selectedAddedContact?.bio || '';
  const selectedAddedContactUniqueName = selectedAddedContact?.uniqueName || '';
  const selectedAddedContactReceiveAddress =
    selectedAddedContact?.receiveAddress || '';

  const [isSaving, setIsSaving] = useState(false);
  const [inputs, setInputs] = useState(() => ({
    name: selectedAddedContactName || '',
    bio: selectedAddedContactBio || '',
    uniquename: selectedAddedContactUniqueName || '',
    receiveAddress: selectedAddedContactReceiveAddress || '',
  }));

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

  // For contact path: full change detection. For myProfile: image only.
  const hasChangedInfo = isEditingMyProfile
    ? tempImage.uri || tempImage.shouldDelete
    : selectedAddedContactName !== inputs.name ||
      selectedAddedContactBio !== inputs.bio ||
      selectedAddedContactUniqueName !== inputs.uniquename ||
      selectedAddedContactReceiveAddress !== inputs.receiveAddress ||
      fromInitialAdd ||
      tempImage.uri ||
      tempImage.shouldDelete;

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
    bioRef,
    receiveAddressRef,
    isEditingMyProfile,
    selectedAddedContact,
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
          <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
            <ProfileInputFields {...inputFieldsProps} />
          </View>
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

  // ── myProfile path ──────────────────────────────────────────────────────────
  if (isEditingMyProfile) {
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile image */}
          <TouchableOpacity
            activeOpacity={!isAddingImage ? 0.2 : 1}
            onPress={async () => {
              if (isAddingImage) return;
              if (Keyboard.isVisible()) {
                Keyboard.dismiss();
                await new Promise(resolve => setTimeout(resolve, 250));
              }
              if (!hasImage) {
                addProfilePicture();
                return;
              }
              navigate.navigate('AddOrDeleteContactImage', {
                addPhoto: () => addProfilePicture(),
                deletePhoto: handleDeleteProfilePicture,
                hasImage: hasImage,
              });
            }}
          >
            <View
              style={[
                styles.profileImage,
                { backgroundColor: backgroundOffset },
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
                      : myProfileImage?.updated
                  }
                  uri={
                    tempImage.shouldDelete
                      ? null
                      : tempImage.uri
                      ? tempImage.comparison?.uri
                      : myProfileImage?.localUri
                  }
                  darkModeType={darkModeType}
                  theme={theme}
                />
              )}
            </View>
            <View style={styles.selectFromPhotos}>
              <ThemeIcon
                colorOverride={COLORS.lightModeText}
                size={20}
                iconName={hasImage ? 'X' : 'Image'}
              />
            </View>
          </TouchableOpacity>

          <ThemeText
            styles={styles.sectionHeader}
            content={t('contacts.editMyProfilePage.aboutYou')}
          />

          <MyProfileRows
            myContact={myContact}
            backgroundOffset={backgroundOffset}
            textColor={textColor}
            navigate={navigate}
            masterInfoObject={masterInfoObject}
            t={t}
          />

          <CustomButton
            buttonStyles={{
              width: '100%',
              ...CENTER,
              marginTop: 'auto',
              marginBottom: bottomPadding,
            }}
            actionFunction={saveChanges}
            useLoading={isSaving}
            textContent={
              hasChangedInfo ? t('constants.save') : t('constants.back')
            }
          />
        </ScrollView>
      </View>
    );
  }

  // ── Contact path (unchanged) ────────────────────────────────────────────────
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile image */}
        <TouchableOpacity
          activeOpacity={
            (isEditingMyProfile || selectedAddedContact.isLNURL) &&
            !isAddingImage
              ? 0.2
              : 1
          }
          onPress={async () => {
            if (!isEditingMyProfile && !selectedAddedContact.isLNURL) return;
            if (isAddingImage) return;
            if (Keyboard.isVisible()) {
              Keyboard.dismiss();
              await new Promise(resolve => setTimeout(resolve, 250));
            }
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

        {/* Unified settings card */}
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <ProfileInputFields {...inputFieldsProps} />
        </View>

        <CustomButton
          buttonStyles={{
            width: '100%',
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
      if (isAddingImage) return;

      setIsSaving(true);

      // ── myProfile: image only ─────────────────────────────────────────────
      if (isEditingMyProfile) {
        if (tempImage.shouldDelete) {
          await deleteProfilePicture(true, null);
        } else if (tempImage.uri && tempImage.comparison) {
          const areImagesTheSame = await areImagesSame(
            tempImage.comparison?.uri,
            myProfileImage?.localUri,
          );
          if (!areImagesTheSame) {
            await saveProfileImage(tempImage, true, null);
          }
        }
        keyboardGoBack(navigate);
        return;
      }

      // ── Contact path (unchanged) ──────────────────────────────────────────
      if (
        inputs.name.length >= 30 ||
        inputs.bio.length >= 150 ||
        inputs.uniquename.length >= 30 ||
        (selectedAddedContact?.isLNURL && inputs.receiveAddress.length >= 200)
      )
        return;

      if (
        !VALID_NAME_BIO_REGEX.test(inputs.name) ||
        !VALID_NAME_BIO_REGEX.test(inputs.bio)
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('contacts.editMyProfilePage.invalidCharactersError'),
        });
        return;
      }

      if (
        selectedAddedContact?.isLNURL &&
        !EMAIL_REGEX.test(inputs.receiveAddress.trim())
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'contacts.editMyProfilePage.invalidReceiveAddressError',
          ),
        });
        return;
      }

      if (tempImage.shouldDelete) {
        await deleteProfilePicture(false, selectedAddedContact);
      } else if (tempImage.uri && tempImage.comparison) {
        const areImagesTheSame = await areImagesSame(
          tempImage.comparison?.uri,
          selectedAddedContactImage?.localUri,
        );
        if (!areImagesTheSame) {
          await saveProfileImage(tempImage, false, selectedAddedContact);
        }
      }

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

        let newAddedContacts = JSON.parse(JSON.stringify(decodedAddedContacts));
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
      ) {
        keyboardGoBack(navigate);
      } else {
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
        keyboardGoBack(navigate);
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
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  innerContainer: {
    flex: 1,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.55,
    alignSelf: 'flex-start',
    marginTop: 24,
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
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  navRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 60,
  },
  navRowLabelLine: {
    marginRight: 'auto',
    flexShrink: 1,
  },
  navRowLabel: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.55,
    flexShrink: 1,
    marginLeft: 10,
  },
  navRowValue: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    marginRight: 'auto',
    flexShrink: 1,
  },
  copyLinkRow: {
    paddingVertical: 8,
  },
  copyLinkText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.55,
    flex: 1,
    marginRight: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    opacity: 0.15,
  },
});
