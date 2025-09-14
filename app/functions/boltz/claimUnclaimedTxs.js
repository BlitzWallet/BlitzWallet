// import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
// import {getBoltzApiUrl} from './boltzEndpoitns';

// export default async function claimUnclaimedBoltzSwaps() {
//   const savedBoltzTXs = JSON.parse(await getLocalStorageItem('boltzClaimTxs'));

//   if (!savedBoltzTXs) return true;

//   let newBoltzTx = await Promise.all(
//     savedBoltzTXs.map(async swap => {
//       try {
//         const response = await fetch(
//           `${getBoltzApiUrl(
//             process.env.BOLTZ_ENVIRONMENT,
//           )}/v2/chain/L-BTC/transaction`,
//           {
//             method: 'POST',
//             headers: {
//               accept: 'application/json',
//               'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({hex: swap[0]}),
//           },
//         );
//         const data = await response.json();

//         if (data.id) {
//           return null;
//         } else return swap;
//       } catch (err) {
//         console.log(err);

//         return swap;
//       }
//     }),
//   );

//   // Filter out any null values (successful transactions)
//   newBoltzTx = newBoltzTx.filter(tx => tx !== null);

//   // Save to local storage
//   setLocalStorageItem('boltzClaimTxs', JSON.stringify(newBoltzTx));
// }
