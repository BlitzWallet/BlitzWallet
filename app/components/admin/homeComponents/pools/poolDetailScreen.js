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
import AvatarStack from './avatarStack';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { applyErrorAnimationTheme } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import SectionCard from '../../../../screens/inAccount/settingsHub/components/SectionCard';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
const errorTxAnimation = require('../../../../assets/errorTxAnimation.json');

const MAX_VISIBLE_ACTIVITY = 3;

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
  const { backgroundOffset, backgroundColor } = GetThemeColors();
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

  // Organizer + most recent contributions for inline activity
  const recentActivity = useMemo(() => {
    if (!pool) return [];
    const organizer = {
      ...pool,
      isOrganizer: true,
    };
    const recent = contributions.slice(0, MAX_VISIBLE_ACTIVITY);
    return [organizer, ...recent];
  }, [pool, contributions]);

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

  // ---------- Error / Loading states (unchanged) ----------

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
        label={pool?.poolTitle || t('wallet.pools.pool')}
        showLeftImage={isCreator}
        leftImageStyles={{ height: 25 }}
        iconNew={isActive ? 'Trash2' : 'RefreshCcw'}
        leftImageFunction={isActive ? handleClosePool : handleReCheck}
      />

      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Section 1: Hero — Progress Ring ── */}
        <View style={styles.heroContainer}>
          <CircularProgress
            current={pool.currentAmount}
            goal={pool.goalAmount}
            size={250}
            strokeWidth={4}
            fundedAmount={formatAmount(pool.currentAmount)}
            goalAmount={formatAmount(pool.goalAmount)}
          />

          {/* Creator text */}
          <ThemeText
            styles={styles.creatorText}
            CustomNumberOfLines={1}
            CustomEllipsizeMode={'tail'}
            content={`${t('wallet.pools.createdBy')}${
              pool.creatorName || 'Unknown'
            }`}
          />

          {/* Overlapping avatar stack + contributor count */}
          <TouchableOpacity
            style={styles.avatarRow}
            onPress={handleContributorClick}
            activeOpacity={0.7}
          >
            <AvatarStack
              contributors={[...contributions]}
              maxVisible={4}
              avatarSize={32}
            />
            <ThemeText
              styles={styles.contributorCountText}
              content={t('wallet.pools.contributorCount', {
                count: contributions.length,
              })}
            />
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Actions or Closed Banner ── */}
        {!isActive ? (
          <View
            style={[styles.closedBanner, { backgroundColor: backgroundOffset }]}
          >
            <ThemeIcon iconName={'Lock'} size={20} />
            <View style={styles.closedTextContainer}>
              <ThemeText
                CustomNumberOfLines={1}
                content={`${t('wallet.pools.closed')}${closedDate}`}
              />
              {isCreator && (
                <ThemeText
                  styles={styles.closedSubtext}
                  content={t('wallet.pools.moneyTransferred')}
                />
              )}
            </View>
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

        {/* ── Section 3: Recent Activity ── */}
        <View style={styles.activitySection}>
          <SectionCard title={t('wallet.pools.activitySection')}>
            {recentActivity.length <= 1 && contributions.length === 0 ? (
              <View style={styles.emptyActivity}>
                <ThemeText
                  styles={styles.emptyActivityText}
                  content={t('wallet.pools.noActivity')}
                />
              </View>
            ) : (
              <>
                {recentActivity.map((item, index) => {
                  if (!item) return null;
                  const name =
                    item?.creatorName || item?.contributorName || 'Unknown';
                  const isLast = index === recentActivity.length - 1;
                  const showSeparator =
                    !isLast || contributions.length > MAX_VISIBLE_ACTIVITY;

                  return (
                    <View key={index}>
                      <View style={styles.activityRow}>
                        <ContributorAvatar
                          avatarSize={36}
                          contributorName={name}
                        />
                        <ThemeText
                          styles={styles.activityName}
                          CustomNumberOfLines={1}
                          CustomEllipsizeMode={'tail'}
                          content={name}
                        />
                        {item.isOrganizer ? (
                          <ThemeText
                            styles={styles.activityRoleLabel}
                            content={t('wallet.pools.organizer')}
                          />
                        ) : (
                          <ThemeText
                            styles={styles.activityAmount}
                            content={formatAmount(item.amount)}
                          />
                        )}
                      </View>
                      {showSeparator && (
                        <View
                          style={[
                            styles.activitySeparator,
                            { borderBottomColor: backgroundColor },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}

                {/* View All row */}
                {contributions.length > MAX_VISIBLE_ACTIVITY && (
                  <TouchableOpacity
                    style={styles.viewAllRow}
                    onPress={handleContributorClick}
                    activeOpacity={0.7}
                  >
                    <ThemeText
                      styles={styles.viewAllText}
                      content={t('settings.hub.viewAll')}
                    />
                    <ThemeIcon iconName={'ChevronRight'} size={20} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: WINDOWWIDTH,
    ...CENTER,
    flexGrow: 1,
    paddingBottom: 20,
  },

  // ── Hero ──
  heroContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  creatorText: {
    fontSize: SIZES.medium,
    opacity: 0.6,
    marginTop: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  contributorCountText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
  },

  // ── Actions ──
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  actionButton: {
    flexGrow: 1,
    maxWidth: 'unset',
  },

  // ── Closed Banner ──
  closedBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 20,
  },
  closedTextContainer: {
    flex: 1,
  },
  closedSubtext: {
    fontSize: SIZES.small,
    opacity: 0.7,
    marginTop: 2,
  },

  // ── Activity Section ──
  activitySection: {
    width: '100%',
    marginTop: 24,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activityName: {
    flex: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  activityRoleLabel: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    flexShrink: 0,
  },
  activityAmount: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    flexShrink: 0,
  },
  activitySeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: 16 + 36 + 10, // paddingHorizontal + avatarSize + gap
  },

  // ── View All ──
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  viewAllText: {
    flex: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },

  // ── Empty Activity ──
  emptyActivity: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
});
