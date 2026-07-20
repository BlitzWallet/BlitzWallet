import {
  MAX_ADDRESSES_PER_OPTION_FREE,
  MAX_ADDRESSES_PER_OPTION_PREMIUM,
  getAccumulationAddressLimit,
  getPairKey,
} from '../../app/constants/accumulationAddresses';

describe('getAccumulationAddressLimit', () => {
  it('returns 5 for undefined', () => {
    expect(getAccumulationAddressLimit(undefined)).toBe(5);
  });

  it('returns 5 for an empty object', () => {
    expect(getAccumulationAddressLimit({})).toBe(5);
  });

  it('returns 5 when isPremium is false', () => {
    expect(getAccumulationAddressLimit({ isPremium: false })).toBe(5);
  });

  it('returns 20 when isPremium is true', () => {
    expect(getAccumulationAddressLimit({ isPremium: true })).toBe(20);
  });
});

describe('address cap constants', () => {
  it('exposes the free and premium caps', () => {
    expect(MAX_ADDRESSES_PER_OPTION_FREE).toBe(5);
    expect(MAX_ADDRESSES_PER_OPTION_PREMIUM).toBe(20);
  });
});

describe('getPairKey', () => {
  it('builds a stable key from sourceChain, sourceAsset, destinationAsset', () => {
    expect(
      getPairKey({ sourceChain: 'base', sourceAsset: 'USDC', destinationAsset: 'BTC' }),
    ).toBe('base:USDC:BTC');
  });

  it('produces equal keys for the same triple', () => {
    const a = getPairKey({ sourceChain: 'base', sourceAsset: 'USDC', destinationAsset: 'BTC' });
    const b = getPairKey({ sourceChain: 'base', sourceAsset: 'USDC', destinationAsset: 'BTC' });
    expect(a).toBe(b);
  });

  it('produces a different key for a different destination', () => {
    const a = getPairKey({ sourceChain: 'base', sourceAsset: 'USDC', destinationAsset: 'BTC' });
    const b = getPairKey({ sourceChain: 'base', sourceAsset: 'USDC', destinationAsset: 'USDB' });
    expect(a).not.toBe(b);
  });
});
