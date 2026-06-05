import {
  isRootstockSwapActive,
  isRootstockSwapCompleted,
  isRootstockSwapLockupFailed,
  isRootstockSwapPendingRefund,
  isRootstockSwapTerminalFailureStatus,
  shouldApplyRootstockStatus,
} from '../../../../app/functions/boltz/rootstock/swapStatus';

describe('Rootstock swap status helpers', () => {
  it('treats claimed and claim pending as completed success states', () => {
    expect(isRootstockSwapCompleted('transaction.claimed')).toBe(true);
    expect(isRootstockSwapCompleted('transaction.claim.pending')).toBe(true);
  });

  it('treats expired and failed invoices as terminal failures', () => {
    expect(isRootstockSwapTerminalFailureStatus('swap.expired')).toBe(true);
    expect(isRootstockSwapTerminalFailureStatus('invoice.failedToPay')).toBe(
      true,
    );
  });

  it('does not treat lockup failed as terminal', () => {
    expect(isRootstockSwapLockupFailed('transaction.lockupFailed')).toBe(true);
    expect(isRootstockSwapCompleted('transaction.lockupFailed')).toBe(false);
    expect(
      isRootstockSwapTerminalFailureStatus('transaction.lockupFailed'),
    ).toBe(false);
  });

  it('reads restored statuses from persisted swap data', () => {
    expect(
      isRootstockSwapCompleted({
        type: 'submarine',
        data: { status: 'swap.expired' },
      }),
    ).toBe(true);
  });

  it('keeps failed rows from blocking future auto-sweeps', () => {
    expect(
      isRootstockSwapActive({
        type: 'submarine',
        data: { didSwapFail: true, status: 'swap.expired' },
      }),
    ).toBe(false);
  });

  it('treats a swap discarded with no funds as inactive', () => {
    expect(
      isRootstockSwapActive({
        type: 'submarine',
        data: { abandonedNoFunds: true, status: 'invoice.set' },
      }),
    ).toBe(false);
  });

  it('is inactive once didSwapComplete is set even if status looks pending', () => {
    expect(
      isRootstockSwapActive({
        type: 'submarine',
        data: { didSwapComplete: true, status: 'transaction.mempool' },
      }),
    ).toBe(false);
  });
});

describe('shouldApplyRootstockStatus (monotonic ordering)', () => {
  it('applies forward progress', () => {
    expect(
      shouldApplyRootstockStatus('invoice.set', 'transaction.mempool'),
    ).toBe(true);
  });

  it('rejects a stale regression', () => {
    expect(
      shouldApplyRootstockStatus('transaction.confirmed', 'transaction.mempool'),
    ).toBe(false);
  });

  it('always applies terminal success even out of order', () => {
    expect(
      shouldApplyRootstockStatus('transaction.confirmed', 'transaction.claimed'),
    ).toBe(true);
  });

  it('always applies terminal failure', () => {
    expect(
      shouldApplyRootstockStatus('transaction.mempool', 'swap.expired'),
    ).toBe(true);
  });

  it('never regresses out of a completed state', () => {
    expect(
      shouldApplyRootstockStatus('transaction.claimed', 'transaction.mempool'),
    ).toBe(false);
  });

  it('applies the first status when none recorded', () => {
    expect(shouldApplyRootstockStatus(undefined, 'swap.created')).toBe(true);
  });
});

describe('isRootstockSwapPendingRefund', () => {
  it('is true for a terminal swap with an unfinished refund', () => {
    expect(
      isRootstockSwapPendingRefund({
        data: { status: 'swap.expired', refundState: 'retryable_error' },
      }),
    ).toBe(true);
  });

  it('is false once the refund completed', () => {
    expect(
      isRootstockSwapPendingRefund({
        data: { status: 'swap.expired', refundState: 'completed' },
      }),
    ).toBe(false);
  });

  it('is false when nothing was ever locked', () => {
    expect(
      isRootstockSwapPendingRefund({
        data: {
          status: 'swap.expired',
          refundState: 'retryable_error',
          abandonedNoFunds: true,
        },
      }),
    ).toBe(false);
  });

  it('is false for a non-terminal swap', () => {
    expect(
      isRootstockSwapPendingRefund({ data: { status: 'transaction.mempool' } }),
    ).toBe(false);
  });
});
