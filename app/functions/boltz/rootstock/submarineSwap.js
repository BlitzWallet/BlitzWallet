import bolt11 from 'bolt11';
import EtherSwapArtifact from 'boltz-core/out/EtherSwap.sol/EtherSwap.json';
import {Contract} from 'ethers';
import {getBoltzApiUrl} from '../boltzEndpoitns';
import {
  rootstockEnvironment,
  satoshisToWei,
  satoshiWeiFactor,
  weiToSatoshis,
} from '.';
import {loadSwaps, saveSwap} from './swapDb';
import crypto from 'react-native-quick-crypto';
import {sparkReceivePaymentWrapper} from '../../spark/payments';

export async function createRootstockSubmarineSwap(invoice) {
  const res = await fetch(
    getBoltzApiUrl(rootstockEnvironment) + '/v2/swap/submarine',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({invoice, to: 'BTC', from: 'RBTC'}),
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
  const {claimAddress, timeoutBlockHeight, expectedAmount} = swap.data.swap;
  const {invoice} = swap.data;

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
    memo: 'Rootstock to Spark Swap',
    paymentType: 'lightning',
    shouldNavigate: false,
  });
  if (!sparkInvoice.didWork) return;
  // const sparkInvoice = {
  //   invoice:
  //     'lntb108130n1p5xacjnpp5myp7wmxkpz98p7v5zlagf2n902k05pd05ehqzw603e08a4mgr6nsdpv2pshjmt9de6zqar0ypxk2unrdpskuapqv93kxmm4de6qcqzzsxqzjhsp5pr7jydjlfqm2tg6sh0cd7pdphkq7v8cjal6v0kx38wfwgmaesx6s9qyyssqpr5h3qypejvkljvj35lsxp8gjqntsr55g6nec2h7dk5wd3w6w4hzs7aekxzgfpw3pnk39hjleyyk8njg87zdgdez9atug9phv73sutsqd5kaqn',
  // };

  await createRootstockSubmarineSwap(sparkInvoice.invoice);
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

    const preimage = crypto.randomBytes(32);

    const gasLimit = await contract.lock.estimateGas(
      preimage,
      userAddress,
      timeoutBlockHeight,
      {value: 1n},
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
      return {maxSats: 0n, reason: 'Insufficient RBTC for fee'};
    }

    const usableSats = weiToSatoshis(usableWei);

    const min = BigInt(limits.rsk.min);
    const max = BigInt(limits.rsk.max);
    if (usableSats < min) {
      return {maxSats: 0n, reason: 'Below Boltz min swap'};
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
