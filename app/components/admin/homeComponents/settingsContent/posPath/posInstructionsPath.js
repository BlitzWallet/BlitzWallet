import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { COLORS, SIZES } from '../../../../../constants/theme';
import { CENTER } from '../../../../../constants/styles';
import QRCode from 'react-native-qrcode-svg';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import { useImageCache } from '../../../../../../context-store/imageCache';
import { useMemo, useRef } from 'react';
import { Image } from 'expo-image';
import ViewShot from 'react-native-view-shot';
import { createPdf } from 'react-native-pdf-from-image';
import CustomButton from '../../../../../functions/CustomElements/button';
import * as FileSystem from 'expo-file-system/legacy';
import {
  isFileSharingAvailable,
  shareFile,
} from '../../../../../functions/handleShare';

const normalizeFileUri = path => {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
};

export default function POSInstructionsPath() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { cache } = useImageCache();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const posURL = `https://pay.blitzwalletapp.com/${masterInfoObject.posSettings.storeName}`;
  const viewShotRef = useRef(null);

  const logoKey = masterInfoObject?.posSettings?.brandLogo;
  const cachedImageData = logoKey ? cache?.[logoKey] : null;

  const brandLogoUri = cachedImageData?.localUri || null;
  const brandLogoUpdated = cachedImageData?.updated || null;

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

  const generatePDFFromView = async () => {
    try {
      const imageURI = await viewShotRef.current.capture();

      const pdfName = `Blitz_${t(
        'settings.posPath.posInstructionsPath.title',
      )}_${Date.now()}.pdf`;

      const response = await createPdf({
        imagePaths: [imageURI],
        name: pdfName,
      });

      const destinationPath = `${FileSystem.documentDirectory}${pdfName}`;

      await FileSystem.copyAsync({
        from: normalizeFileUri(response.filePath),
        to: destinationPath,
      });

      const isAvailable = await isFileSharingAvailable();
      if (isAvailable) {
        await shareFile(destinationPath, {
          mimeType: 'application/pdf',
          dialogTitle: t('settings.posPath.posInstructionsPath.title'),
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error) {
      console.error('Error generating/sharing PDF:', error);
      showToast('Failed to generate PDF');
    }
  };

  return (
    <GlobalThemeView
      useStandardWidth={true}
      globalContainerStyles={{ backgroundColor: COLORS.white }}
    >
      <CustomSettingsTopBar
        label={t('settings.posPath.posInstructionsPath.title')}
        customBackColor={COLORS.lightModeText}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <ViewShot
          style={styles.viewShotPadding}
          ref={viewShotRef}
          options={{ format: 'jpg', quality: 0.9 }}
        >
          {brandLogoSource && (
            <Image
              source={{ uri: brandLogoSource }}
              style={styles.logoImage}
              contentFit="contain"
            />
          )}

          <ThemeText
            styles={[styles.headingText, { marginTop: 'auto' }]}
            content={t('settings.posPath.posInstructionsPath.head1')}
          />
          <ThemeText
            styles={styles.headingText}
            content={t('settings.posPath.posInstructionsPath.head2')}
          />

          <ThemeText
            styles={styles.instructionsText}
            content={t('settings.posPath.posInstructionsPath.step1')}
          />
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              copyToClipboard(posURL, showToast);
            }}
            style={styles.qrCodeContainer}
          >
            <View style={styles.qrCodeBorder}>
              <QRCode
                size={275}
                quietZone={15}
                value={posURL}
                color={COLORS.white}
                backgroundColor={COLORS.lightModeText}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              copyToClipboard(posURL, showToast);
            }}
          >
            <ThemeText styles={styles.posURLText} content={posURL} />
          </TouchableOpacity>
        </ViewShot>
      </ScrollView>
      <CustomButton
        buttonStyles={{
          backgroundColor: COLORS.lightModeText,
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
        }}
        textStyles={{ color: COLORS.darkModeText }}
        actionFunction={generatePDFFromView}
        textContent={t('constants.print')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  headingText: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },
  viewShotPadding: {
    paddingVertical: 20,
    backgroundColor: COLORS.darkModeText,
  },
  qrCodeContainer: {
    width: 300,
    height: 300,
    borderRadius: 20,
    ...CENTER,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeBorder: {
    width: 275,
    height: 275,
    borderRadius: 8,
    overflow: 'hidden',
  },
  instructionsText: {
    width: '100%',
    textAlign: 'center',
    maxWidth: 275,
    ...CENTER,
    marginTop: 15,
  },
  lineItem: {
    marginVertical: 5,
    paddingLeft: 10,
    color: COLORS.lightModeText,
  },
  logoImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    ...CENTER,
    marginBottom: 15,
  },
  posURLText: {
    width: 250,
    textAlign: 'center',
    color: COLORS.lightModeText,
    fontSize: SIZES.smedium,
    textAlign: 'center',
    ...CENTER,
  },
});
