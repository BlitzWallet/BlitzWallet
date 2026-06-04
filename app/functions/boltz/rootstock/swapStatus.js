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
      !swap?.data?.didSwapFail &&
      !isRootstockSwapCompleted(swap),
  );
}

export function isRootstockSwapLockupFailed(status) {
  return ROOTSTOCK_NON_TERMINAL_FAILURE_STATUSES.includes(status);
}
