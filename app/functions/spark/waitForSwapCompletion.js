import { IS_SPARK_ID } from '../../constants';
import {
  getSingleTxDetails,
  getSparkPaymentStatus,
  isOptimizationInProgress,
} from './index';
import { subscribeToSparkBalance } from './awaitBalanceChange';

// Attempt cap for waiting on a Flashnet swap's outbound Spark transfer. With
// exponential backoff (1.5s doubling to 10s) this keeps the worst-case wait
// around ~60s while bounding traffic to 8 polls instead of a fixed-interval
// spam loop, so a stuck or hostile node can't keep the device polling forever.
export const MAX_POLL_ATTEMPTS = 8;
export const MAX_STABILITY_ATTEMPTS = 20;

// A completed transfer can still leave the SDK temporarily unable to spend the
// full balance while it optimizes the received leaves. Observe live balance
// changes and require two quiet, non-optimizing windows before the caller sends.
const waitForBalanceStabilization = async mnemonic => {
  let balanceRevision = 0;
  let consecutiveStableChecks = 0;
  const subscription = subscribeToSparkBalance({
    mnemonic,
    onUpdate: result => {
      if (result?.didWork) balanceRevision += 1;
    },
  });

  try {
    await subscription.ready;

    for (let attempt = 0; attempt < MAX_STABILITY_ATTEMPTS; attempt++) {
      const revisionBeforeWait = balanceRevision;
      await new Promise(res => setTimeout(res, 1500));

      if (revisionBeforeWait !== balanceRevision) {
        consecutiveStableChecks = 0;
        continue;
      }

      const optimizationStatus = await isOptimizationInProgress({ mnemonic });
      if (
        revisionBeforeWait !== balanceRevision ||
        !optimizationStatus?.didWork ||
        optimizationStatus.isOptimizing
      ) {
        consecutiveStableChecks = 0;
        continue;
      }

      consecutiveStableChecks += 1;
      if (consecutiveStableChecks === 2) return;
    }

    throw new Error('Swap balance stabilization timeout');
  } finally {
    subscription.unsubscribe();
  }
};

export const waitForSwapCompletion = async (mnemonic, outboundTransferId) => {
  let pollIntervalMs = 1500;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (!IS_SPARK_ID.test(outboundTransferId)) {
      await new Promise(res => setTimeout(res, 2500));
      await waitForBalanceStabilization(mnemonic);
      return;
    }

    const sparkTransferResponse = await getSingleTxDetails(
      mnemonic,
      outboundTransferId,
    );

    const status = getSparkPaymentStatus(sparkTransferResponse?.status);
    if (status === 'completed') {
      await waitForBalanceStabilization(mnemonic);
      return;
    }
    if (status === 'failed') throw new Error('Swap failed');

    await new Promise(res => setTimeout(res, pollIntervalMs));
    pollIntervalMs = Math.min(pollIntervalMs * 2, 10000);
  }

  throw new Error('Swap completion timeout');
};
