import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  ICONS,
  SIZES,
  VALID_USERNAME_REGEX,
} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {encriptMessage} from '../../../../functions/messaging/encodingAndDecodingMessages';

import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {isValidUniqueName} from '../../../../../db';

import CustomButton from '../../../../functions/CustomElements/button';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import {getImageFromLibrary} from '../../../../functions/imagePickerWrapper';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useKeysContext} from '../../../../../context-store/keys';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {keyboardGoBack} from '../../../../functions/customNavigation';
import {useTranslation} from 'react-i18next';
import * as ImageManipulator from 'expo-image-manipulator';
import ContactProfileImage from './internalComponents/profileImage';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {
  deleteDatabaseImage,
  setDatabaseIMG,
} from '../../../../../db/photoStorage';
import {useImageCache} from '../../../../../context-store/imageCache';
import {useContactImage} from '../../../../hooks/useContactImage';

export default function EditMyProfilePage(props) {
  const navigate = useNavigation();
  const {
    decodedAddedContacts,
    toggleGlobalContactsInformation,
    globalContactsInformation,
  } = useGlobalContacts();

  const {t} = useTranslation();

  const pageType = props?.pageType || props.route?.params?.pageType;
  const fromSettings = props.fromSettings || props.route?.params?.fromSettings;

  const isEditingMyProfile = pageType.toLowerCase() === 'myprofile';
  const providedContact =
    !isEditingMyProfile &&
    (props?.selectedAddedContact || props.route?.params?.selectedAddedContact);
  const myContact = globalContactsInformation.myProfile;
  const isFirstTimeEditing = myContact.didEditProfile;

  const [selectedAddedContact, setSelectedAddedContact] = useState(
    props.fromInitialAdd
      ? providedContact
      : decodedAddedContacts.find(
          contact => contact.uuid === providedContact?.uuid,
        ),
  );

  useEffect(() => {
    if (props.fromInitialAdd) {
      setSelectedAddedContact(providedContact);
    } else {
      const contact = decodedAddedContacts.find(
        contact => contact.uuid === providedContact.uuid,
      );
      setSelectedAddedContact(contact);
    }
  }, [props.fromInitialAdd, providedContact, decodedAddedContacts]);
  useHandleBackPressNew();

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={fromSettings ? t('settings.editcontactprofile.text1') : ''}
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
      />
      <InnerContent
        isEditingMyProfile={isEditingMyProfile}
        selectedAddedContact={selectedAddedContact}
        setSelectedAddedContact={setSelectedAddedContact}
        fromInitialAdd={props.fromInitialAdd}
        fromSettings={fromSettings}
      />
    </CustomKeyboardAvoidingView>
  );
}

function InnerContent({
  isEditingMyProfile,
  selectedAddedContact,
  setSelectedAddedContact,
  fromInitialAdd,
  fromSettings,
}) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {cache, refreshCache, removeProfileImageFromCache} = useImageCache();
  const {backgroundOffset, textInputColor, textInputBackground, textColor} =
    GetThemeColors();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
  } = useGlobalContacts();
  const {t} = useTranslation();
  const [isAddingImage, setIsAddingImage] = useState(false);

  const nameRef = useRef(null);
  const uniquenameRef = useRef(null);
  const bioRef = useRef(null);
  const receiveAddressRef = useRef(null);
  const myContact = globalContactsInformation.myProfile;

  const myContactName = myContact?.name;
  const myContactBio = myContact?.bio;
  const myContactUniqueName = myContact?.uniqueName;
  const isFirstTimeEditing = myContact.didEditProfile;

  const selectedAddedContactName = selectedAddedContact?.name;
  const selectedAddedContactBio = selectedAddedContact?.bio;
  const selectedAddedContactUniqueName = selectedAddedContact?.uniqueName;
  const selectedAddedContactReceiveAddress =
    selectedAddedContact?.receiveAddress;

  const insets = useSafeAreaInsets();
  const [inputs, setInputs] = useState({
    name: '',
    bio: '',
    uniquename: '',
    receiveAddress: '',
  });
  const [hasImage, setHasImage] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const paddingBottom = Platform.select({
    ios: insets.bottom,
    android: CONTENT_KEYBOARD_OFFSET,
  });

  const navigate = useNavigation();

  function changeInputText(text, type) {
    setInputs(prev => {
      return {...prev, [type]: text};
    });
  }

  useEffect(() => {
    changeInputText(
      isFirstTimeEditing
        ? isEditingMyProfile
          ? myContactName || ''
          : selectedAddedContactName || ''
        : '',
      'name',
    );
    changeInputText(
      isFirstTimeEditing
        ? isEditingMyProfile
          ? myContactBio || ''
          : selectedAddedContactBio || ''
        : '',
      'bio',
    );
    changeInputText(
      isFirstTimeEditing
        ? isEditingMyProfile
          ? myContactUniqueName || ''
          : selectedAddedContactUniqueName || ''
        : '',
      'uniquename',
    );
    changeInputText(selectedAddedContactReceiveAddress || '', 'receiveAddress');
  }, [
    isEditingMyProfile,
    myContactName,
    myContactBio,
    myContactUniqueName,
    selectedAddedContactName,
    selectedAddedContactBio,
    selectedAddedContactUniqueName,
  ]);

  const myProfileImage = cache[myContact?.uuid];
  const selectedAddedContactImage = useContactImage(selectedAddedContact?.uuid);

  return (
    <View style={styles.innerContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          width: fromSettings ? INSET_WINDOW_WIDTH : '100%',
          ...CENTER,
        }}>
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
              addProfilePicture();
              return;
            }
            navigate.navigate('AddOrDeleteContactImage', {
              addPhoto: addProfilePicture,
              deletePhoto: deleteProfilePicture,
              hasImage: hasImage,
            });
          }}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundOffset,
              },
            ]}>
            {isAddingImage ? (
              <FullLoadingScreen showText={false} />
            ) : (
              <ContactProfileImage
                updated={
                  isEditingMyProfile
                    ? myProfileImage?.updated
                    : selectedAddedContact.isLNURL
                    ? new Date().toISOString()
                    : selectedAddedContactImage?.updated
                }
                uri={
                  isEditingMyProfile
                    ? myProfileImage?.localUri
                    : selectedAddedContact.isLNURL
                    ? selectedAddedContact.profileImage
                    : selectedAddedContactImage?.localUri
                }
                darkModeType={darkModeType}
                theme={theme}
                setHasImage={setHasImage}
              />
            )}
          </View>
          {(isEditingMyProfile || selectedAddedContact.isLNURL) && (
            <View style={styles.selectFromPhotos}>
              <Image
                source={hasImage ? ICONS.xSmallIconBlack : ICONS.ImagesIconDark}
                style={{width: 20, height: 20}}
              />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textInputContainer}
          activeOpacity={1}
          onPress={() => {
            nameRef.current.focus();
          }}>
          <ThemeText
            styles={styles.textInputContainerDescriptionText}
            content={t('settings.editcontactprofile.text2')}
          />
          <TextInput
            keyboardAppearance={theme ? 'dark' : 'light'}
            placeholder={t('settings.editcontactprofile.text3')}
            placeholderTextColor={COLORS.opaicityGray}
            ref={nameRef}
            style={[
              styles.textInput,
              {
                backgroundColor: textInputBackground,
                color:
                  inputs.name.length < 30
                    ? textInputColor
                    : theme && darkModeType
                    ? textInputColor
                    : COLORS.cancelRed,
              },
            ]}
            value={inputs.name || ''}
            onChangeText={text => changeInputText(text, 'name')}
            onBlur={() => {
              setIsKeyboardActive(false);
            }}
            onFocus={() => {
              setIsKeyboardActive(true);
            }}
          />
          <ThemeText
            styles={{
              textAlign: 'right',
              color:
                inputs.name.length < 30
                  ? textColor
                  : theme && darkModeType
                  ? textColor
                  : COLORS.cancelRed,
            }}
            content={`${inputs.name.length} / ${30}`}
          />
        </TouchableOpacity>
        {selectedAddedContact?.isLNURL && (
          <TouchableOpacity
            style={styles.textInputContainer}
            activeOpacity={1}
            onPress={() => {
              receiveAddressRef.current.focus();
            }}>
            <ThemeText
              styles={styles.textInputContainerDescriptionText}
              content={t('settings.editcontactprofile.text4')}
            />
            <TextInput
              keyboardAppearance={theme ? 'dark' : 'light'}
              placeholderTextColor={COLORS.opaicityGray}
              ref={receiveAddressRef}
              style={[
                styles.textInput,
                {
                  backgroundColor: textInputBackground,
                  color:
                    inputs.receiveAddress.length < 30
                      ? textInputColor
                      : theme && darkModeType
                      ? textInputColor
                      : COLORS.cancelRed,
                },
              ]}
              value={inputs.receiveAddress || ''}
              placeholder={t('settings.editcontactprofile.text5')}
              onChangeText={text => changeInputText(text, 'receiveAddress')}
              onBlur={() => {
                setIsKeyboardActive(false);
              }}
              onFocus={() => {
                setIsKeyboardActive(true);
              }}
            />

            <ThemeText
              styles={{
                textAlign: 'right',
                color:
                  inputs.receiveAddress.length < 60
                    ? textColor
                    : theme && darkModeType
                    ? textColor
                    : COLORS.cancelRed,
              }}
              content={`${inputs.receiveAddress.length} / ${60}`}
            />
          </TouchableOpacity>
        )}
        {isEditingMyProfile && (
          <TouchableOpacity
            style={styles.textInputContainer}
            activeOpacity={1}
            onPress={() => {
              uniquenameRef.current.focus();
            }}>
            <ThemeText
              styles={styles.textInputContainerDescriptionText}
              content={t('settings.editcontactprofile.text6')}
            />
            <TextInput
              keyboardAppearance={theme ? 'dark' : 'light'}
              placeholderTextColor={COLORS.opaicityGray}
              ref={uniquenameRef}
              style={[
                styles.textInput,
                {
                  backgroundColor: textInputBackground,
                  color:
                    inputs.uniquename.length < 30
                      ? textInputColor
                      : theme && darkModeType
                      ? textInputColor
                      : COLORS.cancelRed,
                },
              ]}
              value={inputs.uniquename || ''}
              placeholder={myContact.uniqueName}
              onChangeText={text => changeInputText(text, 'uniquename')}
              onBlur={() => {
                setIsKeyboardActive(false);
              }}
              onFocus={() => {
                setIsKeyboardActive(true);
              }}
            />

            <ThemeText
              styles={{
                textAlign: 'right',
                color:
                  inputs.uniquename.length < 30
                    ? textColor
                    : theme && darkModeType
                    ? textColor
                    : COLORS.cancelRed,
              }}
              content={`${inputs.uniquename.length} / ${30}`}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.textInputContainer}
          activeOpacity={1}
          onPress={() => {
            bioRef.current.focus();
          }}>
          <ThemeText
            styles={styles.textInputContainerDescriptionText}
            content={t('settings.editcontactprofile.text7')}
          />
          <TextInput
            keyboardAppearance={theme ? 'dark' : 'light'}
            placeholder={t('settings.editcontactprofile.text8')}
            placeholderTextColor={COLORS.opaicityGray}
            ref={bioRef}
            editable
            multiline
            textAlignVertical="top"
            style={[
              styles.textInput,
              {
                minHeight: 60,
                maxHeight: 100,
                backgroundColor: textInputBackground,
                color:
                  inputs.bio.length < 150
                    ? textInputColor
                    : theme && darkModeType
                    ? textInputColor
                    : COLORS.cancelRed,
              },
            ]}
            value={inputs.bio || ''}
            onChangeText={text => changeInputText(text, 'bio')}
            onBlur={() => {
              setIsKeyboardActive(false);
            }}
            onFocus={() => {
              setIsKeyboardActive(true);
            }}
          />

          <ThemeText
            styles={{
              textAlign: 'right',
              color:
                inputs.bio.length < 150
                  ? textColor
                  : theme && darkModeType
                  ? textColor
                  : COLORS.cancelRed,
            }}
            content={`${inputs.bio.length} / ${150}`}
          />
        </TouchableOpacity>
      </ScrollView>

      <CustomButton
        buttonStyles={{
          width: 'auto',
          ...CENTER,
          marginTop: 10,
          marginBottom: isKeyboardActive
            ? CONTENT_KEYBOARD_OFFSET
            : paddingBottom,
        }}
        actionFunction={saveChanges}
        textContent={
          fromInitialAdd
            ? t('settings.editcontactprofile.text9')
            : t('constants.save')
        }
      />
    </View>
  );
  async function saveChanges() {
    if (
      inputs.name.length > 30 ||
      inputs.bio.length > 150 ||
      inputs.uniquename.length > 30 ||
      (selectedAddedContact?.isLNURL && inputs.receiveAddress.length > 60)
    )
      return;

    const uniqueName =
      isEditingMyProfile && !isFirstTimeEditing
        ? inputs.uniquename || myContact.uniqueName
        : inputs.uniquename;

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
            errorMessage: t('settings.editcontactprofile.text10'),
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
              errorMessage: t('settings.editcontactprofile.text11'),
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
            // unaddedContacts:
            //   globalContactsInformation.unaddedContacts,
          },
          true,
        );
        navigate.goBack();
      }
    } else {
      if (fromInitialAdd) {
        let tempContact = JSON.parse(JSON.stringify(selectedAddedContact));
        tempContact.name = inputs.name.trim();
        tempContact.nameLower = inputs.name.trim().toLowerCase();
        tempContact.bio = inputs.bio;
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
                name: inputs.name,
                nameLower: inputs.name.toLowerCase(),
                bio: inputs.bio,
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
            // unaddedContacts:
            //   globalContactsInformation.unaddedContacts,
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
            // unaddedContacts:
            //   globalContactsInformation.unaddedContacts,
          },
          true,
        );
        navigate.goBack();
      }
    }
  }

  async function addProfilePicture() {
    const imagePickerResponse = await getImageFromLibrary({quality: 1});
    const {didRun, error, imgURL} = imagePickerResponse;
    if (!didRun) return;
    if (error) {
      navigate.navigate('ErrorScreen', {errorMessage: error});
      return;
    }

    if (isEditingMyProfile) {
      const response = await uploadProfileImage({imgURL: imgURL});
      if (!response) return;
      toggleGlobalContactsInformation(
        {
          myProfile: {
            ...globalContactsInformation.myProfile,
            hasProfileImage: true,
          },

          addedContacts: globalContactsInformation.addedContacts,
        },
        true,
      );
      return;
    }

    if (fromInitialAdd) {
      setSelectedAddedContact(prev => {
        return {...prev, profileImage: imgURL.uri};
      });
      return;
    }

    let tempSelectedContact = JSON.parse(JSON.stringify(selectedAddedContact));
    tempSelectedContact['profileImage'] = imgURL.uri;

    const newContacts = [
      ...JSON.parse(JSON.stringify(decodedAddedContacts)),
    ].map(contact => {
      if (contact.uuid === selectedAddedContact.uuid) {
        return {...contact, profileImage: imgURL.uri};
      } else return contact;
    });

    const em = encriptMessage(
      contactsPrivateKey,
      publicKey,
      JSON.stringify(newContacts),
    );

    toggleGlobalContactsInformation(
      {
        myProfile: {
          ...globalContactsInformation.myProfile,
        },
        addedContacts: em,
      },
      true,
    );
  }
  async function uploadProfileImage({imgURL, removeImage}) {
    try {
      setIsAddingImage(true);
      if (!removeImage) {
        const resized = ImageManipulator.ImageManipulator.manipulate(
          imgURL.uri,
        ).resize({width: 350});
        const image = await resized.renderAsync();
        const savedImage = await image.saveAsync({
          compress: 0.4,
          format: ImageManipulator.SaveFormat.WEBP,
        });

        const response = await setDatabaseIMG(
          globalContactsInformation.myProfile.uuid,
          {uri: savedImage.uri},
        );

        if (response) {
          await refreshCache(
            globalContactsInformation.myProfile.uuid,
            response,
          );
          return true;
        } else throw new Error('Unable to save image');
      } else {
        await deleteDatabaseImage(globalContactsInformation.myProfile.uuid);
        await removeProfileImageFromCache(
          globalContactsInformation.myProfile.uuid,
        );
        return true;
      }
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
      return false;
    } finally {
      setIsAddingImage(false);
    }
  }
  async function deleteProfilePicture() {
    try {
      if (isEditingMyProfile) {
        const response = await uploadProfileImage({removeImage: true});
        console.log(response);
        if (!response) return;
        toggleGlobalContactsInformation(
          {
            myProfile: {
              ...globalContactsInformation.myProfile,
              hasProfileImage: false,
            },

            addedContacts: globalContactsInformation.addedContacts,
          },
          true,
        );
        return;
      }
      if (fromInitialAdd) {
        setSelectedAddedContact(prev => {
          return {...prev, profileImage: null};
        });

        return;
      }
      const newContacts = [
        ...JSON.parse(JSON.stringify(decodedAddedContacts)),
      ].map(contact => {
        if (contact.uuid === selectedAddedContact.uuid) {
          return {...contact, profileImage: null};
        } else return contact;
      });

      const em = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(newContacts),
      );

      toggleGlobalContactsInformation(
        {
          myProfile: {
            ...globalContactsInformation.myProfile,
          },
          addedContacts: em,
        },
        true,
      );
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.editcontactprofile.text12'),
      });
      console.log(err);
    }
  }
}

const styles = StyleSheet.create({
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
  },
  textInputContainer: {width: '100%'},
  textInputContainerDescriptionText: {
    marginBottom: 5,
  },
});
