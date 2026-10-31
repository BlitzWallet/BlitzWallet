import {
  AccessibilityInfo,
  StyleSheet,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  EMAIL_REGEX,
  MAX_WEB_CONTENT_WIDTH,
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
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';

import { keyboardGoBack } from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useProfileImage } from './hooks/useProfileImage';
import EditProfileTextInput from './internalComponents/editProfileTextItems';
import { areImagesSame } from './utils/imageComparison';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { KeyboardController } from 'react-native-keyboard-controller';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import { setStringAsync } from 'expo-clipboard';
import { formatDisplayName } from './utils/formatListDisplayName';
import ContactAvatar from './internalComponents/contactAvatar';

export default function EditMyProfilePage(props) {
  const navigate = useNavigation();
  const {
    decodedAddedContacts,
    toggleGlobalContactsInformation,
    globalContactsInformation,
    deleteContact,
  } = useGlobalContactsInfo();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const { t } = useTranslation();

  const pageType = props?.pageType || props.route?.params?.pageType;
  const fromSettings = props.fromSettings || props.route?.params?.fromSettings;
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

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={{ flex: 1, width: contentWidth, ...CENTER }}>
        <TopBar
          title={
            isEditingMyProfile
              ? fromSettings
                ? t('contacts.editMyProfilePage.navTitle')
                : ''
              : t('contacts.expandedContactPage.editLabel')
          }
          shouldDismissKeyboard={true}
          onBack={() => keyboardGoBack(navigate)}
          right={
            !isEditingMyProfile &&
            !selectedAddedContact?.isParentContact && (
              <IconButton
                icon="Trash2"
                label="contacts.editMyProfilePage.deleteContact"
                onPress={() =>
                  navigate.navigate('ConfirmDialog', {
                    title: t('contacts.editMyProfilePage.deleteContactTitle', {
                      name: formatDisplayName(selectedAddedContact),
                    }),
                    message: t(
                      'contacts.editMyProfilePage.deleteContactMessage',
                    ),
                    confirmLabel: t('constants.delete'),
                    cancelLabel: t('constants.cancel'),
                    onConfirm: () => deleteUser(true),
                  })
                }
              />
            )
          }
        />
        <InnerContent
          isEditingMyProfile={isEditingMyProfile}
          selectedAddedContact={selectedAddedContact}
          fromInitialAdd={props.fromInitialAdd}
          fromSettings={fromSettings}
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
  receiveAddressRef,
  selectedAddedContact,
  tokens,
  t,
}) {
  const hasLNURL = selectedAddedContact?.isLNURL;

  return (
    <>
      <EditProfileTextInput
        label={t('contacts.editMyProfilePage.nameInputDesc')}
        placeholder={t(
          'contacts.editMyProfilePage.addedContactnameInputPlaceholder',
        )}
        value={inputs.name}
        onChangeText={text => changeInputText(text, 'name')}
        onFocus={() => setIsKeyboardActive(true)}
        onBlur={() => setIsKeyboardActive(false)}
        inputRef={nameRef}
        maxLength={30}
        tokens={tokens}
        isFirst={true}
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
          tokens={tokens}
        />
      )}
    </>
  );
}

// ─── My profile nav rows ──────────────────────────────────────────────────────

function MyProfileRows({ myContact, navigate, masterInfoObject, t }) {
  const receiveCurrencyValue =
    masterInfoObject.lnurlReceiveCurrency === 'usd'
      ? t('constants.dollars_upper')
      : t('constants.bitcoin_upper');

  return (
    <ListCard style={{ width: '100%' }}>
      <ListRow
        title={t('contacts.editMyProfilePage.nameInputDesc')}
        value={myContact?.name || t('contacts.splitBill.noName')}
        trailing={'value'}
        showChevron={true}
        titleStyle={styles.rowTitle}
        onPress={() =>
          navigate.navigate('EditProfileFieldPage', { fieldKey: 'name' })
        }
      />
      <ListRow
        title={t('contacts.editMyProfilePage.uniqueNameInputDesc')}
        value={myContact?.uniqueName || ''}
        trailing={'value'}
        showChevron={true}
        titleStyle={styles.rowTitle}
        onPress={() =>
          navigate.navigate('EditProfileFieldPage', { fieldKey: 'uniquename' })
        }
      />
      <ListRow
        title={t('contacts.editMyProfilePage.bioInputDesc')}
        value={myContact?.bio || t('constants.noBioSet')}
        trailing={'value'}
        showChevron={true}
        titleStyle={styles.rowTitle}
        onPress={() =>
          navigate.navigate('EditProfileFieldPage', { fieldKey: 'bio' })
        }
      />
      <ListRow
        title={t('contacts.remotePaymentCurrencySelect.title')}
        value={receiveCurrencyValue}
        trailing={'value'}
        showChevron={true}
        titleStyle={styles.rowTitle}
        onPress={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'lnurlReceiveCurrencySelect',
          })
        }
      />
    </ListCard>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

// 44 ground disc; the glyph morphs to a check for 1.5 s and screen readers
// hear "Copied" (OQ-52). No toast.
function CopyDisc({ value, label }) {
  const { tokens } = useGlobalThemeContext();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await setStringAsync(value);
      setCopied(true);
      AccessibilityInfo.announceForAccessibility(
        t('toastmessages.confirmCopy'),
      );
    } catch {
      AccessibilityInfo.announceForAccessibility(t('toastmessages.failedCopy'));
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={handleCopy}
      style={[styles.copyDisc, { backgroundColor: tokens.ground }]}
    >
      <ThemeIcon redesign size={20} iconName={copied ? 'Check' : 'Copy'} />
    </TouchableOpacity>
  );
}

// ─── InnerContent ─────────────────────────────────────────────────────────────

function InnerContent({
  isEditingMyProfile,
  selectedAddedContact,
  fromInitialAdd,
  fromSettings,
}) {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { cache, refreshCacheObject } = useImageCache();
  const { backgroundOffset, tokens } = GetThemeColors();
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

  // Props for ProfileInputFields (contact path)
  const inputFieldsProps = {
    inputs,
    changeInputText,
    setIsKeyboardActive,
    nameRef,
    receiveAddressRef,
    selectedAddedContact,
    tokens,
    t,
  };

  // ── myProfile path ──────────────────────────────────────────────────────────
  if (isEditingMyProfile) {
    return (
      <View
        style={[
          styles.innerContainer,
          fromSettings && { maxWidth: MAX_WEB_CONTENT_WIDTH, width: '100%' },
        ]}
      >
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            width: '100%',
            alignItems: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile image */}
          <TouchableOpacity
            activeOpacity={!isAddingImage ? 0.2 : 1}
            onPress={async () => {
              if (isAddingImage) return;
              if (KeyboardController.isVisible()) {
                await KeyboardController.dismiss();
                await new Promise(resolve => setTimeout(resolve, 250));
              }
              if (!hasImage) {
                addProfilePicture();
                return;
              }
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'ProfilePhotoModal',
                addPhoto: () => addProfilePicture(),
                deletePhoto: handleDeleteProfilePicture,
                hasImage: hasImage,
              });
            }}
          >
            <View style={styles.profileImage}>
              {isAddingImage ? (
                <FullLoadingScreen showText={false} />
              ) : (
                <ContactAvatar
                  name={myContact.name || myContact?.uniqueName}
                  seed={myContact.uuid}
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
                  size={96}
                  fontSize={96 / 3}
                />
              )}
            </View>
            <View
              style={[
                styles.selectFromPhotos,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.ground,
                },
              ]}
            >
              <ThemeIcon
                redesign
                size={18}
                iconName={hasImage ? 'X' : 'Image'}
              />
            </View>
          </TouchableOpacity>

          <SectionHeader
            first={true}
            style={styles.sectionHeader}
            title={t('contacts.editMyProfilePage.aboutYou')}
          />
          <MyProfileRows
            myContact={myContact}
            navigate={navigate}
            masterInfoObject={masterInfoObject}
            t={t}
          />
          <SectionHeader
            style={styles.sectionHeader}
            title={t('contacts.editMyProfilePage.share')}
          />

          <ListCard style={{ width: '100%' }}>
            {[
              {
                key: 'lnAddress',
                title: t('contacts.editMyProfilePage.lightningAddress'),
                value: `${myContact.uniqueName}@blitzwalletapp.com`,
                label: 'contacts.editMyProfilePage.copyLightningAddress',
              },
              {
                key: 'tips',
                title: t('contacts.editMyProfilePage.tipPage'),
                value: `blitzwalletapp.com/${myContact.uniqueName}`,
                label: 'contacts.editMyProfilePage.copyTipPage',
              },
            ].map(item => (
              <ListRow
                key={item.key}
                title={item.title}
                sub={item.value}
                minHeight={72}
                trailing={<CopyDisc value={item.value} label={item.label} />}
                titleStyle={{ ...styles.shareTitle, color: tokens.muted }}
                subStyle={{ ...styles.shareSub, color: tokens.ink }}
                subLines={1}
              />
            ))}
          </ListCard>

          <CustomButton
            buttonStyles={{
              marginTop: 'auto',
              marginBottom: bottomPadding,
            }}
            actionFunction={saveChanges}
            useLoading={isSaving}
            textContent={
              hasChangedInfo ? t('constants.save') : t('constants.back')
            }
            size={'regular'}
            tone={hasChangedInfo ? undefined : 'secondary'}
          />
        </CustomScrollView>
      </View>
    );
  }

  // ── Contact path (PeopleAdd/People.dc.html "Edit contact") ──────────────────
  const canEditPhoto = !!selectedAddedContact.isLNURL;
  return (
    <View
      style={[
        styles.innerContainer,
        fromSettings && { maxWidth: MAX_WEB_CONTENT_WIDTH, width: '100%' },
      ]}
    >
      <CustomScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contactScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile image */}
        <TouchableOpacity
          style={styles.contactPhoto}
          activeOpacity={canEditPhoto && !isAddingImage ? 0.2 : 1}
          onPress={async () => {
            if (!canEditPhoto) return;
            if (isAddingImage) return;
            if (KeyboardController.isVisible()) {
              await KeyboardController.dismiss();
              await new Promise(resolve => setTimeout(resolve, 250));
            }
            if (!hasImage) {
              addProfilePicture(isEditingMyProfile, selectedAddedContact);
              return;
            }
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'ProfilePhotoModal',
              addPhoto: () =>
                addProfilePicture(isEditingMyProfile, selectedAddedContact),
              deletePhoto: handleDeleteProfilePicture,
              hasImage: hasImage,
            });
          }}
        >
          <View
            style={[styles.profileImage, { backgroundColor: backgroundOffset }]}
          >
            {isAddingImage ? (
              <FullLoadingScreen showText={false} />
            ) : (
              <ContactAvatar
                name={
                  selectedAddedContact?.name || selectedAddedContact?.uniqueName
                }
                seed={selectedAddedContact?.uuid}
                updated={
                  tempImage.shouldDelete
                    ? null
                    : tempImage.uri
                    ? tempImage.comparison?.updated
                    : selectedAddedContactImage?.updated
                }
                uri={
                  tempImage.shouldDelete
                    ? null
                    : tempImage.uri
                    ? tempImage.comparison?.uri
                    : selectedAddedContactImage?.localUri
                }
                size={96}
                fontSize={96 / 3}
              />
            )}
          </View>
          {canEditPhoto && (
            <View
              style={[
                styles.selectFromPhotos,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.ground,
                },
              ]}
            >
              <ThemeIcon
                redesign
                size={18}
                iconName={hasImage ? 'X' : 'Camera'}
              />
            </View>
          )}
        </TouchableOpacity>

        <ProfileInputFields {...inputFieldsProps} />

        <CustomButton
          buttonStyles={{
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
          size={'regular'}
        />
      </CustomScrollView>
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
        // Bio is not editable for contacts, so it is not validated here.
        inputs.name.length >= 30 ||
        inputs.uniquename.length >= 30 ||
        (selectedAddedContact?.isLNURL && inputs.receiveAddress.length >= 200)
      )
        return;

      if (!VALID_NAME_BIO_REGEX.test(inputs.name)) {
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
    width: '100%',
  },
  contactScrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  contactPhoto: {
    alignSelf: 'center',
    marginTop: 4,
  },
  sectionHeader: {
    alignSelf: 'flex-start',
  },
  // 44 disc + 3 px ground ring, hanging 6 off the avatar corner (D157).
  selectFromPhotos: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.darkModeText,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -9,
    bottom: -9,
    zIndex: 2,
  },
  profileImage: {
    width: 96,
    height: 96,
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
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    opacity: 0.55,
    flexShrink: 1,
    marginLeft: 10,
  },
  navRowValue: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    marginRight: 'auto',
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
  rowTitle: { fontSize: 15, lineHeight: 22 },
  shareTitle: { fontSize: 13, lineHeight: 19 },
  shareSub: { fontSize: 15, lineHeight: 22 },
  shareHint: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginHorizontal: 4,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  copyDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
