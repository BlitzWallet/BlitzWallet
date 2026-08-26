export default async function getBitcoinTransactionAmount(txid, address, vout) {
  const apis = [
    {
      name: 'Blockstream',
      url: `https://blockstream.info/api/tx/${txid}`,
    },
    {
      name: 'Mempool.space',
      url: `https://mempool.space/api/tx/${txid}`,
    },
    {
      name: 'mempool.bullbitcoin',
      url: `https://mempool.bullbitcoin.com/api/tx/${txid}`,
    },
  ];

  for (const api of apis) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(api.url, { signal: controller.signal });
      const data = await response.json();
      console.log('api response data', data);

      const transactionOutputs = data?.vout;

      if (!Array.isArray(transactionOutputs)) {
        throw new Error(`Invalid response from ${api.name} API`);
      }

      let ourOutput;
      const voutIndex = Number(vout);
      const hasValidVout =
        vout !== undefined &&
        vout !== null &&
        String(vout).trim() !== '' &&
        Number.isInteger(voutIndex) &&
        voutIndex >= 0;

      if (hasValidVout) {
        const candidate = transactionOutputs[voutIndex];
        if (!candidate) {
          throw new Error(
            `vout ${voutIndex} out of bounds for tx ${txid} (${api.name})`,
          );
        }
        if (candidate.scriptpubkey_address !== address) {
          throw new Error(
            `Address mismatch at vout ${voutIndex}: expected ${address} got ${candidate.scriptpubkey_address} (${api.name})`,
          );
        }
        ourOutput = candidate;
      } else if (
        vout !== undefined &&
        vout !== null &&
        String(vout).trim() !== ''
      ) {
        throw new Error(`Invalid vout "${vout}" for tx ${txid} (${api.name})`);
      } else {
        ourOutput = transactionOutputs.find(
          output => output.scriptpubkey_address === address,
        );
        if (!ourOutput)
          throw new Error(`Not able to find our address in the output`);
      }

      return { didWork: true, value: ourOutput.value };
    } catch (err) {
      console.log('error getting transaction amount', err);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return { didWork: false };
}
