import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useAnalyticsNumbers } from '../../../../../../context-store/analyticsContext';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import { useTheme } from '../../../../../../context-store/theme';
import { computeBudgetWarning } from '../../../../../hooks/useBudgetWarning';
import { useTranslation } from 'react-i18next';
import useContentWidth from '../../../../../functions/CustomElements/redesign/useContentWidth';
import { CENTER } from '../../../../../constants';
import KeyValueRow from '../../../../../functions/CustomElements/redesign/KeyValueRow';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';

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
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const contentWidth = useContentWidth();

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

  const isBalanceHidden = masterInfoObject?.userBalanceDenomination === 'hidden';
  const overByAmountText = isBalanceHidden
    ? '• • • • •'
    : displayCorrectDenomination({
        amount: Math.abs(amountAfterSend),
        masterInfoObject,
        fiatStats,
      });

  const budgetAmountText = isBalanceHidden
    ? '• • • • •'
    : displayCorrectDenomination({
        amount: budget?.amount || 0,
        masterInfoObject,
        fiatStats,
      });

  return (
    <View style={[styles.sheet, { width: contentWidth }]}>
      <Disc icon="TriangleAlert" size={56} iconSize={24} tone="warm" />
      <ThemeText
        styles={styles.header}
        content={t('analytics.budget.budgetWarningHeadsUp')}
      />
      <ThemeText
        variant="body"
        styles={[styles.subheader, { color: tokens.muted }]}
        content={subheader}
      />
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
  sheet: { flex: 1, ...CENTER, alignItems: 'center', marginTop: 15 },
  header: { marginTop: 16, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  subheader: { marginTop: 4, textAlign: 'center' },
  card: { marginTop: 20, alignSelf: 'stretch' },
  button: { marginTop: 'auto' },
});
