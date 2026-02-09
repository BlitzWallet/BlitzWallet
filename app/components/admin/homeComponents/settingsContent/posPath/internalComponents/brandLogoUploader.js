import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useImageCache } from '../../../../../../../context-store/imageCache';
import { useMemo, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { getImageFromLibrary } from '../../../../../../functions/imagePickerWrapper';
import {
  deleteDatabaseImage,
  setDatabaseIMG,
} from '../../../../../../../db/photoStorage';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../../../../../constants';
import { Image } from 'expo-image';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { ThemeText } from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import { HIDDEN_OPACITY } from '../../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';

export default function BrandLogoUploader({
  onLogoChange,
  onLogoRemove,
  masterInfoObject,
  brandLogoUri,
  brandLogoUpdated,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { refreshCache, removeProfileImageFromCache } = useImageCache();
  const { theme } = useGlobalThemeContext();
  const [isUploading, setIsUploading] = useState(false);

  const getPOSImageKey = () => `${masterInfoObject.uuid}_POS`;

  const resizeImage = async imgURL => {
    try {
      const { width: originalWidth, height: originalHeight } = imgURL;
      const photoWidth = originalWidth;
      const photoHeight = originalHeight;
      const targetSize = 400;

      const smallerDimension = Math.min(photoWidth, photoHeight);
      const cropSize = smallerDimension;
      const cropX = (photoWidth - cropSize) / 2;
      const cropY = (photoHeight - cropSize) / 2;

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

  const pickImage = async () => {
    try {
      const imagePickerResponse = await getImageFromLibrary({ quality: 1 });
      const { didRun, error, imgURL } = imagePickerResponse;

      if (!didRun) return;

      if (error) {
        navigate.navigate('ErrorScreen', { errorMessage: t(error) });
        return;
      }

      const startTime = Date.now();
      setIsUploading(true);

      const savedImage = await resizeImage(imgURL);

      if (!savedImage.uri) {
        setIsUploading(false);
        return;
      }

      const offsetTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 700 - offsetTime);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      const posKey = getPOSImageKey();
      const didUpload = await setDatabaseIMG(posKey, { uri: savedImage.uri });

      if (didUpload) {
        await refreshCache(posKey, savedImage.uri);
        onLogoChange(savedImage.uri);
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.savingImageError'),
        });
      }
    } catch (err) {
      console.error('Error uploading brand logo', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.savingImageError'),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setIsUploading(true);
      const posKey = getPOSImageKey();
      await deleteDatabaseImage(posKey);
      await removeProfileImageFromCache(posKey);
      onLogoRemove();
    } catch (err) {
      console.error('Error removing brand logo', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.removingImageError'),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const brandLogoSource = useMemo(() => {
    if (!brandLogoUri) return null;

    if (brandLogoUpdated) {
      const version = new Date(brandLogoUpdated).getTime();
      if (!isNaN(version)) {
        return `${brandLogoUri}?v=${version}`;
      }
    }

    return brandLogoUri;
  }, [brandLogoUri, brandLogoUpdated]);

  return (
    <View style={styles.logoSection}>
      <ThemeText content={t('settings.posPath.settings.brandLogo')} />
      <View
        style={[styles.logoContainer, { backgroundColor: backgroundOffset }]}
      >
        {isUploading ? (
          <FullLoadingScreen
            showText={false}
            containerStyles={{ minHeight: 100 }}
          />
        ) : brandLogoSource ? (
          <View style={styles.logoPreviewContainer}>
            <View style={styles.logoPreview}>
              <Image
                source={{ uri: brandLogoSource }}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>
            <View style={styles.logoButtons}>
              <CustomButton
                buttonStyles={styles.logoButton}
                actionFunction={pickImage}
                textContent={t('settings.posPath.settings.changeLogo')}
              />
              <CustomButton
                buttonStyles={styles.logoButton}
                actionFunction={handleRemoveLogo}
                textContent={t('settings.posPath.settings.removeLogo')}
              />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.logoUploadPlaceholder,
              { borderColor: COLORS.opaicityGray },
            ]}
            onPress={pickImage}
            disabled={isUploading}
          >
            <ThemeIcon iconName={'Image'} size={48} />
            <ThemeText
              styles={styles.logoUploadText}
              content={t('settings.posPath.settings.uploadLogo')}
            />
            <ThemeText styles={styles.logoSizeText} content={'400 × 400 px'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  logoSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  logoContainer: {
    marginTop: 10,
    borderRadius: 8,
    padding: 16,
  },
  logoPreviewContainer: {
    gap: 12,
  },
  logoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 128,
    height: 128,
    borderRadius: 8,
  },
  logoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  logoButton: {
    flex: 1,
  },
  logoUploadPlaceholder: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  logoUploadText: {
    marginTop: 8,
    fontSize: SIZES.small,
    textAlign: 'center',
  },
  logoSizeText: {
    marginTop: 8,
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
});
