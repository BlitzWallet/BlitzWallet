import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import CircularProgress from '../../../../components/admin/homeComponents/pools/circularProgress';
import { SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import WidgetCard from './WidgetCard';

export default function PoolsPreview({
  activePoolsArray,
  poolsArray,
  onViewAll,
}) {
  const { t } = useTranslation();

  const displayedPools = activePoolsArray.slice(0, 2);
  const hasMorePools = activePoolsArray.length > 2;
  const remainingPoolsCount = activePoolsArray.length - 2;

  return (
    <WidgetCard onPress={onViewAll}>
      <View style={styles.header}>
        <ThemeText
          styles={styles.headerTitle}
          content={t('settings.accountsPoolsScreen.poolsTitle')}
        />
        {!!poolsArray.length && (
          <ThemeText
            styles={styles.viewAll}
            content={t('settings.hub.viewAll')}
          />
        )}
      </View>
      {activePoolsArray.length > 0 ? (
        <>
          {displayedPools.map(pool => (
            <View key={pool.poolId} style={styles.poolRow}>
              <CircularProgress
                current={pool.currentAmount}
                goal={pool.goalAmount}
                size={35}
                strokeWidth={3}
                showPercentage={false}
                useAltBackground={true}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.poolTitle}
                content={pool.poolTitle}
              />
            </View>
          ))}
          {hasMorePools && (
            <ThemeText
              styles={styles.moreText}
              content={t('settings.hub.morePoolsCount', {
                count: remainingPoolsCount,
              })}
            />
          )}
        </>
      ) : (
        <ThemeText
          styles={styles.emptyText}
          content={
            !poolsArray.length
              ? t('settings.accountsPoolsScreen.noPoolsMessage')
              : t('settings.accountsPoolsScreen.noActivePools')
          }
        />
      )}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  viewAll: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  poolTitle: {
    flex: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  moreText: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 4,
    includeFontPadding: false,
  },
  emptyText: {
    fontSize: SIZES.smedium,
    opacity: 0.5,
    includeFontPadding: false,
  },
});
