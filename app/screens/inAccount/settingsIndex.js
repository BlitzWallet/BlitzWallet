import { StyleSheet, View, TouchableOpacity, Share } from 'react-native';
import { COLORS, ICONS, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { BlitzSocialOptions } from '../../components/admin/homeComponents/settingsContent';
import { CENTER } from '../../constants/styles';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import { useMemo } from 'react';
import ThemeImage from '../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useAppStatus } from '../../../context-store/appStatus';
import { useGlobalContextProvider } from '../../../context-store/context';
import openWebBrowser from '../../functions/openWebBrowser';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../hooks/themeColors';
import { useImageCache } from '../../../context-store/imageCache';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { supportedLanguagesList } from '../../../locales/localeslist';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useToast } from '../../../context-store/toastManager';
import { copyToClipboard } from '../../functions';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { shareMessage } from '../../functions/handleShare';

const PREFERENCES = [
  {
    for: 'general',
    name: 'Display Currency',
    displayName: 'screens.inAccount.settingsContent.display currency',
    iconNew: 'Coins',
  },
  {
    for: 'general',
    name: 'Language',
    displayName: 'screens.inAccount.settingsContent.language',
    iconNew: 'Languages',
  },
  {
    for: 'general',
    name: 'Display Options',
    displayName: 'screens.inAccount.settingsContent.display options',
    iconNew: 'Palette',
  },
  {
    for: 'general',
    name: 'Fast Pay',
    displayName: 'screens.inAccount.settingsContent.fast pay',
    iconNew: 'ClockFading',
  },

  {
    for: 'general',
    name: 'Notifications',
    displayName: 'screens.inAccount.settingsContent.notifications',
    iconNew: 'Bell',
  },
];

const OTHEROPTIONS = [
  {
    for: 'general',
    name: 'About',
    displayName: 'screens.inAccount.settingsContent.about',
    iconNew: 'Info',
  },
  {
    for: 'general',
    name: 'Blitz Stats',
    displayName: 'screens.inAccount.settingsContent.blitz stats',
    iconNew: 'ChartArea',
  },
  {
    for: 'Closing Account',
    name: 'Delete Wallet',
    displayName: 'screens.inAccount.settingsContent.delete wallet',
    iconNew: 'Trash2',
  },
];
const SECURITYOPTIONS = [
  {
    for: 'Security & Customization',
    name: 'Login Mode',
    displayName: 'screens.inAccount.settingsContent.login mode',
    iconNew: 'ScanFace',
  },
  {
    for: 'Security & Customization',
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    iconNew: 'Lock',
  },
];

const ADVANCEDOPTIONS = [
  {
    for: 'Closing Account',
    name: 'Spark Info',
    displayName: 'screens.inAccount.settingsContent.spark info',
    iconNew: 'VectorSquare',
  },
  {
    for: 'general',
    name: 'Accounts',
    displayName: 'screens.inAccount.settingsContent.accounts',
    iconNew: 'WalletCards',
  },
  {
    for: 'general',
    name: 'Nostr',
    displayName: 'screens.inAccount.settingsContent.nostr',
    iconNew: 'Link',
  },
  {
    for: 'Closing Account',
    name: 'Blitz Fee Details',
    displayName: 'screens.inAccount.settingsContent.blitz fee details',
    icon: ICONS.receiptIcon,
    iconWhite: ICONS.receiptWhite,
  },

  {
    for: 'general',
    name: 'Crash Reports',
    displayName: 'screens.inAccount.settingsContent.crash reports',
    iconNew: 'ShieldCheck',
  },

  {
    for: 'general',
    name: 'ViewAllSwaps',
    displayName: 'screens.inAccount.settingsContent.view all swaps',
    iconNew: 'SendToBack',
  },
];
const SETTINGSOPTIONS = [
  [...PREFERENCES],
  [...SECURITYOPTIONS],
  [...ADVANCEDOPTIONS],
  [...OTHEROPTIONS],
];
const DOOMSDAYSETTINGS = [
  [
    {
      for: 'Security & Customization',
      name: 'Backup wallet',
      displayName: 'screens.inAccount.settingsContent.backup wallet',
      iconNew: 'Lock',
    },
  ],
  [
    {
      for: 'Closing Account',
      name: 'Delete Wallet',
      displayName: 'screens.inAccount.settingsContent.delete wallet',
      iconNew: 'Trash2',
    },
  ],
];

const SCROLL_THRESHOLD = 360;

export default function SettingsIndex(props) {
  const { showToast } = useToast();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { globalContactsInformation } = useGlobalContacts();
  const { cache } = useImageCache();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const isDoomsday = props?.route?.params?.isDoomsday;
  const navigate = useNavigation();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated styles for share icon
  const shareIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 50, SCROLL_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP,
    );

    const translateY = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 50, SCROLL_THRESHOLD],
      [0, -10],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Animated styles for "Profile" text
  const profileTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 50, SCROLL_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP,
    );

    const translateY = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 50, SCROLL_THRESHOLD],
      [0, -10],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
      position: 'absolute',
    };
  });

  // Animated styles for "Settings" text
  const settingsTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 50, SCROLL_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );

    const translateY = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 50, SCROLL_THRESHOLD],
      [10, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
      position: 'absolute',
    };
  });

  const settignsList = isDoomsday ? DOOMSDAYSETTINGS : SETTINGSOPTIONS;
  const myProfileImage = cache[masterInfoObject?.uuid];
  const myContact = globalContactsInformation?.myProfile;
  const currentLangugage = supportedLanguagesList.find(
    item => item.id === masterInfoObject.userSelectedLanguage,
  )?.languageName;

  const settingsElements = useMemo(() => {
    return settignsList.map((element, id) => {
      const internalElements = element.map((element, id) => {
        return (
          <TouchableOpacity
            activeOpacity={0.5}
            style={[
              styles.listContainer,
              {
                borderBottomColor: backgroundColor,
              },
            ]}
            key={id}
            onPress={() => {
              if (
                !isConnectedToTheInternet &&
                [
                  'display currency',
                  'node info',
                  'channel closure',
                  'edit contact profile',
                  'refund liquid swap',
                  'experimental',
                  'lsp',
                  'fast pay',
                ].includes(element.name?.toLowerCase())
              ) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t('errormessages.nointernet'),
                });
                return;
              }
              navigate.navigate('SettingsContentHome', {
                for: element.name,
                isDoomsday: isDoomsday,
              });
            }}
          >
            {element.iconNew ? (
              <ThemeIcon iconName={element.iconNew} size={20} />
            ) : (
              <ThemeImage
                styles={{ width: 20, height: 20 }}
                lightsOutIcon={element.iconWhite}
                darkModeIcon={element.icon}
                lightModeIcon={element.icon}
              />
            )}
            <ThemeText
              CustomNumberOfLines={1}
              styles={{
                ...styles.listText,
                textTransform:
                  element.name === 'Experimental' ? 'none' : 'capitalize',
              }}
              content={t(element.displayName)}
            />
            {element.name === 'Display Currency' && (
              <ThemeText
                styles={[
                  styles.inlineSettingsDescription,
                  { textTransform: 'uppercase' },
                ]}
                content={masterInfoObject.fiatCurrency}
              />
            )}
            {element.name === 'Language' && (
              <ThemeText
                styles={[
                  styles.inlineSettingsDescription,
                  { textTransform: 'capitalize' },
                ]}
                content={currentLangugage}
              />
            )}
            <ThemeIcon size={20} iconName={'ChevronRight'} />
          </TouchableOpacity>
        );
      });

      return (
        <View key={id} style={styles.optionsContainer}>
          <ThemeText
            content={
              id === 0
                ? t('screens.inAccount.settingsContent.preferences')
                : id === 1
                ? t('screens.inAccount.settingsContent.security')
                : id === 2
                ? t('screens.inAccount.settingsContent.technical settings')
                : ''
            }
            styles={{
              ...styles.optionsTitle,
              marginTop: id > 2 ? 0 : 20,
            }}
          />

          <View
            style={[
              styles.optionsListContainer,
              { backgroundColor: backgroundOffset },
            ]}
          >
            {internalElements}
          </View>
        </View>
      );
    });
  }, [
    settignsList,
    isDoomsday,
    isConnectedToTheInternet,
    theme,
    darkModeType,
    masterInfoObject.fiatCurrency,
    currentLangugage,
  ]);

  const handleUserNameCopy = () => {
    copyToClipboard(myContact?.uniqueName, showToast);
  };

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={styles.customTopbar}>
        <TouchableOpacity style={styles.goBackTopbar} onPress={navigate.goBack}>
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Animated.View style={profileTextStyle}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.topBarLabel}
              content={
                !isDoomsday
                  ? t('settings.index.profileHead')
                  : t('settings.index.settingsHead')
              }
            />
          </Animated.View>

          <Animated.View style={settingsTextStyle}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.topBarLabel}
              content={t('settings.index.settingsHead')}
            />
          </Animated.View>
        </View>
        {!isDoomsday && (
          <Animated.View style={shareIconStyle}>
            <TouchableOpacity
              onPress={() => {
                shareMessage({
                  message: `${t(
                    'share.contact',
                  )}\nhttps://blitzwalletapp.com/u/${myContact?.uniqueName}`,
                });
              }}
            >
              <ThemeIcon iconName={'Share'} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollAign}
        style={styles.settingsContainer}
        scrollEnabled={!isDoomsday}
      >
        {!isDoomsday && (
          <View
            style={[
              styles.profileContainer,
              { borderBottomColor: backgroundOffset },
            ]}
          >
            <View
              style={[
                styles.profileImage,
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
              CustomNumberOfLines={1}
              styles={{ opacity: myContact?.name ? 0.5 : 0.8 }}
              content={myContact?.name || t('constants.annonName')}
            />
            <TouchableOpacity onPress={handleUserNameCopy}>
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.profileUniqueName}
                content={`@${myContact?.uniqueName}`}
              />
            </TouchableOpacity>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={() =>
                  navigate.navigate('SettingsContentHome', {
                    for: 'edit contact profile',
                    isDoomsday: isDoomsday,
                  })
                }
                style={[
                  styles.button,
                  {
                    borderColor: backgroundOffset,
                  },
                ]}
              >
                <ThemeIcon
                  colorOverride={
                    theme ? COLORS.darkModeText : COLORS.lightModeText
                  }
                  size={20}
                  styles={{ marginRight: 10 }}
                  iconName={'SquarePen'}
                />
                <ThemeText
                  styles={{ includeFontPadding: false }}
                  content={t('settings.index.editProfile')}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  navigate.navigate('ShowProfileQr');
                }}
                style={[
                  styles.button,
                  {
                    borderColor: backgroundOffset,
                  },
                ]}
              >
                <ThemeIcon
                  colorOverride={
                    theme ? COLORS.darkModeText : COLORS.lightModeText
                  }
                  size={20}
                  styles={{ marginRight: 10 }}
                  iconName={'ScanQrCode'}
                />

                <ThemeText
                  styles={{ includeFontPadding: false }}
                  content={t('settings.index.showQR')}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {settingsElements}

        {isDoomsday && (
          <TouchableOpacity
            onPress={() => {
              openWebBrowser({
                navigate,
                link: 'https://recover.blitzwalletapp.com/',
              });
            }}
            style={{
              ...styles.posContainer,
              borderColor:
                theme && darkModeType ? COLORS.white : COLORS.primary,
              marginTop: 30,
            }}
          >
            <ThemeText
              styles={{
                color: theme && darkModeType ? COLORS.white : COLORS.primary,
                fontSize: SIZES.xLarge,
                marginLeft: 10,
                includeFontPadding: false,
              }}
              content={t('screens.inAccount.settingsContent.blitzRestore')}
            />
          </TouchableOpacity>
        )}
        {!isDoomsday && (
          <>
            <TouchableOpacity
              onPress={() => {
                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: t('errormessages.nointernet'),
                  });
                  return;
                }

                navigate.navigate('SettingsContentHome', {
                  for: 'Point-of-sale',
                });
              }}
              style={{
                ...styles.posContainer,
                borderColor:
                  theme && darkModeType ? COLORS.white : COLORS.primary,
              }}
            >
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.white : COLORS.primary
                }
                size={40}
                strokeWidth={1.6}
                iconName={'Calculator'}
              />
              <ThemeText
                styles={{
                  color: theme && darkModeType ? COLORS.white : COLORS.primary,
                  fontSize: SIZES.xLarge,
                  marginLeft: 10,
                  includeFontPadding: false,
                }}
                content={t('screens.inAccount.settingsContent.point-of-sale')}
              />
            </TouchableOpacity>
            <BlitzSocialOptions />
          </>
        )}
      </Animated.ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { alignItems: 'center', paddingBottom: 0 },
  settingsContainer: {
    flex: 1,
    width: '100%',
    ...CENTER,
  },
  customTopbar: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 30,
  },
  goBackTopbar: { marginRight: 'auto' },
  topBarLabel: {
    fontSize: SIZES.large,
    flexShrink: 1,
    includeFontPadding: false,
  },
  headerTextContainer: {
    width: '100%',
    paddingHorizontal: 35,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 125,
    height: 125,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    marginTop: 20,
    overflow: 'hidden',
  },
  selectFromPhotos: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 2,
  },

  optionsContainer: {
    width: INSET_WINDOW_WIDTH,
    marginTop: 10,
  },
  optionsTitle: {
    textTransform: 'capitalize',
    marginTop: 20,
    opacity: 0.8,
    marginBottom: 10,
  },
  optionsListContainer: {
    width: '100%',
    paddingHorizontal: 15,
    borderRadius: 8,
    ...CENTER,
  },
  listContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  listText: {
    marginRight: 'auto',
    marginLeft: 10,
    includeFontPadding: false,
    flexShrink: 1,
  },

  posContainer: {
    flexDirection: 'row',
    borderWidth: 2,
    width: 'auto',
    ...CENTER,
    paddingHorizontal: 25,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  inlineSettingsDescription: {
    opacity: 0.7,
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  scrollAign: { alignItems: 'center' },
  profileContainer: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    paddingBottom: 30,
    borderBottomWidth: 2,
  },
  profileUniqueName: { marginBottom: 35 },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 45,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  buttonImage: { width: 20, height: 20, marginRight: 15 },
});
