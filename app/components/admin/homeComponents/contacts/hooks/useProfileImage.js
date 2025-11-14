import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImageManipulator from 'expo-image-manipulator';
import { getImageFromLibrary } from '../../../../../functions/imagePickerWrapper';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { useImageCache } from '../../../../../../context-store/imageCache';
import {
  deleteDatabaseImage,
  setDatabaseIMG,
} from '../../../../../../db/photoStorage';

export function useProfileImage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { globalContactsInformation, toggleGlobalContactsInformation } =
    useGlobalContacts();
  const { refreshCache, removeProfileImageFromCache } = useImageCache();

  const [isAddingImage, setIsAddingImage] = useState(false);

  /**
   * Adds a profile picture for a contact
   * @param {boolean} isEditingMyProfile - Whether editing own profile
   * @param {object} selectedContact - The contact object (only needed if not editing own profile)
   */
  const addProfilePicture = async (
    isEditingMyProfile,
    selectedContact = null,
  ) => {
    const imagePickerResponse = await getImageFromLibrary({ quality: 1 });
    const { didRun, error, imgURL } = imagePickerResponse;

    if (!didRun) return;

    if (error) {
      navigate.navigate('ErrorScreen', { errorMessage: t(error) });
      return;
    }

    if (isEditingMyProfile) {
      const response = await uploadProfileImage({
        imgURL: imgURL,
        uuid: globalContactsInformation.myProfile.uuid,
      });

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

    // For other contacts, just refresh cache
    if (selectedContact) {
      await refreshCache(selectedContact.uuid, imgURL.uri, false);
    }
  };

  /**
   * Uploads and processes a profile image
   * @param {object} params - Upload parameters
   * @param {object} params.imgURL - Image URL object
   * @param {string} params.uuid - UUID of the profile
   * @param {boolean} params.removeImage - Whether to remove the image
   */
  const uploadProfileImage = async ({ imgURL, uuid, removeImage }) => {
    try {
      setIsAddingImage(true);

      if (!removeImage) {
        const resized = ImageManipulator.ImageManipulator.manipulate(
          imgURL.uri,
        ).resize({ width: 350 });
        const image = await resized.renderAsync();
        const savedImage = await image.saveAsync({
          compress: 0.4,
          format: ImageManipulator.SaveFormat.WEBP,
        });

        const response = await setDatabaseIMG(uuid, { uri: savedImage.uri });

        if (response) {
          await refreshCache(uuid, response, false);
          return true;
        } else {
          throw new Error(t('contacts.editMyProfilePage.unableToSaveError'));
        }
      } else {
        await deleteDatabaseImage(uuid);
        await removeProfileImageFromCache(uuid);
        return true;
      }
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
      return false;
    } finally {
      setIsAddingImage(false);
    }
  };

  /**
   * Deletes a profile picture
   * @param {boolean} isEditingMyProfile - Whether editing own profile
   * @param {object} selectedContact - The contact object (only needed if not editing own profile)
   */
  const deleteProfilePicture = async (
    isEditingMyProfile,
    selectedContact = null,
  ) => {
    try {
      if (isEditingMyProfile) {
        const response = await uploadProfileImage({
          removeImage: true,
          uuid: globalContactsInformation.myProfile.uuid,
        });

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

      if (selectedContact) {
        await removeProfileImageFromCache(selectedContact.uuid);
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.editMyProfilePage.deleteProfileImageError'),
      });
      console.log(err);
    }
  };

  return {
    isAddingImage,
    addProfilePicture,
    deleteProfilePicture,
  };
}
