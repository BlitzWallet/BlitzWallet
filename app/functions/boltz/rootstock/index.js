export const satoshiWeiFactor = 10n ** 10n;

const SATOSHIS_PER_BTC = 10n ** 8n; // 100,000,000 satoshis = 1 BTC
const WEI_PER_RBTC = 10n ** 18n; // 1,000,000,000,000,000,000 wei = 1 RBTC
const SATOSHI_TO_WEI_FACTOR = WEI_PER_RBTC / SATOSHIS_PER_BTC; // 10^10
const providerEndpointTestnet = 'https://public-node.testnet.rsk.co';
const providerEndpointMainnet = 'https://public-node.rsk.co/';

export const rootstockEnvironment = 'liquid';
export const getRoostockProviderEndpoint = environment => {
  return environment === 'liquid'
    ? providerEndpointMainnet
    : providerEndpointTestnet;
};

/**
 * Convert satoshis to Rootstock wei
 * @param {bigint} satoshis - Amount in satoshis
 * @returns {bigint} - Amount in wei
 */
export const satoshisToWei = satoshis => {
  const satoshisBigInt =
    typeof satoshis === 'bigint' ? satoshis : BigInt(satoshis);
  return satoshisBigInt * SATOSHI_TO_WEI_FACTOR;
};

/**
 * Convert Rootstock wei to satoshis
 * @param {bigint} wei - Amount in wei
 * @returns {bigint} - Amount in satoshis
 */
export const weiToSatoshis = wei => {
  return wei / SATOSHI_TO_WEI_FACTOR;
};
