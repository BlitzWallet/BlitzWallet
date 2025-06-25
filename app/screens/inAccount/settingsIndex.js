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

const GENERALOPTIONS = [
  {
    for: 'general',
    name: 'About',
    icon: ICONS.aboutIcon,
    iconWhite: ICONS.aboutIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Display Currency',
    icon: ICONS.currencyIcon,
    iconWhite: ICONS.currencyIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },

  {
    for: 'general',
    name: 'Display Options',
    icon: ICONS.colorIcon,
    iconWhite: ICONS.colorIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },

  {
    for: 'general',
    name: 'Edit Contact Profile',
    icon: ICONS.contactsIconBlue,
    iconWhite: ICONS.contactsIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Fast Pay',
    svgIcon: true,
    svgName: 'quickPayIcon',
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'general',
    name: 'Blitz Stats',
    svgName: 'crashDebugIcon',
    icon: ICONS.navigationIcon,
    iconWhite: ICONS.navigationIconWhite,
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
  // {
  //   for: 'general',
  //   name: 'Noster Wallet Connect',
  //   icon: ICONS.Connected,
  //   arrowIcon: ICONS.leftCheveronIcon,
  // },
];
const SECURITYOPTIONS = [
  {
    for: 'Security & Customization',
    name: 'Login Mode',
    icon: ICONS.faceIDIcon,
    iconWhite: ICONS.faceIDIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'Security & Customization',
    name: 'Backup wallet',
    icon: ICONS.keyIcon,
    iconWhite: ICONS.keyIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
];

const EXPIRIMENTALFEATURES = [
  {
    for: 'Experimental features',
    name: 'Experimental',
    svgIcon: true,
    svgName: 'expirementalFeaturesIcon',
    arrowIcon: ICONS.leftCheveronIcon,
  },
];
const ADVANCEDOPTIONS = [
  {
    for: 'general',
    name: 'Crash Reports',
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
    name: 'Refund Liquid Swap',
    icon: ICONS.liquidIcon,
    iconWhite: ICONS.liquidIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'Closing Account',
    name: 'Delete Wallet',
    icon: ICONS.trashIcon,
    iconWhite: ICONS.trashIconWhite,
    arrowIcon: ICONS.leftCheveronIcon,
  },
  {
    for: 'Closing Account',
    name: 'Spark Info',
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
      icon: ICONS.keyIcon,
      iconWhite: ICONS.keyIconWhite,
      arrowIcon: ICONS.leftCheveronIcon,
    },
  ],
  [
    {
      for: 'Closing Account',
      name: 'Reset Wallet',
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
  const {nodeInformation} = useNodeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
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
                element.name?.toLowerCase() === 'restore channels' &&
                (nodeInformation.userBalance === 0 ||
                  !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
                !isDoomsday
              ) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: 'You have no channels to back up',
                });
                return;
              }
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
                  errorMessage:
                    'Please reconnect to the internet to use this feature',
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
              styles={{
                ...styles.listText,
                textTransform:
                  element.name === 'Experimental' ? 'none' : 'capitalize',
              }}
              content={element.name}
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
                ? 'General'
                : id === 1
                ? 'Security'
                : id === 2
                ? 'Technical Settings'
                : 'Experimental Features'
            }
            styles={{...styles.optionsTitle}}
          />
          <View style={[styles.optionsListContainer]}>{internalElements}</View>
        </View>
      );
    });
  }, [
    settignsList,
    nodeInformation.userBalance,
    isDoomsday,
    isConnectedToTheInternet,
    theme,
    darkModeType,
  ]);

  return (
    <GlobalThemeView
      useStandardWidth={true}
      styles={{alignItems: 'center', paddingBottom: 0}}>
      <CustomSettingsTopBar label={'Settings'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{alignItems: 'center'}}
        style={styles.settingsContainer}>
        {settingsElements}
        {!isDoomsday && (
          <>
            <TouchableOpacity
              onPress={() => {
                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'Please reconnect to the internet to use this feature',
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
                content={'Point-of-sale'}
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
