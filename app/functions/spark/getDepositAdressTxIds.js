import fetchBackend from '../../../db/handleBackend';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

export default async function getDepositAddressTxIds(
  address,
  contactsPrivateKey,
  publicKey,
) {
  const savedDepositTxids = {};
  let savedTxIds = savedDepositTxids[address];
  if (!savedTxIds) {
    savedTxIds = [];
  }
  const ids = await fetchTxidsFromBlockstream(
    address,
    contactsPrivateKey,
    publicKey,
  );
  if (ids.length > 0) {
    savedTxIds.push(...ids);
    savedDepositTxids[address] = savedTxIds;
  }
  return savedDepositTxids[address] || [];
}

async function fetchTxidsFromBlockstream(
  address,
  contactsPrivateKey,
  publicKey,
) {
  const apis = [
    {
      name: 'Blockstream',
      url: `https://blockstream.info/api/address/${address}/txs`,
    },
    {
      name: 'Mempool.space',
      url: `https://mempool.space/api/address/${address}/txs`,
    },
    {
      name: 'fbBLockstream',
    },
  ];

  for (const api of apis) {
    try {
      let data;
      if (api.name === 'fbBLockstream') {
        const response = await fetchBackend(
          'enterpriseBlockstreamEsploraData',
          { address },
          contactsPrivateKey,
          publicKey,
        );
        data = response;
      } else {
        const response = await fetch(api.url);
        data = await response.json();
        console.log('api response data', data);
      }

      if (!Array.isArray(data)) {
        throw new Error(`Invalid response from ${api.name} API`);
      }

      // Create a map of all spent UTXOs from the transaction data we already have
      const spentUtxos = new Set();
      data.forEach(tx => {
        tx.vin.forEach(input => {
          if (input.txid && input.vout !== undefined) {
            spentUtxos.add(`${input.txid}:${input.vout}`);
          }
        });
      });

      const exploraData = data
        .map(tx => {
          const isIncomingTx = tx.vout.some(
            vout => vout.scriptpubkey_address === address,
          );
          if (!isIncomingTx) {
            return null;
          }

          // Check if this transaction has any unspent outputs to our address
          const hasUnspentOutputs = tx.vout.some((vout, index) => {
            if (vout.scriptpubkey_address === address) {
              const utxoKey = `${tx.txid}:${index}`;
              return !spentUtxos.has(utxoKey);
            }
            return false;
          });

          if (!hasUnspentOutputs) return null;

          const isConfirmed = tx.status?.confirmed || false;

          // Calculate the amount received to this address
          const amount = tx.vout.reduce((total, vout, index) => {
            if (vout.scriptpubkey_address === address) {
              const utxoKey = `${tx.txid}:${index}`;
              if (!spentUtxos.has(utxoKey)) {
                return total + vout.value;
              }
            }
            return total;
          }, 0);

          // Calculate transaction fee (total inputs - total outputs)
          const totalInputValue = tx.vin.reduce((total, input) => {
            return total + (input.prevout?.value || 0);
          }, 0);

          const totalOutputValue = tx.vout.reduce((total, output) => {
            return total + output.value;
          }, 0);

          const fee = totalInputValue - totalOutputValue;

          return hasUnspentOutputs
            ? {
                txid: tx.txid,
                didClaim: false,
                isConfirmed,
                fee,
                amount,
              }
            : null;
        })
        .filter(Boolean);

      let savedDepositTxids =
        JSON.parse(await getLocalStorageItem('alreadyClaimedTxs')) || {};
      let savedTxIds = savedDepositTxids[address] || [];
      let updatedExploraData = exploraData;

      if (savedTxIds.length) {
        updatedExploraData = exploraData.filter(
          item => !savedTxIds.includes(item.txid),
        );
      }

      return updatedExploraData;
    } catch (err) {
      console.log(`fetching data from ${api.name.toLowerCase()} failed`, err);
      // If this is the last API, return empty array or rethrow
      if (api === apis[apis.length - 1]) {
        console.log('All APIs failed, returning empty array');
        return [];
      }
    }
  }
}

export async function handleTxIdState(txId, didClaim, address) {
  let savedDepositTxids =
    JSON.parse(await getLocalStorageItem('alreadyClaimedTxs')) || {};
  let savedTxIds = savedDepositTxids[address] || [];

  if (!txId) {
    console.warn('No txId provided to handleTxIdState');
    return;
  }

  if (typeof didClaim !== 'boolean') {
    console.warn('didClaim must be a boolean value');
    return;
  }

  if (savedTxIds.includes(txId.txid)) return;

  savedTxIds.push(txId.txid);
  savedDepositTxids[address] = savedTxIds;
  await setLocalStorageItem(
    'alreadyClaimedTxs',
    JSON.stringify(savedDepositTxids),
  );
}
