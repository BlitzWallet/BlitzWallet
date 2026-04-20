// Pure computation — same logic tested in __tests__/budgetWarningHook.test.js.
// Uses module-level NEAR_BUDGET_LIMIT / OVER_BUDGET_LIMIT constants rather than

import { useAnalytics } from '../../context-store/analyticsContext';
import { useGlobalContextProvider } from '../../context-store/context';
import { NEAR_BUDGET_LIMIT, OVER_BUDGET_LIMIT } from '../constants';

// accepting them as parameters (test file defines its own copy inline).
export function computeBudgetWarning(budget, spentTotal) {
  try {
    if (!budget || !budget.amount || budget.amount <= 0) {
      return {
        shouldWarn: false,
        isOverBudget: false,
        spentPercent: 0,
        leftToSpend: 0,
      };
    }
    const budgetAmount = budget.amount;
    const spentPercent = spentTotal / budgetAmount;
    const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
    const shouldWarn = spentPercent >= NEAR_BUDGET_LIMIT;
    const isOverBudget = spentPercent >= OVER_BUDGET_LIMIT;
    return { shouldWarn, isOverBudget, spentPercent, leftToSpend };
  } catch (err) {
    console.log('compute budget warning error', err);
    return {
      shouldWarn: false,
      isOverBudget: false,
      spentPercent: 0,
      leftToSpend: 0,
    };
  }
}

export function useBudgetWarning(sendingAmount = 0) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { spentTotal } = useAnalytics();
  const budget = masterInfoObject?.monthlyBudget ?? null;
  return computeBudgetWarning(budget, spentTotal + sendingAmount);
}
