import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import QrCard from './redesign/QrCard';
import copyToClipboard from '../copyToClipboard';
import { useToast } from '../../../context-store/toastManager';
import GlobalThemeView from './globalThemeView';
import { CENTER, EMAIL_REGEX, FONT, VALID_URL_REGEX } from '../../constants';
import ThemeText from './textTheme';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { MODES } from '../../constants/themes';
import getDeepLinkUser from '../../components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
import { useNavigation } from '@react-navigation/native';
import { getCachedProfileImage } from '../cachedImage';
import { share } from '../handleShare';
import TopBar from './redesign/TopBar';
import IconButton from './redesign/IconButton';
import CustomButton from './button';
import useQrSize from '../../hooks/useQrSize';

// D158: one code (your Lightning address, OQ-40) on a white card with your
// name. Tap copies; Print + Share sit in the top bar.
export default function ShowProfileQr(props) {
  const { showButton = true } = props?.route?.params || {};
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigation();
  // Card padding is 24 (styles.card); the card hugs the QR so the name lines up with its edges.
  const { qrSize, cardWidth, contentWidth } = useQrSize({ cardPadding: 24 });
  const viewShotRef = useRef(null);

  const name = globalContactsInformation.myProfile.name;
  const uniqueName = globalContactsInformation.myProfile.uniqueName;

  const lnurl = `${uniqueName}@blitzwalletapp.com`;

  const handleCopy = () => {
    copyToClipboard(lnurl, showToast);
  };

  const handleShare = async () => {
    share({ url: `https://blitzwalletapp.com/${uniqueName}` });
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
              onPress={handleCopy}
              accessibilityLabel={t('contacts.showProfileQr.copyAddress')}
              style={[styles.card, { width: cardWidth }]}
              header={
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
              }
            >
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.lnurl}
                content={lnurl}
                variant={'hint'}
              />
            </QrCard>
          </ViewShot>
        </View>
        {showButton && (
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
        )}
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
    alignItems: 'center',
    paddingVertical: 20,
  },
  viewShot: { borderRadius: 28, overflow: 'hidden' },
  // QrCard draws the header (name block) above the code and `children` under
  // it, so the card just spaces its three parts.
  card: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderWidth: 0,
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
