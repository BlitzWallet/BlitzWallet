import { useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import ViewShot from 'react-native-view-shot';
import QrCard from './redesign/QrCard';
import copyToClipboard from '../copyToClipboard';
import { useToast } from '../../../context-store/toastManager';
import GlobalThemeView from './globalThemeView';
import {
  CENTER,
  EMAIL_REGEX,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
  VALID_URL_REGEX,
} from '../../constants';
import ThemeText from './textTheme';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { useImageCache } from '../../../context-store/imageCache';
import { MODES } from '../../constants/themes';
import getDeepLinkUser from '../../components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
import { useNavigation } from '@react-navigation/native';
import { getCachedProfileImage } from '../cachedImage';
import { shareFile, shareMessage } from '../handleShare';
import TopBar from './redesign/TopBar';
import IconButton from './redesign/IconButton';
import CustomButton from './button';
import ContactAvatar from '../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';

// Photo disc in the middle of the profile QR (Show QR + Print).
export function ProfileQrBadge({ size }) {
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { cache } = useImageCache();
  const { t } = useTranslation();
  const myProfile = globalContactsInformation.myProfile;
  const myProfileImage = cache[myProfile?.uuid];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ContactAvatar
        name={myProfile?.name || myProfile?.uniqueName}
        seed={myProfile?.uuid}
        updated={myProfileImage?.updated}
        uri={myProfileImage?.localUri}
        size={size}
        fontSize={size / 3}
      />
    </View>
  );
}

// D158: one code (your Lightning address, OQ-40) on a white card with your
// name. Tap copies; Print + Share sit in the top bar.
export default function ShowProfileQr() {
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const qrSize = Math.min(280, contentWidth - 48);
  const viewShotRef = useRef(null);

  const name = globalContactsInformation.myProfile.name;
  const uniqueName = globalContactsInformation.myProfile.uniqueName;

  const lnurl = `${uniqueName}@blitzwalletapp.com`;
  const shareText = t('contacts.showProfileQr.shareMessage', {
    address: lnurl,
  });

  const handleCopy = () => {
    copyToClipboard(lnurl, showToast);
  };

  // Q12-11: the card as an image on native, plain text otherwise.
  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      try {
        const uri = await viewShotRef.current.capture();
        const result = await shareFile(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: shareText,
        });
        if (result.success) return;
      } catch (err) {
        console.log('profile QR image share error', err);
      }
    }
    shareMessage({ message: shareText });
  };

  const handleProfileScan = async data => {
    try {
      if (EMAIL_REGEX.test(data)) {
        navigate.reset({
          index: 0, // The top-level route index
          routes: [
            {
              name: 'HomeAdmin',
              params: { screen: 'Home' },
            },
            {
              name: 'ConfirmPaymentScreen',
              params: {
                btcAdress: data,
              },
            },
          ],
        });
        return;
      }

      let newContact;
      if (VALID_URL_REGEX.test(data)) {
        const {
          didWork,
          reason,
          data: userProfile,
        } = await getDeepLinkUser({
          deepLinkContent: data,
          userProfile: globalContactsInformation.myProfile,
        });

        if (!didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(reason),
          });
          return;
        }
        newContact = userProfile;
      } else {
        const decoded = atob(data);
        const parsedData = JSON.parse(decoded);
        const {
          didWork,
          reason,
          data: userProfile,
        } = await getDeepLinkUser({
          deepLinkContent: `blitz-wallet/u/${parsedData.uniqueName}`,
          userProfile: globalContactsInformation.myProfile,
        });

        if (!didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(reason),
          });
          return;
        }
        newContact = userProfile;
      }

      await getCachedProfileImage(newContact.uuid);

      navigate.reset({
        index: 0, // The top-level route index
        routes: [
          {
            name: 'HomeAdmin',
            params: { screen: 'Home' },
          },
          {
            name: 'ExpandedAddContactsPage',
            params: {
              newContact: newContact,
            },
          },
        ],
      });
    } catch (err) {
      console.log('parse contact half modal error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('contacts.addContactsHalfModal.noContactsMessage'),
      });
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.index.showQR')}
          right={
            <>
              <IconButton
                icon="Printer"
                label="constants.print"
                onPress={() => navigate.navigate('ProfilePrintPage')}
              />
              <IconButton
                icon="Share2"
                label="contacts.editMyProfilePage.share"
                onPress={handleShare}
              />
            </>
          }
        />

        <View style={styles.cardWrapper}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1 }}
            style={styles.viewShot}
          >
            <QrCard
              value={lnurl}
              size={qrSize}
              badge={<ProfileQrBadge size={48} />}
              badgeSize={48}
              onPress={handleCopy}
              accessibilityLabel={t('contacts.showProfileQr.copyAddress')}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
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
              </View>
            </QrCard>
          </ViewShot>
        </View>

        <CustomButton
          size="regular"
          icon="ScanLine"
          textContent={t('contacts.showProfileQr.scanProfile')}
          actionFunction={() =>
            navigate.navigate('CameraModal', {
              updateBitcoinAdressFunc: handleProfileScan,
              fromPage: 'ShowProfileQr',
            })
          }
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  viewShot: { borderRadius: 28, overflow: 'hidden' },
  // QrCard renders children under the code; column-reverse puts the name
  // block on top as drawn.
  card: {
    width: '100%',
    padding: 24,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderWidth: 0,
    flexDirection: 'column-reverse',
    gap: 20,
  },
  cardHeader: { alignSelf: 'stretch' },
  name: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 28,
    color: MODES.light.ink,
    includeFontPadding: false,
  },
  // The card stays white in every mode, so its text uses the Light palette.
  uniqueName: {
    color: MODES.light.muted,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
});
