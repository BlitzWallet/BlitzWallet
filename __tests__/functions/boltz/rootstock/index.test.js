const {
  getRoostockProviderEndpoint,
  getRoostockProviderEndpoints,
  getRoostockProviderNetwork,
} = require('../../../../app/functions/boltz/rootstock');

describe('Rootstock provider endpoints', () => {
  it('returns primary and backup mainnet endpoints in priority order', () => {
    expect(getRoostockProviderEndpoints('liquid')).toEqual([
      'https://public-node.rsk.co/',
      'https://mycrypto.rsk.co',
    ]);
  });

  it('keeps the single endpoint helper pointed at the primary endpoint', () => {
    expect(getRoostockProviderEndpoint('liquid')).toBe(
      'https://public-node.rsk.co/',
    );
  });

  it('uses only the testnet endpoint outside the liquid environment', () => {
    expect(getRoostockProviderEndpoints('testnet')).toEqual([
      'https://public-node.testnet.rsk.co',
    ]);
  });

  it('returns the Rootstock mainnet network for liquid swaps', () => {
    expect(getRoostockProviderNetwork('liquid')).toEqual({
      name: 'rootstock',
      chainId: 30,
    });
  });
});
