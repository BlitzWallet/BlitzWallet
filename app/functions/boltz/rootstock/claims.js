import {Contract, Signature} from 'ethers';
import EtherSwapArtifact from 'boltz-core/out/EtherSwap.sol/EtherSwap.json';
import {rootstockEnvironment, satoshisToWei, satoshiWeiFactor} from '.';
import {deleteSwapById, getSwapById} from './swapDb';
import bolt11 from 'bolt11';
import {getBoltzApiUrl} from '../boltzEndpoitns';

export async function claimRootstockReverseSwap(selectedSwap, signer) {
  const {swap, preimage} = selectedSwap.data;

  // Get contracts
  const contractsRes = await fetch(
    getBoltzApiUrl(rootstockEnvironment) + '/v2/chain/RBTC/contracts',
  );
  const contracts = await contractsRes.json();

  const contract = new Contract(
    contracts.swapContracts.EtherSwap,
    EtherSwapArtifact.abi,
    signer,
  );

  const tx = await contract['claim(bytes32,uint256,address,uint256)'](
    Buffer.from(preimage, 'hex'),
    BigInt(swap.onchainAmount) * satoshiWeiFactor,
    swap.refundAddress,
    swap.timeoutBlockHeight,
  );

  console.log(`Claimed RBTC tx: ${tx.hash}`);
}

export async function refundRootstockSubmarineSwap(swap, signer) {
  try {
    const invoice = swap.data.invoice;
    const {claimAddress, timeoutBlockHeight, id, expectedAmount} =
      swap.data.swap;
    const currentBlockHeight = await signer.provider.getBlockNumber();
    const decoded = bolt11.decode(invoice);

    const invoicePreimageHash = decoded.tags.find(
      tag => tag.tagName === 'payment_hash',
    )?.data;

    console.log(invoicePreimageHash, claimAddress, timeoutBlockHeight, id);
    const contractsRes = await fetch(
      getBoltzApiUrl(rootstockEnvironment) + '/v2/chain/RBTC/contracts',
    );
    const contracts = await contractsRes.json();

    const contract = new Contract(
      contracts.swapContracts.EtherSwap,
      EtherSwapArtifact.abi,
      signer,
    );

    let tx;
    if (timeoutBlockHeight < currentBlockHeight) {
      tx = await contract['refund(bytes32,uint256,address,uint256)'](
        `0x${invoicePreimageHash}`,
        satoshisToWei(expectedAmount),
        claimAddress,
        timeoutBlockHeight,
      );
    } else {
      // Need refund signature from Boltz
      const refundRes = await fetch(
        getBoltzApiUrl(rootstockEnvironment) +
          `/v2/swap/submarine/${id}/refund`,
      );
      const refundData = await refundRes.json();

      console.log(refundData, 'boltz refund data');
      if (refundData.error) return;

      const {signature} = refundData;
      const decSignature = Signature.from(signature);
      tx = await contract.refundCooperative(
        `0x${invoicePreimageHash}`,
        satoshisToWei(expectedAmount),
        claimAddress,
        timeoutBlockHeight,
        decSignature.v,
        decSignature.r,
        decSignature.s,
      );
    }

    console.log(`Refunded RBTC tx: ${tx.hash}`);

    if (tx) {
      await deleteSwapById(id);
      return true;
    }
  } catch (err) {
    console.log('Error refunding rootstock swap', err);
  }
}
