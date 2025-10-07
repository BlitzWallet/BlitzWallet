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
import { loadSwaps, saveSwap } from './swapDb';
import { randomBytes } from 'react-native-quick-crypto';
import { sparkReceivePaymentWrapper } from '../../spark/payments';
import i18next from 'i18next';

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

  saveSwap(swap.id, 'submarine', {
    swap,
    invoice,
    createdAt: Date.now(),
  });

  return swap;
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
  const tx = await contract.lock(
    invoicePreimageHash,
    claimAddress,
    timeoutBlockHeight,
    {
      value: BigInt(expectedAmount) * satoshiWeiFactor,
    },
  );

  console.log(`Lock tx sent: ${tx.hash}`);
}

export async function executeSubmarineSwap(
  signerMnemonic,
  swapLimits,
  provider,
  signer,
  sendWebViewRequest,
) {
  console.log('Running rootstock excecution');
  const address = await signer.getAddress();
  const rootStockWalletBalance = await provider.getBalance(address);

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

  const swap = await createRootstockSubmarineSwap(sparkInvoice.invoice);
  return swap;
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
    const rootstockSatBalance = Number(rootstockBalance / satoshiWeiFactor);
    const swaps = await loadSwaps();
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

    const gasLimit = await contract.lock.estimateGas(
      preimage,
      userAddress,
      timeoutBlockHeight,
      { value: 1n },
    );
    console.log('Gas limit:', gasLimit);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 1n;
    console.log('Gas price:', gasPrice);

    console.log(limits, 'limits');
    console.log('rootstockSatBalance', rootstockSatBalance);
    const boltzFee = Math.round(
      (limits.rsk.submarine.fees.minerFees.claim +
        limits.rsk.submarine.fees.minerFees.lockup +
        rootstockSatBalance * (limits.rsk.submarine.fees.percentage / 100)) *
        1.1,
    );
    console.log('outboundSwapsBalance', outboundSwapsBalance);

    const estimatedFeeWei = gasLimit * gasPrice;
    console.log('Estimated fee (wei):', estimatedFeeWei);
    console.log('Estimated boltz fee:', boltzFee, satoshisToWei(boltzFee));

    const usableWei =
      rootstockBalance -
      estimatedFeeWei -
      satoshisToWei(boltzFee) -
      satoshisToWei(outboundSwapsBalance);
    if (usableWei <= 0n) {
      return { maxSats: 0n, reason: 'Insufficient RBTC for fee' };
    }

    const usableSats = weiToSatoshis(usableWei);

    const min = BigInt(limits.rsk.min);
    const max = BigInt(limits.rsk.max);
    if (usableSats < min) {
      return { maxSats: 0n, reason: 'Below Boltz min swap' };
    }

    const maxSats = usableSats > max ? max : usableSats;

    return {
      maxSats,
      usableSats,
      usableWei,
      estimatedFeeWei,
      gasLimit,
      gasPrice,
    };
  } catch (err) {
    console.log('Error calculating max submarine swap amount:', err);
    throw err;
  }
}
