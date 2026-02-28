import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import CircularProgress from '../../../../components/admin/homeComponents/pools/circularProgress';
import { COLORS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import WidgetCard from './WidgetCard';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function PoolsPreview({
  activePoolsArray,
  poolsArray,
  onViewAll,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const displayedPools = activePoolsArray.slice(0, 2);
  const hasMorePools = activePoolsArray.length > 2;
  const remainingPoolsCount = activePoolsArray.length - 2;

  if (!poolsArray.length) {
    return (
      <WidgetCard onPress={onViewAll}>
        <View style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.header, { marginBottom: 0 }]}>
              <ThemeText
                styles={styles.headerTitle}
                content={t('settings.accountsPoolsScreen.poolsTitle')}
              />
            </View>

            <ThemeText
              styles={styles.rateText}
              content={t('wallet.pools.collectPaymentsDescription')}
            />
          </View>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor:
                  theme && darkModeType
                    ? darkModeType
                      ? backgroundColor
                      : backgroundOffset
                    : COLORS.primary,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={COLORS.darkModeText}
              iconName={'PiggyBank'}
              size={22}
            />
          </View>
        </View>
      </WidgetCard>
    );
  }

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
                showConfirmed={pool.currentAmount >= pool.goalAmount}
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexShrink: 1,
  },
  title: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  rateText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
