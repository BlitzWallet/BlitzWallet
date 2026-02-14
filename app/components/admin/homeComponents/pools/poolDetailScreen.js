import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  CENTER,
  FONT,
  SIZES,
  STARTING_INDEX_FOR_POOLS_DERIVE,
} from '../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { usePools } from '../../../../../context-store/poolContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import CircularProgress from './circularProgress';
import ContributorAvatar from './contributorAvatar';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { applyErrorAnimationTheme } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
const errorTxAnimation = require('../../../../assets/errorTxAnimation.json');

export default function PoolDetailScreen(props) {
  const poolId = props.route?.params?.poolId;
  const passedPool = props.route?.params?.pool;
  const shouldSave = props.route?.params?.shouldSave;

  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const {
    pools,
    contributions: allContributions,
    savePoolToCloud,
    syncPool,
    loadContributionsForPool,
  } = usePools();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noPool, setNoPool] = useState(false);
  const { t } = useTranslation();

  // Read pool from context (cache-first)
  const pool = pools[poolId] || passedPool || null;
  // Read contributions from context (cache-first)
  const contributions = allContributions[poolId] || [];

  const isCreator = pool?.creatorUUID === masterInfoObject?.uuid;
  const isActive = pool?.status === 'active';

  const formatAmount = useCallback(
    amount => {
      return displayCorrectDenomination({
        amount,
        masterInfoObject,
        fiatStats,
      });
    },
    [masterInfoObject, fiatStats],
  );

  const refreshPoolDetails = useCallback(async () => {
    try {
      // If this is a freshly created pool, upload it first
      if (shouldSave && passedPool) {
        setIsSaving(true);

        const didSave = await savePoolToCloud(passedPool);
        setIsSaving(false);

        if (!didSave) {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Failed to save pool',
          });
          return;
        }

        toggleMasterInfoObject({
          currentDerivedPoolIndex:
            passedPool.derivationIndex - STARTING_INDEX_FOR_POOLS_DERIVE + 1,
        });

        // Clear params to treat saved pool as a normal clicked pool
        navigate.setParams({
          poolId: passedPool.poolId,
          pool: undefined,
          shouldSave: false,
        });
        return;
      }

      // purposly use a stale state here so if we transition from active to closed it is not blocked
      // but on the next session it will be blocked
      if (pool && pool.status === 'closed') {
        console.warn('Pool is closed, no refreshing...');
        return;
      }

      // Load contributions from SQLite if not yet in context
      await loadContributionsForPool(poolId);

      // Background sync — incremental fetch from Firestore
      const changed = await syncPool(poolId, !pool);

      if (!changed && !pool) {
        setNoPool(true);
      }
    } catch (err) {
      console.log('Error fetching pool details:', err);
    }
  }, [poolId, shouldSave, passedPool, syncPool, loadContributionsForPool]);

  useFocusEffect(
    useCallback(() => {
      refreshPoolDetails(true);
    }, [refreshPoolDetails]),
  );

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `https://blitzwalletapp.com/pools/${poolId}`,
      });
    } catch (err) {
      console.log('Error sharing pool:', err);
    }
  }, [poolId]);

  const handleContribute = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'contributeToPool',
      pool,
      poolId,
      sliderHight: 0.5,
    });
  }, [navigate, poolId, pool]);

  const handleClosePool = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'closePoolConfirmation',
      pool,
    });
  }, [navigate, poolId, pool]);

  const handleReCheck = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'closePoolConfirmation',
      autoStart: true,
      pool,
    });
  }, [navigate, poolId, pool]);

  const handleContributorClick = useCallback(() => {
    navigate.navigate('ViewContributor', { pool, poolId, contributions });
  }, [pool, poolId, contributions]);

  const contributers = useMemo(() => {
    return [pool, ...contributions].map((item, index) => (
      <TouchableOpacity onPress={handleContributorClick} key={index}>
        <ContributorAvatar
          avatarSize={50}
          contributorName={
            item?.creatorName || item?.contributorName || 'Unknwon'
          }
        />
      </TouchableOpacity>
    ));
  }, [contributions, pool, handleContributorClick]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshPoolDetails(false);
    setRefreshing(false);
  };

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

  const closedDate = pool?.closedAt
    ? new Date(pool.closedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      errorTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  if (noPool) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar label={t('wallet.pools.pool')} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <LottieView
            autoPlay={true}
            source={errorAnimation}
            loop={false}
            style={{
              width: 250,
              height: 250,
            }}
          />
          <ThemeText
            styles={{ fontSize: SIZES.large }}
            content={t('wallet.pools.couldNotFind')}
          />
          <CustomButton
            buttonStyles={{ marginTop: 'auto' }}
            actionFunction={navigate.goBack}
            textContent={t('constants.back')}
          />
        </View>
      </GlobalThemeView>
    );
  }

  if (isSaving) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar label={t('wallet.pools.pool')} />
        <FullLoadingScreen text={t('wallet.pools.creatingPool')} />
      </GlobalThemeView>
    );
  }

  if (!pool) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar label={t('wallet.pools.pool')} />
        <FullLoadingScreen />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('wallet.pools.pool')}
        showLeftImage={isCreator}
        leftImageStyles={{ height: 25 }}
        iconNew={isActive ? 'Trash2' : 'RefreshCcw'}
        leftImageFunction={isActive ? handleClosePool : handleReCheck}
      />

      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        <View style={styles.headerContainer}>
          <View style={{ width: '100%' }}>
            {/* Pool Info */}
            <ThemeText styles={styles.poolTitle} content={pool.poolTitle} />
            <ThemeText
              styles={styles.creatorText}
              content={`${t('wallet.pools.createdBy')}${
                pool.creatorName || 'Unknown'
              }`}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              width: '100%',
              flexWrap: 'wrap',
              marginBottom: 25,
            }}
          >
            {contributers}
          </View>
          {/* Progress Circle */}
          <View style={styles.progressContainer}>
            <CircularProgress
              current={pool.currentAmount}
              goal={pool.goalAmount}
              size={270}
              strokeWidth={4}
              fundedAmount={formatAmount(pool.currentAmount)}
              goalAmount={formatAmount(pool.goalAmount)}
            />
          </View>

          {!isActive ? (
            <View
              style={[styles.closedBanner, { borderColor: backgroundOffset }]}
            >
              <ThemeText
                styles={styles.closedBannerText}
                content={`${t('wallet.pools.closed')}${closedDate}`}
              />
              {isCreator && (
                <ThemeText
                  styles={styles.transferredText}
                  content={t('wallet.pools.moneyTransferred')}
                />
              )}
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <CustomButton
                buttonStyles={styles.actionButton}
                textContent={t('wallet.pools.contribute')}
                actionFunction={handleContribute}
              />
              <CustomButton
                buttonStyles={[
                  styles.actionButton,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? COLORS.lightModeText
                        : COLORS.primary,
                  },
                ]}
                textStyles={{ color: COLORS.darkModeText }}
                textContent={t('wallet.pools.share')}
                actionFunction={handleShare}
              />
            </View>
          )}
          {!contributions.length && isActive && (
            <ThemeText
              styles={styles.noContributinos}
              content={t('wallet.pools.noActivity')}
            />
          )}
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    flex: 1,
  },
  progressContainer: {
    marginVertical: 'auto',
  },
  poolTitle: {
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    fontWeight: 500,
    marginBottom: 8,
    marginTop: 20,
  },
  creatorText: {
    fontSize: SIZES.medium,
    opacity: 0.6,
    marginBottom: 15,
  },
  contributorCountText: {
    fontSize: SIZES.small,
    opacity: 0.5,
    marginBottom: 16,
  },
  closedBanner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 25,
  },
  closedBannerText: {},
  transferredText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 25,
    alignItems: 'center',
  },
  actionButton: {
    flexGrow: 1,
    maxWidth: 'unset',
  },
  closePoolButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closePoolText: {
    fontSize: SIZES.small,
    opacity: 0.6,
  },
  listContent: {
    width: WINDOWWIDTH,
    ...CENTER,
    flexGrow: 1,
    gap: 8,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  contributionInfo: {
    flex: 1,
    gap: 2,
  },
  contributionMessage: {
    fontSize: SIZES.small,
    opacity: 0.6,
  },
  noContributinos: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    marginTop: 20,
  },
});
