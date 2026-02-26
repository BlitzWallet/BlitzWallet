import {
  StyleSheet,
  View,
  Platform,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { UserSatAmount } from './homeLightning/userSatAmount';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import { NavBar } from './navBar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  useHandler,
  useEvent,
} from 'react-native-reanimated';
import { TAB_ITEM_HEIGHT } from '../../../../navigation/tabs';
import { useActiveCustodyAccount } from '../../../../context-store/activeAccount';
import { fullRestoreSparkState } from '../../../functions/spark/restore';
import {
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../../../functions/spark/transactions';
import { scheduleOnRN } from 'react-native-worklets';
import { BalanceDots } from './homeLightning/balanceDots';
import { useUserBalanceContext } from '../../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../../context-store/flashnetContext';
import { formatBalanceAmount } from '../../../functions';
import TokensPreview from '../homeComponents/homeLightning/TokensPreview';

const MemoizedNavBar = memo(NavBar);
const MemoizedUserSatAmount = memo(UserSatAmount);
const MemoizedSendRecieveBTNs = memo(SendRecieveBTNs);
const MemoizedLRC20Assets = memo(LRC20Assets);

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const MemoizedStickyNavbarContainer = memo(
  function MemoizedStickyNavbarContainer({
    backgroundColor,
    borderRadius,
    onLayout,
    darkModeType,
    theme,
    toggleTheme,
    sparkBalance,
    sparkTokens,
    didViewSeedPhrase,
    masterInfoObject,
    totalSatValue,
    bitcoinBalance,
    dollarBalanceToken,
    scrollPosition,
    balanceOpacityStyle,
  }) {
    return (
      <View
        onLayout={onLayout}
        style={[
          styles.navbarContainer,
          {
            backgroundColor,
            borderBottomLeftRadius: borderRadius ? 30 : 0,
            borderBottomRightRadius: borderRadius ? 30 : 0,
          },
        ]}
      >
        <MemoizedNavBar
          darkModeType={darkModeType}
          theme={theme}
          toggleTheme={toggleTheme}
          sparkBalance={sparkBalance}
          sparkTokens={sparkTokens}
          didViewSeedPhrase={didViewSeedPhrase}
        />

        <Animated.View
          style={[styles.navbarBalance, balanceOpacityStyle]}
          pointerEvents="none"
        >
          <FormattedSatText
            styles={styles.navbarBalanceText}
            globalBalanceDenomination={
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? masterInfoObject.userBalanceDenomination
                : scrollPosition === 'total'
                ? masterInfoObject.userBalanceDenomination
                : scrollPosition === 'sats'
                ? 'sats'
                : 'fiat'
            }
            balance={
              scrollPosition === 'total'
                ? totalSatValue
                : scrollPosition === 'sats'
                ? bitcoinBalance
                : formatBalanceAmount(
                    dollarBalanceToken,
                    false,
                    masterInfoObject,
                  )
            }
            forceCurrency={scrollPosition !== 'usd' ? '' : 'USD'}
            useBalance={scrollPosition === 'usd'}
            useSizing={true}
          />
        </Animated.View>
      </View>
    );
  },
);

// Custom hook for PagerView scroll handler
function usePagerScrollHandler(handlers, dependencies) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent(
    event => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer,
  );
}

export default function HomeLightning({ navigation }) {
  const {
    sparkInformation,
    showTokensInformation,
    isSendingPaymentRef,
    // numberOfCachedTxs
  } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const {
    bitcoinBalance,
    dollarBalanceSat,
    totalSatValue,
    dollarBalanceToken,
  } = useUserBalanceContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { theme, darkModeType, toggleTheme } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isConnectedToTheInternet, didGetToHomepage, toggleDidGetToHomepage } =
    useAppStatus();
  const scrollViewRef = useRef(null);
  const { topPadding, bottomPadding } = useGlobalInsets();
  const navigate = useNavigation();
  const currentTime = useUpdateHomepageTransactions();
  const { t } = useTranslation();
  const { backgroundColor } = GetThemeColors();
  const screenWidth = useWindowDimensions().width;

  const balanceScrollX = useSharedValue(0);
  const pagerRef = useRef(null);

  const scrollY = useSharedValue(0);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const [scrollPosition, setScrollPosition] = useState('total');

  const updateScrollPosition = useCallback(page => {
    if (page === 0) {
      setScrollPosition('total');
    } else if (page === 1) {
      setScrollPosition('sats');
    } else {
      setScrollPosition('usd');
    }
  }, []);

  const onBalancePageScroll = usePagerScrollHandler({
    onPageScroll: e => {
      'worklet';
      const scrollOffset = (e.position + e.offset) * screenWidth;
      balanceScrollX.value = scrollOffset;
    },
  });

  const [scrollContentChanges, setScrollContentChanges] = useState({
    borderRadius: false,
    backgroundColor: backgroundColor,
  });
  const [refreshing, setRefreshing] = useState(false);

  const { startLiquidEventListener } = useLiquidEvent();
  const { startRootstockEventListener } = useRootstockProvider();

  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const enabledLRC20 = false;
  const didViewSeedPhrase = masterInfoObject?.didViewSeedPhrase;

  const BALANCE_FADE_START = navbarHeight;
  const BALANCE_FADE_END = 100;

  useEffect(() => {
    setTimeout(() => {
      toggleDidGetToHomepage(true);
    }, 250);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!navigation) return;
      const listenerID = navigation?.addListener('tabPress', () => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
      });

      return navigation?.removeListener?.('click', listenerID);
    }, [navigation]),
  );

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

  const BALANCE_PAGES = useMemo(
    () => [
      { key: 'total', type: 'total' },
      { key: 'sats', type: 'sats' },
      { key: 'usd', type: 'usd' },
    ],
    [],
  );

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
        scrollPosition,
        poolInfoRef,
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
    scrollPosition,
  ]);

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
        isSendingPayment: isSendingPaymentRef.current,
        mnemonic: currentWalletMnemoinc,
        identityPubKey: sparkInformation.identityPubKey,
        isInitialRestore: false,
      });
      if (!response) {
        sparkTransactionsEventEmitter.emit(
          SPARK_TX_UPDATE_ENVENT_NAME,
          'fullUpdate-waitBalance',
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

  const handlePageSelected = useCallback(
    e => {
      const page = e.nativeEvent.position;
      console.log(page, 'page');
      updateScrollPosition(page);
    },
    [updateScrollPosition],
  );

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

      <Animated.ScrollView
        ref={scrollViewRef}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollViewContainerStyles}
        stickyHeaderIndices={[0]}
      >
        {/* Sticky navbar */}
        <MemoizedStickyNavbarContainer
          backgroundColor={backgroundColor}
          borderRadius={scrollContentChanges.borderRadius}
          onLayout={handleNavbarLayout}
          darkModeType={darkModeType}
          theme={theme}
          toggleTheme={toggleTheme}
          sparkBalance={sparkInformation?.balance}
          sparkTokens={sparkInformation?.tokens}
          didViewSeedPhrase={didViewSeedPhrase}
          masterInfoObject={masterInfoObject}
          totalSatValue={totalSatValue}
          bitcoinBalance={bitcoinBalance}
          dollarBalanceToken={dollarBalanceToken}
          scrollPosition={scrollPosition}
          balanceOpacityStyle={balanceOpacityStyle}
        />

        {/* Balance pager (horizontal swipe) */}
        <View style={[styles.balanceSection, { backgroundColor }]}>
          <AnimatedPagerView
            ref={pagerRef}
            style={styles.pagerView}
            initialPage={0}
            onPageSelected={handlePageSelected}
            onPageScroll={onBalancePageScroll}
          >
            {BALANCE_PAGES.map(item => (
              <View key={item.key} style={styles.pageContainer}>
                {item.type === 'total' && (
                  <>
                    <ThemeText
                      content={t('constants.total_balance')}
                      styles={styles.balanceLabel}
                    />
                    <MemoizedUserSatAmount
                      isConnectedToTheInternet={isConnectedToTheInternet}
                      theme={theme}
                      darkModeType={darkModeType}
                      sparkInformation={sparkInformation}
                      mode="total"
                    />
                  </>
                )}

                {item.type === 'sats' && (
                  <>
                    <ThemeText
                      content={t('constants.sat_balance')}
                      styles={styles.balanceLabel}
                    />
                    <MemoizedUserSatAmount
                      isConnectedToTheInternet={isConnectedToTheInternet}
                      theme={theme}
                      darkModeType={darkModeType}
                      sparkInformation={sparkInformation}
                      mode="sats"
                    />
                  </>
                )}

                {item.type === 'usd' && (
                  <>
                    <ThemeText
                      content={t('constants.usd_balance')}
                      styles={styles.balanceLabel}
                    />
                    <MemoizedUserSatAmount
                      isConnectedToTheInternet={isConnectedToTheInternet}
                      theme={theme}
                      darkModeType={darkModeType}
                      sparkInformation={sparkInformation}
                      mode="usd"
                    />
                  </>
                )}
              </View>
            ))}
          </AnimatedPagerView>

          <BalanceDots
            scrollX={balanceScrollX}
            pageCount={BALANCE_PAGES.length}
            screenWidth={screenWidth}
            theme={theme}
            darkModeType={darkModeType}
          />
        </View>

        <View
          style={[
            styles.buttonsContainer,
            { marginBottom: !showTokensInformation ? 50 : 0 },
          ]}
        >
          <MemoizedSendRecieveBTNs
            theme={theme}
            darkModeType={darkModeType}
            isConnectedToTheInternet={isConnectedToTheInternet}
            scrollPosition={scrollPosition}
          />
        </View>

        {showTokensInformation && (
          <TokensPreview didGetToHomepage={didGetToHomepage} />
        )}

        {/* Transactions list */}

        {flatListDataForSpark.map((tx, idx) => (
          <View key={idx}>{tx.item}</View>
        ))}
      </Animated.ScrollView>
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
  balanceLabel: {
    textTransform: 'uppercase',
    includeFontPadding: false,
    fontSize: SIZES.smedium,
  },
  balanceSection: {
    alignItems: 'center',
  },
  pagerView: {
    width: '100%',
    height: 180,
  },
  pageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsContainer: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
});
