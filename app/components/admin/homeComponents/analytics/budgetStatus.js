import { COLORS, NEAR_BUDGET_LIMIT, OVER_BUDGET_LIMIT } from '../../../../constants';

// Shared by the Analytics budget card and the Budget page.
export default function getBudgetStatus(spentPercent, t, tokens) {
  if (spentPercent >= OVER_BUDGET_LIMIT)
    return {
      label: t('analytics.overBudget'),
      color: tokens.danger,
      pillBg: tokens.danger,
      pillText: tokens.onAccent,
    };
  if (spentPercent >= NEAR_BUDGET_LIMIT)
    return {
      label: t('analytics.nearLimit'),
      color: COLORS.bitcoinOrange,
      pillBg: tokens.warnBg,
      pillText: tokens.warn,
    };
  return {
    label: t('analytics.onTrack'),
    color: tokens.accent,
    pillBg: tokens.accent,
    pillText: tokens.onAccent,
  };
}
