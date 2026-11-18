import { IS_SPARK_ID } from '../../constants';
import { acquire } from './walletRuntime';

const SWAP_WAIT_MS = 60000;
const POLL_MS = 1500;

// Waits for the pool's outbound transfer to land. Spark transfer ids resolve
// through getPayment; token transfers arrive as a bare tx hash and are matched
// against recent received payments by details.txHash.
export const waitForSwapCompletion = async (mnemonic, outboundTransferId) => {
  const handle = await acquire(mnemonic, { mode: 'client', borrow: true });
  const isSparkId = IS_SPARK_ID.test(outboundTransferId);
  const txHash = String(outboundTransferId).split(':')[0];
  const deadline = Date.now() + SWAP_WAIT_MS;

  while (Date.now() < deadline) {
    const payment = isSparkId
      ? await handle.getPayment(outboundTransferId)
      : (
          await handle.listPayments({
            typeFilter: ['receive'],
            fromTimestamp: Math.floor(Date.now() / 1000) - 600,
          })
        ).find(p => p.details?.txHash === txHash);

    if (payment?.status === 'completed') return;
    if (payment?.status === 'failed') throw new Error('Swap failed');

    await new Promise(res => setTimeout(res, POLL_MS));
  }

  throw new Error('Swap completion timeout');
};
