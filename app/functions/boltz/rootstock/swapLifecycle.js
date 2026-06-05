import { getSwapById, updateSwap } from './swapDb';
import { refundRootstockSubmarineSwap } from './claims';
import { lockSubmarineSwap } from './submarineSwap';
import { updateRootstockSwapPlaceholder } from './swapProgress';
import {
  isRootstockSwapLockupFailed,
  isRootstockSwapSuccessStatus,
  isRootstockSwapTerminalFailureStatus,
  shouldApplyRootstockStatus,
} from './swapStatus';

async function processTerminalRefund({
  swapId,
  swapWithStatus,
  signer,
  activeSwapIds,
  updateSwapFn,
  refundFn,
}) {
  const attemptCount = (swapWithStatus.data?.refundAttemptCount || 0) + 1;
  await updateSwapFn(swapId, {
    refundState: 'pending',
    refundAttemptCount: attemptCount,
    refundLastAttemptAt: Date.now(),
  });

  const failedSwap = {
    ...swapWithStatus,
    data: { ...swapWithStatus.data, didSwapFail: true },
  };
  const didRefund = await refundFn(failedSwap, signer);

  if (didRefund) {
    await updateSwapFn(swapId, {
      didSwapFail: true,
      refundState: 'completed',
    });
    activeSwapIds?.delete(swapId);
  } else {
    // Leave the swap recoverable. The provider re-drives pending refunds on the
    // interval and on restart (isRootstockSwapPendingRefund), so locked RBTC is
    // never stranded by a transient Boltz/RPC failure.
    await updateSwapFn(swapId, {
      refundState: 'retryable_error',
      refundErrorAt: Date.now(),
    });
  }
}

function hasLockedRootstockFunds(swap) {
  return Boolean(
    swap?.data?.lockTxHash ||
      swap?.data?.locked ||
      swap?.data?.lockState === 'broadcasted' ||
      swap?.data?.lockState === 'confirmed',
  );
}

function getRootstockPaymentTxId(swapUpdate) {
  return (
    swapUpdate?.transaction?.id ||
    swapUpdate?.transaction?.hash ||
    swapUpdate?.transactionId ||
    swapUpdate?.transactionHash ||
    swapUpdate?.txId ||
    swapUpdate?.txHash ||
    swapUpdate?.lockupTransactionId ||
    swapUpdate?.lockupTransactionHash ||
    null
  );
}

export async function handleRootstockSwapUpdate({
  swapId,
  status,
  swapUpdate,
  signer,
  activeSwapIds,
  deps = {},
}) {
  const {
    getSwapByIdFn = getSwapById,
    updateSwapFn = updateSwap,
    lockSubmarineSwapFn = lockSubmarineSwap,
    refundRootstockSubmarineSwapFn = refundRootstockSubmarineSwap,
    updateRootstockSwapPlaceholderFn = updateRootstockSwapPlaceholder,
  } = deps;

  const swapResponse = await getSwapByIdFn(swapId);
  console.log(swapResponse, 'saved swap in history');
  if (!swapResponse) return;

  const [swap] = swapResponse;
  if (!swap) return;
  console.log(swap, 'DESTRUCTED SWAP');

  const previousStatus = swap.data?.status;
  if (!shouldApplyRootstockStatus(previousStatus, status)) {
    console.log(
      `Ignoring stale Rootstock status ${status} (have ${previousStatus}) for ${swapId}`,
    );
    return;
  }

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
  const rootstockPaymentTxId =
    getRootstockPaymentTxId(swapUpdate) ||
    swap.data?.rootstockPaymentTxId ||
    swap.data?.lockTxHash;

  if (swap.type !== 'submarine') return;

  if (
    rootstockPaymentTxId &&
    rootstockPaymentTxId !== swap.data?.rootstockPaymentTxId
  ) {
    await updateSwapFn(swapId, { rootstockPaymentTxId });
  }

  await updateRootstockSwapPlaceholderFn({
    swapId,
    accountId: swap.data?.accountId,
    invoiceId: swap.data?.invoiceId,
    invoice: swap.data?.invoice,
    amountSat: swap.data?.amountSat || swap.data?.swap?.expectedAmount,
    feeSat: swap.data?.feeSat,
    status,
    createdTime: swap.data?.createdAt,
    extraDetails: {
      rootstockPaymentTxId,
      lockTxHash: swap.data?.lockTxHash,
      lockState: swap.data?.lockState,
    },
  });

  if (status === 'invoice.set') {
    const lockResponse = await lockSubmarineSwapFn(swapWithStatus, signer);
    const lockTxHash = lockResponse?.tx?.hash;
    if (lockTxHash) {
      await updateSwapFn(swapId, { rootstockPaymentTxId: lockTxHash });
      await updateRootstockSwapPlaceholderFn({
        swapId,
        accountId: swap.data?.accountId,
        invoiceId: swap.data?.invoiceId,
        invoice: swap.data?.invoice,
        amountSat: swap.data?.amountSat || swap.data?.swap?.expectedAmount,
        feeSat: swap.data?.feeSat,
        status,
        createdTime: swap.data?.createdAt,
        extraDetails: {
          rootstockPaymentTxId: lockTxHash,
          lockTxHash,
          lockState: 'locked',
        },
      });
    }
  }

  if (status === 'transaction.mempool' || status === 'transaction.confirmed') {
    // Boltz detected our lockup on-chain — record definitive broadcast proof.
    await updateSwapFn(swapId, { lockState: 'confirmed' });
  }

  if (isRootstockSwapLockupFailed(status)) {
    if (hasLockedRootstockFunds(swap)) {
      // Funds are on-chain — recover them through the refund path.
      await processTerminalRefund({
        swapId,
        swapWithStatus,
        signer,
        activeSwapIds,
        updateSwapFn,
        refundFn: refundRootstockSubmarineSwapFn,
      });
    } else {
      // No lockup ever broadcast; nothing to refund, close it out.
      await updateSwapFn(swapId, { lockupFailed: true, abandonedNoFunds: true });
      activeSwapIds?.delete(swapId);
    }
    return;
  }

  if (isRootstockSwapTerminalFailureStatus(status)) {
    await processTerminalRefund({
      swapId,
      swapWithStatus,
      signer,
      activeSwapIds,
      updateSwapFn,
      refundFn: refundRootstockSubmarineSwapFn,
    });
    return;
  }

  if (isRootstockSwapSuccessStatus(status)) {
    await updateSwapFn(swapId, {
      didSwapComplete: true,
      completedAt: Date.now(),
    });
    activeSwapIds?.delete(swapId);
  }
}
