// Mirror of the computation we'll implement in the hook
function computeBudgetWarning(budget, spentTotal, NEAR_BUDGET_LIMIT, OVER_BUDGET_LIMIT) {
  if (!budget || !budget.amount || budget.amount <= 0) {
    return { shouldWarn: false, isOverBudget: false, spentPercent: 0, leftToSpend: 0 };
  }
  const budgetAmount = budget.amount;
  const spentPercent = spentTotal / budgetAmount;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const shouldWarn = spentPercent >= NEAR_BUDGET_LIMIT;
  const isOverBudget = spentPercent >= OVER_BUDGET_LIMIT;
  return { shouldWarn, isOverBudget, spentPercent, leftToSpend };
}

const NEAR = 0.75;
const OVER = 1.0;

describe('computeBudgetWarning', () => {
  it('returns no warning when budget is null', () => {
    const r = computeBudgetWarning(null, 500, NEAR, OVER);
    expect(r.shouldWarn).toBe(false);
    expect(r.isOverBudget).toBe(false);
  });

  it('returns no warning when spent is below near limit', () => {
    const r = computeBudgetWarning({ amount: 1000 }, 500, NEAR, OVER); // 50%
    expect(r.shouldWarn).toBe(false);
    expect(r.isOverBudget).toBe(false);
    expect(r.leftToSpend).toBe(500);
  });

  it('returns warning (not over) at exactly near limit', () => {
    const r = computeBudgetWarning({ amount: 1000 }, 750, NEAR, OVER); // 75%
    expect(r.shouldWarn).toBe(true);
    expect(r.isOverBudget).toBe(false);
    expect(r.leftToSpend).toBe(250);
  });

  it('returns over-budget warning at 100%', () => {
    const r = computeBudgetWarning({ amount: 1000 }, 1000, NEAR, OVER);
    expect(r.shouldWarn).toBe(true);
    expect(r.isOverBudget).toBe(true);
    expect(r.leftToSpend).toBe(0);
  });

  it('caps leftToSpend at 0 when over budget', () => {
    const r = computeBudgetWarning({ amount: 1000 }, 1200, NEAR, OVER);
    expect(r.leftToSpend).toBe(0);
    expect(r.isOverBudget).toBe(true);
  });

  it('returns no warning when budget amount is zero or missing', () => {
    expect(computeBudgetWarning({ amount: 0 }, 0, NEAR, OVER).shouldWarn).toBe(false);
    expect(computeBudgetWarning({}, 500, NEAR, OVER).shouldWarn).toBe(false);
  });
});
