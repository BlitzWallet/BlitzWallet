import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { GlobalThemeView } from '../../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { CENTER } from '../../../../../constants/styles';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import StaffSignCard, {
  signCardStyle,
} from './internalComponents/staffSignCard';
import { useImageCache } from '../../../../../../context-store/imageCache';
import { useMemo, useRef } from 'react';
import ViewShot from 'react-native-view-shot';
import { createPdf } from 'react-native-pdf-from-image';
import CustomButton from '../../../../../functions/CustomElements/button';
import * as FileSystem from 'expo-file-system/legacy';
import {
  isFileSharingAvailable,
  shareFile,
  shareMessage,
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
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.posInstructionsPath.title')}
          right={
            <IconButton
              icon="Share2"
              iconSize={20}
              label={t('settings.posPath.posInstructionsPath.share')}
              onPress={() => shareMessage({ url: posURL })}
            />
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ViewShot
            style={signCardStyle}
            ref={viewShotRef}
            // png keeps the rounded corners transparent; jpg fills them black
            options={{ format: 'png' }}
          >
            <StaffSignCard
              posURL={posURL}
              logoSource={brandLogoSource}
              onCopyLink={() => copyToClipboard(posURL, showToast)}
            />
          </ViewShot>
        </CustomScrollView>
        <CustomButton
          actionFunction={generatePDFFromView}
          textContent={t('constants.print')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingBottom: 16 },
});
