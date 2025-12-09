import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { COLORS, ICONS, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { BlitzSocialOptions } from '../../components/admin/homeComponents/settingsContent';
import { CENTER } from '../../constants/styles';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import { useMemo } from 'react';
import Icon from '../../functions/CustomElements/Icon';
import ThemeImage from '../../functions/CustomElements/themeImage';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useAppStatus } from '../../../context-store/appStatus';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { useGlobalContextProvider } from '../../../context-store/context';
import openWebBrowser from '../../functions/openWebBrowser';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../hooks/themeColors';
import { useImageCache } from '../../../context-store/imageCache';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { Image } from 'expo-image';
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

const PREFERENCES = [
  {
    for: 'general',
    name: 'Display Currency',
    displayName: 'screens.inAccount.settingsContent.display currency',
    icon: ICONS.currencyIcon,
    iconWhite: ICONS.currencyIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Language',
    displayName: 'screens.inAccount.settingsContent.language',
    svgIcon: true,
    svgName: 'languageIcon',
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Display Options',
    displayName: 'screens.inAccount.settingsContent.display options',
    icon: ICONS.colorIcon,
    iconWhite: ICONS.colorIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Fast Pay',
    displayName: 'screens.inAccount.settingsContent.fast pay',
    svgIcon: true,
    svgName: 'quickPayIcon',
    arrowIcon: ICONS.leftCheveronIcon,
  },

  {
    for: 'general',
    name: 'Notifications',
    displayName: 'screens.inAccount.settingsContent.notifications',
    icon: ICONS.notification,
    iconWhite: ICONS.notificationWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
];

const OTHEROPTIONS = [
  {
    for: 'general',
    name: 'About',
    displayName: 'screens.inAccount.settingsContent.about',
    icon: ICONS.aboutIcon,
    iconWhite: ICONS.aboutIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  // {
  //   for: 'general',
  //   name: 'Edit Contact Profile',
  //   displayName: 'screens.inAccount.settingsContent.edit contact profile',
  //   icon: ICONS.contactsIconBlue,
  //   iconWhite: ICONS.contactsIconWhite,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },

  {
    for: 'general',
    name: 'Blitz Stats',
    displayName: 'screens.inAccount.settingsContent.blitz stats',
    svgName: 'crashDebugIcon',
    icon: ICONS.navigationIcon,
    iconWhite: ICONS.navigationIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'Closing Account',
    name: 'Delete Wallet',
    displayName: 'screens.inAccount.settingsContent.delete wallet',
    icon: ICONS.trashIcon,
    iconWhite: ICONS.trashIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },

  // {
  //   for: 'general',
  //   name: 'Support Our Work',
  //   svgName: 'crashDebugIcon',
  //   svgIcon: true,
  //   svgName: 'developerSupportIcon',
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
  // {
  //   for: 'general',
  //   name: 'Send On-chain',
  //   svgIcon: true,
  //   svgName: 'swapIcon',
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },

  // {
  //   for: 'general',
  //   name: 'Create Gift',
  //   icon: ICONS.adminHomeWallet,
  //   arrowIcon: ICONS.leftCheveronIcon,
  //   usesStandAlonePath: true,
  // },
];
const SECURITYOPTIONS = [
  {
    for: 'Security & Customization',
    name: 'Login Mode',
    displayName: 'screens.inAccount.settingsContent.login mode',
    icon: ICONS.faceIDIcon,
    iconWhite: ICONS.faceIDIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'Security & Customization',
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    icon: ICONS.keyIcon,
    iconWhite: ICONS.keyIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
];

// const EXPIRIMENTALFEATURES = [
//   {
//     for: 'Experimental features',
//     name: 'Experimental',
//     svgIcon: true,
//     svgName: 'expirementalFeaturesIcon',
//     arrowIcon: ICONS.leftCheveronIcon,
//   },
// ];
const ADVANCEDOPTIONS = [
  {
    for: 'Closing Account',
    name: 'Spark Info',
    displayName: 'screens.inAccount.settingsContent.spark info',
    icon: ICONS.nodeIcon,
    iconWhite: ICONS.nodeIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Accounts',
    displayName: 'screens.inAccount.settingsContent.accounts',
    icon: ICONS.group,
    iconWhite: ICONS.groupWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Nostr',
    displayName: 'screens.inAccount.settingsContent.nostr',
    svgIcon: true,
    svgName: 'linkIcon',
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'Closing Account',
    name: 'Blitz Fee Details',
    displayName: 'screens.inAccount.settingsContent.blitz fee details',
    icon: ICONS.receiptIcon,
    iconWhite: ICONS.receiptWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },

  {
    for: 'general',
    name: 'Crash Reports',
    displayName: 'screens.inAccount.settingsContent.crash reports',
    svgIcon: true,
    svgName: 'crashDebugIcon',
    arrowIcon: ICONS.leftCheveronIcon,
  },

  // {
  //   for: 'general',
  //   name: 'Node Info',
  //   icon: ICONS.nodeIcon,
  //   iconWhite: ICONS.nodeIconWhite,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
  // {
  //   for: 'Security & Customization',
  //   name: 'Lsp',
  //   icon: ICONS.linkIcon,
  //   iconWhite: ICONS.chainLight,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
  // {
  //   for: 'Security & Customization',
  //   name: 'Balance Info',
  //   icon: ICONS.adminHomeWallet,
  //   iconWhite: ICONS.adminHomeWallet_white,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
  // {
  //   for: 'Security & Customization',
  //   name: 'Bank',
  //   icon: ICONS.bankIcon,
  //   iconWhite: ICONS.bankWhite,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
  // {
  //   for: 'general',
  //   name: 'Channel Closure',
  //   icon: ICONS.settingsBitcoinIcon,
  //   iconWhite: ICONS.settingsBitcoinIconWhite,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },

  {
    for: 'general',
    name: 'ViewAllSwaps',
    displayName: 'screens.inAccount.settingsContent.view all swaps',
    icon: ICONS.liquidIcon,
    iconWhite: ICONS.liquidIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },

  // {
  //   for: 'Closing Account',
  //   name: 'Restore channels',
  //   icon: ICONS.share,
  //   iconWhite: ICONS.shareWhite,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
];
const SETTINGSOPTIONS = [
  [...PREFERENCES],
  [...SECURITYOPTIONS],
  [...ADVANCEDOPTIONS],
  [...OTHEROPTIONS],
  // [...EXPIRIMENTALFEATURES],
];
const DOOMSDAYSETTINGS = [
  //   [
  //     //   // {
  //     //   //   for: 'general',
  //     //   //   name: 'On-Chain Funds',
  //     //   //   icon: ICONS.settingsBitcoinIcon,
  //     //   //   iconWhite: ICONS.settingsBitcoinIconWhite,
  //     //   //   arrowIcon: ICONS.leftCheveronIcon,
  //     //   // },
  //     // {
  //     //   for: 'general',
  //     //   name: 'View Liquid Swaps',
  //     //   icon: ICONS.liquidIcon,
  //     //   iconWhite: ICONS.liquidIconWhite,
  //     //   arrowIcon: ICONS.leftCheveronIcon,
  //     // },
  //   ],
  [
    {
      for: 'Security & Customization',
      name: 'Backup wallet',
      displayName: 'screens.inAccount.settingsContent.backup wallet',
      icon: ICONS.keyIcon,
      iconWhite: ICONS.keyIconWhite,
      arrowIcon: ICONS.leftCheveronIcon,
    },
  ],
  [
    {
      for: 'Closing Account',
      name: 'Delete Wallet',
      displayName: 'screens.inAccount.settingsContent.delete wallet',
      icon: ICONS.trashIcon,
      iconWhite: ICONS.trashIconWhite,
      arrowIcon: ICONS.leftCheveronIcon,
    },
    // {
    //   for: 'Closing Account',
    //   name: 'Restore channels',
    //   icon: ICONS.share,
    //   iconWhite: ICONS.shareWhite,
    //   arrowIcon: ICONS.leftCheveronIcon,
    // },
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
  useHandleBackPressNew();

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
            {element.svgIcon ? (
              <Icon
                color={theme && darkModeType ? COLORS.white : COLORS.primary}
                width={20}
                height={20}
                name={element.svgName}
              />
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
            <ThemeImage
              styles={{
                width: 20,
                height: 20,
                transform: [{ rotate: '180deg' }],
              }}
              lightsOutIcon={ICONS.left_cheveron_white}
              darkModeIcon={ICONS.leftCheveronIcon}
              lightModeIcon={ICONS.leftCheveronIcon}
            />
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
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
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
                Share.share({
                  message: `${t(
                    'share.contact',
                  )}\nhttps://blitzwalletapp.com/u/${myContact?.uniqueName}`,
                });
              }}
            >
              <ThemeImage
                lightModeIcon={ICONS.share}
                darkModeIcon={ICONS.share}
                lightsOutIcon={ICONS.shareWhite}
              />
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
                <ThemeImage
                  styles={styles.buttonImage}
                  lightModeIcon={ICONS.editIcon}
                  darkModeIcon={ICONS.editIconLight}
                  lightsOutIcon={ICONS.editIconLight}
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
                <ThemeImage
                  styles={styles.buttonImage}
                  lightModeIcon={ICONS.scanQrCodeDark}
                  darkModeIcon={ICONS.scanQrCodeLight}
                  lightsOutIcon={ICONS.scanQrCodeLight}
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
              <Icon
                color={theme && darkModeType ? COLORS.white : COLORS.primary}
                width={30}
                height={40}
                name={'posICON'}
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
  },
  goBackTopbar: { marginRight: 'auto' },
  topBarLabel: {
    fontSize: SIZES.large,
    flexShrink: 1,
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
