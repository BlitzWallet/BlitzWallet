import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useImageCache } from '../../../../../../../context-store/imageCache';
import { useMemo, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { getImageFromLibrary } from '../../../../../../functions/imagePickerWrapper';
import {
  deleteDatabaseImage,
  setDatabaseIMG,
} from '../../../../../../../db/photoStorage';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { ThemeText } from '../../../../../../functions/CustomElements';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import { useTheme } from '../../../../../../../context-store/theme';

export default function BrandLogoUploader({
  onLogoChange,
  onLogoRemove,
  masterInfoObject,
  brandLogoUri,
  brandLogoUpdated,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { refreshCache, removeProfileImageFromCache } = useImageCache();
  const { tokens } = useTheme();
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
    <View>
      {isUploading ? (
        <View style={[styles.emptyCard, { backgroundColor: tokens.surface }]}>
          <FullLoadingScreen showText={false} />
        </View>
      ) : brandLogoSource ? (
        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <Image
            source={{ uri: brandLogoSource }}
            style={[styles.logoImage, { backgroundColor: tokens.disc }]}
            contentFit="cover"
          />
          <View style={styles.logoInfo}>
            <ThemeText
              styles={styles.title}
              content={t('settings.posPath.settings.brandLogo')}
            />
            <View style={styles.logoButtons}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={pickImage}
                style={[styles.pill, { backgroundColor: tokens.disc }]}
              >
                <ThemeText
                  styles={styles.pillText}
                  content={t('settings.posPath.settings.changeLogo')}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleRemoveLogo}
                style={styles.pill}
              >
                <ThemeText
                  styles={[styles.pillText, { color: tokens.muted }]}
                  content={t('settings.posPath.settings.removeLogo')}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          style={[
            styles.emptyCard,
            { backgroundColor: tokens.surface, borderColor: tokens.divider },
          ]}
          onPress={pickImage}
        >
          <ThemeIcon
            redesign
            iconName={'Image'}
            size={24}
            colorOverride={tokens.muted}
          />
          <ThemeText
            styles={styles.title}
            content={t('settings.posPath.settings.addLogo')}
          />
          <ThemeText
            styles={[styles.sizeText, { color: tokens.muted }]}
            content={t('settings.posPath.settings.logoSize')}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  logoInfo: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  logoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  emptyCard: {
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  sizeText: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
