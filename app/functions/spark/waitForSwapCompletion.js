import { IS_SPARK_ID } from '../../constants';
import { getSingleTxDetails, getSparkPaymentStatus } from './index';

// Attempt cap for waiting on a Flashnet swap's outbound Spark transfer. With
// exponential backoff (1.5s doubling to 10s) this keeps the worst-case wait
// around ~60s while bounding traffic to 8 polls instead of a fixed-interval
// spam loop, so a stuck or hostile node can't keep the device polling forever.
export const MAX_POLL_ATTEMPTS = 8;

export const waitForSwapCompletion = async (mnemonic, outboundTransferId) => {
  let pollIntervalMs = 1500;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (!IS_SPARK_ID.test(outboundTransferId)) {
      await new Promise(res => setTimeout(res, 2500));
      return;
    }

    const sparkTransferResponse = await getSingleTxDetails(
      mnemonic,
      outboundTransferId,
    );

    const status = getSparkPaymentStatus(sparkTransferResponse?.status);
    if (status === 'completed') return;
    if (status === 'failed') throw new Error('Swap failed');

    await new Promise(res => setTimeout(res, pollIntervalMs));
    pollIntervalMs = Math.min(pollIntervalMs * 2, 10000);
  }

  throw new Error('Swap completion timeout');
};
