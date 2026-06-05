import { getSwapById, updateSwap } from './swapDb';
import { refundRootstockSubmarineSwap } from './claims';
import { lockSubmarineSwap } from './submarineSwap';
import { updateRootstockSwapPlaceholder } from './swapProgress';
import {
  isRootstockSwapLockupFailed,
  isRootstockSwapSuccessStatus,
  isRootstockSwapTerminalFailureStatus,
} from './swapStatus';

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
    await updateSwapFn(swapId, { lockupFailed: true });
  }

  if (isRootstockSwapTerminalFailureStatus(status)) {
    const failedSwap = {
      ...swapWithStatus,
      data: {
        ...swapWithStatus.data,
        didSwapFail: true,
      },
    };
    await updateSwapFn(swapId, { didSwapFail: true });
    await refundRootstockSubmarineSwapFn(failedSwap, signer);
    activeSwapIds?.delete(swapId);
  }

  if (isRootstockSwapSuccessStatus(status)) {
    await updateSwapFn(swapId, {
      didSwapComplete: true,
      completedAt: Date.now(),
    });
    activeSwapIds?.delete(swapId);
  }
}
