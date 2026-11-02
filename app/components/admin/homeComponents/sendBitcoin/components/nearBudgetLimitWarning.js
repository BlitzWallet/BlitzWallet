import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useAnalyticsNumbers } from '../../../../../../context-store/analyticsContext';
import CustomButton from '../../../../../functions/CustomElements/button';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import { computeBudgetWarning } from '../../../../../hooks/useBudgetWarning';
import { useTranslation } from 'react-i18next';
import KeyValueRow from '../../../../../functions/CustomElements/redesign/KeyValueRow';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { HIDDEN_BALANCE_CLOSE } from '../../../../../constants';

// SendLimits.dc.html "Heads up · budget": warn disc, one line, the over/left
// amount and the monthly budget, Continue. Shown on the first slide.
export default function BudgetWarningModal({
  handleBackPressFunction,
  sendingAmount = 0,
  setContentHeight,
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { spentTotal } = useAnalyticsNumbers();
  const { t } = useTranslation();

  useEffect(() => {
    setContentHeight?.(430);
  }, [setContentHeight]);

  const budget = masterInfoObject?.monthlyBudget ?? null;
  const { isOverBudget } = computeBudgetWarning(budget, spentTotal);

  const willExceedBudget =
    !isOverBudget && spentTotal + sendingAmount > budget?.amount;

  const subheader = isOverBudget
    ? t('analytics.budget.overBudgetWarning')
    : willExceedBudget
    ? t('analytics.budget.willExceedBudgetWarning')
    : t('analytics.budget.nearBudgetWarning');

  const amountAfterSend = budget?.amount - (spentTotal + sendingAmount);
  const amountLabel =
    isOverBudget || willExceedBudget
      ? t('analytics.overBy')
      : t('analytics.remaining');

  const isBalanceHidden =
    masterInfoObject?.userBalanceDenomination === 'hidden';
  const overByAmountText = isBalanceHidden
    ? HIDDEN_BALANCE_CLOSE
    : displayCorrectDenomination({
        amount: Math.abs(amountAfterSend),
        masterInfoObject,
        fiatStats,
      });

  const budgetAmountText = isBalanceHidden
    ? HIDDEN_BALANCE_CLOSE
    : displayCorrectDenomination({
        amount: budget?.amount || 0,
        masterInfoObject,
        fiatStats,
      });

  return (
    <View style={styles.sheet}>
      <Disc icon="TriangleAlert" size={56} iconSize={24} tone="warm" />
      <View style={styles.header}>
        <SheetHeader
          afterIcon
          centered
          title={t('analytics.budget.budgetWarningHeadsUp')}
          sub={subheader}
        />
      </View>
      <ListCard style={styles.card}>
        <KeyValueRow
          mono={false}
          label={amountLabel}
          value={overByAmountText}
        />
        <KeyValueRow
          mono={false}
          label={t('analytics.budget.monthlyBudget')}
          value={budgetAmountText}
        />
      </ListCard>
      <CustomButton
        size="regular"
        buttonStyles={styles.button}
        textContent={t('constants.continue')}
        actionFunction={() => handleBackPressFunction()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, alignItems: 'center', marginTop: 15 },
  header: { alignSelf: 'stretch' },
  card: { alignSelf: 'stretch' },
  button: { marginTop: 'auto' },
});
