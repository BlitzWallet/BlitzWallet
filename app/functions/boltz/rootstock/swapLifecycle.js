import {
  deleteSwapById,
  getSwapById,
  updateSwap,
} from './swapDb';
import {refundRootstockSubmarineSwap} from './claims';
import {lockSubmarineSwap} from './submarineSwap';
import {
  isRootstockSwapLockupFailed,
  isRootstockSwapSuccessStatus,
  isRootstockSwapTerminalFailureStatus,
} from './swapStatus';

export async function handleRootstockSwapUpdate({
  swapId,
  status,
  signer,
  activeSwapIds,
  setPendingNavigation,
  deps = {},
}) {
  const {
    getSwapByIdFn = getSwapById,
    updateSwapFn = updateSwap,
    lockSubmarineSwapFn = lockSubmarineSwap,
    refundRootstockSubmarineSwapFn = refundRootstockSubmarineSwap,
    deleteSwapByIdFn = deleteSwapById,
  } = deps;

  const swapResponse = await getSwapByIdFn(swapId);
  console.log(swapResponse, 'saved swap in history');
  if (!swapResponse) return;

  const [swap] = swapResponse;
  if (!swap) return;
  console.log(swap, 'DESTRUCTED SWAP');

  await updateSwapFn(swapId, {
    status,
    lastStatusAt: Date.now(),
  });

  const swapWithStatus = {
    ...swap,
    data: {
      ...swap.data,
      status,
    },
  };

  if (swap.type !== 'submarine') return;

  if (status === 'invoice.set') {
    await lockSubmarineSwapFn(swapWithStatus, signer);
    setPendingNavigation?.(true);
  }

  if (isRootstockSwapLockupFailed(status)) {
    await updateSwapFn(swapId, {lockupFailed: true});
  }

  if (isRootstockSwapTerminalFailureStatus(status)) {
    const failedSwap = {
      ...swapWithStatus,
      data: {
        ...swapWithStatus.data,
        didSwapFail: true,
      },
    };
    await updateSwapFn(swapId, {didSwapFail: true});
    await refundRootstockSubmarineSwapFn(failedSwap, signer);
    activeSwapIds?.delete(swapId);
  }

  if (isRootstockSwapSuccessStatus(status)) {
    await deleteSwapByIdFn(swapId);
    activeSwapIds?.delete(swapId);
  }
}
