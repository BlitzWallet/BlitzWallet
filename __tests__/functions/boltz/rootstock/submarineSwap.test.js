jest.mock('boltz-core/out/EtherSwap.sol/EtherSwap.json', () => ({
  abi: [],
}));

jest.mock('bolt11', () => ({
  decode: jest.fn(() => ({
    tags: [{ tagName: 'payment_hash', data: 'a'.repeat(64) }],
  })),
}));

jest.mock('react-native-quick-crypto', () => ({
  randomBytes: jest.fn(() => Buffer.alloc(32, 1)),
}));

jest.mock('../../../../app/functions/spark/payments', () => ({
  sparkReceivePaymentWrapper: jest.fn(),
}));

jest.mock('i18next', () => ({
  t: key => key,
}));

jest.mock('../../../../app/functions/boltz/rootstock/swapDb', () => ({
  loadSwaps: jest.fn(),
  saveSwap: jest.fn(),
  updateSwap: jest.fn(),
}));

const mockContract = {
  lock: jest.fn(),
  'lock(bytes32,address,uint256)': jest.fn(),
};
mockContract['lock(bytes32,address,uint256)'].estimateGas = jest.fn();

jest.mock('ethers', () => ({
  Contract: jest.fn(() => mockContract),
}));

const { Contract } = require('ethers');
const bolt11 = require('bolt11');
const {
  loadSwaps,
  saveSwap,
  updateSwap,
} = require('../../../../app/functions/boltz/rootstock/swapDb');
const {
  calculateMaxSubmarineSwapAmount,
  createRootstockSubmarineSwap,
  lockSubmarineSwap,
} = require('../../../../app/functions/boltz/rootstock/submarineSwap');
const {
  satoshisToWei,
} = require('../../../../app/functions/boltz/rootstock');

const signer = {
  getAddress: jest.fn(() => Promise.resolve('0xrefund')),
};

const provider = {
  getBalance: jest.fn(),
  getFeeData: jest.fn(),
};

const limits = {
  rsk: {
    min: 2500,
    max: 25000000,
    submarine: {
      limits: { minimal: 2500, maximal: 25000000, maximalZeroConf: 0 },
      fees: { percentage: 0.1, minerFees: 32 },
    },
  },
};

describe('Rootstock submarine swaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            swapContracts: { EtherSwap: '0xcontract' },
          }),
      }),
    );
    provider.getBalance.mockResolvedValue(satoshisToWei(100000));
    provider.getFeeData.mockResolvedValue({ gasPrice: 10000000000n });
    mockContract.lock.mockResolvedValue({ hash: '0xambiguous-lock' });
    mockContract['lock(bytes32,address,uint256)'].mockResolvedValue({
      hash: '0xlocktx',
    });
    mockContract['lock(bytes32,address,uint256)'].estimateGas.mockResolvedValue(
      100n,
    );
    bolt11.decode.mockReturnValue({
      tags: [{ tagName: 'payment_hash', data: 'a'.repeat(64) }],
    });
    loadSwaps.mockResolvedValue([]);
    saveSwap.mockResolvedValue(true);
    updateSwap.mockResolvedValue(true);
  });

  it('creates an RBTC to BTC submarine swap and persists the active row', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            id: 'swap-1',
            claimAddress: '0xclaim',
            timeoutBlockHeight: 100,
            expectedAmount: 5000,
          }),
      }),
    );

    const row = await createRootstockSubmarineSwap('lnbc1invoice');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.boltz.exchange/v2/swap/submarine',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          invoice: 'lnbc1invoice',
          to: 'BTC',
          from: 'RBTC',
        }),
      }),
    );
    expect(saveSwap).toHaveBeenCalledWith(
      'swap-1',
      'submarine',
      expect.objectContaining({
        invoice: 'lnbc1invoice',
        status: 'swap.created',
      }),
    );
    expect(row).toEqual(
      expect.objectContaining({
        id: 'swap-1',
        type: 'submarine',
      }),
    );
  });

  it('does not persist a swap when Boltz returns a create error', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ error: 'invalid invoice' }),
      }),
    );

    const row = await createRootstockSubmarineSwap('lnbc1badinvoice');

    expect(row).toBeUndefined();
    expect(saveSwap).not.toHaveBeenCalled();
  });

  it('calculates max amount with submarine scalar fees and gas reserved', async () => {
    const result = await calculateMaxSubmarineSwapAmount({
      limits,
      provider,
      signer,
    });

    expect(result.maxSats).toBe(99755n);
    expect(result.boltzFee).toBe(145);
    expect(
      mockContract['lock(bytes32,address,uint256)'].estimateGas,
    ).toHaveBeenCalled();
    expect(mockContract.lock.estimateGas).toBeUndefined();
  });

  it('subtracts active outbound swap amounts before calculating max', async () => {
    loadSwaps.mockResolvedValue([
      {
        id: 'existing',
        type: 'submarine',
        data: { swap: { expectedAmount: 5000 } },
      },
    ]);

    const result = await calculateMaxSubmarineSwapAmount({
      limits,
      provider,
      signer,
    });

    expect(result.maxSats).toBe(94760n);
  });

  it('clamps max amount to the Boltz submarine maximum', async () => {
    provider.getBalance.mockResolvedValue(satoshisToWei(50000000));

    const result = await calculateMaxSubmarineSwapAmount({
      limits,
      provider,
      signer,
    });

    expect(result.maxSats).toBe(25000000n);
  });

  it('returns zero when the available amount is below Boltz minimum', async () => {
    provider.getBalance.mockResolvedValue(satoshisToWei(2600));

    const result = await calculateMaxSubmarineSwapAmount({
      limits,
      provider,
      signer,
    });

    expect(result).toEqual({
      maxSats: 0n,
      reason: 'Below Boltz min swap',
    });
  });

  it('returns zero when balance cannot cover gas and outbound swaps', async () => {
    provider.getBalance.mockResolvedValue(satoshisToWei(50));

    const result = await calculateMaxSubmarineSwapAmount({
      limits,
      provider,
      signer,
    });

    expect(result).toEqual({
      maxSats: 0n,
      reason: 'Insufficient RBTC for fee',
    });
  });

  it('persists lock state before broadcasting and then stores the lock tx hash', async () => {
    const swap = {
      id: 'swap-1',
      type: 'submarine',
      data: {
        invoice: 'lnbc1invoice',
        swap: {
          id: 'swap-1',
          claimAddress: '0xclaim',
          timeoutBlockHeight: 100,
          expectedAmount: 5000,
        },
      },
    };

    const response = await lockSubmarineSwap(swap, signer);

    expect(updateSwap).toHaveBeenNthCalledWith(
      1,
      'swap-1',
      expect.objectContaining({ lockState: 'locking' }),
    );
    expect(mockContract['lock(bytes32,address,uint256)']).toHaveBeenCalledWith(
      expect.any(Buffer),
      '0xclaim',
      100,
      { value: 5000n * 10000000000n },
    );
    expect(mockContract.lock).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenNthCalledWith(
      2,
      'swap-1',
      expect.objectContaining({
        locked: true,
        lockState: 'locked',
        lockTxHash: '0xlocktx',
      }),
    );
    expect(response.didLock).toBe(true);
  });

  it('does not broadcast a second lock once lock state exists', async () => {
    const response = await lockSubmarineSwap(
      {
        id: 'swap-1',
        type: 'submarine',
        data: {
          lockState: 'locking',
          invoice: 'lnbc1invoice',
          swap: {
            id: 'swap-1',
            claimAddress: '0xclaim',
            timeoutBlockHeight: 100,
            expectedAmount: 5000,
          },
        },
      },
      signer,
    );

    expect(response).toEqual({
      didLock: false,
      reason: 'lock_already_started',
    });
    expect(Contract).not.toHaveBeenCalled();
    expect(mockContract['lock(bytes32,address,uint256)']).not.toHaveBeenCalled();
    expect(updateSwap).not.toHaveBeenCalled();
  });

  it('does not broadcast a second lock while the first lock is in flight', async () => {
    let resolveLock;
    mockContract['lock(bytes32,address,uint256)'].mockReturnValue(
      new Promise(resolve => {
        resolveLock = resolve;
      }),
    );

    const swap = {
      id: 'swap-1',
      type: 'submarine',
      data: {
        invoice: 'lnbc1invoice',
        swap: {
          id: 'swap-1',
          claimAddress: '0xclaim',
          timeoutBlockHeight: 100,
          expectedAmount: 5000,
        },
      },
    };

    const firstLock = lockSubmarineSwap(swap, signer);
    await Promise.resolve();
    const secondLock = await lockSubmarineSwap(swap, signer);
    resolveLock({ hash: '0xlocktx' });
    await firstLock;

    expect(secondLock).toEqual({
      didLock: false,
      reason: 'lock_in_flight',
    });
    expect(mockContract['lock(bytes32,address,uint256)']).toHaveBeenCalledTimes(
      1,
    );
    expect(mockContract.lock).not.toHaveBeenCalled();
  });

  it('records a lock error without marking the swap locked', async () => {
    mockContract['lock(bytes32,address,uint256)'].mockRejectedValue(
      new Error('broadcast failed'),
    );

    await expect(
      lockSubmarineSwap(
        {
          id: 'swap-1',
          type: 'submarine',
          data: {
            invoice: 'lnbc1invoice',
            swap: {
              id: 'swap-1',
              claimAddress: '0xclaim',
              timeoutBlockHeight: 100,
              expectedAmount: 5000,
            },
          },
        },
        signer,
      ),
    ).rejects.toThrow('broadcast failed');

    expect(updateSwap).toHaveBeenLastCalledWith(
      'swap-1',
      expect.objectContaining({
        lockState: 'lock_error',
        lockError: 'broadcast failed',
      }),
    );
  });

  it('records a lock error when the invoice has no payment hash', async () => {
    bolt11.decode.mockReturnValue({ tags: [] });

    await expect(
      lockSubmarineSwap(
        {
          id: 'swap-1',
          type: 'submarine',
          data: {
            invoice: 'lnbc1missinghash',
            swap: {
              id: 'swap-1',
              claimAddress: '0xclaim',
              timeoutBlockHeight: 100,
              expectedAmount: 5000,
            },
          },
        },
        signer,
      ),
    ).rejects.toThrow();

    expect(mockContract['lock(bytes32,address,uint256)']).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenLastCalledWith(
      'swap-1',
      expect.objectContaining({
        lockState: 'lock_error',
      }),
    );
  });
});
