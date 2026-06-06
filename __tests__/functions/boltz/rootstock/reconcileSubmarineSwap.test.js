jest.mock('boltz-core/out/EtherSwap.sol/EtherSwap.json', () => ({
  abi: [],
}));

jest.mock('bolt11', () => ({
  decode: jest.fn(() => ({
    tags: [{ tagName: 'payment_hash', data: 'a'.repeat(64) }],
  })),
}));

jest.mock('../../../../app/functions/boltz/rootstock/swapDb', () => ({
  deleteSwapById: jest.fn(() => Promise.resolve(true)),
  updateSwap: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../../../../app/functions/boltz/rootstock/swapProgress', () => ({
  updateRootstockSwapPlaceholder: jest.fn(() => Promise.resolve(true)),
}));

const mockContract = {
  hashValues: jest.fn(() => Promise.resolve('0xkey')),
  swaps: jest.fn(() => Promise.resolve(false)),
  queryFilter: jest.fn(() => Promise.resolve([])),
  filters: { Lockup: jest.fn(() => 'lockup-filter') },
};

jest.mock('ethers', () => ({
  Contract: jest.fn(() => mockContract),
}));

const {
  deleteSwapById,
  updateSwap,
} = require('../../../../app/functions/boltz/rootstock/swapDb');
const {
  updateRootstockSwapPlaceholder,
} = require('../../../../app/functions/boltz/rootstock/swapProgress');
const {
  reconcileSubmarineSwapLock,
} = require('../../../../app/functions/boltz/rootstock/reconcileSubmarineSwap');

const signer = { getAddress: jest.fn(() => Promise.resolve('0xrefund')) };

const provider = {
  getBlockNumber: jest.fn(() => Promise.resolve(1000)),
  getTransactionCount: jest.fn(() => Promise.resolve(5)),
};

const buildSwap = (overrides = {}) => ({
  id: 'swap-1',
  type: 'submarine',
  data: {
    invoice: 'lnbc1invoice',
    invoiceId: 'invoice-id-1',
    accountId: 'acct-1',
    amountSat: 5000,
    feeSat: 32,
    createdAt: 123,
    status: 'invoice.set',
    lockState: 'broadcasting',
    lockStartedAt: 1000,
    swap: {
      id: 'swap-1',
      claimAddress: '0xclaim',
      timeoutBlockHeight: 100,
      expectedAmount: 5000,
    },
    ...overrides,
  },
});

// Boltz status fetch + contracts fetch share global.fetch; discriminate by URL.
const mockFetch = ({ status = 'invoice.set' } = {}) => {
  global.fetch = jest.fn(url => {
    if (url.includes('/v2/chain/RBTC/contracts')) {
      return Promise.resolve({
        json: () =>
          Promise.resolve({ swapContracts: { EtherSwap: '0xcontract' } }),
      });
    }
    // /v2/swap/{id}
    return Promise.resolve({ json: () => Promise.resolve({ status }) });
  });
};

describe('reconcileSubmarineSwapLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContract.hashValues.mockResolvedValue('0xkey');
    mockContract.swaps.mockResolvedValue(false);
    mockContract.queryFilter.mockResolvedValue([]);
    provider.getBlockNumber.mockResolvedValue(1000);
    provider.getTransactionCount.mockResolvedValue(5);
    mockFetch();
  });

  it('keeps and recovers the hash when Boltz advanced past invoice.set', async () => {
    mockFetch({ status: 'transaction.mempool' });
    mockContract.queryFilter.mockResolvedValue([{ transactionHash: '0xlock' }]);

    const result = await reconcileSubmarineSwapLock(buildSwap(), signer, provider);

    expect(result).toEqual({ decision: 'keep', reason: 'boltz_advanced' });
    expect(mockContract.swaps).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        locked: true,
        lockState: 'confirmed',
        lockTxHash: '0xlock',
        rootstockPaymentTxId: '0xlock',
      }),
    );
    expect(deleteSwapById).not.toHaveBeenCalled();
  });

  it('keeps when on-chain swaps[key] proves funds are locked', async () => {
    mockContract.swaps.mockResolvedValue(true);
    mockContract.queryFilter.mockResolvedValue([{ transactionHash: '0xlock' }]);

    const result = await reconcileSubmarineSwapLock(buildSwap(), signer, provider);

    expect(result).toEqual({ decision: 'keep', reason: 'onchain_locked' });
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        locked: true,
        lockState: 'broadcasted',
        lockTxHash: '0xlock',
      }),
    );
    expect(deleteSwapById).not.toHaveBeenCalled();
  });

  it('is uncertain (no delete) when an unmined tx is pending', async () => {
    provider.getTransactionCount.mockImplementation((_addr, tag) =>
      Promise.resolve(tag === 'pending' ? 6 : 5),
    );

    const result = await reconcileSubmarineSwapLock(buildSwap(), signer, provider);

    expect(result).toEqual({ decision: 'uncertain', reason: 'pending_nonce' });
    expect(updateSwap).toHaveBeenCalledWith('swap-1', {
      lockState: 'broadcast_unknown',
    });
    expect(deleteSwapById).not.toHaveBeenCalled();
  });

  it('keeps and recovers the hash when a Lockup log exists', async () => {
    mockContract.queryFilter.mockResolvedValue([{ transactionHash: '0xlock' }]);

    const result = await reconcileSubmarineSwapLock(buildSwap(), signer, provider);

    expect(result).toEqual({ decision: 'keep', reason: 'lockup_log' });
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        lockState: 'broadcasted',
        lockTxHash: '0xlock',
      }),
    );
    expect(deleteSwapById).not.toHaveBeenCalled();
  });

  it('discards (deletes) only when no funds were provably sent', async () => {
    // status invoice.set, swaps=false, nonce equal, no Lockup log
    const result = await reconcileSubmarineSwapLock(buildSwap(), signer, provider);

    expect(result).toEqual({ decision: 'discard', reason: 'no_funds' });
    expect(deleteSwapById).toHaveBeenCalledTimes(1);
    expect(deleteSwapById).toHaveBeenCalledWith('swap-1');
    expect(updateRootstockSwapPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        swapId: 'swap-1',
        status: 'swap.expired',
        extraDetails: expect.objectContaining({ abandonedNoFunds: true }),
      }),
    );
  });

  it('is uncertain and never deletes when a chain check throws', async () => {
    mockContract.swaps.mockRejectedValue(new Error('rpc down'));

    const result = await reconcileSubmarineSwapLock(buildSwap(), signer, provider);

    expect(result).toEqual({ decision: 'uncertain', reason: 'error' });
    expect(deleteSwapById).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenLastCalledWith('swap-1', {
      lockState: 'broadcast_unknown',
    });
  });

  // Regression: the exact stuck state from the bug report.
  describe('stuck {invoice.set, broadcasting, txHash:null}', () => {
    const stuck = () =>
      buildSwap({ status: 'invoice.set', lockState: 'broadcasting' });

    it('is discarded when the chain proves no lockup', async () => {
      const result = await reconcileSubmarineSwapLock(stuck(), signer, provider);

      expect(result.decision).toBe('discard');
      expect(deleteSwapById).toHaveBeenCalledWith('swap-1');
    });

    it('is KEPT (never deleted) when the chain shows a lockup', async () => {
      mockContract.swaps.mockResolvedValue(true);
      mockContract.queryFilter.mockResolvedValue([
        { transactionHash: '0xlock' },
      ]);

      const result = await reconcileSubmarineSwapLock(stuck(), signer, provider);

      expect(result.decision).toBe('keep');
      expect(deleteSwapById).not.toHaveBeenCalled();
      expect(updateSwap).toHaveBeenCalledWith(
        'swap-1',
        expect.objectContaining({ lockTxHash: '0xlock' }),
      );
    });
  });
});
