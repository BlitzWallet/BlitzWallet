import {
  StyleSheet,
  View,
  Platform,
  RefreshControl,
  Animated,
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
import {COLORS, SIZES} from '../../../constants';
import FormattedSatText from '../../../functions/CustomElements/satTextDisplay';

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
  const {backgroundColor} = GetThemeColors();

  const scrollY = useRef(new Animated.Value(0)).current;
  const balanceOpacityInNav = useRef(new Animated.Value(0)).current;

  const scrollListenerRef = useRef(null);

  const [scrollContentChanges, setScrollContentChanges] = useState({
    borderRadius: false,
    backgroundColor: backgroundColor,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState(0);

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

  const BALANCE_FADE_START = navbarHeight; // When balance starts fading into navbar
  const BALANCE_FADE_END = 100; // When balance is fully in navbar
  const BALANCE_RETURN_START = 50; // When balance starts returning from navbar
  const BALANCE_RETURN_END = navbarHeight; // When balance is fully back in original position

  useEffect(() => {
    toggleDidGetToHomepage(true);
  }, []);

  useEffect(() => {
    if (BALANCE_FADE_START === 0) return;

    if (scrollListenerRef.current) {
      scrollY.removeListener(scrollListenerRef.current);
    }

    scrollListenerRef.current = scrollY.addListener(({value}) => {
      if (value >= BALANCE_FADE_START && value <= BALANCE_FADE_END) {
        const progress =
          (value - BALANCE_FADE_START) /
          (BALANCE_FADE_END - BALANCE_FADE_START);
        balanceOpacityInNav.setValue(progress);
      } else if (value >= BALANCE_RETURN_END && value <= BALANCE_RETURN_START) {
        const progress =
          (BALANCE_RETURN_START - value) /
          (BALANCE_RETURN_START - BALANCE_RETURN_END);
        balanceOpacityInNav.setValue(1 - progress);
      } else if (value < BALANCE_RETURN_END) {
        balanceOpacityInNav.setValue(0);
      } else if (value > BALANCE_FADE_END) {
        balanceOpacityInNav.setValue(1);
      }
    });

    return () => {
      scrollY.removeListener(scrollListenerRef.current);
    };
  }, [BALANCE_FADE_START]);

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
    } finally {
      setRefreshing(false);
    }
  }, [startLiquidEventListener, startRootstockEventListener]);

  const handleScroll = useCallback(
    e => {
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
    },
    [enabledLRC20],
  );

  const handleNavbarLayout = useCallback(event => {
    const {height} = event.nativeEvent.layout;
    setNavbarHeight(height);
  }, []);

  const colors = useMemo(
    () =>
      Platform.select({
        ios: darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        android: darkModeType && theme ? COLORS.lightModeText : COLORS.primary,
      }),
    [darkModeType, theme],
  );

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

  const renderItem = useCallback(
    ({item}) => {
      switch (item.type) {
        case 'navbar':
          return (
            <View
              onLayout={handleNavbarLayout}
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

              <Animated.View
                style={[
                  styles.navbarBalance,
                  {
                    opacity: balanceOpacityInNav,
                    transform: [
                      {
                        translateY: balanceOpacityInNav.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none">
                <FormattedSatText
                  styles={styles.navbarBalanceText}
                  balance={sparkInformation.balance}
                />
              </Animated.View>
            </View>
          );
        case 'balance':
          return (
            <Animated.View
              style={[
                styles.balanceSection,
                {
                  backgroundColor: backgroundColor,
                },
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
            </Animated.View>
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
      handleNavbarLayout,
      scrollContentChanges.borderRadius,
      backgroundColor,
      theme,
      toggleTheme,
      balanceOpacityInNav,
      darkModeType,
      sparkInformation.balance,
      lrc20Settings.isEnabled,
      t,
      isConnectedToTheInternet,
      sparkInformation,
    ],
  );

  const homepageBackgroundOffsetColor = useMemo(() => {
    return enabledLRC20
      ? theme
        ? darkModeType
          ? COLORS.walletHomeLightsOutOffset
          : COLORS.walletHomeDarkModeOffset
        : COLORS.walletHomeLightModeOffset
      : backgroundColor;
  }, [theme, darkModeType, enabledLRC20]);

  const globlThemeViewMemodStlyes = useMemo(() => {
    return {
      flex: 1,
      backgroundColor: scrollContentChanges.backgroundColor
        ? homepageBackgroundOffsetColor
        : backgroundColor,
      paddingBottom: 0,
    };
  }, [
    scrollContentChanges.backgroundColor,
    homepageBackgroundOffsetColor,
    backgroundColor,
  ]);
  const topPaddingForLRC20PageMemeStyles = useMemo(() => {
    return {
      backgroundColor: backgroundColor,
      position: 'absolute',
      top: 0,
      width: '100%',
      height: topPadding,
      zIndex: 99,
    };
  }, [backgroundColor, topPadding]);
  return (
    <GlobalThemeView styles={globlThemeViewMemodStlyes}>
      {enabledLRC20 && <View style={topPaddingForLRC20PageMemeStyles} />}
      <Animated.FlatList
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
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {
            useNativeDriver: false,
            listener: handleScroll,
          },
        )}
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
    position: 'relative',
  },
  navbarBalance: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  navbarBalanceText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
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
