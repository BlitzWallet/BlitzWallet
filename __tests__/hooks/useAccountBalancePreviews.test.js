import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// Mutable mock state the jest.mock factories below read lazily.
let mockActiveAccount = { uuid: 'active-uuid' };
let mockAccountsLnurl = {};
let mockSnapshots = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: callback => {
    const MockReact = require('react');
    MockReact.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

jest.mock('../../context-store/activeAccount', () => ({
  useActiveCustodyAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('../../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: { accountsLnurl: mockAccountsLnurl },
  }),
}));

jest.mock('../../context-store/sparkContext', () => ({
  useSparkWallet: () => ({
    sparkInformation: { didConnect: true, balance: 50000, tokens: {} },
  }),
}));

jest.mock('../../context-store/flashnetContext', () => ({
  useFlashnet: () => ({ swapUSDPriceDollars: 50000000 }),
}));

jest.mock('../../app/constants', () => ({ SATSPERBITCOIN: 100000000 }));

jest.mock('../../app/functions/spark/balanceSnapshots', () => ({
  getAllAccountBalanceSnapshots: jest.fn(async () => mockSnapshots),
  getUsdTokenDollars: () => 0,
}));

const useAccountBalancePreviews = require('../../app/hooks/useAccountBalancePreviews')
  .default;

async function flushMicrotasks(times = 20) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

async function renderHook() {
  const hookResult = {};
  function TestHost() {
    const result = useAccountBalancePreviews();
    Object.assign(hookResult, result);
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(<TestHost />);
    await flushMicrotasks();
  });
  return hookResult;
}

describe('useAccountBalancePreviews.computeLastUpdated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveAccount = { uuid: 'active-uuid' };
    mockAccountsLnurl = {};
    mockSnapshots = [];
  });

  test('returns the snapshot updatedAt for a non-active account', async () => {
    mockAccountsLnurl = {
      acct1: { uuid: 'acct-1', identityPubKey: 'pk-1' },
    };
    mockSnapshots = [
      { identityPubKey: 'pk-1', balance: 1000, tokens: {}, updatedAt: 1724300000000 },
    ];
    const hookResult = await renderHook();
    expect(hookResult.computeLastUpdated({ uuid: 'acct-1' })).toBe(
      1724300000000,
    );
  });

  test('returns null for the active account even when a snapshot exists', async () => {
    mockAccountsLnurl = {
      acct1: { uuid: 'active-uuid', identityPubKey: 'pk-1' },
    };
    mockSnapshots = [
      { identityPubKey: 'pk-1', balance: 1000, tokens: {}, updatedAt: 1724300000000 },
    ];
    const hookResult = await renderHook();
    expect(hookResult.computeLastUpdated({ uuid: 'active-uuid' })).toBeNull();
  });

  test('returns null for an account with no snapshot', async () => {
    mockAccountsLnurl = {
      acct2: { uuid: 'acct-2', identityPubKey: 'pk-2' },
    };
    const hookResult = await renderHook();
    expect(hookResult.computeLastUpdated({ uuid: 'acct-2' })).toBeNull();
  });

  test('still exposes computeTotalSats from a snapshot', async () => {
    mockAccountsLnurl = {
      acct1: { uuid: 'acct-1', identityPubKey: 'pk-1' },
    };
    mockSnapshots = [
      { identityPubKey: 'pk-1', balance: 1000, tokens: {}, updatedAt: 1724300000000 },
    ];
    const hookResult = await renderHook();
    expect(hookResult.computeTotalSats({ uuid: 'acct-1' })).toBe(1000);
  });
});
