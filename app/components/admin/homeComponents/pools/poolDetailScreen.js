import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  MAX_WEB_CONTENT_WIDTH,
  SIZES,
  STARTING_INDEX_FOR_POOLS_DERIVE,
} from '../../../../constants';
import { COLORS } from '../../../../constants/theme';
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
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';

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
    updatePoolList,
  } = usePools();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, tokens } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noPool, setNoPool] = useState(false);
  const didHandleSave = useRef(false);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  // Read pool from context (cache-first)
  const pool = pools[poolId] || passedPool || null;
  // Read contributions from context (cache-first)
  const contributions = allContributions[poolId] || [];

  const isCreator = pool?.creatorUUID === masterInfoObject?.uuid;
  const isActive = pool?.status === 'active';
  const goalReached = pool?.currentAmount >= pool?.goalAmount;
  const hideContributorsForClosedPools =
    isCreator &&
    !isActive &&
    (!pool?.currentAmount || contributions.length === 0);

  const contributeLabel = t('wallet.pools.contribute');
  const shareLabel = t('wallet.pools.share');

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
        if (didHandleSave.current) return;
        didHandleSave.current = true;
        setIsSaving(true);

        const didSave = await savePoolToCloud(passedPool);
        setIsSaving(false);

        if (!didSave) {
          setNoPool(true);
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

      // Load contributions from SQLite if not yet in context, always load
      await loadContributionsForPool(poolId);

      // purposly use a stale state here so if we transition from active to closed it is not blocked
      // but on the next session it will be blocked
      if (pool && pool.status === 'closed') {
        console.warn('Pool is closed, no refreshing...');
        return;
      }

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
      async function refreshData() {
        await updatePoolList();
        refreshPoolDetails(true);
      }
      refreshData();
    }, [refreshPoolDetails, updatePoolList]),
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
        ios: darkModeType && theme ? tokens.ink : tokens.accent,
        android: darkModeType && theme ? COLORS.lightModeText : tokens.accent,
      }),
    [darkModeType, theme],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        colors={[colors]}
        tintColor={darkModeType && theme ? tokens.ink : tokens.accent}
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

  // ---------- Error / Loading states (unchanged) ----------

  if (noPool) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('wallet.pools.pool')} />
          <View style={styles.centerComponenet}>
            <EmptyState
              icon={'CircleAlert'}
              iconTone="danger"
              title={
                shouldSave
                  ? t('wallet.pools.savingPoolErrorTitle')
                  : t('wallet.pools.couldNotFindTitle')
              }
              sub={
                shouldSave
                  ? t('wallet.pools.savingPoolErrorSub')
                  : t('wallet.pools.couldNotFindSub')
              }
            />
          </View>
          <CustomButton
            actionFunction={navigate.goBack}
            textContent={t('constants.back')}
            size={'regular'}
          />
        </View>
      </GlobalThemeView>
    );
  }

  if (isSaving) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('wallet.pools.pool')} />

          <FullLoadingScreen text={t('wallet.pools.creatingPool')} />
        </View>
      </GlobalThemeView>
    );
  }

  if (!pool) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('wallet.pools.pool')} />
          <FullLoadingScreen />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={pool?.poolTitle || t('wallet.pools.pool')}
          right={
            isCreator && (
              <IconButton
                onPress={
                  isActive
                    ? isCreator && goalReached
                      ? handleShare
                      : handleClosePool
                    : handleReCheck
                }
                icon={
                  isActive
                    ? isCreator && goalReached
                      ? 'Share'
                      : 'ArchiveX'
                    : 'RefreshCcw'
                }
                label={
                  isActive
                    ? isCreator && goalReached
                      ? 'wallet.pools.share'
                      : 'wallet.pools.closePool'
                    : 'constants.refresh'
                }
              />
            )
          }
        />
        <CustomScrollView
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Section 1: Hero — Progress Ring ── */}
          <View style={styles.heroContainer}>
            <CircularProgress
              current={pool.currentAmount}
              goal={pool.goalAmount}
              size={200}
              strokeWidth={10}
              fundedAmount={formatAmount(pool.currentAmount)}
              goalAmount={formatAmount(pool.goalAmount)}
              useFillAnimation={true}
              trackColor={tokens.divider}
            />

            {/* Creator text */}
            <ThemeText
              styles={[styles.creatorText, { color: tokens.muted }]}
              CustomNumberOfLines={1}
              CustomEllipsizeMode={'tail'}
              content={`${t('wallet.pools.createdBy')}${
                pool.creatorName || t('wallet.pools.unknown')
              }`}
            />

            {/* Overlapping avatar stack + contributor count */}
            {!hideContributorsForClosedPools && (
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
                <ThemeIcon
                  iconName={'ChevronRight'}
                  colorOverride={tokens.muted}
                  size={15}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Section 2: Actions or Closed Banner ── */}
          {!isActive ? (
            <ListCard style={styles.closedBanner}>
              <ListRow
                lead={<Disc icon={'Lock'} />}
                title={`${t('wallet.pools.closed')}${closedDate}`}
                sub={t('wallet.pools.moneyTransferred')}
              />
            </ListCard>
          ) : (
            <View style={styles.buttonsContainer}>
              {isCreator && pool.currentAmount >= pool.goalAmount ? (
                <CustomButton
                  textContent={t('wallet.pools.closePool')}
                  actionFunction={handleClosePool}
                  size={'regular'}
                />
              ) : (
                <AdaptiveButtonRow
                  labels={[contributeLabel, shareLabel]}
                  containerStyle={styles.actionsRow}
                >
                  {({ buttonStyle }) => (
                    <>
                      <CustomButton
                        buttonStyles={[styles.actionButton, buttonStyle]}
                        enableElipsis={false}
                        textContent={t('wallet.pools.contribute')}
                        actionFunction={handleContribute}
                        size={'regular'}
                      />
                      <CustomButton
                        buttonStyles={[styles.actionButton, buttonStyle]}
                        enableElipsis={false}
                        textContent={t('wallet.pools.share')}
                        actionFunction={handleShare}
                        size={'regular'}
                        tone="secondary"
                      />
                    </>
                  )}
                </AdaptiveButtonRow>
              )}
            </View>
          )}

          {/* ── Section 3: Recent Activity ── */}
          {!hideContributorsForClosedPools && (
            <View style={styles.activitySection}>
              <SectionHeader
                title={t('wallet.pools.activitySection')}
                first={true}
              />

              {recentActivity.length <= 1 && contributions.length === 0 ? (
                <View style={styles.emptyActivity}>
                  <EmptyState
                    icon={'UsersRound'}
                    title={t('wallet.pools.noActivity')}
                  />
                </View>
              ) : (
                <ListCard>
                  {recentActivity.map((item, index) => {
                    if (!item) return null;
                    const name =
                      item?.creatorName ||
                      item?.contributorName ||
                      t('wallet.pools.unknown');
                    const isLast = index === recentActivity.length - 1;
                    const showSeparator =
                      !isLast || contributions.length > MAX_VISIBLE_ACTIVITY;

                    return (
                      <ListRow
                        lead={
                          <ContributorAvatar
                            avatarSize={36}
                            contributorName={name}
                          />
                        }
                        title={
                          name === 'Anonymous' ? t('constants.annonName') : name
                        }
                        trailing={
                          item.isOrganizer ? (
                            <ThemeText
                              styles={[
                                styles.activityRoleLabel,
                                { color: tokens.muted },
                              ]}
                              content={t('wallet.pools.organizer')}
                            />
                          ) : (
                            <ThemeText
                              styles={styles.activityAmount}
                              content={formatAmount(item.amount)}
                            />
                          )
                        }
                        titleStyle={styles.activityName}
                      />
                    );
                  })}

                  {/* View All row */}
                  {contributions.length > MAX_VISIBLE_ACTIVITY && (
                    <ListRow
                      titleStyle={{
                        color: tokens.link,
                        fontSize: SIZES.smedium,
                      }}
                      title={t('settings.hub.viewAll')}
                      showChevron={true}
                      onPress={handleContributorClick}
                    />
                  )}
                </ListCard>
              )}
            </View>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: {
    flexGrow: 1,
  },
  centerComponenet: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Hero ──
  heroContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  creatorText: {
    fontSize: SIZES.small,
    marginTop: 16,
    includeFontPadding: false,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  contributorCountText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },

  // ── Actions ──
  buttonsContainer: {
    marginTop: 20,
  },
  actionsRow: {
    width: '100%',
  },
  actionButton: {
    flexGrow: 1,
    maxWidth: 'unset',
  },

  // ── Closed Banner ──
  closedBanner: {
    marginTop: 20,
  },

  // ── Activity Section ──
  activitySection: {
    width: '100%',
    marginTop: 24,
  },

  activityName: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  activityRoleLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    flexShrink: 0,
  },
  activityAmount: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    flexShrink: 0,
  },

  // ── Empty Activity ──
  emptyActivity: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
