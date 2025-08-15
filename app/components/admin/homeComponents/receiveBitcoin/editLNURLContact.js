import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import {ThemeText} from '../../../../functions/CustomElements';
import ContactProfileImage from '../contacts/internalComponents/profileImage';
import {useImageCache} from '../../../../../context-store/imageCache';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {
  CENTER,
  COLORS,
  ICONS,
  VALID_USERNAME_REGEX,
} from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import {useCallback, useRef, useState} from 'react';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {SIZES} from '../../../../constants/theme';
import {useNavigation} from '@react-navigation/native';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {getImageFromLibrary} from '../../../../functions/imagePickerWrapper';
import {setDatabaseIMG} from '../../../../../db/photoStorage';
import CustomButton from '../../../../functions/CustomElements/button';
import {isValidUniqueName} from '../../../../../db';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';

export default function EditLNURLContactOnReceivePage({
  theme,
  darkModeType,
  slideHeight,
  isKeyboardActive,
  setIsKeyboardActive,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const {cache, refreshCache} = useImageCache();
  const {globalContactsInformation, toggleGlobalContactsInformation} =
    useGlobalContacts();
  const {masterInfoObject} = useGlobalContextProvider();
  const {backgroundOffset, textInputColor, textColor, backgroundColor} =
    GetThemeColors();
  const [username, setUsername] = useState('');
  const [isAddingImage, setIsAddingImage] = useState(false);
  const initialValue = useRef(0);
  const {t} = useTranslation();
  const imageData = cache[masterInfoObject.uuid];
  const image = cache[masterInfoObject.uuid]?.localUri;

  const addProfilePicture = useCallback(async () => {
    const imagePickerResponse = await getImageFromLibrary({quality: 1});
    const {didRun, error, imgURL} = imagePickerResponse;
    if (!didRun) return;
    if (error) {
      navigate.navigate('ErrorScreen', {errorMessage: t(error)});
      return;
    }

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
  }, [globalContactsInformation]);

  const uploadProfileImage = useCallback(
    async ({imgURL}) => {
      try {
        setIsAddingImage(true);
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
        } else
          throw new Error(t('contacts.editMyProfilePage.unableToSaveError'));
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
        return false;
      } finally {
        setIsAddingImage(false);
      }
    },
    [globalContactsInformation],
  );

  const saveProfileName = useCallback(async () => {
    try {
      if (
        !username ||
        !username.length ||
        globalContactsInformation.myProfile.uniqueName.toLowerCase() ===
          username.toLowerCase()
      ) {
        handleBackPressFunction();
        return;
      }

      if (username.length > 30) return;
      if (!VALID_USERNAME_REGEX.test(username))
        throw new Error(t('contacts.editMyProfilePage.unqiueNameRegexError'));

      const isFreeUniqueName = await isValidUniqueName(
        'blitzWalletUsers',
        username.trim(),
      );
      if (!isFreeUniqueName)
        throw new Error(
          t('contacts.editMyProfilePage.usernameAlreadyExistsError'),
        );
      toggleGlobalContactsInformation(
        {
          myProfile: {
            ...globalContactsInformation.myProfile,
            uniqueName: username.trim(),
            uniqueNameLower: username.trim().toLowerCase(),
          },
          addedContacts: globalContactsInformation.addedContacts,
        },
        true,
      );
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          navigate.goBack();
        });
      });
    } catch (err) {
      console.log('Saving to database error', err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    }
  }, [globalContactsInformation, username]);

  return (
    <ScrollView
      keyboardShouldPersistTaps={'always'}
      showsVerticalScrollIndicator={false}>
      <View
        onLayout={e => {
          const {height} = e.nativeEvent.layout;
          if (!initialValue.current) {
            initialValue.current = height;
            console.log(height, 'height');
            setContentHeight(height + 90);
          }
        }}
        style={styles.popupContainer}>
        <TouchableOpacity
          onPress={() => {
            if (isAddingImage) return;
            addProfilePicture();
          }}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}>
            {isAddingImage ? (
              <FullLoadingScreen showText={false} />
            ) : (
              <ContactProfileImage
                updated={imageData?.updated}
                uri={image}
                darkModeType={darkModeType}
                theme={theme}
              />
            )}
          </View>
          <View style={styles.scanProfileImage}>
            <Image
              source={ICONS.ImagesIconDark}
              style={{width: 20, height: 20}}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            navigate.navigate('InformationPopup', {
              textContent: t(
                'wallet.receivePages.editLNURLContact.informationMessage',
              ),
              buttonText: t('constants.understandText'),
            });
          }}
          style={{
            width: '100%',
            height: 45,
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <ThemeText
            styles={{
              includeFontPadding: false,
              marginRight: 5,
            }}
            content={t(
              'wallet.receivePages.editLNURLContact.usernameInputDesc',
            )}
          />

          <ThemeImage
            styles={{width: 20, height: 20}}
            lightModeIcon={ICONS.aboutIcon}
            darkModeIcon={ICONS.aboutIcon}
            lightsOutIcon={ICONS.aboutIconWhite}
          />
        </TouchableOpacity>
        <View style={{width: '100%'}}>
          <CustomSearchInput
            textInputStyles={{
              color:
                username.length < 30
                  ? textInputColor
                  : theme && darkModeType
                  ? textInputColor
                  : COLORS.cancelRed,
            }}
            inputText={username}
            setInputText={setUsername}
            placeholderText={globalContactsInformation.myProfile.uniqueName}
            containerStyles={{width: '100%'}}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
          />
          <ThemeText
            styles={{
              textAlign: 'right',
              marginTop: 10,
              color:
                username.length < 30
                  ? textColor
                  : theme && darkModeType
                  ? textColor
                  : COLORS.cancelRed,
            }}
            content={`${username.length}/30`}
          />
        </View>
        <CustomButton
          actionFunction={saveProfileName}
          buttonStyles={{
            marginTop: 10,
            backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
          }}
          textStyles={{
            color: theme ? COLORS.lightModeText : COLORS.darkModeText,
          }}
          textContent={t('constants.save')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  popupContainer: {
    flex: 1,
    width: '80%',
    alignItems: 'center',
    ...CENTER,
  },
  profileImage: {
    width: 125,
    height: 125,
    borderRadius: 75,
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  scanProfileImage: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 2,
  },
});
