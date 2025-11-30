import { StyleSheet, View, Platform, RefreshControl } from 'react-native';
import { UserSatAmount } from './homeLightning/userSatAmount';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import { NavBar } from './navBar';
import { useNavigation } from '@react-navigation/native';
import { useUpdateHomepageTransactions } from '../../../hooks/updateHomepageTransactions';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../../context-store/appStatus';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { SendRecieveBTNs } from './homeLightning/sendReciveBTNs';
import { useSparkWallet } from '../../../../context-store/sparkContext';
import getFormattedHomepageTxsForSpark from '../../../functions/combinedTransactionsSpark';
import GetThemeColors from '../../../hooks/themeColors';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import LRC20Assets from './homeLightning/lrc20Assets';
import { useLiquidEvent } from '../../../../context-store/liquidEventContext';
import { useRootstockProvider } from '../../../../context-store/rootstockSwapContext';
import { crashlyticsLogReport } from '../../../functions/crashlyticsLogs';
import { COLORS, SIZES } from '../../../constants';
import FormattedSatText from '../../../functions/CustomElements/satTextDisplay';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { TAB_ITEM_HEIGHT } from '../../../../navigation/tabs';
import { useActiveCustodyAccount } from '../../../../context-store/activeAccount';
import { fullRestoreSparkState } from '../../../functions/spark/restore';
import {
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../../../functions/spark/transactions';
import { scheduleOnRN } from 'react-native-worklets';

const MemoizedNavBar = memo(NavBar);
const MemoizedUserSatAmount = memo(UserSatAmount);
const MemoizedSendRecieveBTNs = memo(SendRecieveBTNs);
const MemoizedLRC20Assets = memo(LRC20Assets);

export default function HomeLightning() {
  const {
    sparkInformation,
    showTokensInformation,
    // numberOfCachedTxs
  } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { theme, darkModeType, toggleTheme } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isConnectedToTheInternet, didGetToHomepage, toggleDidGetToHomepage } =
    useAppStatus();
  const { topPadding, bottomPadding } = useGlobalInsets();
  const navigate = useNavigation();
  const currentTime = useUpdateHomepageTransactions();
  const { t } = useTranslation();
  const { backgroundColor } = GetThemeColors();

  const scrollY = useSharedValue(0);
  const [navbarHeight, setNavbarHeight] = useState(0);

  const [scrollContentChanges, setScrollContentChanges] = useState({
    borderRadius: false,
    backgroundColor: backgroundColor,
  });
  const [refreshing, setRefreshing] = useState(false);

  const { startLiquidEventListener } = useLiquidEvent();
  const { startRootstockEventListener } = useRootstockProvider();

  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const enabledLRC20 = showTokensInformation;
  const didViewSeedPhrase = masterInfoObject?.didViewSeedPhrase;

  const BALANCE_FADE_START = navbarHeight;
  const BALANCE_FADE_END = 100;

  useEffect(() => {
    setTimeout(() => {
      toggleDidGetToHomepage(true);
    }, 250);
  }, []);

  const handleStateUpdate = useCallback(
    newObj => {
      if (
        newObj.borderRadius === scrollContentChanges.borderRadius &&
        newObj.backgroundColor === scrollContentChanges.backgroundColor
      )
        return;
      setScrollContentChanges(newObj);
    },
    [scrollContentChanges],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;

      const offsetY = event.contentOffset.y;
      const newBorderRadius = offsetY > 40;
      const newBg = offsetY > 100;

      scheduleOnRN(handleStateUpdate, {
        borderRadius: newBorderRadius,
        backgroundColor: newBg,
      });
    },
  });

  const balanceOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [BALANCE_FADE_START, BALANCE_FADE_END],
      [0, 1],
      'clamp',
    );

    const translateY = interpolate(
      scrollY.value,
      [BALANCE_FADE_START, BALANCE_FADE_END],
      [10, 0],
      'clamp',
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const flatListDataForSpark = useMemo(() => {
    return (
      getFormattedHomepageTxsForSpark({
        currentTime,
        sparkInformation,
        homepageTxPreferance,
        navigate,
        frompage: 'home',
        viewAllTxText: t('wallet.homeLightning.home.see_all_txs'),
        noTransactionHistoryText: t(
          'wallet.homeLightning.home.no_transaction_history',
        ),
        todayText: t('constants.today'),
        yesterdayText: t('constants.yesterday'),
        dayText: t('constants.day'),
        monthText: t('constants.month'),
        yearText: t('constants.year'),
        agoText: t('transactionLabelText.ago'),
        theme,
        darkModeType,
        userBalanceDenomination,
        // numberOfCachedTxs,
        didGetToHomepage,
        enabledLRC20,
      }) || []
    );
  }, [
    currentTime,
    sparkInformation.transactions,
    sparkInformation.didConnect,
    homepageTxPreferance,
    userBalanceDenomination,
    // numberOfCachedTxs,
    didGetToHomepage,
    theme,
    darkModeType,
    t,
    enabledLRC20,
  ]);

  // Memoize the list data
  const listData = useMemo(() => {
    return [
      { type: 'navbar', key: 'navbar' },
      { type: 'balance', key: 'balance' },
      { type: 'buttons', key: 'buttons' },
      ...(flatListDataForSpark || []),
    ];
  }, [flatListDataForSpark]);

  const handleRefresh = useCallback(async () => {
    crashlyticsLogReport(`Running in handle refresh function on homepage`);
    try {
      if (!sparkInformation.identityPubKey || !sparkInformation.didConnect)
        return;
      startLiquidEventListener(6);
      startRootstockEventListener({ intervalMs: 60000 });

      const response = await fullRestoreSparkState({
        sparkAddress: sparkInformation.sparkAddress,
        batchSize: 2,
        isSendingPayment: false,
        mnemonic: currentWalletMnemoinc,
        identityPubKey: sparkInformation.identityPubKey,
        isInitialRestore: false,
      });
      if (!response) {
        sparkTransactionsEventEmitter.emit(
          SPARK_TX_UPDATE_ENVENT_NAME,
          'fullUpdate',
        );
      }
    } catch (err) {
      console.log('error refreshing on homepage', err);
    } finally {
      setRefreshing(false);
    }
  }, [
    startLiquidEventListener,
    startRootstockEventListener,
    sparkInformation,
    currentWalletMnemoinc,
  ]);

  const handleNavbarLayout = useCallback(event => {
    const { height } = event.nativeEvent.layout;
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
    ({ item }) => {
      if (!item) return null;
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
              ]}
            >
              <MemoizedNavBar
                darkModeType={darkModeType}
                theme={theme}
                toggleTheme={toggleTheme}
                sparkBalance={sparkInformation?.balance}
                sparkTokens={sparkInformation?.tokens}
                didViewSeedPhrase={didViewSeedPhrase}
              />

              <Animated.View
                style={[styles.navbarBalance, balanceOpacityStyle]}
                pointerEvents="none"
              >
                <FormattedSatText
                  useMillionDenomination={true}
                  styles={styles.navbarBalanceText}
                  balance={sparkInformation.balance}
                  useSizing={true}
                />
              </Animated.View>
            </View>
          );
        case 'balance':
          return (
            <View
              style={[
                styles.balanceSection,
                {
                  backgroundColor: backgroundColor,
                },
              ]}
            >
              <ThemeText
                content={
                  showTokensInformation
                    ? t('constants.sat_balance')
                    : t('constants.total_balance')
                }
                styles={{ textTransform: 'uppercase' }}
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
                { backgroundColor: backgroundColor },
              ]}
            >
              <MemoizedSendRecieveBTNs
                theme={theme}
                darkModeType={darkModeType}
                isConnectedToTheInternet={isConnectedToTheInternet}
              />
              {showTokensInformation && (
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
      balanceOpacityStyle,
      darkModeType,
      sparkInformation.balance,
      showTokensInformation,
      t,
      isConnectedToTheInternet,
      sparkInformation,
      didViewSeedPhrase,
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

  const scrollViewContainerStyles = useMemo(() => {
    return {
      flexGrow: 1,
      backgroundColor: homepageBackgroundOffsetColor,
      paddingBottom: bottomPadding + TAB_ITEM_HEIGHT,
    };
  }, [homepageBackgroundOffsetColor, bottomPadding]);

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
        initialNumToRender={homepageTxPreferance || 25}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        data={listData}
        keyExtractor={(item, index) => item.key || index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollViewContainerStyles}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={renderItem}
        stickyHeaderIndices={[0]}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  navbarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 10,
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
  balanceSection: {
    alignItems: 'center',
    paddingTop: 30,
  },
  buttonsContainer: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
});
