// Hard spending gate for child accounts. Unlike the user-set monthly budget
// (useBudgetWarning) which only warns, a parent-set spending limit blocks the
// payment. Enforcement is local/soft — the limit value is synced from the
// child's Firebase doc into masterInfoObject and compared against the locally
// tracked monthly spend (analytics spentTotal).
import { useAnalyticsNumbers } from '../../context-store/analyticsContext';
import { useGlobalContextProvider } from '../../context-store/context';

export function computeChildLimitGate(isChildAccount, limit, projectedSpend) {
  if (!isChildAccount || !limit || limit <= 0) {
    return { isOverLimit: false, limit: null };
  }
  return { isOverLimit: projectedSpend > limit, limit };
}

export function useChildSpendingLimitGate(sendingAmount = 0) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { spentTotal } = useAnalyticsNumbers();
  return computeChildLimitGate(
    masterInfoObject?.isChildAccount,
    masterInfoObject?.spendingLimit,
    spentTotal + Number(sendingAmount || 0),
  );
}
