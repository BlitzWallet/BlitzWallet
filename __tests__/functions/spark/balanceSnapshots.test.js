jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

const mockRows = new Map();

const mockDb = {
  execAsync: jest.fn(async () => {}),
  getFirstAsync: jest.fn(async (_sql, params) => {
    if (!params) return null;
    return mockRows.get(params[0]) || null;
  }),
  runAsync: jest.fn(async (sql, params = []) => {
    if (sql.includes('INTO account_balance_snapshots')) {
      const [identityPubKey, balance, tokens, updatedAt] = params;
      mockRows.set(identityPubKey, {
        identityPubKey,
        balance,
        tokens,
        updatedAt,
      });
      return { changes: 1 };
    }
    return { changes: 0 };
  }),
  getAllAsync: jest.fn(async () => [...mockRows.values()]),
};

import {
  getUsdTokenDollars,
  optimisticallyUpdateBalanceSnapshot,
  saveAccountBalanceSnapshot,
} from '../../../app/functions/spark/balanceSnapshots';
import { USDB_TOKEN_ID } from '../../../app/constants';

describe('getUsdTokenDollars', () => {
  it('returns 0 when there is no tokens object', () => {
    expect(getUsdTokenDollars(null)).toBe(0);
    expect(getUsdTokenDollars(undefined)).toBe(0);
    expect(getUsdTokenDollars({})).toBe(0);
  });

  it('returns 0 when the USDB token has no balance or decimals', () => {
    expect(getUsdTokenDollars({ [USDB_TOKEN_ID]: {} })).toBe(0);
    expect(
      getUsdTokenDollars({ [USDB_TOKEN_ID]: { balance: '100' } }),
    ).toBe(0);
    expect(
      getUsdTokenDollars({
        [USDB_TOKEN_ID]: { balance: '100', tokenMetadata: {} },
      }),
    ).toBe(0);
  });

  it('converts a USDB token balance to dollars', () => {
    const tokensObj = {
      [USDB_TOKEN_ID]: {
        balance: '100000000',
        tokenMetadata: { decimals: 8 },
      },
    };
    expect(getUsdTokenDollars(tokensObj)).toBe(1);
  });

  it('handles BigInt balances', () => {
    const tokensObj = {
      [USDB_TOKEN_ID]: {
        balance: 250000000000n,
        tokenMetadata: { decimals: 8 },
      },
    };
    expect(getUsdTokenDollars(tokensObj)).toBe(2500);
  });

  it('ignores non-USDB tokens', () => {
    const tokensObj = {
      someOtherToken: {
        balance: '999999999',
        tokenMetadata: { decimals: 8 },
      },
    };
    expect(getUsdTokenDollars(tokensObj)).toBe(0);
  });
});

describe('optimisticallyUpdateBalanceSnapshot', () => {
  const PK = 'pubkey-1';
  const usdbToken = balance => ({
    [USDB_TOKEN_ID]: {
      balance,
      tokenMetadata: { decimals: 8 },
    },
  });

  beforeEach(() => {
    mockRows.clear();
  });

  async function cachedRow() {
    const row = mockRows.get(PK);
    return row ? { balance: row.balance, tokens: JSON.parse(row.tokens) } : null;
  }

  it('applies a BTC delta to the cached snapshot', async () => {
    await saveAccountBalanceSnapshot(PK, 100000, {});
    await optimisticallyUpdateBalanceSnapshot(PK, { deltaBtcSats: -1000 });
    expect(await cachedRow()).toMatchObject({ balance: 99000 });
  });

  it('applies a USDB delta in base units', async () => {
    await saveAccountBalanceSnapshot(PK, 50000, usdbToken(100000000n));
    await optimisticallyUpdateBalanceSnapshot(PK, { deltaUsdMicros: 250000 });
    expect(await cachedRow()).toMatchObject({ balance: 50000 });
    expect(
      JSON.parse(mockRows.get(PK).tokens)[USDB_TOKEN_ID].balance,
    ).toBe('100250000');
  });

  it('prefers a fresh base balance and tokens when supplied', async () => {
    await saveAccountBalanceSnapshot(PK, 100000, usdbToken(100000000n));
    await optimisticallyUpdateBalanceSnapshot(PK, {
      btcSats: 90000,
      tokensObj: usdbToken(90000000n),
      deltaBtcSats: -1000,
      deltaUsdMicros: 100000,
    });
    const row = await cachedRow();
    expect(row.balance).toBe(89000);
    expect(JSON.parse(mockRows.get(PK).tokens)[USDB_TOKEN_ID].balance).toBe(
      '90100000',
    );
  });

  it('clamps balances at zero', async () => {
    await saveAccountBalanceSnapshot(PK, 500, {});
    await optimisticallyUpdateBalanceSnapshot(PK, { deltaBtcSats: -1000 });
    expect(await cachedRow()).toMatchObject({ balance: 0 });
  });

  it('does nothing without a cached snapshot (live read will paint)', async () => {
    await optimisticallyUpdateBalanceSnapshot(PK, { deltaBtcSats: 5000 });
    expect(mockRows.has(PK)).toBe(false);
  });
});