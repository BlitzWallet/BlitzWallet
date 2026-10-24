import { useCallback, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { GlobalThemeView } from '../../../functions/CustomElements';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';
import { SIZES } from '../../../constants';
import { CENTER } from '../../../constants/styles';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { useGlobalContactsInfo } from '../../../../context-store/globalContacts';
import { useImageCache } from '../../../../context-store/imageCache';
import { useAppStatus } from '../../../../context-store/appStatus';
import { getAllLocalPools } from '../../../functions/pools/poolsStorage';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';

import ProfileCard from './components/ProfileCard';
import AccountsPreview from './components/AccountsPreview';
import PoolsPreview from './components/PoolsPreview';
import SavingsPreview from './components/SavingsPreview';
import GiftsPreview from './components/GiftsPreview';
import AccumulationAddressesPreview from './components/AccumulationAddressesPreview';
import AnalyticsPreview from './components/AnalyticsPreview';

import {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import SectionCard from './components/SectionCard';
import SettingsRow from './components/SettingsRow';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import openWebBrowser from '../../../functions/openWebBrowser';
import { MAX_WEB_CONTENT_WIDTH } from '../../../constants';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import IconButton from '../../../functions/CustomElements/redesign/IconButton';

// Accounts + Point of sale live in the Profile header now (D156). The money
// widgets stay below the list until the Money tab (Chunk 13) takes them.
const INITIAL_WIDGET_ORDER = [
  { id: 'savings', type: 'savings' },
  { id: 'pools', type: 'pools' },
  { id: 'gifts', type: 'gifts' },
  { id: 'accumulation', type: 'accumulation' },
  { id: 'analytics', type: 'analytics' },
];

const DOOMSDAY_ROW = [
  {
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    iconName: 'Lock',
  },
  {
    name: 'Wallet Leaves',
    displayName: 'screens.inAccount.settingsContent.wallet leaves',
    iconName: 'DatabaseBackup',
  },
  {
    name: 'Delete Wallet',
    displayName: 'screens.inAccount.settingsContent.delete wallet',
    iconName: 'Trash2',
    isDestructive: true,
  },
];

export default function SettingsHub(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { cache } = useImageCache();
  const { isConnectedToTheInternet } = useAppStatus();
  const { tokens } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [poolsArray, setPoolsArray] = useState([]);
  const [activePoolsArray, setActivePoolsArray] = useState([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const allPools = await getAllLocalPools();
        const uuid = masterInfoObject?.uuid;
        const owned = allPools.filter(p => p.creatorUUID === uuid);
        setPoolsArray(owned.sort((a, b) => b.createdAt - a.createdAt));
        setActivePoolsArray(
          owned
            .filter(p => p.status === 'active')
            .sort((a, b) => b.createdAt - a.createdAt),
        );
      })();
    }, [masterInfoObject?.uuid]),
  );

  const isDoomsday = props?.route?.params?.isDoomsday;
  const myProfileImage = cache[masterInfoObject?.uuid];
  const myContact = globalContactsInformation?.myProfile;

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      console.log(event);
      scrollY.value = event.contentOffset.y;
    },
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

  const handleSavingsPress = useCallback(() => {
    navigate.navigate('SavingsStack');
  }, [navigate]);
  const handleAccumulationPress = useCallback(() => {
    navigate.navigate('AccumulationAddressesHome');
  }, [navigate]);

  const handleViewAllAccounts = useCallback(() => {
    navigate.navigate('SettingsContentHome', {
      for: 'Accounts',
      initialTab: 'personal',
    });
  }, [navigate]);

  const handleViewAllPools = useCallback(() => {
    navigate.navigate('PoolsStack');
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
    navigate.navigate('GiftsStack');
  }, [navigate]);

  const handleAnalyticsPress = useCallback(() => {
    navigate.navigate('AnalyticsStack');
  }, [navigate]);

  const renderWidgetItem = useCallback(
    ({ item }) => {
      // Ordering is driven by INITIAL_WIDGET_ORDER and rendered as-is in FlashList.
      switch (item.type) {
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
        case 'gifts':
          return <GiftsPreview onPress={handleOpenGifts} />;
        case 'accumulation':
          return (
            <AccumulationAddressesPreview onPress={handleAccumulationPress} />
          );
        case 'analytics':
          return <AnalyticsPreview onPress={handleAnalyticsPress} />;
        default:
          return null;
      }
    },
    [
      activePoolsArray,
      handleAnalyticsPress,
      handleOpenGifts,
      handleViewAllPools,
      handleSavingsPress,
      poolsArray,
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
        <View style={[styles.doomedayContianer, { width: contentWidth }]}>
          <TopBar title={t('settings.index.settingsHead')} />
          <View style={styles.doomedayCard}>
            <ListCard dividerInset={48}>
              {DOOMSDAY_ROW.map(row => (
                <ListRow
                  key={row.name}
                  title={t(row.displayName)}
                  minHeight={52}
                  titleStyle={styles.doomedayRowTitle}
                  tone={row.isDestructive ? 'danger' : 'default'}
                  lead={
                    <Disc
                      icon={row.iconName}
                      size={36}
                      tone={row.isDestructive ? 'danger' : 'default'}
                    />
                  }
                  trailing={
                    row.isDestructive ? undefined : (
                      <ThemeIcon
                        redesign
                        iconName="ChevronRight"
                        size={18}
                        colorOverride={tokens.muted}
                      />
                    )
                  }
                  onPress={() => handleSettingsRowPress(row)}
                />
              ))}
              <ListRow
                title={t('screens.inAccount.settingsContent.blitzRestore')}
                minHeight={52}
                titleStyle={styles.doomedayRowTitle}
                onPress={() => {
                  openWebBrowser({
                    navigate,
                    link: 'https://recover.blitzwalletapp.com/',
                  });
                }}
                trailing={
                  <ThemeIcon
                    redesign
                    iconName="ExternalLink"
                    size={18}
                    colorOverride={tokens.muted}
                  />
                }
              />
            </ListCard>
          </View>
        </View>
      </GlobalThemeView>
    );
  }

  const profileRows = [
    {
      key: 'settings',
      icon: 'Settings',
      label: t('settings.index.settingsHead'),
      onPress: () => navigate.navigate('SettingsIndex'),
    },
    !masterInfoObject?.isChildAccount && {
      key: 'backup',
      icon: 'KeyRound',
      label: t('settings.index.backup'),
      onPress: () => handleSettingsRowPress({ name: 'Backup wallet' }),
    },
    {
      key: 'social',
      icon: 'Share2',
      label: t('settings.index.social'),
      onPress: () =>
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'socialLinks',
        }),
    },
    {
      key: 'pos',
      icon: 'Store',
      label: t('settings.index.pointOfSale'),
      onPress: handlePOS,
    },
    // Nostr stays native only (WM-18).
    Platform.OS !== 'web' && {
      key: 'nostr',
      icon: 'AtSign',
      label: t('settings.index.nostr'),
      onPress: () => handleSettingsRowPress({ name: 'Nostr' }),
    },
  ].filter(Boolean);

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={{ width: contentWidth, ...CENTER }}>
        <TopBar
          title={t('settings.index.profileHead')}
          right={
            <IconButton
              icon="Settings"
              label="settings.index.settingsHead"
              onPress={() => navigate.navigate('SettingsIndex')}
            />
          }
        />
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
          { width: contentWidth, paddingBottom: bottomPadding },
        ]}
        ListHeaderComponent={
          <>
            <ProfileCard
              profileImage={myProfileImage}
              name={myContact?.name || t('constants.annonName')}
              uniqueName={myContact?.uniqueName}
              onEditPress={handleEditProfile}
              onShowQRPress={handleShowQR}
            />
            <AccountsPreview onViewAll={handleViewAllAccounts} />
            <View style={styles.rowsCard}>
              <ListCard dividerInset={64}>
                {profileRows.map(row => (
                  <ListRow
                    key={row.key}
                    title={row.label}
                    minHeight={52}
                    paddingVertical={8}
                    titleStyle={styles.rowTitle}
                    lead={<Disc icon={row.icon} size={36} />}
                    trailing="chevron"
                    onPress={row.onPress}
                  />
                ))}
              </ListCard>
            </View>
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
  listContent: {
    ...CENTER,
  },
  rowsCard: { marginTop: 12, marginBottom: 20 },
  rowTitle: { fontSize: 15, lineHeight: 22 },
  widgetsHeader: {
    width: '100%',
    marginTop: 12,
    marginBottom: 14,
  },
  widgetsTitle: {
    fontSize: SIZES.large,
    includeFontPadding: false,
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
    alignSelf: 'center',
  },
  doomedayCard: { marginTop: 16 },
  doomedayRowTitle: { fontSize: 15, lineHeight: 21 },
});
