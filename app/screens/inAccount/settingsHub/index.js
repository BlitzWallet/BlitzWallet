import { useCallback } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';
import { SIZES } from '../../../constants';
import { CENTER } from '../../../constants/styles';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../constants/theme';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { useGlobalContacts } from '../../../../context-store/globalContacts';
import { useImageCache } from '../../../../context-store/imageCache';
import { useAppStatus } from '../../../../context-store/appStatus';
import { usePools } from '../../../../context-store/poolContext';
import { useToast } from '../../../../context-store/toastManager';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import useAccountSwitcher from '../../../hooks/useAccountSwitcher';
import { copyToClipboard } from '../../../functions';

import ProfileCard from './components/ProfileCard';
import AccountsPreview from './components/AccountsPreview';
import PoolsPreview from './components/PoolsPreview';
import SavingsPreview from './components/SavingsPreview';
import PointOfSaleBanner from './components/PointOfSaleBanner';
import GiftsPreview from './components/GiftsPreview';

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import SectionCard from './components/SectionCard';
import SettingsRow from './components/SettingsRow';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import openWebBrowser from '../../../functions/openWebBrowser';

const INITIAL_WIDGET_ORDER = [
  { id: 'accounts', type: 'accounts' },
  { id: 'savings', type: 'savings' },
  { id: 'pools', type: 'pools' },
  { id: 'gifts', type: 'gifts' },
  { id: 'point-of-sale', type: 'point-of-sale' },
];

const DOOMSDAY_ROW = [
  {
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    iconName: 'Lock',
  },
  {
    name: 'Delete Wallet',
    displayName: 'screens.inAccount.settingsContent.delete wallet',
    iconName: 'Trash2',
  },
];
const SCROLL_THRESHOLD = 100;

export default function SettingsHub(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContacts();
  const { cache } = useImageCache();
  const { isConnectedToTheInternet } = useAppStatus();
  const { activePoolsArray, poolsArray } = usePools();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();

  const {
    isSwitchingAccount,
    handleAccountPress,
    isUsingNostr,
    selectedAltAccount,
  } = useAccountSwitcher();

  const isDoomsday = props?.route?.params?.isDoomsday;
  const myProfileImage = cache[masterInfoObject?.uuid];
  const myContact = globalContactsInformation?.myProfile;
  const pinnedAccountUUIDs = masterInfoObject?.pinnedAccounts || [];

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      console.log(event);
      scrollY.value = event.contentOffset.y;
    },
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
  const widgetOrder = INITIAL_WIDGET_ORDER;

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
  }, [isConnectedToTheInternet, isDoomsday, navigate, t]);

  const handleShowQR = useCallback(() => {
    navigate.navigate('ShowProfileQr');
  }, [navigate]);

  const handleCopyUsername = useCallback(() => {
    copyToClipboard(myContact?.uniqueName, showToast);
  }, [myContact?.uniqueName, showToast]);

  const handleAccountEdit = useCallback(
    account => {
      navigate.navigate('EditAccountPage', {
        account,
        from: 'SettingsHome',
      });
    },
    [navigate],
  );

  const handleSavingsPress = useCallback(() => {
    navigate.navigate('SavingsHome');
  }, [navigate]);

  const handleViewAllAccounts = useCallback(() => {
    navigate.navigate('SettingsContentHome', { for: 'Accounts' });
  }, [navigate]);

  const handleViewAllPools = useCallback(() => {
    navigate.navigate('SettingsContentHome', { for: 'pools' });
  }, [navigate]);

  const handlePOS = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }

    navigate.navigate('SettingsContentHome', { for: 'Point-of-sale' });
  }, [isConnectedToTheInternet, navigate, t]);

  const handleOpenGifts = useCallback(() => {
    navigate.navigate('GiftsPageHome');
  }, [navigate]);

  const renderWidgetItem = useCallback(
    ({ item }) => {
      // Ordering is driven by INITIAL_WIDGET_ORDER and rendered as-is in FlashList.
      switch (item.type) {
        case 'accounts':
          return (
            <AccountsPreview
              pinnedAccountUUIDs={pinnedAccountUUIDs}
              isUsingNostr={isUsingNostr}
              selectedAltAccount={selectedAltAccount}
              isSwitchingAccount={isSwitchingAccount}
              onAccountPress={handleAccountPress}
              onAccountEdit={handleAccountEdit}
              onViewAll={handleViewAllAccounts}
            />
          );
        case 'pools':
          return (
            <PoolsPreview
              activePoolsArray={activePoolsArray}
              poolsArray={poolsArray}
              onViewAll={handleViewAllPools}
            />
          );
        case 'savings':
          return <SavingsPreview onPress={handleSavingsPress} />;
        case 'point-of-sale':
          return <PointOfSaleBanner onPress={handlePOS} />;
        case 'gifts':
          return <GiftsPreview onPress={handleOpenGifts} />;
        default:
          return null;
      }
    },
    [
      activePoolsArray,
      handleAccountEdit,
      handleAccountPress,
      handleOpenGifts,
      handlePOS,
      handleViewAllAccounts,
      handleViewAllPools,
      handleSavingsPress,
      isSwitchingAccount,
      isUsingNostr,
      pinnedAccountUUIDs,
      poolsArray,
      selectedAltAccount,
    ],
  );

  const handleSettingsRowPress = useCallback(
    row => {
      navigate.navigate('SettingsContentHome', {
        for: row.name,
        isDoomsday,
      });
    },
    [isConnectedToTheInternet, isDoomsday],
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
              onPress={() => handleSettingsRowPress(row)}
              isLast={index === rows.length - 1}
              isDestructive={row.isDestructive}
            />
          ))}
        </SectionCard>
      );
    },
    [t, handleSettingsRowPress],
  );

  if (isDoomsday) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
        <CustomSettingsTopBar label={t('settings.index.settingsHead')} />
        <View style={styles.doomedayContianer}>
          {renderSection(DOOMSDAY_ROW)}

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
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={styles.topBar}>
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
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('SettingsIndex');
          }}
        >
          <ThemeIcon iconName={'Settings'} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={widgetOrder}
        estimatedItemSize={132}
        keyExtractor={item => item.id}
        renderItem={renderWidgetItem}
        // onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPadding },
        ]}
        ListHeaderComponent={
          <>
            <ProfileCard
              profileImage={myProfileImage}
              name={myContact?.name || t('constants.annonName')}
              uniqueName={myContact?.uniqueName}
              onEditPress={handleEditProfile}
              onShowQRPress={handleShowQR}
              onCopyUsername={handleCopyUsername}
            />
          </>
        }
      />
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
  goBackTopbar: {
    marginRight: 'auto',
  },
  topBarLabel: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  listContent: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 8,
  },
  widgetsHeader: {
    width: '100%',
    marginTop: 12,
    marginBottom: 14,
  },
  widgetsTitle: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  headerTextContainer: {
    width: '100%',
    paddingHorizontal: 35,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetsSubtitle: {
    marginTop: 2,
    fontSize: SIZES.small,
    opacity: 0.55,
    includeFontPadding: false,
  },
  posContainer: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 2,
    ...CENTER,
    paddingHorizontal: 25,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doomedayContianer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: 20,
  },
});
