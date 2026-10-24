import { StyleSheet } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import CircularProgress from './circularProgress';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../hooks/themeColors';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

/**
 * Pool card for the management list.
 * Active: shows progress + amount raised on the right
 * Closed: shows "Closed [date]" instead of amount
 */
export default function PoolCard({ pool, onPress }) {
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();

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
    <ListRow
      onPress={onPress}
      lead={
        <CircularProgress
          current={pool.currentAmount}
          goal={pool.goalAmount}
          size={48}
          strokeWidth={3}
          showPercentage={true}
          showConfirmed={pool.currentAmount >= pool.goalAmount}
          trackColor={tokens.divider}
        />
      }
      title={pool.poolTitle}
      sub={
        isActive
          ? t('wallet.pools.payment', {
              count: pool.contributorCount || 0,
            })
          : `${t('wallet.pools.closed')}${closedDate}`
      }
      trailing={
        isActive && (
          <ThemeText
            styles={styles.amountText}
            content={formatAmount(pool.currentAmount)}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  amountText: {
    includeFontPadding: false,
  },
});
