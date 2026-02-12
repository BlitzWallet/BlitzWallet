import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS, ICONS, SIZES } from '../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../constants/theme';
import { CENTER } from '../../../constants/styles';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { useGlobalContacts } from '../../../../context-store/globalContacts';
import { useImageCache } from '../../../../context-store/imageCache';
import { useAppStatus } from '../../../../context-store/appStatus';
import { usePools } from '../../../../context-store/poolContext';
import { useToast } from '../../../../context-store/toastManager';
import GetThemeColors from '../../../hooks/themeColors';
import useAccountSwitcher from '../../../hooks/useAccountSwitcher';
import { copyToClipboard } from '../../../functions';
import { shareMessage } from '../../../functions/handleShare';
import openWebBrowser from '../../../functions/openWebBrowser';
import { supportedLanguagesList } from '../../../../locales/localeslist';

import ProfileCard from './components/ProfileCard';
import AccountsPreview from './components/AccountsPreview';
import PoolsPreview from './components/PoolsPreview';
import SectionCard from './components/SectionCard';
import SettingsRow from './components/SettingsRow';
import PointOfSaleBanner from './components/PointOfSaleBanner';
import { BlitzSocialOptions } from '../../../components/admin/homeComponents/settingsContent';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const PREFERENCES_ROWS = [
  {
    name: 'Display Currency',
    displayName: 'screens.inAccount.settingsContent.display currency',
    iconName: 'Coins',
    hasInlineValue: 'fiatCurrency',
  },
  {
    name: 'Language',
    displayName: 'screens.inAccount.settingsContent.language',
    iconName: 'Languages',
    hasInlineValue: 'language',
  },
  {
    name: 'Display Options',
    displayName: 'screens.inAccount.settingsContent.display options',
    iconName: 'Palette',
  },
  {
    name: 'Fast Pay',
    displayName: 'screens.inAccount.settingsContent.fast pay',
    iconName: 'ClockFading',
  },
  {
    name: 'Notifications',
    displayName: 'screens.inAccount.settingsContent.notifications',
    iconName: 'Bell',
  },
];

const SECURITY_ROWS = [
  {
    name: 'Login Mode',
    displayName: 'screens.inAccount.settingsContent.login mode',
    iconName: 'ScanFace',
  },
  {
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    iconName: 'Lock',
  },
];

const TECHNICAL_ROWS = [
  {
    name: 'Spark Info',
    displayName: 'screens.inAccount.settingsContent.spark info',
    iconName: 'VectorSquare',
  },
  {
    name: 'Nostr',
    displayName: 'screens.inAccount.settingsContent.nostr',
    iconName: 'Link',
  },
  {
    name: 'Blitz Fee Details',
    displayName: 'screens.inAccount.settingsContent.blitz fee details',
    iconImage: ICONS.receiptIcon,
    iconImageWhite: ICONS.receiptWhite,
  },
  {
    name: 'Crash Reports',
    displayName: 'screens.inAccount.settingsContent.crash reports',
    iconName: 'ShieldCheck',
  },
  {
    name: 'ViewAllSwaps',
    displayName: 'screens.inAccount.settingsContent.view all swaps',
    iconName: 'SendToBack',
  },
];

const OTHER_ROWS = [
  {
    name: 'About',
    displayName: 'screens.inAccount.settingsContent.about',
    iconName: 'Info',
  },
  {
    name: 'Blitz Stats',
    displayName: 'screens.inAccount.settingsContent.blitz stats',
    iconName: 'ChartArea',
  },
];

const DELETE_ROW = {
  name: 'Delete Wallet',
  displayName: 'screens.inAccount.settingsContent.delete wallet',
  iconName: 'Trash2',
  isDestructive: true,
};

const REQUIRES_INTERNET = [
  'display currency',
  'fast pay',
  'point-of-sale',
  'edit contact profile',
];
const SCROLL_THRESHOLD = 330;

export default function SettingsHub(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContacts();
  const { cache } = useImageCache();
  const { isConnectedToTheInternet } = useAppStatus();
  const { backgroundOffset } = GetThemeColors();
  const { activePoolsArray, poolsArray } = usePools();
  const { bottomPadding } = useGlobalInsets();

  const {
    accounts,
    activeAccount,
    isSwitchingAccount,
    handleAccountPress,
    isUsingNostr,
    selectedAltAccount,
  } = useAccountSwitcher();

  const isDoomsday = props?.route?.params?.isDoomsday;
  const myProfileImage = cache[masterInfoObject?.uuid];
  const myContact = globalContactsInformation?.myProfile;
  const pinnedAccountUUIDs = masterInfoObject.pinnedAccounts;

  const currentLanguage = supportedLanguagesList.find(
    item => item.id === masterInfoObject.userSelectedLanguage,
  )?.languageName;

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });

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

  const handleSettingsRowPress = useCallback(
    row => {
      if (
        !isConnectedToTheInternet &&
        REQUIRES_INTERNET.includes(row.name.toLowerCase())
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.nointernet'),
        });
        return;
      }
      navigate.navigate('SettingsContentHome', {
        for: row.name,
        isDoomsday,
      });
    },
    [isConnectedToTheInternet, isDoomsday],
  );

  const handleEditProfile = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('SettingsContentHome', {
      for: 'edit contact profile',
      isDoomsday,
    });
  }, [isConnectedToTheInternet, isDoomsday]);

  const handleShowQR = useCallback(() => {
    navigate.navigate('ShowProfileQr');
  }, []);

  const handleCopyUsername = useCallback(() => {
    copyToClipboard(myContact?.uniqueName, showToast);
  }, [myContact?.uniqueName]);

  const handleAccountEdit = useCallback(account => {
    navigate.navigate('EditAccountPage', {
      account,
      from: 'SettingsHome',
    });
  }, []);

  const handleViewAllAccounts = useCallback(() => {
    navigate.navigate('SettingsContentHome', { for: 'Accounts' });
  }, []);

  const handleViewAllPools = useCallback(() => {
    navigate.navigate('SettingsContentHome', { for: 'pools' });
  }, []);

  const handlePOS = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('SettingsContentHome', { for: 'Point-of-sale' });
  }, [isConnectedToTheInternet]);

  const handleBlitzRestore = useCallback(() => {
    openWebBrowser({
      navigate,
      link: 'https://recover.blitzwalletapp.com/',
    });
  }, []);

  const getInlineValue = useCallback(
    row => {
      if (row.hasInlineValue === 'fiatCurrency') {
        return masterInfoObject.fiatCurrency?.toUpperCase();
      }
      if (row.hasInlineValue === 'language') {
        return currentLanguage;
      }
      return undefined;
    },
    [masterInfoObject.fiatCurrency, currentLanguage],
  );

  const renderSection = useCallback(
    (rows, title) => {
      return (
        <SectionCard title={title}>
          {rows.map((row, index) => (
            <SettingsRow
              key={row.name}
              iconName={row.iconName}
              iconImage={row.iconImage}
              iconImageWhite={row.iconImageWhite}
              label={t(row.displayName)}
              inlineValue={getInlineValue(row)}
              onPress={() => handleSettingsRowPress(row)}
              isLast={index === rows.length - 1}
              isDestructive={row.isDestructive}
            />
          ))}
        </SectionCard>
      );
    },
    [t, getInlineValue, handleSettingsRowPress],
  );

  if (isDoomsday) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
        <CustomSettingsTopBar label={t('settings.index.settingsHead')} />
        <ScrollView
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
        >
          {renderSection(
            [SECURITY_ROWS.find(r => r.name === 'Backup wallet')],
            '',
          )}
          {renderSection([DELETE_ROW], '')}
          <TouchableOpacity
            onPress={handleBlitzRestore}
            style={[
              styles.restoreBanner,
              {
                borderColor:
                  theme && darkModeType ? COLORS.white : COLORS.primary,
              },
            ]}
          >
            <ThemeText
              styles={{
                color: theme && darkModeType ? COLORS.white : COLORS.primary,
                fontSize: SIZES.xLarge,
                includeFontPadding: false,
              }}
              content={t('screens.inAccount.settingsContent.blitzRestore')}
            />
          </TouchableOpacity>
        </ScrollView>
      </GlobalThemeView>
    );
  }

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
        contentContainerStyle={styles.scrollContent}
      >
        <ProfileCard
          profileImage={myProfileImage}
          name={myContact?.name || t('constants.annonName')}
          uniqueName={myContact?.uniqueName}
          onEditPress={handleEditProfile}
          onShowQRPress={handleShowQR}
          onCopyUsername={handleCopyUsername}
        />

        <AccountsPreview
          accounts={accounts}
          pinnedAccountUUIDs={pinnedAccountUUIDs}
          isUsingNostr={isUsingNostr}
          selectedAltAccount={selectedAltAccount}
          isSwitchingAccount={isSwitchingAccount}
          onAccountPress={handleAccountPress}
          onAccountEdit={handleAccountEdit}
          onViewAll={handleViewAllAccounts}
        />

        <PoolsPreview
          activePoolsArray={activePoolsArray}
          poolsArray={poolsArray}
          onViewAll={handleViewAllPools}
        />

        {renderSection(
          PREFERENCES_ROWS,
          t('screens.inAccount.settingsContent.preferences'),
        )}

        {renderSection(
          SECURITY_ROWS,
          t('screens.inAccount.settingsContent.security'),
        )}

        {renderSection(
          TECHNICAL_ROWS,
          t('screens.inAccount.settingsContent.technical settings'),
        )}

        {renderSection(OTHER_ROWS)}

        {renderSection([DELETE_ROW])}

        <PointOfSaleBanner onPress={handlePOS} />

        <BlitzSocialOptions />
      </Animated.ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    minHeight: 30,
  },
  topBarTitle: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  topBarSpacer: {
    width: 24,
  },
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 8,
    gap: 25,
  },
  restoreBanner: {
    width: '100%',
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 16,
    alignItems: 'center',
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
});
