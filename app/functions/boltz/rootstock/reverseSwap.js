import {randomBytes} from 'react-native-quick-crypto';
import {getBoltzApiUrl} from '../boltzEndpoitns';
import sha256Hash from '../../hash';
import {saveSwap} from './swapDb';
import {Wallet} from 'ethers';
import {rootstockEnvironment} from '.';

export async function createRootstockReverseSwap(
  invoiceAmount,
  signerMnemonic,
) {
  const preimage = randomBytes(32);
  const preimageHash = sha256Hash(preimage).toString('hex');
  const signer = Wallet.fromPhrase(signerMnemonic);
  const walletAddress = await signer.getAddress();
  const res = await fetch(
    getBoltzApiUrl(rootstockEnvironment) + '/v2/swap/reverse',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        invoiceAmount,
        to: 'RBTC',
        from: 'BTC',
        claimAddress: walletAddress,
        preimageHash,
      }),
    },
  );
  const swap = await res.json();

  // Save preimage + swap data
  saveSwap(swap.id, 'reverse', {
    swap,
    preimage: Buffer.from(preimage).toString('hex'),
    createdAt: Date.now(),
  });

  return swap;
}

// export const reverseSwap = async () => {
//   // Create a random preimage for the swap; has to have a length of 32 bytes
//   const preimage = crypto.randomBytes(32);
//   console.log(preimage);
//   console.log(preimage);
//   const signer = Wallet.fromPhrase(signerMnemonic);
//   // Create a Reverse Swap
//   console.log(await signer.getAddress());
//   const provider = new JsonRpcProvider(
//     getRoostockProviderEndpoint(process.env.BOLTZ_ENVIRONMENT),
//   );
//   console.log(
//     (await provider.getBalance('0xeE728e592106F18400160550f2a148725B9c055D')) /
//       satoshiWeiFactor,
//   );
//   return;
//   console.log(sha256Hash(preimage).toString('hex'));
//   const createdResponse = await (
//     await fetch(getBoltzApiUrl('testnet') + '/v2/swap/reverse', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         invoiceAmount,
//         to: 'RBTC',
//         from: 'BTC',
//         claimAddress: '0xeE728e592106F18400160550f2a148725B9c055D',
//         preimageHash: sha256Hash(preimage).toString('hex'),
//       }),
//     })
//   ).json();

//   console.log('Created swap');
//   console.log(createdResponse);
//   console.log();

//   // Create a WebSocket and subscribe to updates for the created swap
//   const webSocket = new WebSocket(`${getBoltzWsUrl('testnet')}`);

//   webSocket.onopen = () => {
//     console.log('websocket opened', createdResponse.id);
//     webSocket.send(
//       JSON.stringify({
//         op: 'subscribe',
//         channel: 'swap.update',
//         args: [createdResponse.id],
//       }),
//     );
//   };

//   webSocket.onmessage = async event => {
//     try {
//       const data = JSON.parse(event.data);
//       const msg = data;
//       console.log('Got WebSocket update', msg);
//       // Use event.data, not rawMsg.toString()

//       if (msg.event !== 'update') {
//         return;
//       }

//       switch (msg.args[0].status) {
//         case 'swap.created': {
//           console.log('Waiting for invoice to be paid');
//           break;
//         }

//         // "transaction.confirmed" means we can claim the RBTC
//         case 'transaction.confirmed': {
//           console.log('running here');
//           const provider = new JsonRpcProvider(
//             getRoostockProviderEndpoint(process.env.BOLTZ_ENVIRONMENT),
//           );
//           console.log(provider);
//           const contracts = await (
//             await fetch(getBoltzApiUrl('testnet') + '/v2/chain/RBTC/contracts')
//           ).json();

//           console.log(contracts);
//           const contract = new Contract(
//             contracts.swapContracts.EtherSwap,
//             EtherSwapArtifact.abi,
//             signer.connect(provider),
//           );

//           console.log(contract, 'contract');
//           console.log(preimage);
//           console.log(BigInt(createdResponse.onchainAmount) * satoshiWeiFactor);
//           const tx = await contract['claim(bytes32,uint256,address,uint256)'](
//             Buffer.from(preimage),
//             BigInt(createdResponse.onchainAmount) * satoshiWeiFactor,
//             createdResponse.refundAddress,
//             createdResponse.timeoutBlockHeight,
//           );
//           console.log(tx, 'console.logtx');
//           console.log(`Claimed RBTC in: ${tx.hash}`);
//           break;
//         }

//         case 'invoice.settled':
//           console.log('Swap successful');
//           webSocket.close();
//           break;
//       }
//     } catch (err) {
//       console.log(err);
//     }
//   };

//   webSocket.onerror = error => {
//     console.error('WebSocket error:', error);
//   };

//   webSocket.onclose = () => {
//     console.log('WebSocket closed');
//   };
// };
