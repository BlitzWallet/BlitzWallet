jest.mock('boltz-core/out/EtherSwap.sol/EtherSwap.json', () => ({
  abi: [],
}));

jest.mock('react-native-quick-crypto', () => ({
  randomBytes: jest.fn(() => Buffer.alloc(32, 1)),
}));

jest.mock('../../../../app/functions/boltz/rootstock/swapDb', () => ({
  deleteSwapById: jest.fn(),
  getSwapById: jest.fn(),
  updateSwap: jest.fn(),
}));

jest.mock('../../../../app/functions/boltz/rootstock/claims', () => ({
  refundRootstockSubmarineSwap: jest.fn(),
}));

jest.mock('../../../../app/functions/boltz/rootstock/submarineSwap', () => ({
  lockSubmarineSwap: jest.fn(),
}));

jest.mock('../../../../app/functions/boltz/rootstock/swapProgress', () => ({
  updateRootstockSwapPlaceholder: jest.fn(),
}));

const {
  handleRootstockSwapUpdate,
} = require('../../../../app/functions/boltz/rootstock/swapLifecycle');

const buildSwap = overrides => ({
  id: 'swap-1',
  type: 'submarine',
  data: {
    invoice: 'lnbc1invoice',
    invoiceId: 'invoice-id-1',
    accountId: 'acct-1',
    swap: {
      id: 'swap-1',
      claimAddress: '0xclaim',
      timeoutBlockHeight: 100,
      expectedAmount: 5000,
    },
    ...overrides?.data,
  },
  ...overrides,
});

describe('Rootstock swap lifecycle transitions', () => {
  let deps;
  let activeSwapIds;
  const signer = { id: 'signer' };

  beforeEach(() => {
    jest.clearAllMocks();
    activeSwapIds = new Set(['swap-1']);
    deps = {
      getSwapByIdFn: jest.fn(() => Promise.resolve([buildSwap()])),
      updateSwapFn: jest.fn(() => Promise.resolve(true)),
      lockSubmarineSwapFn: jest.fn(() => Promise.resolve({ didLock: true })),
      refundRootstockSubmarineSwapFn: jest.fn(() => Promise.resolve(true)),
      deleteSwapByIdFn: jest.fn(() => Promise.resolve(true)),
      updateRootstockSwapPlaceholderFn: jest.fn(() => Promise.resolve(true)),
    };
  });

  const runStatus = (status, swapUpdate) =>
    handleRootstockSwapUpdate({
      swapId: 'swap-1',
      status,
      swapUpdate,
      signer,
      activeSwapIds,
      deps,
    });

  it('updates the pending placeholder and locks on invoice.set', async () => {
    await runStatus('invoice.set');

    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ status: 'invoice.set' }),
    );
    expect(deps.updateRootstockSwapPlaceholderFn).toHaveBeenCalledWith(
      expect.objectContaining({
        swapId: 'swap-1',
        status: 'invoice.set',
        invoice: 'lnbc1invoice',
        amountSat: 5000,
      }),
    );
    expect(deps.lockSubmarineSwapFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'invoice.set' }),
      }),
      signer,
    );
    expect(activeSwapIds.has('swap-1')).toBe(true);
  });

  it('stores the local Rootstock lock tx hash after locking', async () => {
    deps.lockSubmarineSwapFn.mockResolvedValue({
      didLock: true,
      tx: { hash: '0xlocktx' },
    });

    await runStatus('invoice.set');

    expect(deps.updateSwapFn).toHaveBeenCalledWith('swap-1', {
      rootstockPaymentTxId: '0xlocktx',
    });
    expect(deps.updateRootstockSwapPlaceholderFn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        swapId: 'swap-1',
        status: 'invoice.set',
        extraDetails: expect.objectContaining({
          rootstockPaymentTxId: '0xlocktx',
          lockTxHash: '0xlocktx',
        }),
      }),
    );
  });

  it('stores the Rootstock payment tx id from websocket transaction updates', async () => {
    await runStatus('transaction.mempool', {
      transaction: { id: '0xwebsockettx' },
    });

    expect(deps.updateSwapFn).toHaveBeenCalledWith('swap-1', {
      rootstockPaymentTxId: '0xwebsockettx',
    });
    expect(deps.updateRootstockSwapPlaceholderFn).toHaveBeenCalledWith(
      expect.objectContaining({
        swapId: 'swap-1',
        status: 'transaction.mempool',
        extraDetails: expect.objectContaining({
          rootstockPaymentTxId: '0xwebsockettx',
        }),
      }),
    );
  });

  it('keeps the swap history row on transaction.claim.pending', async () => {
    await runStatus('transaction.claim.pending');

    expect(deps.updateRootstockSwapPlaceholderFn).toHaveBeenCalledWith(
      expect.objectContaining({
        swapId: 'swap-1',
        status: 'transaction.claim.pending',
      }),
    );
    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        didSwapComplete: true,
        completedAt: expect.any(Number),
      }),
    );
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(activeSwapIds.has('swap-1')).toBe(false);
  });

  it('keeps the swap history row on transaction.claimed', async () => {
    await runStatus('transaction.claimed');

    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        didSwapComplete: true,
        completedAt: expect.any(Number),
      }),
    );
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
    expect(activeSwapIds.has('swap-1')).toBe(false);
  });

  it.each(['invoice.failedToPay', 'swap.expired'])(
    'marks failed and refunds on terminal failure %s',
    async status => {
      await runStatus(status);

      expect(deps.updateRootstockSwapPlaceholderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          swapId: 'swap-1',
          status,
        }),
      );
      expect(deps.updateSwapFn).toHaveBeenCalledWith('swap-1', {
        didSwapFail: true,
      });
      expect(deps.refundRootstockSubmarineSwapFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status,
            didSwapFail: true,
          }),
        }),
        signer,
      );
      expect(activeSwapIds.has('swap-1')).toBe(false);
    },
  );

  it('marks lockupFailed but keeps the swap active for later expiry/refund', async () => {
    await runStatus('transaction.lockupFailed');

    expect(deps.updateSwapFn).toHaveBeenCalledWith('swap-1', {
      lockupFailed: true,
    });
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
    expect(activeSwapIds.has('swap-1')).toBe(true);
  });

  it('persists passive statuses without money-moving actions', async () => {
    await runStatus('transaction.confirmed');

    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ status: 'transaction.confirmed' }),
    );
    expect(deps.lockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
  });

  it.each(['transaction.mempool', 'transaction.confirmed'])(
    'records lockState confirmed once Boltz detects the lockup on %s',
    async status => {
      await runStatus(status);

      expect(deps.updateSwapFn).toHaveBeenCalledWith('swap-1', {
        lockState: 'confirmed',
      });
    },
  );

  it('ignores missing restored rows', async () => {
    deps.getSwapByIdFn.mockResolvedValue([]);

    await runStatus('invoice.set');

    expect(deps.updateSwapFn).not.toHaveBeenCalled();
    expect(deps.lockSubmarineSwapFn).not.toHaveBeenCalled();
  });

  it('ignores obsolete reverse rows after persisting status', async () => {
    deps.getSwapByIdFn.mockResolvedValue([buildSwap({ type: 'reverse' })]);

    await runStatus('transaction.confirmed');

    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ status: 'transaction.confirmed' }),
    );
    expect(deps.lockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
  });
});
