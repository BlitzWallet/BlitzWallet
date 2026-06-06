import { Contract } from 'ethers';
import EtherSwapArtifact from 'boltz-core/out/EtherSwap.sol/EtherSwap.json';
import bolt11 from 'bolt11';
import { getBoltzApiUrl } from '../boltzEndpoitns';
import { rootstockEnvironment, satoshiWeiFactor } from '.';
import { deleteSwapById, updateSwap } from './swapDb';
import { updateRootstockSwapPlaceholder } from './swapProgress';

// Boltz statuses that prove a lockup transaction was detected on-chain. If the
// swap has reached any of these, RBTC was definitely sent — never discard it.
const STATUS_PROVES_LOCKUP = new Set([
  'transaction.mempool',
  'transaction.confirmed',
  'transaction.claim.pending',
  'transaction.claimed',
  'invoice.pending',
  'invoice.paid',
  'invoice.failedToPay',
  'transaction.lockupFailed',
]);

// ~30s block time on Rootstock; used to bound Lockup log scans to the window
// since the lock attempt rather than scanning from genesis.
const ROOTSTOCK_BLOCK_TIME_MS = 30000;
const LOOKBACK_BLOCK_MARGIN = 120; // ~1h safety margin

async function fetchBoltzSwapStatus(boltzId) {
  try {
    const res = await fetch(
      getBoltzApiUrl(rootstockEnvironment) + `/v2/swap/${boltzId}`,
    );
    const data = await res.json();
    return data?.status || null;
  } catch (err) {
    console.log('reconcile: failed to fetch Boltz status', err);
    return null;
  }
}

async function buildEtherSwapContract(signer) {
  const contractsRes = await fetch(
    getBoltzApiUrl(rootstockEnvironment) + '/v2/chain/RBTC/contracts',
  );
  const contracts = await contractsRes.json();
  return new Contract(
    contracts.swapContracts.EtherSwap,
    EtherSwapArtifact.abi,
    signer,
  );
}

function getInvoicePreimageHash(invoice) {
  const data = bolt11
    .decode(invoice)
    .tags.find(tag => tag.tagName === 'payment_hash')?.data;
  if (!data) throw new Error('invoice missing payment hash');
  return `0x${data}`;
}

// Look up the actual lockup tx hash from the EtherSwap Lockup event, keyed on
// our preimage hash + refund address, bounded to the lock attempt window.
async function findLockupTxHash(
  contract,
  provider,
  preimageHash,
  claimAddress,
  refundAddress,
  swap,
) {
  try {
    const currentBlock = await provider.getBlockNumber();
    const elapsedMs = Date.now() - (swap.data?.lockStartedAt || Date.now());
    const elapsedBlocks = Math.ceil(elapsedMs / ROOTSTOCK_BLOCK_TIME_MS);
    const fromBlock = Math.max(
      0,
      currentBlock - elapsedBlocks - LOOKBACK_BLOCK_MARGIN,
    );
    const filter = contract.filters.Lockup(
      preimageHash,
      claimAddress,
      refundAddress,
    );
    const logs = await contract.queryFilter(filter, fromBlock);
    return logs?.[0]?.transactionHash || null;
  } catch (err) {
    console.log('reconcile: lockup log lookup failed', err);
    return null;
  }
}

// Record that the lock IS on-chain (recovering the tx hash if we found one) so
// the swap proceeds normally and the transaction row stops showing a null hash.
async function persistRecoveredLock(swapId, swap, txHash, lockState) {
  const update = { locked: true, lockState };
  if (txHash) {
    update.lockTxHash = txHash;
    update.rootstockPaymentTxId = txHash;
  }
  await updateSwap(swapId, update);
  await updateRootstockSwapPlaceholder({
    swapId,
    accountId: swap.data?.accountId,
    invoiceId: swap.data?.invoiceId,
    invoice: swap.data?.invoice,
    amountSat: swap.data?.amountSat || swap.data?.swap?.expectedAmount,
    feeSat: swap.data?.feeSat,
    status: swap.data?.status,
    createdTime: swap.data?.createdAt,
    extraDetails: {
      ...(txHash ? { rootstockPaymentTxId: txHash, lockTxHash: txHash } : {}),
      lockState,
    },
  });
}

/**
 * Resolve a submarine swap whose lock attempt crashed/stalled before a confirmed
 * broadcast. Decides keep / discard / uncertain from on-chain proof only — never
 * from elapsed time. Discards (deletes) ONLY when it is proven no RBTC was locked.
 *
 * @returns {{decision: 'keep'|'discard'|'uncertain', reason: string}}
 */
export async function reconcileSubmarineSwapLock(swap, signer, provider) {
  const swapId = swap?.id || swap?.data?.swap?.id;
  try {
    const {
      claimAddress,
      timeoutBlockHeight,
      expectedAmount,
      id: boltzId,
    } = swap.data.swap;
    const invoice = swap.data.invoice;

    // 1. Boltz status — advanced past invoice.set proves a lockup happened.
    const boltzStatus = await fetchBoltzSwapStatus(boltzId);
    if (boltzStatus && STATUS_PROVES_LOCKUP.has(boltzStatus)) {
      const contract = await buildEtherSwapContract(signer);
      const refundAddress = await signer.getAddress();
      const preimageHash = getInvoicePreimageHash(invoice);
      const txHash = await findLockupTxHash(
        contract,
        provider,
        preimageHash,
        claimAddress,
        refundAddress,
        swap,
      );
      await persistRecoveredLock(swapId, swap, txHash, 'confirmed');
      return { decision: 'keep', reason: 'boltz_advanced' };
    }

    const contract = await buildEtherSwapContract(signer);
    const refundAddress = await signer.getAddress();
    const preimageHash = getInvoicePreimageHash(invoice);
    const amountWei = BigInt(expectedAmount) * satoshiWeiFactor;

    // 2. On-chain lock state — definitive proof funds are locked right now.
    const key = await contract.hashValues(
      preimageHash,
      amountWei,
      claimAddress,
      refundAddress,
      timeoutBlockHeight,
    );
    const isLocked = await contract.swaps(key);
    if (isLocked) {
      const txHash = await findLockupTxHash(
        contract,
        provider,
        preimageHash,
        claimAddress,
        refundAddress,
        swap,
      );
      await persistRecoveredLock(swapId, swap, txHash, 'broadcasted');
      return { decision: 'keep', reason: 'onchain_locked' };
    }

    // 3. Pending (unmined) tx from our wallet — a broadcast may be in flight.
    const [latest, pending] = await Promise.all([
      provider.getTransactionCount(refundAddress, 'latest'),
      provider.getTransactionCount(refundAddress, 'pending'),
    ]);
    if (pending > latest) {
      await updateSwap(swapId, { lockState: 'broadcast_unknown' });
      return { decision: 'uncertain', reason: 'pending_nonce' };
    }

    // 4. Lockup event log — backstop for a mined lock a lagging node missed.
    const txHash = await findLockupTxHash(
      contract,
      provider,
      preimageHash,
      claimAddress,
      refundAddress,
      swap,
    );
    if (txHash) {
      await persistRecoveredLock(swapId, swap, txHash, 'broadcasted');
      return { decision: 'keep', reason: 'lockup_log' };
    }

    // 5. Provably no RBTC was locked — discard so a fresh swap is created.
    await updateRootstockSwapPlaceholder({
      swapId,
      accountId: swap.data?.accountId,
      invoiceId: swap.data?.invoiceId,
      invoice: swap.data?.invoice,
      amountSat: swap.data?.amountSat || swap.data?.swap?.expectedAmount,
      feeSat: swap.data?.feeSat,
      status: 'swap.expired',
      createdTime: swap.data?.createdAt,
      extraDetails: { abandonedNoFunds: true },
    });
    await deleteSwapById(swapId);
    return { decision: 'discard', reason: 'no_funds' };
  } catch (err) {
    // Any uncertainty (RPC error, etc.) must never delete or re-broadcast.
    console.log('reconcile: uncertain, leaving swap untouched', err);
    if (swapId) {
      try {
        await updateSwap(swapId, { lockState: 'broadcast_unknown' });
      } catch (updateErr) {
        console.log('reconcile: failed to mark broadcast_unknown', updateErr);
      }
    }
    return { decision: 'uncertain', reason: 'error' };
  }
}
