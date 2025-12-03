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
   * gets a profile picture for a contact
   */
  const getProfileImage = async () => {
    try {
      const imagePickerResponse = await getImageFromLibrary({ quality: 1 });
      const { didRun, error, imgURL } = imagePickerResponse;

      if (!didRun) return;

      if (error) {
        navigate.navigate('ErrorScreen', { errorMessage: t(error) });
        return;
      }
      const startTime = Date.now();
      setIsAddingImage(true);

      const savedImage = await resizeImage({ imgURL });

      if (!savedImage.uri) return;
      const offsetTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 700 - offsetTime);

      if (remainingTime > 0) {
        console.log(`Waiting ${remainingTime}ms to reach minimum 1s duration`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      return { comparison: savedImage, imgURL };
    } catch (err) {
      console.log('error getting profile iamge', err);
    } finally {
      setIsAddingImage(false);
    }
  };

  /**
   * Saves a profile picture for a contact
   * @param {string} imgURL - Imgae URI
   * @param {boolean} isEditingMyProfile - Whether editing own profile
   */
  const saveProfileImage = async (
    imgData,
    isEditingMyProfile,
    selectedContact,
  ) => {
    try {
      if (isEditingMyProfile) {
        const response = await uploadProfileImage({
          imgURL: imgData.comparison.uri,
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
        await refreshCache(selectedContact.uuid, imgData.comparison.uri, false);
      }
    } catch (err) {
      console.log('error saving profile image', err);
    }
  };

  /**
   * Resizes and crops an image to a circle for profile pictures
   * @param {object} params - Upload parameters
   * @param {object} params.imgURL - Image URL object
   */
  const resizeImage = async ({ imgURL }) => {
    try {
      const { width: originalWidth, height: originalHeight } = imgURL;
      const photoWidth = originalWidth * 0.95;
      const photoHeight = originalHeight * 0.95;
      const targetSize = 250; // Match your largest display size

      const smallerDimension = Math.min(photoWidth, photoHeight);
      const cropSize = smallerDimension;
      const cropX = (photoWidth - cropSize) / 2;
      const cropY = (photoHeight - cropSize) / 2;

      // Get image dimensions to calculate center crop
      const manipulator = ImageManipulator.ImageManipulator.manipulate(
        imgURL.uri,
      );

      const cropped = manipulator.crop({
        originX: cropX,
        originY: cropY,
        width: cropSize,
        height: cropSize,
      });

      const resized = cropped.resize({
        width: targetSize,
        height: targetSize,
      });

      const image = await resized.renderAsync();
      const savedImage = await image.saveAsync({
        compress: 0.4,
        format: ImageManipulator.SaveFormat.WEBP,
      });

      return savedImage;
    } catch (err) {
      console.log('Error resizing image', err);
      return {};
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
      if (!removeImage) {
        const response = await setDatabaseIMG(uuid, { uri: imgURL });

        if (response) {
          await refreshCache(uuid, imgURL, false);
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
    deleteProfilePicture,
    getProfileImage,
    saveProfileImage,
  };
}
