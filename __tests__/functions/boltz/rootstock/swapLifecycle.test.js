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

const {handleRootstockSwapUpdate} = require('../../../../app/functions/boltz/rootstock/swapLifecycle');

const buildSwap = overrides => ({
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
    ...overrides?.data,
  },
  ...overrides,
});

describe('Rootstock swap lifecycle transitions', () => {
  let deps;
  let activeSwapIds;
  const signer = {id: 'signer'};
  const setPendingNavigation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    activeSwapIds = new Set(['swap-1']);
    deps = {
      getSwapByIdFn: jest.fn(() => Promise.resolve([buildSwap()])),
      updateSwapFn: jest.fn(() => Promise.resolve(true)),
      lockSubmarineSwapFn: jest.fn(() => Promise.resolve({didLock: true})),
      refundRootstockSubmarineSwapFn: jest.fn(() => Promise.resolve(true)),
      deleteSwapByIdFn: jest.fn(() => Promise.resolve(true)),
    };
  });

  const runStatus = status =>
    handleRootstockSwapUpdate({
      swapId: 'swap-1',
      status,
      signer,
      activeSwapIds,
      setPendingNavigation,
      deps,
    });

  it('locks and navigates on invoice.set', async () => {
    await runStatus('invoice.set');

    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({status: 'invoice.set'}),
    );
    expect(deps.lockSubmarineSwapFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({status: 'invoice.set'}),
      }),
      signer,
    );
    expect(setPendingNavigation).toHaveBeenCalledWith(true);
    expect(activeSwapIds.has('swap-1')).toBe(true);
  });

  it('deletes the swap on transaction.claim.pending', async () => {
    await runStatus('transaction.claim.pending');

    expect(deps.deleteSwapByIdFn).toHaveBeenCalledWith('swap-1');
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(activeSwapIds.has('swap-1')).toBe(false);
  });

  it('deletes the swap on transaction.claimed', async () => {
    await runStatus('transaction.claimed');

    expect(deps.deleteSwapByIdFn).toHaveBeenCalledWith('swap-1');
    expect(activeSwapIds.has('swap-1')).toBe(false);
  });

  it.each(['invoice.failedToPay', 'swap.expired'])(
    'marks failed and refunds on terminal failure %s',
    async status => {
      await runStatus(status);

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
      expect.objectContaining({status: 'transaction.confirmed'}),
    );
    expect(deps.lockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
  });

  it('ignores missing restored rows', async () => {
    deps.getSwapByIdFn.mockResolvedValue([]);

    await runStatus('invoice.set');

    expect(deps.updateSwapFn).not.toHaveBeenCalled();
    expect(deps.lockSubmarineSwapFn).not.toHaveBeenCalled();
  });

  it('ignores obsolete reverse rows after persisting status', async () => {
    deps.getSwapByIdFn.mockResolvedValue([buildSwap({type: 'reverse'})]);

    await runStatus('transaction.confirmed');

    expect(deps.updateSwapFn).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({status: 'transaction.confirmed'}),
    );
    expect(deps.lockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.refundRootstockSubmarineSwapFn).not.toHaveBeenCalled();
    expect(deps.deleteSwapByIdFn).not.toHaveBeenCalled();
  });
});
