import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Share,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import copyToClipboard from '../copyToClipboard';
import { useToast } from '../../../context-store/toastManager';
import GlobalThemeView from './globalThemeView';
import CustomSettingsTopBar from './settingsTopBar';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, EMAIL_REGEX, SIZES, VALID_URL_REGEX } from '../../constants';
import ThemeText from './textTheme';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useImageCache } from '../../../context-store/imageCache';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { COLORS, INSET_WINDOW_WIDTH } from '../../constants/theme';
import getDeepLinkUser from '../../components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
import { useNavigation } from '@react-navigation/native';
import { getCachedProfileImage } from '../cachedImage';
import ThemeIcon from './themeIcon';

export default function ShowProfileQr() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContacts();
  const { cache } = useImageCache();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();
  const [activeType, setActiveType] = useState('blitz');
  const [copied, setCopied] = useState(false);

  const name = globalContactsInformation.myProfile.name;
  const uniqueName = globalContactsInformation.myProfile.uniqueName;
  const myProfileImage = cache[masterInfoObject?.uuid];

  const lnurl = `${uniqueName}@blitzwalletapp.com`;
  const deeplink = `https://blitzwalletapp.com/u/${uniqueName}`;

  const currentValue = activeType === 'lnurl' ? lnurl : deeplink;
  const currentLabel =
    activeType === 'lnurl'
      ? t('contacts.showProfileQr.lnAddress')
      : t('contacts.showProfileQr.blitzContact');

  const activeToggleColor = theme ? backgroundColor : COLORS.darkModeText;

  const handleCopy = () => {
    copyToClipboard(currentValue, showToast);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (activeType === 'lnurl') {
      Share.share({ message: currentValue });
    } else {
      Share.share({ message: t('share.contact') + '\n' + currentValue });
    }
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
    <GlobalThemeView useStandardWidth={true} style={styles.container}>
      <CustomSettingsTopBar
        label={t('settings.index.showQR')}
        showLeftImage={true}
        iconNew="Share"
        leftImageFunction={handleShare}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          width: INSET_WINDOW_WIDTH,
          ...CENTER,
        }}
      >
        {/* Profile */}
        <View style={styles.profileContainer}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: backgroundOffset,
              },
            ]}
          >
            <ContactProfileImage
              updated={myProfileImage?.updated}
              uri={myProfileImage?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <ThemeText
            styles={{ opacity: name ? 0.5 : 0.8 }}
            content={name || t('constants.annonName')}
          />
          <ThemeText content={`@${uniqueName}`} />
        </View>

        {/* Toggle */}
        <View
          style={[
            styles.toggleContainer,
            { backgroundColor: backgroundOffset },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.toggleButton,
              activeType === 'lnurl' && {
                ...styles.toggleActive,
                backgroundColor: activeToggleColor,
              },
            ]}
            onPress={() => setActiveType('lnurl')}
          >
            <ThemeText
              CustomNumberOfLines={1}
              styles={
                activeType === 'lnurl'
                  ? styles.toggleActiveText
                  : styles.toggleText
              }
              content={t('contacts.showProfileQr.lnAddress')}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              activeType === 'blitz' && {
                ...styles.toggleActive,
                backgroundColor: activeToggleColor,
              },
            ]}
            onPress={() => setActiveType('blitz')}
          >
            <ThemeText
              CustomNumberOfLines={1}
              styles={
                activeType === 'blitz'
                  ? styles.toggleActiveText
                  : styles.toggleText
              }
              content={t('contacts.showProfileQr.blitzContact')}
            />
          </TouchableOpacity>
        </View>

        {/* QR */}
        <View style={styles.qrWrapper}>
          <TouchableOpacity
            onPress={handleCopy}
            style={[styles.qrCard, { borderColor: backgroundOffset }]}
          >
            <QRCode value={currentValue} size={240} />
          </TouchableOpacity>

          {/* <ThemeText styles={styles.label} content={currentLabel} /> */}

          <TouchableOpacity
            style={[
              styles.copyButton,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
                marginTop: 'auto',
              },
            ]}
            onPress={handleCopy}
          >
            <ThemeIcon
              colorOverride={COLORS.darkModeText}
              size={20}
              styles={{ marginRight: 5 }}
              iconName={'Copy'}
            />
            <ThemeText
              styles={styles.copyText}
              content={
                copied
                  ? t('contacts.showProfileQr.copyMessage')
                  : t(
                      `contacts.showProfileQr.${
                        activeType === 'lnurl' ? 'lnurlCopy' : 'blitzCopy'
                      }`,
                    )
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.copyButton,
              {
                marginTop: 0,
              },
            ]}
            onPress={() => {
              navigate.navigate('CameraModal', {
                updateBitcoinAdressFunc: handleProfileScan,
                fromPage: 'ShowProfileQr',
              });
            }}
          >
            <ThemeIcon
              colorOverride={COLORS.darkModeText}
              size={20}
              styles={{ marginRight: 5 }}
              iconName={'ScanQrCode'}
            />
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t('contacts.showProfileQr.scanProfile')}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatar: {
    position: 'relative',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },

  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 5,
    marginTop: 25,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: '#fff',
  },
  toggleText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  toggleActiveText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  qrWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: 30,
  },
  qrCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  label: {
    opacity: 0.6,
    marginTop: 20,
    marginBottom: 'auto',
  },
  copyButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexDirection: 'row',
  },
  copyText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
  },
});
