import bolt11 from 'bolt11';
import EtherSwapArtifact from 'boltz-core/out/EtherSwap.sol/EtherSwap.json';
import { Contract } from 'ethers';
import { getBoltzApiUrl } from '../boltzEndpoitns';
import {
  rootstockEnvironment,
  satoshisToWei,
  satoshiWeiFactor,
  weiToSatoshis,
} from '.';
import { loadSwaps, saveSwap, updateSwap } from './swapDb';
import { randomBytes } from 'react-native-quick-crypto';
import { sparkReceivePaymentWrapper } from '../../spark/payments';
import i18next from 'i18next';
import {
  calculateBufferedBoltzFeeSats,
  calculateInvoiceAmountAfterFees,
  getRootstockSubmarinePair,
  normalizeSubmarineFees,
} from './swapLimits';
import { insertRootstockSwapPlaceholder } from './swapProgress';
import { updateSparkTransactionDetails } from '../../spark/transactions';
import { isRootstockSwapActive } from './swapStatus';
import { fetchBoltzJson } from './boltzHttp';

const inFlightSubmarineLocks = new Set();
const ETHER_SWAP_RBTC_LOCK_SIGNATURE = 'lock(bytes32,address,uint256)';

export async function createRootstockSubmarineSwap(invoice, placeholder = {}) {
  let swap;
  try {
    swap = await fetchBoltzJson(
      getBoltzApiUrl(rootstockEnvironment) + '/v2/swap/submarine',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, to: 'BTC', from: 'RBTC' }),
      },
    );
  } catch (err) {
    console.log('Error creating rootstock submarine swap', err);
    return;
  }
  console.log(swap, 'boltz swap response');

  // A swap we cannot lock or track later is worse than none — bail before any
  // DB/placeholder write if Boltz omitted the fields the lock/refund paths need.
  if (!swap?.id || !swap?.claimAddress || swap?.timeoutBlockHeight == null) {
    console.log('Boltz submarine response missing required fields', swap);
    return;
  }

  const createdAt = placeholder.createdTime || Date.now();

  const savedSwap = {
    id: swap.id,
    type: 'submarine',
    data: {
      swap,
      invoice,
      invoiceId: placeholder.invoiceId,
      accountId: placeholder.accountId,
      amountSat: placeholder.amountSat,
      feeSat: placeholder.feeSat,
      createdAt,
      status: 'swap.created',
    },
  };

  await saveSwap(savedSwap.id, savedSwap.type, savedSwap.data);
  if (placeholder.invoiceId) {
    await updateSparkTransactionDetails(placeholder.invoiceId, {
      isRootstockSwap: true,
      rootstockSwapId: swap.id,
      rootstockSwapInvoiceId: placeholder.invoiceId,
      rootstockSwapStatus: 'swap.created',
    });
  }
  await insertRootstockSwapPlaceholder({
    swapId: swap.id,
    accountId: placeholder.accountId,
    invoiceId: placeholder.invoiceId,
    invoice,
    amountSat: placeholder.amountSat,
    feeSat: placeholder.feeSat,
    createdTime: createdAt,
  });

  return savedSwap;
}

// Lock states that represent a real or possible on-chain broadcast. A swap in
// any of these (or with a recorded tx hash) must never be re-locked directly;
// recovery happens through reconciliation, not by loosening this guard.
const SUBMARINE_LOCK_ATTEMPTED_STATES = new Set([
  'lock_intent',
  'broadcasting',
  'broadcast_unknown',
  'broadcasted',
  'confirmed',
  'lock_error',
  'locked', // legacy
  'locking', // legacy
]);

// Lock states a crash can leave behind that reconciliation must resolve before
// the swap can make progress (no confirmed broadcast yet).
const SUBMARINE_LOCK_UNRESOLVED_STATES = new Set([
  'lock_intent',
  'broadcasting',
  'broadcast_unknown',
  'lock_error',
  'locking', // legacy single pre-broadcast marker
]);

export function hasSubmarineSwapLockStarted(swap) {
  return Boolean(
    swap?.data?.locked ||
      swap?.data?.lockTxHash ||
      SUBMARINE_LOCK_ATTEMPTED_STATES.has(swap?.data?.lockState),
  );
}

// True when a submarine swap has a lock attempt that crashed/stalled before a
// confirmed broadcast, so reconciliation needs to chain-check it.
export function isSubmarineLockUnresolved(swap) {
  if (swap?.type !== 'submarine') return false;
  if (swap?.data?.lockTxHash) return false;
  return SUBMARINE_LOCK_UNRESOLVED_STATES.has(swap?.data?.lockState);
}

async function markSubmarineSwapLockState(id, newState) {
  if (!id) return;
  await updateSwap(id, newState);
}

export async function getRootstockAddress(signer) {
  try {
    const rootstockAddress = await signer.getAddress();
    return rootstockAddress;
  } catch (err) {
    console.log('Error getting rootstock address', err);
  }
}

export async function lockSubmarineSwap(swap, signer) {
  const { claimAddress, timeoutBlockHeight, expectedAmount } = swap.data.swap;
  const { invoice } = swap.data;
  const swapId = swap.id || swap.data.swap.id;

  if (hasSubmarineSwapLockStarted(swap)) {
    console.log(`Skipping Rootstock lock for ${swapId}; lock already started`);
    return { didLock: false, reason: 'lock_already_started' };
  }

  if (inFlightSubmarineLocks.has(swapId)) {
    console.log(`Skipping Rootstock lock for ${swapId}; lock in flight`);
    return { didLock: false, reason: 'lock_in_flight' };
  }

  inFlightSubmarineLocks.add(swapId);
  // Intent only — no network call that moves funds has run yet.
  await markSubmarineSwapLockState(swapId, {
    lockState: 'lock_intent',
    lockStartedAt: Date.now(),
  });

  // Tracks whether we have reached the broadcast boundary. Everything before it
  // is provably fund-safe (no tx submitted); a failure after it is uncertain.
  let reachedBroadcast = false;
  try {
    // Fetch current contract addresses from Boltz
    const contractsRes = await fetch(
      getBoltzApiUrl(rootstockEnvironment) + '/v2/chain/RBTC/contracts',
    );
    const contracts = await contractsRes.json();

    const contract = new Contract(
      contracts.swapContracts.EtherSwap,
      EtherSwapArtifact.abi,
      signer,
    );

    // Extract payment hash from the invoice
    const invoicePreimageHash = Buffer.from(
      bolt11.decode(invoice).tags.find(tag => tag.tagName === 'payment_hash')
        ?.data,
      'hex',
    );

    // Tx construction is complete; we are about to submit to the network.
    await markSubmarineSwapLockState(swapId, { lockState: 'broadcasting' });
    reachedBroadcast = true;

    // Send lock transaction
    const tx = await contract[ETHER_SWAP_RBTC_LOCK_SIGNATURE](
      invoicePreimageHash,
      claimAddress,
      timeoutBlockHeight,
      {
        value: BigInt(expectedAmount) * satoshiWeiFactor,
      },
    );

    await markSubmarineSwapLockState(swapId, {
      locked: true,
      lockState: 'broadcasted',
      lockTxHash: tx.hash,
      lockedAt: Date.now(),
    });

    console.log(`Lock tx sent: ${tx.hash}`);
    return { didLock: true, tx };
  } catch (err) {
    // Pre-broadcast failure → no tx was sent, safe to retry (lock_error).
    // Post-broadcast failure → a tx may be in flight, must chain-check before
    // any retry (broadcast_unknown).
    await markSubmarineSwapLockState(swapId, {
      lockState: reachedBroadcast ? 'broadcast_unknown' : 'lock_error',
      lockError: err?.message || String(err),
      lockErrorAt: Date.now(),
    });
    throw err;
  } finally {
    inFlightSubmarineLocks.delete(swapId);
  }
}

export async function executeSubmarineSwap(
  signerMnemonic,
  swapLimits,
  provider,
  signer,
  sendWebViewRequest,
  accountId,
) {
  try {
    console.log('Running rootstock excecution');
    const address = await signer.getAddress();
    const rootStockWalletBalance = await provider.getBalance(address);

    const maxSendAmountResponse = await calculateMaxSubmarineSwapAmount({
      limits: swapLimits,
      provider,
      signer,
      rootStockWalletBalance,
    });

    if (!maxSendAmountResponse.maxSats) return;

    const sparkInvoice = await sparkReceivePaymentWrapper({
      amountSats: Number(maxSendAmountResponse.maxSats),
      memo: i18next.t('transactionLabelText.roostockSwap'),
      paymentType: 'lightning',
      shouldNavigate: false,
      mnemoinc: signerMnemonic,
      sendWebViewRequest,
      extraDetails: {
        isRootstockSwap: true,
        rootstockSwapStatus: 'swap.created',
        rootstockSwapAmountSat: Number(maxSendAmountResponse.maxSats),
        rootstockSwapFeeSat: maxSendAmountResponse.boltzFee,
      },
    });
    if (!sparkInvoice.didWork) return;

    return createRootstockSubmarineSwap(sparkInvoice.invoice, {
      accountId,
      invoiceId: sparkInvoice.data?.id,
      amountSat: Number(maxSendAmountResponse.maxSats),
      feeSat: maxSendAmountResponse.boltzFee,
      createdTime: Date.now(),
    });
  } catch (err) {
    console.log(err, 'error in execute submarine swaps');
    return false;
  }
}

/**
 * Calculate the max Lightning invoice sats the user can send in a submarine swap
 */
/**
 * Calculate the max Lightning invoice sats the user can send in a submarine swap
 */
export async function calculateMaxSubmarineSwapAmount({
  limits,
  provider,
  signer,
  timeoutBlockHeight = 999999,
}) {
  try {
    const userAddress = await signer.getAddress();
    const rootstockBalance = await provider.getBalance(userAddress); // in wei
    const swaps = (await loadSwaps()) || [];
    const outboundSwapsBalance = swaps
      .filter(swap => swap.type === 'submarine' && isRootstockSwapActive(swap))
      .reduce(
        (prev, cur) => prev + (Number(cur?.data?.swap?.expectedAmount) || 0),
        0,
      );

    const contractsRes = await fetch(
      getBoltzApiUrl(rootstockEnvironment) + '/v2/chain/RBTC/contracts',
    );
    const contracts = await contractsRes.json();
    const contract = new Contract(
      contracts.swapContracts.EtherSwap,
      EtherSwapArtifact.abi,
      signer,
    );

    const preimage = randomBytes(32);

    const gasLimit = await contract[ETHER_SWAP_RBTC_LOCK_SIGNATURE].estimateGas(
      preimage,
      userAddress,
      timeoutBlockHeight,
      { value: 1n },
    );
    console.log('Gas limit:', gasLimit);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 1n;
    console.log('Gas price:', gasPrice);

    const submarinePair = getRootstockSubmarinePair(limits);
    const { minerFeeSats, percentage } = normalizeSubmarineFees(
      submarinePair.fees,
    );
    console.log('outboundSwapsBalance', outboundSwapsBalance);

    const estimatedFeeWei = gasLimit * gasPrice;
    console.log('Estimated fee (wei):', estimatedFeeWei);

    const availableWei =
      rootstockBalance - estimatedFeeWei - satoshisToWei(outboundSwapsBalance);
    if (availableWei <= 0n) {
      return { maxSats: 0n, reason: 'Insufficient RBTC for fee' };
    }

    const availableSats = weiToSatoshis(availableWei);

    const min = BigInt(submarinePair.limits?.minimal ?? limits.rsk.min);
    const max = BigInt(submarinePair.limits?.maximal ?? limits.rsk.max);
    const maxSats = calculateInvoiceAmountAfterFees({
      availableSats,
      minSats: min,
      maxSats: max,
      minerFeeSats,
      percentage,
    });

    if (maxSats < min) {
      return { maxSats: 0n, reason: 'Below Boltz min swap' };
    }

    const boltzFee = calculateBufferedBoltzFeeSats({
      swapAmountSats: maxSats,
      minerFeeSats,
      percentage,
    });

    return {
      maxSats,
      availableSats,
      availableWei,
      boltzFee,
      estimatedFeeWei,
      gasLimit,
      gasPrice,
    };
  } catch (err) {
    console.log('Error calculating max submarine swap amount:', err);
    throw err;
  }
}
