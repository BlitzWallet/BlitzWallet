import {
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  RefreshControl,
  Pressable,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { UserSatAmount } from './homeLightning/userSatAmount';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import { NavBar } from './navBar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../../context-store/appStatus';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { SendRecieveBTNs } from './homeLightning/sendReciveBTNs';
import { useSparkWallet } from '../../../../context-store/sparkContext';
import getFormattedHomepageTxsForSpark from '../../../functions/combinedTransactionsSpark';
import GetThemeColors from '../../../hooks/themeColors';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import { useLiquidEvent } from '../../../../context-store/liquidEventContext';
import { useRootstockProvider } from '../../../../context-store/rootstockSwapContext';
import { crashlyticsLogReport } from '../../../functions/crashlyticsLogs';
import { COLORS, FONT, SIZES } from '../../../constants';
import FormattedSatText from '../../../functions/CustomElements/satTextDisplay';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  useHandler,
  useEvent,
  LinearTransition,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { TAB_ITEM_HEIGHT } from '../../../../navigation/tabs';
import { useActiveCustodyAccount } from '../../../../context-store/activeAccount';
import { BalanceDots } from './homeLightning/balanceDots';
import { useUserBalanceContext } from '../../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../../context-store/flashnetContext';
import { formatBalanceAmount } from '../../../functions';
import TokensPreview from '../homeComponents/homeLightning/TokensPreview';
import { INSET_WINDOW_WIDTH } from '../../../constants/theme';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';

const MemoizedNavBar = memo(NavBar);
const MemoizedUserSatAmount = memo(UserSatAmount);
const MemoizedSendRecieveBTNs = memo(SendRecieveBTNs);

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const MemoizedStickyNavbarContainer = memo(
  function MemoizedStickyNavbarContainer({
    backgroundColor,
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
          },
        ]}
      >
        <MemoizedNavBar
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
    updateHomepageScrollPosition,
    // numberOfCachedTxs
  } = useSparkWallet();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const {
    bitcoinBalance,
    dollarBalanceSat,
    totalSatValue,
    dollarBalanceToken,
  } = useUserBalanceContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { theme, darkModeType, toggleTheme } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const {
    isConnectedToTheInternet,
    didGetToHomepage,
    toggleDidGetToHomepage,
    screenDimensions,
  } = useAppStatus();
  const scrollViewRef = useRef(null);
  const { bottomPadding } = useGlobalInsets();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const screenWidth = screenDimensions?.width ?? 0;

  const balanceScrollX = useSharedValue(0);
  const pagerRef = useRef(null);

  const scrollY = useSharedValue(0);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const [scrollPosition, setScrollPosition] = useState('total');

  const updateScrollPosition = useCallback(
    page => {
      const pos = page === 0 ? 'total' : page === 1 ? 'sats' : 'usd';
      setScrollPosition(pos);
      updateHomepageScrollPosition(pos);
    },
    [updateHomepageScrollPosition],
  );

  const onBalancePageScroll = usePagerScrollHandler({
    onPageScroll: e => {
      'worklet';
      const scrollOffset = (e.position + e.offset) * screenWidth;
      balanceScrollX.value = scrollOffset;
    },
  });

  const [refreshing, setRefreshing] = useState(false);

  const { startLiquidEventListener } = useLiquidEvent();
  const { startRootstockEventListener } = useRootstockProvider();

  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const didViewSeedPhrase = masterInfoObject?.didViewSeedPhrase;
  const hideSmallPaymentsHomepage = masterInfoObject?.hideSmallPaymentsHomepage;

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

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
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
        enabledLRC20: showTokensInformation,
        scrollPosition,
        poolInfoRef,
        t,
        hideSmallPaymentsHomepage,
        swapLimits,
      }) || []
    );
  }, [
    sparkInformation.transactions,
    sparkInformation.didConnect,
    homepageTxPreferance,
    userBalanceDenomination,
    // numberOfCachedTxs,
    didGetToHomepage,
    theme,
    darkModeType,
    t,
    showTokensInformation,
    hideSmallPaymentsHomepage,
    swapLimits.bitcoin,
  ]);

  const handleRefresh = useCallback(async () => {
    crashlyticsLogReport(`Running in handle refresh function on homepage`);
    try {
      if (!sparkInformation.identityPubKey || !sparkInformation.didConnect)
        return;
      startLiquidEventListener(6);
      startRootstockEventListener({ intervalMs: 60000 });
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
      updateScrollPosition(e.nativeEvent.position);
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

  const scrollViewContainerStyles = useMemo(() => {
    return {
      flexGrow: 1,
      backgroundColor,
      paddingBottom: bottomPadding + TAB_ITEM_HEIGHT,
    };
  }, [backgroundColor, bottomPadding]);

  const memoizedTxList = useMemo(
    () =>
      flatListDataForSpark.map(tx => (
        <Animated.View
          key={tx.key}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          layout={LinearTransition.duration(300)}
        >
          {tx.item}
        </Animated.View>
      )),
    [flatListDataForSpark],
  );

  return (
    <GlobalThemeView styles={styles.themeViewStyle}>
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
          <View style={styles.pagerWrapper}>
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
            <View style={styles.staticOverlay} pointerEvents="box-none">
              <BalanceDots
                scrollX={balanceScrollX}
                pageCount={BALANCE_PAGES.length}
                screenWidth={screenWidth}
                theme={theme}
                darkModeType={darkModeType}
              />

              <MemoizedSendRecieveBTNs
                theme={theme}
                darkModeType={darkModeType}
                isConnectedToTheInternet={isConnectedToTheInternet}
                scrollPosition={scrollPosition}
              />
            </View>
          </View>
        </View>

        {showTokensInformation && (
          <TokensPreview didGetToHomepage={didGetToHomepage} />
        )}

        {/* Transactions list */}

        <View
          style={[
            styles.txListContainer,
            {
              backgroundColor: backgroundOffset,
              paddingTop: flatListDataForSpark.length > 1 ? 5 : 15,
            },
          ]}
        >
          {flatListDataForSpark.length > 1 && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => navigate.navigate('ViewAllTxPage')}
              style={styles.sectionHeader}
            >
              <ThemeText
                content={t('wallet.homeLightning.home.activity')}
                styles={styles.sectionTitle}
              />
              <Pressable
                onPress={() => navigate.navigate('ViewAllTxPage')}
                style={({ pressed }) => [
                  {
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  },
                  pressed && { opacity: 0.5 },
                ]}
              >
                <View style={[styles.leftContainer, { opacity: 0.5 }]}>
                  <ThemeText
                    styles={styles.seeAllLink}
                    content={t('settings.hub.viewAll')}
                  />
                  <ThemeIcon
                    colorOverride={textColor}
                    size={15}
                    iconName={'ChevronRight'}
                  />
                </View>
              </Pressable>
            </TouchableOpacity>
          )}
          {memoizedTxList}
        </View>
      </Animated.ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  themeViewStyle: {
    paddingBottom: 0,
  },
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
  pagerWrapper: {
    position: 'relative',
    width: '100%',
  },
  pagerView: {
    width: '100%',
    height: 325,
  },
  pageContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 52,
  },
  staticOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
  },
  sectionHeader: {
    width: '100%',
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    marginBottom: 10,
    gap: 5,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  seeAllLink: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txListContainer: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    paddingHorizontal: 15,
    paddingBottom: 15,
    paddingTop: 5,
  },
});
