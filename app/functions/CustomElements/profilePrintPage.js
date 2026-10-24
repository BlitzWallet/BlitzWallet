import { useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ViewShot from 'react-native-view-shot';
import { createPdf } from 'react-native-pdf-from-image';
import * as FileSystem from 'expo-file-system/legacy';
import GlobalThemeView from './globalThemeView';
import ThemeText from './textTheme';
import TopBar from './redesign/TopBar';
import IconButton from './redesign/IconButton';
import QrCard from './redesign/QrCard';
import CustomButton from './button';
import { ProfileQrBadge } from './showProfileQr';
import { CENTER, FONT, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { MODES } from '../../constants/themes';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { useToast } from '../../../context-store/toastManager';
import { isFileSharingAvailable, shareFile } from '../handleShare';

const normalizeFileUri = path =>
  path.startsWith('file://') ? path : `file://${path}`;

// D159 Print preview: a white page with a small bordered card. Native
// reuses the POS flow (view-shot → PDF → share sheet, which has Print);
// web opens the browser print dialog.
export default function ProfilePrintPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const viewShotRef = useRef(null);

  const { name, uniqueName } = globalContactsInformation.myProfile;
  const lnurl = `${uniqueName}@blitzwalletapp.com`;

  const handlePrint = async () => {
    if (Platform.OS === 'web') {
      window.print();
      return;
    }
    try {
      const imageURI = await viewShotRef.current.capture();
      const pdfName = `Blitz_${uniqueName}_${Date.now()}.pdf`;
      const response = await createPdf({
        imagePaths: [imageURI],
        name: pdfName,
      });
      const destinationPath = `${FileSystem.documentDirectory}${pdfName}`;
      await FileSystem.copyAsync({
        from: normalizeFileUri(response.filePath),
        to: destinationPath,
      });
      if (await isFileSharingAvailable()) {
        await shareFile(destinationPath, {
          mimeType: 'application/pdf',
          dialogTitle: t('constants.print'),
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error) {
      console.error('Error generating/sharing profile PDF:', error);
      showToast({ type: 'error', title: 'errormessages.genericError' });
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.bar, { width: contentWidth }]}>
        <TopBar
          title={t('constants.print')}
          showBack={false}
          right={
            <IconButton
              icon="X"
              label="constants.close"
              onPress={navigate.goBack}
            />
          }
        />
      </View>

      <View style={[styles.page, { width }]}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'jpg', quality: 0.9 }}
          style={styles.shot}
        >
          <View style={styles.card}>
            <ThemeText
              CustomNumberOfLines={2}
              styles={styles.name}
              content={name || t('constants.annonName')}
            />
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.uniqueName}
              content={`@${uniqueName}`}
            />
            <QrCard
              value={lnurl}
              size={160}
              badge={<ProfileQrBadge size={30} />}
              badgeSize={30}
              style={styles.qr}
            />
            <ThemeText styles={styles.address} content={lnurl} />
          </View>
          <ThemeText
            styles={styles.hint}
            content={t('contacts.showProfileQr.printHint')}
          />
        </ViewShot>
      </View>

      <View style={{ width: contentWidth, ...CENTER }}>
        <CustomButton
          size="regular"
          icon="Printer"
          textContent={t('constants.print')}
          actionFunction={handlePrint}
        />
      </View>
    </GlobalThemeView>
  );
}

// The preview is paper: white with Light ink in every mode.
const styles = StyleSheet.create({
  bar: { ...CENTER },
  // Full-bleed paper: the window width, centred past the page gutter.
  page: {
    flex: 1,
    alignSelf: 'center',
    marginVertical: 24,
    backgroundColor: MODES.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  shot: {
    alignItems: 'center',
    gap: 16,
    padding: 8,
    backgroundColor: MODES.light.surface,
  },
  card: {
    width: 220,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MODES.light.divider,
    backgroundColor: MODES.light.surface,
    alignItems: 'center',
  },
  name: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: MODES.light.ink,
    includeFontPadding: false,
  },
  uniqueName: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    color: MODES.light.muted,
    includeFontPadding: false,
  },
  qr: {
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
  },
  address: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: MODES.light.ink,
    opacity: 0.5,
    includeFontPadding: false,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: MODES.light.ink,
    includeFontPadding: false,
  },
});
