export const ACCUMULATION_CHAINS = [
  { id: 'arbitrum', label: 'Arbitrum', assets: ['USDC', 'USDT'] },
  { id: 'base', label: 'Base', assets: ['USDC'] },
  { id: 'bsc', label: 'Binance', assets: ['USDC', 'USDT'] },
  { id: 'solana', label: 'Solana', assets: ['USDC', 'USDT'] },
  { id: 'ethereum', label: 'Ethereum', assets: ['USDC', 'USDT'] },
  { id: 'optimism', label: 'Optimism', assets: ['USDC', 'USDT'] },
  { id: 'polygon', label: 'Polygon', assets: ['USDC', 'USDT'] },
  { id: 'plasma', label: 'Plasma', assets: ['USDT'] },
  { id: 'tron', label: 'Tron', assets: ['USDT'] },
];
export const ACCUMULATION_DESTINATIONS = ['BTC', 'USDB'];

export const CHAIN_ASSET_ROW_HEIGHT = 65;
export const CHAIN_EXPAND_PADDING = 26;
export const getChainExpandHeight = chainId => {
  const chain = ACCUMULATION_CHAINS.find(c => c.id === chainId);
  if (!chain) return null;
  return chain.assets.length * CHAIN_ASSET_ROW_HEIGHT + CHAIN_EXPAND_PADDING;
};
