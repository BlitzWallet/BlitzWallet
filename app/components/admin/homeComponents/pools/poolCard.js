import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES } from '../../../../constants';
import CircularProgress from './circularProgress';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTranslation } from 'react-i18next';

/**
 * Pool card for the management list.
 * Active: shows progress + amount raised on the right
 * Closed: shows "Closed [date]" instead of amount
 */
export default function PoolCard({ pool, onPress }) {
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();

  const isActive = !pool.closedAt;

  const formatAmount = amount => {
    return displayCorrectDenomination({
      amount,
      masterInfoObject,
      fiatStats,
    });
  };

  const closedDate = pool.closedAt
    ? new Date(pool.closedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      <View style={styles.leftSection}>
        <CircularProgress
          current={pool.currentAmount}
          goal={pool.goalAmount}
          size={55}
          strokeWidth={3}
          showPercentage={true}
          showConfirmed={pool.currentAmount >= pool.goalAmount}
        />
      </View>

      <View style={styles.middleSection}>
        <ThemeText styles={styles.poolTitle} content={pool.poolTitle} />
        <ThemeText
          styles={styles.poolMeta}
          content={`${t('wallet.pools.goal')}${formatAmount(pool.goalAmount)}`}
        />
        {isActive ? (
          <ThemeText
            styles={styles.poolMeta}
            content={t('wallet.pools.payment', {
              count: pool.contributorCount || 0,
            })}
          />
        ) : (
          <ThemeText
            styles={styles.closedText}
            content={`${t('wallet.pools.closed')}${closedDate}`}
          />
        )}
      </View>

      <View style={styles.rightSection}>
        {isActive && (
          <ThemeText
            styles={styles.amountText}
            content={formatAmount(pool.currentAmount)}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 45,
    borderRadius: 16,
    paddingVertical: 10,
  },
  leftSection: {
    alignItems: 'center',
    gap: 6,
  },
  middleSection: {
    flex: 1,
    gap: 2,
    marginLeft: 8,
    marginRight: 5,
  },
  rightSection: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
  },
  poolTitle: {
    fontWeight: 500,
    includeFontPadding: false,
  },
  poolMeta: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
  },
  amountText: {
    includeFontPadding: false,
  },
  closedText: {
    fontSize: SIZES.small,
    opacity: 0.5,
    includeFontPadding: false,
  },
});
