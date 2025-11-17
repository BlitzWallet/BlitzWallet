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
import { CENTER, ICONS, SIZES } from '../../constants';
import ThemeText from './textTheme';
import ThemeImage from './themeImage';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useImageCache } from '../../../context-store/imageCache';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { COLORS, INSET_WINDOW_WIDTH } from '../../constants/theme';

export default function ShowProfileQr() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContacts();
  const { cache } = useImageCache();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();

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

  return (
    <GlobalThemeView useStandardWidth={true} style={styles.container}>
      <CustomSettingsTopBar
        label={t('contacts.showProfileQr.header')}
        showLeftImage={true}
        leftImageBlue={ICONS.share}
        LeftImageDarkMode={ICONS.shareWhite}
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
          <View style={[styles.qrCard, { borderColor: backgroundOffset }]}>
            <QRCode value={currentValue} size={240} />
          </View>

          <ThemeText styles={styles.label} content={currentLabel} />

          <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
            <ThemeImage
              styles={{ width: 20, height: 20, marginRight: 5 }}
              lightModeIcon={ICONS.clipboardDark}
              darkModeIcon={ICONS.clipboardLight}
              lightsOutIcon={ICONS.clipboardLight}
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
  },
  label: {
    opacity: 0.6,
    marginTop: 20,
  },
  copyButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#ccc',
    flexDirection: 'row',
    marginTop: 20,
  },
  copyText: {
    fontSize: SIZES.small,
  },
});
