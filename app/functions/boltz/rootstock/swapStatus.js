export const ROOTSTOCK_SUCCESS_STATUSES = [
  'transaction.claimed',
  'transaction.claim.pending',
];

export const ROOTSTOCK_TERMINAL_FAILURE_STATUSES = [
  'invoice.failedToPay',
  'swap.expired',
];

export const ROOTSTOCK_NON_TERMINAL_FAILURE_STATUSES = [
  'transaction.lockupFailed',
];

export function getRootstockSwapStatus(swap) {
  return typeof swap === 'string' ? swap : swap?.data?.status || swap?.status;
}

export function isRootstockSwapSuccessStatus(status) {
  return ROOTSTOCK_SUCCESS_STATUSES.includes(status);
}

export function isRootstockSwapTerminalFailureStatus(status) {
  return ROOTSTOCK_TERMINAL_FAILURE_STATUSES.includes(status);
}

export function isRootstockSwapCompleted(swapOrStatus) {
  const status = getRootstockSwapStatus(swapOrStatus);
  return (
    isRootstockSwapSuccessStatus(status) ||
    isRootstockSwapTerminalFailureStatus(status)
  );
}

export function isRootstockSwapActive(swap) {
  return Boolean(
    swap &&
      !swap?.data?.didSwapComplete &&
      !swap?.data?.didSwapFail &&
      !swap?.data?.abandonedNoFunds &&
      !isRootstockSwapCompleted(swap),
  );
}

export function isRootstockSwapLockupFailed(status) {
  return ROOTSTOCK_NON_TERMINAL_FAILURE_STATUSES.includes(status);
}

// Forward-progress ranking for the normal submarine lifecycle. Terminal
// outcomes (success/failure) are handled separately and always allowed.
const ROOTSTOCK_STATUS_RANK = {
  'swap.created': 0,
  'invoice.set': 1,
  'transaction.mempool': 2,
  'invoice.pending': 2,
  'transaction.confirmed': 3,
  'invoice.paid': 4,
  'transaction.claim.pending': 5,
  'transaction.claimed': 6,
};

// Decide whether an incoming status should overwrite the persisted one. Stale
// or duplicate websocket/poll updates must not regress a swap that has already
// moved forward or reached a terminal outcome.
export function shouldApplyRootstockStatus(previousStatus, nextStatus) {
  if (!previousStatus || previousStatus === nextStatus) return true;
  // Terminal outcomes always land, regardless of arrival order.
  if (
    isRootstockSwapSuccessStatus(nextStatus) ||
    isRootstockSwapTerminalFailureStatus(nextStatus)
  ) {
    return true;
  }
  // Once terminal, never regress to a non-terminal status.
  if (isRootstockSwapCompleted(previousStatus)) return false;
  const previousRank = ROOTSTOCK_STATUS_RANK[previousStatus] ?? -1;
  const nextRank = ROOTSTOCK_STATUS_RANK[nextStatus] ?? -1;
  return nextRank >= previousRank;
}

// A swap that reached a terminal failure but still has an unresolved refund.
// The provider re-drives refunds for these on every interval/restart so locked
// RBTC is never abandoned.
export function isRootstockSwapPendingRefund(swap) {
  if (!swap || swap?.data?.abandonedNoFunds) return false;
  const refundState = swap?.data?.refundState;
  if (!refundState || refundState === 'completed') return false;
  return isRootstockSwapTerminalFailureStatus(getRootstockSwapStatus(swap));
}
