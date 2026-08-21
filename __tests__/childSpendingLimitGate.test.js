// Mirror of computeChildLimitGate in app/hooks/useChildSpendingLimitGate.js.
// Kept inline (like budgetWarningHook.test.js) so the test avoids the hook's
// context imports.
function computeChildLimitGate(isChildAccount, limit, projectedSpend) {
  if (!isChildAccount || !limit || limit <= 0) {
    return { isOverLimit: false, limit: null };
  }
  return { isOverLimit: projectedSpend > limit, limit };
}

describe('computeChildLimitGate', () => {
  it('never gates a non-child account', () => {
    const r = computeChildLimitGate(false, 1000, 5000);
    expect(r.isOverLimit).toBe(false);
    expect(r.limit).toBe(null);
  });

  it('never gates when no limit is set', () => {
    expect(computeChildLimitGate(true, null, 5000).isOverLimit).toBe(false);
    expect(computeChildLimitGate(true, 0, 5000).isOverLimit).toBe(false);
  });

  it('allows a payment under the limit', () => {
    const r = computeChildLimitGate(true, 1000, 800);
    expect(r.isOverLimit).toBe(false);
    expect(r.limit).toBe(1000);
  });

  it('allows a payment exactly at the limit', () => {
    expect(computeChildLimitGate(true, 1000, 1000).isOverLimit).toBe(false);
  });

  it('blocks a payment that exceeds the limit', () => {
    const r = computeChildLimitGate(true, 1000, 1001);
    expect(r.isOverLimit).toBe(true);
    expect(r.limit).toBe(1000);
  });
});
