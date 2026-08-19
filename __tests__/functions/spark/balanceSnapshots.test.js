jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));

import { getUsdTokenDollars } from '../../../app/functions/spark/balanceSnapshots';
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