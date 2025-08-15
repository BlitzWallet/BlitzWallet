import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {COLORS, ICONS, SIZES} from '../../constants';
import {useNavigation} from '@react-navigation/native';
import {BlitzSocialOptions} from '../../components/admin/homeComponents/settingsContent';
import {CENTER} from '../../constants/styles';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import {INSET_WINDOW_WIDTH} from '../../constants/theme';
import {useMemo} from 'react';
import Icon from '../../functions/CustomElements/Icon';
import ThemeImage from '../../functions/CustomElements/themeImage';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useNodeContext} from '../../../context-store/nodeContext';
import {useAppStatus} from '../../../context-store/appStatus';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {useGlobalContextProvider} from '../../../context-store/context';
import openWebBrowser from '../../functions/openWebBrowser';
import {useTranslation} from 'react-i18next';

const GENERALOPTIONS = [
  {
    for: 'general',
    name: 'About',
    displayName: 'screens.inAccount.settingsContent.about',
    icon: ICONS.aboutIcon,
    iconWhite: ICONS.aboutIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
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
    name: 'Display Options',
    displayName: 'screens.inAccount.settingsContent.display options',
    icon: ICONS.colorIcon,
    iconWhite: ICONS.colorIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Edit Contact Profile',
    displayName: 'screens.inAccount.settingsContent.edit contact profile',
    icon: ICONS.contactsIconBlue,
    iconWhite: ICONS.contactsIconWhite,
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
    name: 'Blitz Stats',
    displayName: 'screens.inAccount.settingsContent.blitz stats',
    svgName: 'crashDebugIcon',
    icon: ICONS.navigationIcon,
    iconWhite: ICONS.navigationIconWhite,
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
    name: 'Liquid Swaps',
    displayName: 'screens.inAccount.settingsContent.liquid swaps',
    icon: ICONS.liquidIcon,
    iconWhite: ICONS.liquidIconWhite,
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
  {
    for: 'Closing Account',
    name: 'Spark Info',
    displayName: 'screens.inAccount.settingsContent.spark info',
    icon: ICONS.nodeIcon,
    iconWhite: ICONS.nodeIconWhite,
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
  [...GENERALOPTIONS],
  [...SECURITYOPTIONS],
  [...ADVANCEDOPTIONS],
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

export default function SettingsIndex(props) {
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {t} = useTranslation();
  const isDoomsday = props?.route?.params?.isDoomsday;
  const navigate = useNavigation();
  useHandleBackPressNew();

  const settignsList = isDoomsday ? DOOMSDAYSETTINGS : SETTINGSOPTIONS;

  const settingsElements = useMemo(() => {
    return settignsList.map((element, id) => {
      const internalElements = element.map((element, id) => {
        return (
          <TouchableOpacity
            activeOpacity={0.5}
            style={styles.listContainer}
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
            }}>
            {element.svgIcon ? (
              <Icon
                color={theme && darkModeType ? COLORS.white : COLORS.primary}
                width={20}
                height={20}
                name={element.svgName}
              />
            ) : (
              <ThemeImage
                styles={{width: 20, height: 20}}
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
            <ThemeImage
              styles={{width: 20, height: 20, transform: [{rotate: '180deg'}]}}
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
                ? t('screens.inAccount.settingsContent.general')
                : id === 1
                ? t('screens.inAccount.settingsContent.security')
                : id === 2
                ? t('screens.inAccount.settingsContent.technical settings')
                : t('screens.inAccount.settingsContent.experimental features')
            }
            styles={{...styles.optionsTitle}}
          />
          <View style={[styles.optionsListContainer]}>{internalElements}</View>
        </View>
      );
    });
  }, [settignsList, isDoomsday, isConnectedToTheInternet, theme, darkModeType]);

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.settingsContent.settings')}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{alignItems: 'center'}}
        style={styles.settingsContainer}>
        {settingsElements}

        {isDoomsday && (
          <TouchableOpacity
            onPress={() => {
              openWebBrowser({
                navigate,
                link: 'https://recover.blitz-wallet.com/',
              });
            }}
            style={{
              ...styles.posContainer,
              borderColor:
                theme && darkModeType ? COLORS.white : COLORS.primary,
              marginTop: 30,
            }}>
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
              }}>
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
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {alignItems: 'center', paddingBottom: 0},
  settingsContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  optionsContainer: {
    width: '100%',
    marginTop: 10,
  },
  optionsTitle: {
    textTransform: 'capitalize',
    marginBottom: 5,
    fontSize: SIZES.large,
  },
  optionsListContainer: {
    width: '95%',
    padding: 5,
    borderRadius: 8,
    ...CENTER,
  },
  listContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  listText: {
    marginRight: 'auto',
    marginLeft: 10,
    fontSize: SIZES.large,
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
    alignItems: 'center',
  },
});
