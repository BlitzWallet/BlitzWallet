import { Contract, Signature } from 'ethers';
import EtherSwapArtifact from 'boltz-core/out/EtherSwap.sol/EtherSwap.json';
import { rootstockEnvironment, satoshisToWei } from '.';
import { updateSwap } from './swapDb';
import bolt11 from '../../decodeBolt11';
import { getBoltzApiUrl } from '../boltzEndpoitns';

async function persistRefundError(id, message) {
  if (!id) return;
  try {
    await updateSwap(id, {
      refundState: 'retryable_error',
      refundError: message,
      refundErrorAt: Date.now(),
    });
  } catch (updateError) {
    console.log('Error saving rootstock refund error state', updateError);
  }
}

export async function refundRootstockSubmarineSwap(swap, signer) {
  try {
    const invoice = swap.data.invoice;
    const { claimAddress, timeoutBlockHeight, id, expectedAmount } =
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

      if (refundData.error) {
        await persistRefundError(id, refundData.error);
        return false;
      }

      const { signature } = refundData;
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
      try {
        await updateSwap(id, {
          didSwapFail: true,
          refundState: 'completed',
          refundTxHash: tx.hash,
          refundedAt: Date.now(),
        });
      } catch (updateError) {
        console.log('Error saving rootstock refund metadata', updateError);
      }
      return true;
    }

    return false;
  } catch (err) {
    console.log('Error refunding rootstock swap', err);
    await persistRefundError(swap?.data?.swap?.id, err?.message || String(err));
    return false;
  }
}
