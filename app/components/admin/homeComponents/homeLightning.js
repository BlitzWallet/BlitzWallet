import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useGlobalContextProvider } from '../../../../context-store/context';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import HomeNav from './navBar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../../context-store/appStatus';
import { useSparkWallet } from '../../../../context-store/sparkContext';
import GetThemeColors from '../../../hooks/themeColors';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import BalanceCard, { getAssetBalanceText } from './homeLightning/balanceCard';
import BalanceActions from './homeLightning/balanceActions';
import ConnectionErrorCard from './homeLightning/connectionErrorCard';
import HomeCard from './homeLightning/homeCard';
import { CENTER, FONT, MAX_WEB_CONTENT_WIDTH, SIZES } from '../../../constants';
import FormattedSatText from '../../../functions/CustomElements/satTextDisplay';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  FadeIn,
  LayoutAnimationConfig,
} from 'react-native-reanimated';
import { TAB_ITEM_HEIGHT } from '../../../../navigation/tabs';
import { useUserBalanceContext } from '../../../../context-store/userBalanceContext';
import AmountHero from '../../../functions/CustomElements/redesign/AmountHero';
import { useNodeContext } from '../../../../context-store/nodeContext';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import SkeletonBar from '../../../functions/CustomElements/redesign/SkeletonBar';
import {
  TokensIconRow,
  TokensNameRow,
  getWalletTokens,
} from '../../../functions/lrc20/utils';
import { useFlashnet } from '../../../../context-store/flashnetContext';
import handleDBStateChange from '../../../functions/handleDBStateChange';

const PRICE_WAIT_MS = 10000;

const MemoizedStickyNavbarContainer = memo(
  function MemoizedStickyNavbarContainer({
    backgroundColor,
    onLayout,
    masterInfoObject,
    totalSatValue,
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
        <HomeNav />

        <Animated.View
          style={[styles.navbarBalance, balanceOpacityStyle]}
          pointerEvents="none"
        >
          <FormattedSatText
            styles={styles.navbarBalanceText}
            globalBalanceDenomination={masterInfoObject.userBalanceDenomination}
            balance={totalSatValue}
            useBalance={false}
            useSizing={true}
          />
        </Animated.View>
      </View>
    );
  },
);

export default function HomeLightning({ navigation }) {
  const { fiatStats } = useNodeContext();
  const {
    sparkInformation,
    showTokensInformation,
    tokensImageCache,
    sparkConnectionError,
  } = useSparkWallet();
  const { poolInfo } = useFlashnet();

  const { bitcoinBalance, totalSatValue, dollarBalanceToken } =
    useUserBalanceContext();

  const { masterInfoObject, setMasterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const scrollViewRef = useRef(null);
  const { bottomPadding } = useGlobalInsets();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundColor } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const showBackupWalletWarning =
    !masterInfoObject?.isChildAccount && !masterInfoObject?.didViewSeedPhrase;

  const showWalletConnectionError =
    !isConnectedToTheInternet ||
    (sparkInformation.didConnect === false && !!sparkConnectionError);
  // A failed connect never sets the key, so fall back to the cached snapshot.
  const isWalletLoaded =
    !!sparkInformation.identityPubKey ||
    (showWalletConnectionError && !!sparkInformation.balanceUpdatedAt);
  // Total includes dollars, which need the pool price to convert (R2). Flashnet
  // retries forever, so stop waiting after a while: until the price arrives the
  // total counts Bitcoin only, and the Dollars tile still reads right.
  const isWaitingForPrice =
    isWalletLoaded && dollarBalanceToken > 0 && !poolInfo?.currentPriceAInB;
  const [didPriceTimeOut, setDidPriceTimeOut] = useState(false);
  useEffect(() => {
    if (!isWaitingForPrice) return;
    const timeout = setTimeout(() => setDidPriceTimeOut(true), PRICE_WAIT_MS);
    return () => clearTimeout(timeout);
  }, [isWaitingForPrice]);
  const isTotalLoaded =
    isWalletLoaded &&
    (!isWaitingForPrice || didPriceTimeOut || showWalletConnectionError);
  const isHidden = masterInfoObject.userBalanceDenomination === 'hidden';
  const lastVisibleDenomination = useRef('sats');
  if (!isHidden) {
    lastVisibleDenomination.current = masterInfoObject.userBalanceDenomination;
  }

  const saveTimeoutRef = useRef(null);
  const initialValueRef = useRef(masterInfoObject.userBalanceDenomination);
  const scrollY = useSharedValue(0);
  const [navbarHeight, setNavbarHeight] = useState(0);

  const hasMoreThanUSDB = !!getWalletTokens(sparkInformation.tokens).length;

  const BALANCE_FADE_START = navbarHeight;
  const BALANCE_FADE_END = 100;

  useFocusEffect(
    useCallback(() => {
      if (!navigation) return;
      return navigation?.addListener('tabPress', () => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
      });
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

  const handleNavbarLayout = useCallback(event => {
    const { height } = event.nativeEvent.layout;
    setNavbarHeight(height);
  }, []);

  const handleBackupRecovery = () =>
    navigate.navigate('SettingsContentHome', { for: 'backup wallet' });

  const handleBalanceChange = () => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    if (!isWalletLoaded) return;

    // Tap hides and shows; sats vs fiat is chosen in Settings.
    handleDBStateChange(
      {
        userBalanceDenomination: isHidden
          ? lastVisibleDenomination.current
          : 'hidden',
      },
      setMasterInfoObject,
      toggleMasterInfoObject,
      saveTimeoutRef,
      initialValueRef,
    );
  };

  const handleBalance = asset => navigate.navigate('BalancePage', { asset });
  const handleTokens = () => navigate.navigate('TokensPage');

  const scrollViewContainerStyles = useMemo(() => {
    return {
      flexGrow: 1,
      paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 10,
    };
  }, [bottomPadding]);

  return (
    <GlobalThemeView styles={styles.themeViewStyle} useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <Animated.ScrollView
          alwaysBounceVertical={false}
          ref={scrollViewRef}
          // refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollViewContainerStyles}
          stickyHeaderIndices={[0]}
        >
          <MemoizedStickyNavbarContainer
            backgroundColor={backgroundColor}
            onLayout={handleNavbarLayout}
            masterInfoObject={masterInfoObject}
            totalSatValue={totalSatValue}
            balanceOpacityStyle={balanceOpacityStyle}
          />
          <ThemeText
            content={t('constants.total_balance')}
            variant={'hint'}
            styles={styles.amountLabel}
          />
          <View style={styles.amount}>
            <LayoutAnimationConfig skipEntering>
              {isTotalLoaded ? (
                <Animated.View
                  key={isHidden ? 'hidden' : 'shown'}
                  entering={FadeIn.duration(isHidden ? 150 : 250)}
                >
                  <TouchableOpacity onPress={handleBalanceChange}>
                    <AmountHero
                      amountSize={60}
                      amount={totalSatValue}
                      fiatStats={fiatStats}
                      masterInfoObject={masterInfoObject}
                      isHidden={isHidden}
                    />
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <SkeletonBar width={176} height={46} borderRadius={14} />
              )}
            </LayoutAnimationConfig>
          </View>
          <BalanceActions />

          <View style={styles.footer}>
            <ConnectionErrorCard visible={showWalletConnectionError} />
            {showBackupWalletWarning && (
              <HomeCard
                onPress={handleBackupRecovery}
                lead={
                  <Disc
                    icon={'AlertTriangle'}
                    size={44}
                    iconSize={20}
                    tone="danger"
                  />
                }
                title={t('wallet.homeLightning.home.backupTitle')}
                sub={t('wallet.homeLightning.home.backupSub')}
              />
            )}
            <View style={styles.metricsRow}>
              <BalanceCard
                onPress={() => handleBalance('dollars')}
                isBitcoin={false}
                label={t('constants.dollars_upper')}
                isHidden={isHidden}
                isLoading={!isWalletLoaded}
                amount={getAssetBalanceText({
                  isBitcoin: false,
                  amount: dollarBalanceToken,
                  masterInfoObject,
                  fiatStats,
                })}
              />
              <BalanceCard
                onPress={() => handleBalance('bitcoin')}
                isBitcoin={true}
                label={t('constants.bitcoin_upper')}
                isHidden={isHidden}
                isLoading={!isWalletLoaded}
                amount={getAssetBalanceText({
                  isBitcoin: true,
                  amount: bitcoinBalance,
                  masterInfoObject,
                  fiatStats,
                })}
              />
            </View>
            {showTokensInformation && hasMoreThanUSDB && (
              <HomeCard
                onPress={handleTokens}
                lead={
                  <TokensIconRow
                    tokens={sparkInformation.tokens}
                    tokensImageCache={tokensImageCache}
                  />
                }
                title={t('constants.tokens')}
                sub={TokensNameRow(sparkInformation.tokens, t)}
              />
            )}
          </View>
        </Animated.ScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  themeViewStyle: {
    paddingBottom: 0,
  },
  container: { flex: 1, ...CENTER },
  amountLabel: {
    fontFamily: FONT.Title_Medium,
    marginTop: 26,
    fontSize: 14,
    includeFontPadding: false,
  },
  amount: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 84,
    marginBottom: 24,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    gap: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
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
});
