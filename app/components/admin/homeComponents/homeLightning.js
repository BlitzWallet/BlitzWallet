import {
  StyleSheet,
  View,
  FlatList,
  Platform,
  RefreshControl,
} from 'react-native';
import {UserSatAmount} from './homeLightning/userSatAmount';
import {useGlobalContextProvider} from '../../../../context-store/context';
import {GlobalThemeView, ThemeText} from '../../../functions/CustomElements';
import {NavBar} from './navBar';

import {useNavigation} from '@react-navigation/native';
import {useUpdateHomepageTransactions} from '../../../hooks/updateHomepageTransactions';
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppStatus} from '../../../../context-store/appStatus';
import {useGlobalThemeContext} from '../../../../context-store/theme';
import {SendRecieveBTNs} from './homeLightning/sendReciveBTNs';
import {useSparkWallet} from '../../../../context-store/sparkContext';
import getFormattedHomepageTxsForSpark from '../../../functions/combinedTransactionsSpark';
import GetThemeColors from '../../../hooks/themeColors';
import {useGlobalInsets} from '../../../../context-store/insetsProvider';
import LRC20Assets from './homeLightning/lrc20Assets';
import {useLiquidEvent} from '../../../../context-store/liquidEventContext';
import {useRootstockProvider} from '../../../../context-store/rootstockSwapContext';
import {
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../../../functions/spark/transactions';
import {crashlyticsLogReport} from '../../../functions/crashlyticsLogs';
import {COLORS} from '../../../constants';
import {useLRC20EventContext} from '../../../../context-store/lrc20Listener';

// Memoized components to prevent unnecessary re-renders
const MemoizedNavBar = memo(NavBar);
const MemoizedUserSatAmount = memo(UserSatAmount);
const MemoizedSendRecieveBTNs = memo(SendRecieveBTNs);
const MemoizedLRC20Assets = memo(LRC20Assets);

export default function HomeLightning() {
  const {sparkInformation, numberOfCachedTxs} = useSparkWallet();
  const {theme, darkModeType, toggleTheme} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {isConnectedToTheInternet, didGetToHomepage, toggleDidGetToHomepage} =
    useAppStatus();
  const {topPadding} = useGlobalInsets();
  const navigate = useNavigation();
  const currentTime = useUpdateHomepageTransactions();
  const {t} = useTranslation();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  // State optimizations
  const [scrollContentChanges, setScrollContentChanges] = useState({
    borderRadius: false,
    backgroundColor: backgroundColor,
  });
  const [refreshing, setRefreshing] = useState(false);

  const scrollOffset = useRef(0);
  const frame = useRef(null);
  const {startLiquidEventListener} = useLiquidEvent();
  const {startRootstockEventListener} = useRootstockProvider();

  // Extract memoized values
  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const enabledLRC20 = masterInfoObject.lrc20Settings?.isEnabled;
  const lrc20Settings = useMemo(
    () => masterInfoObject.lrc20Settings || {},
    [masterInfoObject.lrc20Settings],
  );

  useEffect(() => {
    toggleDidGetToHomepage(true);
  }, []);

  // Memoize the formatted transactions
  const flatListDataForSpark = useMemo(() => {
    return (
      getFormattedHomepageTxsForSpark({
        currentTime,
        sparkInformation,
        homepageTxPreferance,
        navigate,
        frompage: 'home',
        viewAllTxText: t('wallet.see_all_txs'),
        noTransactionHistoryText: t('wallet.no_transaction_history'),
        todayText: t('constants.today'),
        yesterdayText: t('constants.yesterday'),
        dayText: t('constants.day'),
        monthText: t('constants.month'),
        yearText: t('constants.year'),
        agoText: t('transactionLabelText.ago'),
        theme,
        darkModeType,
        userBalanceDenomination,
        numberOfCachedTxs,
        didGetToHomepage,
        enabledLRC20,
      }) || []
    );
  }, [
    currentTime,
    sparkInformation.transactions,
    homepageTxPreferance,
    userBalanceDenomination,
    numberOfCachedTxs,
    didGetToHomepage,
    theme,
    darkModeType,
    t,
    enabledLRC20,
  ]);

  // Memoize the list data
  const listData = useMemo(() => {
    return [
      {type: 'navbar', key: 'navbar'},
      {type: 'balance', key: 'balance'},
      {type: 'buttons', key: 'buttons'},
      ...flatListDataForSpark?.map((tx, i) => ({
        type: 'tx',
        item: tx,
        key: i.toString(),
      })),
    ];
  }, [flatListDataForSpark]);

  // Memoize the refresh handler
  const handleRefresh = useCallback(async () => {
    crashlyticsLogReport(`Running in handle refresh function on homepage`);
    try {
      startLiquidEventListener(2);
      startRootstockEventListener({intervalMs: 30000});
      sparkTransactionsEventEmitter.emit(
        SPARK_TX_UPDATE_ENVENT_NAME,
        'fullUpdate',
      );
    } catch (err) {
      console.log('error refreshing on homepage', err);
      CrashReportingSettingsPage(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [startLiquidEventListener, startRootstockEventListener]);

  // Optimize scroll handler with debouncing
  const handleScroll = useCallback(e => {
    scrollOffset.current = e.nativeEvent.contentOffset.y;

    if (frame.current) return;

    frame.current = requestAnimationFrame(() => {
      const offsetY = scrollOffset.current;

      setScrollContentChanges(prev => {
        const newBorderRadius = offsetY > 40;
        const newBg = offsetY > 100;
        if (
          prev.borderRadius !== newBorderRadius ||
          prev.backgroundColor !== newBg
        ) {
          return {
            borderRadius: newBorderRadius,
            backgroundColor: newBg,
          };
        }
        return prev;
      });

      frame.current = null;
    });
  }, []);

  // Memoize colors to prevent recalculation
  const colors = useMemo(
    () =>
      Platform.select({
        ios: darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        android: darkModeType && theme ? COLORS.lightModeText : COLORS.primary,
      }),
    [darkModeType, theme],
  );

  // Memoize refresh control to prevent recreation
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        colors={[colors]}
        tintColor={darkModeType && theme ? COLORS.darkModeText : COLORS.primary}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    ),
    [colors, refreshing, handleRefresh, darkModeType, theme],
  );

  // Render item function with memoized components
  const renderItem = useCallback(
    ({item}) => {
      switch (item.type) {
        case 'navbar':
          return (
            <View
              style={[
                styles.navbarContainer,
                {
                  backgroundColor: backgroundColor,
                  borderBottomLeftRadius: scrollContentChanges.borderRadius
                    ? 30
                    : 0,
                  borderBottomRightRadius: scrollContentChanges.borderRadius
                    ? 30
                    : 0,
                },
              ]}>
              <MemoizedNavBar theme={theme} toggleTheme={toggleTheme} />
            </View>
          );
        case 'balance':
          return (
            <View
              style={[
                styles.balanceSection,
                {backgroundColor: backgroundColor},
              ]}>
              <ThemeText
                content={
                  lrc20Settings.isEnabled
                    ? 'SAT Balance'
                    : t('constants.total_balance')
                }
                styles={{textTransform: 'uppercase'}}
              />
              <MemoizedUserSatAmount
                isConnectedToTheInternet={isConnectedToTheInternet}
                theme={theme}
                darkModeType={darkModeType}
                sparkInformation={sparkInformation}
              />
            </View>
          );
        case 'buttons':
          return (
            <View
              style={[
                styles.buttonsContainer,
                {backgroundColor: backgroundColor},
              ]}>
              <MemoizedSendRecieveBTNs
                theme={theme}
                darkModeType={darkModeType}
                isConnectedToTheInternet={isConnectedToTheInternet}
              />
              {lrc20Settings.isEnabled && (
                <MemoizedLRC20Assets
                  theme={theme}
                  darkModeType={darkModeType}
                />
              )}
            </View>
          );
        case 'tx':
          return item.item;
        default:
          return null;
      }
    },
    [
      scrollContentChanges.borderRadius,
      backgroundOffset,
      theme,
      toggleTheme,
      lrc20Settings.isEnabled,
      t,
      isConnectedToTheInternet,
      darkModeType,
      sparkInformation,
    ],
  );

  const homepageBackgroundOffsetColor = useMemo(() => {
    return theme
      ? darkModeType
        ? COLORS.walletHomeLightsOutOffset
        : COLORS.walletHomeDarkModeOffset
      : COLORS.walletHomeLightModeOffset;
  }, [theme, darkModeType]);

  return (
    <GlobalThemeView
      styles={{
        flex: 1,
        backgroundColor: scrollContentChanges.backgroundColor
          ? homepageBackgroundOffsetColor
          : backgroundColor,
        paddingBottom: 0,
      }}>
      <View
        style={[
          {
            backgroundColor: backgroundColor,
            position: 'absolute',
            top: 0,
            width: '100%',
            height: topPadding,
            zIndex: 99,
          },
        ]}
      />
      <FlatList
        refreshControl={refreshControl}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        data={listData}
        keyExtractor={(item, index) => item.key || index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          backgroundColor: homepageBackgroundOffsetColor,
          flexGrow: 1,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={renderItem}
        stickyHeaderIndices={[0]}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  navbarContainer: {
    zIndex: 0,
    paddingBottom: 10,
  },
  topSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  balanceSection: {
    alignItems: 'center',
    paddingTop: 30,
  },
  buttonsContainer: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
});
