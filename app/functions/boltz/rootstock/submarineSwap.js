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

const inFlightSubmarineLocks = new Set();
const ETHER_SWAP_RBTC_LOCK_SIGNATURE = 'lock(bytes32,address,uint256)';

export async function createRootstockSubmarineSwap(invoice) {
  const res = await fetch(
    getBoltzApiUrl(rootstockEnvironment) + '/v2/swap/submarine',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice, to: 'BTC', from: 'RBTC' }),
    },
  );
  const swap = await res.json();
  console.log(swap, 'boltz swap response');
  if (swap.error) return;

  console.log(swap);

  const savedSwap = {
    id: swap.id,
    type: 'submarine',
    data: {
      swap,
      invoice,
      createdAt: Date.now(),
      status: 'swap.created',
    },
  };

  await saveSwap(savedSwap.id, savedSwap.type, savedSwap.data);

  return savedSwap;
}

export function hasSubmarineSwapLockStarted(swap) {
  return Boolean(
    swap?.data?.locked || swap?.data?.lockTxHash || swap?.data?.lockState,
  );
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
  await markSubmarineSwapLockState(swapId, {
    lockState: 'locking',
    lockStartedAt: Date.now(),
  });

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
      lockState: 'locked',
      lockTxHash: tx.hash,
      lockedAt: Date.now(),
    });

    console.log(`Lock tx sent: ${tx.hash}`);
    return { didLock: true, tx };
  } catch (err) {
    await markSubmarineSwapLockState(swapId, {
      lockState: 'lock_error',
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
) {
  try {
    console.log('Running rootstock excecution');
    const address = await signer.getAddress();
    const rootStockWalletBalance = await provider.getBalance(address);
    console.log(address, rootStockWalletBalance);

    console.log(address, rootStockWalletBalance);
    const maxSendAmountResponse = await calculateMaxSubmarineSwapAmount({
      limits: swapLimits,
      provider,
      signer,
      rootStockWalletBalance,
    });

    if (!maxSendAmountResponse.maxSats) return;

    console.log(maxSendAmountResponse, 'max send amoutn resposne');

    const sparkInvoice = await sparkReceivePaymentWrapper({
      amountSats: Number(maxSendAmountResponse.maxSats),
      memo: i18next.t('transactionLabelText.roostockSwap'),
      paymentType: 'lightning',
      shouldNavigate: false,
      mnemoinc: signerMnemonic,
      sendWebViewRequest,
    });
    if (!sparkInvoice.didWork) return;

    return createRootstockSubmarineSwap(sparkInvoice.invoice);
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
      .filter(swap => swap.type === 'submarine' && !swap.data.didSwapFail)
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
