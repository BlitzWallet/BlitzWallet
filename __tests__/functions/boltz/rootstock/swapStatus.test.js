import {
  isRootstockSwapActive,
  isRootstockSwapCompleted,
  isRootstockSwapLockupFailed,
  isRootstockSwapTerminalFailureStatus,
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
});
