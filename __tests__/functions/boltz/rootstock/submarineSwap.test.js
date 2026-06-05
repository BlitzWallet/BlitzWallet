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

jest.mock('../../../../app/functions/spark/transactions', () => ({
  insertSparkTransactionPlaceholders: jest.fn(() => Promise.resolve(true)),
  bulkUpdateSparkTransactions: jest.fn(() => Promise.resolve(true)),
  updateSparkTransactionDetails: jest.fn(() => Promise.resolve(true)),
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
  sparkReceivePaymentWrapper,
} = require('../../../../app/functions/spark/payments');
const {
  insertSparkTransactionPlaceholders,
  updateSparkTransactionDetails,
} = require('../../../../app/functions/spark/transactions');
const {
  calculateMaxSubmarineSwapAmount,
  createRootstockSubmarineSwap,
  executeSubmarineSwap,
  isSubmarineLockUnresolved,
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
    sparkReceivePaymentWrapper.mockResolvedValue({
      didWork: true,
      data: { id: 'invoice-id-1' },
      invoice: 'lnbc1invoice',
    });
    insertSparkTransactionPlaceholders.mockResolvedValue(true);
    updateSparkTransactionDetails.mockResolvedValue(true);
  });

  it('creates an RBTC to BTC submarine swap and persists the active row', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'swap-1',
            claimAddress: '0xclaim',
            timeoutBlockHeight: 100,
            expectedAmount: 5000,
          }),
      }),
    );

    const row = await createRootstockSubmarineSwap('lnbc1invoice', {
      accountId: 'acct-1',
      invoiceId: 'invoice-id-1',
      amountSat: 5000,
      feeSat: 32,
      createdTime: 123,
    });

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
        invoiceId: 'invoice-id-1',
        accountId: 'acct-1',
        amountSat: 5000,
        feeSat: 32,
        status: 'swap.created',
      }),
    );
    expect(updateSparkTransactionDetails).toHaveBeenCalledWith(
      'invoice-id-1',
      expect.objectContaining({
        isRootstockSwap: true,
        rootstockSwapId: 'swap-1',
        rootstockSwapInvoiceId: 'invoice-id-1',
        rootstockSwapStatus: 'swap.created',
      }),
    );
    expect(insertSparkTransactionPlaceholders).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'swap-1',
        accountId: 'acct-1',
        paymentStatus: 'pending',
        paymentType: 'lightning',
        details: expect.objectContaining({
          isRootstockSwap: true,
          rootstockSwapId: 'swap-1',
          rootstockSwapInvoiceId: 'invoice-id-1',
          rootstockSwapStatus: 'swap.created',
          amount: 5000,
          fee: 32,
          description: 'transactionLabelText.roostockSwap',
        }),
      }),
    ]);
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
    expect(insertSparkTransactionPlaceholders).not.toHaveBeenCalled();
  });

  it('tags the Spark invoice with Rootstock metadata when executing a swap', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ swapContracts: { EtherSwap: '0xcontract' } }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            id: 'swap-1',
            claimAddress: '0xclaim',
            timeoutBlockHeight: 100,
            expectedAmount: 5000,
          }),
      });

    await executeSubmarineSwap(
      'seed words',
      limits,
      provider,
      signer,
      jest.fn(),
      'acct-1',
    );

    expect(sparkReceivePaymentWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        amountSats: 99755,
        memo: 'transactionLabelText.roostockSwap',
        shouldNavigate: false,
        extraDetails: expect.objectContaining({
          isRootstockSwap: true,
          rootstockSwapStatus: 'swap.created',
          rootstockSwapAmountSat: 99755,
          rootstockSwapFeeSat: 145,
        }),
      }),
    );
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

  const buildLockSwap = overrides => ({
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
      ...overrides,
    },
  });

  // Path 1 — happy path: lock_intent -> broadcasting -> broadcasted + hash
  it('persists lock_intent -> broadcasting -> broadcasted with the tx hash', async () => {
    const response = await lockSubmarineSwap(buildLockSwap(), signer);

    expect(updateSwap).toHaveBeenNthCalledWith(
      1,
      'swap-1',
      expect.objectContaining({
        lockState: 'lock_intent',
        lockStartedAt: expect.any(Number),
      }),
    );
    expect(updateSwap).toHaveBeenNthCalledWith(
      2,
      'swap-1',
      expect.objectContaining({ lockState: 'broadcasting' }),
    );
    expect(mockContract['lock(bytes32,address,uint256)']).toHaveBeenCalledWith(
      expect.any(Buffer),
      '0xclaim',
      100,
      { value: 5000n * 10000000000n },
    );
    expect(mockContract.lock).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenNthCalledWith(
      3,
      'swap-1',
      expect.objectContaining({
        locked: true,
        lockState: 'broadcasted',
        lockTxHash: '0xlocktx',
        lockedAt: expect.any(Number),
      }),
    );
    expect(response.didLock).toBe(true);
  });

  // Path 2 — ordering invariant: 'broadcasting' is persisted BEFORE the lock tx
  // is submitted. This is what makes lock_intent/lock_error provably pre-broadcast.
  it('persists broadcasting before submitting the lock transaction', async () => {
    const callOrder = [];
    updateSwap.mockImplementation((_id, details) => {
      callOrder.push(`updateSwap:${details.lockState}`);
      return Promise.resolve(true);
    });
    mockContract['lock(bytes32,address,uint256)'].mockImplementation(() => {
      callOrder.push('lock');
      return Promise.resolve({ hash: '0xlocktx' });
    });

    await lockSubmarineSwap(buildLockSwap(), signer);

    expect(callOrder.indexOf('updateSwap:broadcasting')).toBeLessThan(
      callOrder.indexOf('lock'),
    );
    expect(callOrder).toEqual([
      'updateSwap:lock_intent',
      'updateSwap:broadcasting',
      'lock',
      'updateSwap:broadcasted',
    ]);
  });

  // Path 3 — pre-broadcast failure (bad invoice): no payment hash decoded.
  it('records lock_error without broadcasting when the invoice has no payment hash', async () => {
    bolt11.decode.mockReturnValue({ tags: [] });

    await expect(
      lockSubmarineSwap(buildLockSwap({ invoice: 'lnbc1missinghash' }), signer),
    ).rejects.toThrow();

    expect(mockContract['lock(bytes32,address,uint256)']).not.toHaveBeenCalled();
    expect(updateSwap).not.toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ lockState: 'broadcasting' }),
    );
    expect(updateSwap).toHaveBeenLastCalledWith(
      'swap-1',
      expect.objectContaining({ lockState: 'lock_error' }),
    );
  });

  // Path 4 — pre-broadcast failure: contracts fetch is down (the lock_error bug).
  it('records lock_error without broadcasting when the contracts fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network down')));

    await expect(lockSubmarineSwap(buildLockSwap(), signer)).rejects.toThrow(
      'network down',
    );

    expect(updateSwap).toHaveBeenNthCalledWith(
      1,
      'swap-1',
      expect.objectContaining({ lockState: 'lock_intent' }),
    );
    expect(updateSwap).not.toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ lockState: 'broadcasting' }),
    );
    expect(mockContract['lock(bytes32,address,uint256)']).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenLastCalledWith(
      'swap-1',
      expect.objectContaining({ lockState: 'lock_error' }),
    );
  });

  // Path 5 — post-broadcast failure: submit rejects. MUST be broadcast_unknown,
  // not a cleanly-retryable lock_error, so reconciliation chain-checks first.
  it('records broadcast_unknown when the lock submission rejects after broadcasting', async () => {
    mockContract['lock(bytes32,address,uint256)'].mockRejectedValue(
      new Error('broadcast failed'),
    );

    await expect(lockSubmarineSwap(buildLockSwap(), signer)).rejects.toThrow(
      'broadcast failed',
    );

    expect(updateSwap).toHaveBeenNthCalledWith(
      1,
      'swap-1',
      expect.objectContaining({ lockState: 'lock_intent' }),
    );
    expect(updateSwap).toHaveBeenNthCalledWith(
      2,
      'swap-1',
      expect.objectContaining({ lockState: 'broadcasting' }),
    );
    expect(updateSwap).toHaveBeenLastCalledWith(
      'swap-1',
      expect.objectContaining({
        lockState: 'broadcast_unknown',
        lockError: 'broadcast failed',
      }),
    );
  });

  // Path 6 — guard: any prior lock attempt blocks a direct re-lock.
  it.each([
    'lock_intent',
    'broadcasting',
    'broadcast_unknown',
    'broadcasted',
    'locking',
  ])('does not re-lock when a prior lock state %s exists', async lockState => {
    const response = await lockSubmarineSwap(
      buildLockSwap({ lockState }),
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

  it('does not re-lock when a lock tx hash is already recorded', async () => {
    const response = await lockSubmarineSwap(
      buildLockSwap({ lockTxHash: '0xexisting' }),
      signer,
    );

    expect(response).toEqual({
      didLock: false,
      reason: 'lock_already_started',
    });
    expect(mockContract['lock(bytes32,address,uint256)']).not.toHaveBeenCalled();
    expect(updateSwap).not.toHaveBeenCalled();
  });

  it.each(['lock_intent', 'broadcasting', 'broadcast_unknown', 'lock_error', 'locking'])(
    'flags %s as an unresolved lock needing reconciliation',
    lockState => {
      expect(
        isSubmarineLockUnresolved(buildLockSwap({ lockState })),
      ).toBe(true);
    },
  );

  it.each([
    ['broadcasted', { lockState: 'broadcasted' }],
    ['confirmed', { lockState: 'confirmed' }],
    ['a recorded lock tx hash', { lockState: 'broadcasting', lockTxHash: '0xabc' }],
    ['no lock attempt', {}],
  ])('does not flag %s as unresolved', (_label, data) => {
    expect(isSubmarineLockUnresolved(buildLockSwap(data))).toBe(false);
  });

  it('does not flag non-submarine swaps as unresolved', () => {
    expect(
      isSubmarineLockUnresolved({ type: 'reverse', data: { lockState: 'lock_intent' } }),
    ).toBe(false);
  });

  // Path 7 — guard: concurrent in-flight lock on the same id.
  it('does not broadcast a second lock while the first lock is in flight', async () => {
    let resolveLock;
    mockContract['lock(bytes32,address,uint256)'].mockReturnValue(
      new Promise(resolve => {
        resolveLock = resolve;
      }),
    );

    const swap = buildLockSwap();

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
});
