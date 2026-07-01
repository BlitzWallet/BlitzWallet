// mergeAndCacheTokens lets the token-balance:update handler update the token map
// from the event payload (the SDK's full getTokenBalanceMap()) without a second
// balance read. These tests pin the two properties the handler relies on:
//   1. live token balances are normalized to Number (string or BigInt input),
//   2. a token absent from the new full map is zeroed (proving the payload is
//      treated as authoritative, not merged additively).
jest.mock('../../../app/functions/localStorage', () => {
  const store = {};
  return {
    getLocalStorageItem: jest.fn(async key =>
      key in store ? store[key] : null,
    ),
    setLocalStorageItem: jest.fn(async (key, val) => {
      store[key] = val;
    }),
    __reset: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
});

const localStorage = require('../../../app/functions/localStorage');
const {
  mergeAndCacheTokens,
} = require('../../../app/functions/lrc20/cachedTokens');

const MNEMONIC = 'test mnemonic';

const tokenEntry = (balance, maxSupply) => ({
  tokenMetadata: { maxSupply, name: 'TKN' },
  balance,
});

describe('mergeAndCacheTokens', () => {
  beforeEach(() => {
    localStorage.__reset();
  });

  it('normalizes string balances from the WebView payload to Number', async () => {
    const merged = await mergeAndCacheTokens(
      { btknAAA: tokenEntry('500', '1000') },
      MNEMONIC,
    );

    expect(merged.btknAAA.balance).toBe(500);
    expect(merged.btknAAA.tokenMetadata.maxSupply).toBe(1000);
    expect(typeof merged.btknAAA.balance).toBe('number');
  });

  it('normalizes BigInt balances from the native payload to Number', async () => {
    const merged = await mergeAndCacheTokens(
      { btknAAA: tokenEntry(500n, 1000n) },
      MNEMONIC,
    );

    expect(merged.btknAAA.balance).toBe(500);
    expect(merged.btknAAA.tokenMetadata.maxSupply).toBe(1000);
  });

  it('zeroes a previously held token absent from the new full map', async () => {
    await mergeAndCacheTokens(
      {
        btknAAA: tokenEntry('500', '1000'),
        btknBBB: tokenEntry('200', '1000'),
      },
      MNEMONIC,
    );

    // Next event reports only btknAAA — btknBBB must be retained but zeroed,
    // never left at its stale balance.
    const merged = await mergeAndCacheTokens(
      { btknAAA: tokenEntry('700', '1000') },
      MNEMONIC,
    );

    expect(merged.btknAAA.balance).toBe(700);
    expect(merged.btknBBB.balance).toBe(0);
  });

  it('returns an empty map and writes nothing harmful for an empty payload', async () => {
    const merged = await mergeAndCacheTokens({}, MNEMONIC);
    expect(merged).toEqual({});
  });
});
