import Storage, {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../localStorage';

export default async function getDepositAddressTxIds(address) {
  const savedDepositTxids =
    JSON.parse(await getLocalStorageItem('depositAddressTxIds')) || {};
  let savedTxIds = savedDepositTxids[address];
  if (!savedTxIds) {
    savedTxIds = [];
  }

  const ids = await fetchTxidsFromBlockstream(address, savedTxIds);
  if (ids.length > 0) {
    savedTxIds.push(...ids);
    savedDepositTxids[address] = savedTxIds;
    await setLocalStorageItem(
      'depositAddressTxIds',
      JSON.stringify(savedDepositTxids),
    );
  }

  return savedDepositTxids[address] || [];
}

async function fetchTxidsFromBlockstream(address, savedTxIds) {
  const apis = [
    {
      name: 'Blockstream',
      url: `https://blockstream.info/api/address/${address}/txs`,
    },
    {
      name: 'Mempool.space',
      url: `https://mempool.space/api/address/${address}/txs`,
    },
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url);
      const data = await response.json();
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

      return data
        .map(tx => {
          const isIncomingTx = tx.vout.some(
            vout => vout.scriptpubkey_address === address,
          );
          const isAlreadySaved = savedTxIds.some(item => item.txid === tx.txid);
          if (!isIncomingTx || isAlreadySaved) {
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
          return hasUnspentOutputs ? {txid: tx.txid, didClaim: false} : null;
        })
        .filter(Boolean);
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
    JSON.parse(await getLocalStorageItem('depositAddressTxIds')) || {};

  let savedTxIds = savedDepositTxids[address] || [];

  if (!savedTxIds || !savedTxIds.length) return;
  if (!txId) {
    console.warn('No txId provided to handleTxIdState');
    return;
  }
  if (typeof didClaim !== 'boolean') {
    console.warn('didClaim must be a boolean value');
    return;
  }

  // Update the txId state in the savedDepositTxids
  const newState = savedTxIds.map(tx => {
    if (tx.txid === txId.txid) {
      return {...tx, didClaim};
    }
    return tx;
  });
  savedTxIds = newState;
  savedDepositTxids[address] = savedTxIds;
  await setLocalStorageItem(
    'depositAddressTxIds',
    JSON.stringify(savedDepositTxids),
  );
}
