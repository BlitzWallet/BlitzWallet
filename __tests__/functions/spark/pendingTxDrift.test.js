// Unit tests for the pending-tx drift detector used by the reconciler backstop.
//
// Bug: a completed Lightning send can stay "pending" forever in the in-memory
// transactions list when the SPARK_TX_UPDATE event that would refresh the
// projection is lost (queue-gated on AppState/listeners). Once the row is
// completed in the DB, updateSparkTxStatus never re-examines it (it only reads
// DB-pending rows), so nothing re-projects it — the user must kill the app.
//
// hasPendingTxDrift is the backstop: given the in-memory list and the set of
// sparkIDs the DB currently reports as pending, it detects a memory-pending row
// the DB no longer lists (i.e. the DB advanced but memory missed the event).

import { hasPendingTxDrift } from '../../../app/functions/spark/pendingTxDrift';

describe('hasPendingTxDrift', () => {
  test('detects a memory-pending tx that the DB no longer lists as pending', () => {
    const memory = [
      { sparkID: 'a', paymentStatus: 'completed' },
      { sparkID: 'b', paymentStatus: 'pending' },
    ];
    // DB has no pending rows -> b drifted (completed in DB, stale in memory).
    expect(hasPendingTxDrift(memory, [])).toBe(true);
  });

  test('reports no drift when every memory-pending tx is still DB-pending', () => {
    const memory = [
      { sparkID: 'a', paymentStatus: 'completed' },
      { sparkID: 'b', paymentStatus: 'pending' },
    ];
    expect(hasPendingTxDrift(memory, ['b'])).toBe(false);
  });

  test('accepts a Set of DB pending ids', () => {
    const memory = [{ sparkID: 'b', paymentStatus: 'pending' }];
    expect(hasPendingTxDrift(memory, new Set(['b']))).toBe(false);
    expect(hasPendingTxDrift(memory, new Set(['x']))).toBe(true);
  });

  test('reports no drift when there are no memory-pending txs', () => {
    const memory = [{ sparkID: 'a', paymentStatus: 'completed' }];
    expect(hasPendingTxDrift(memory, [])).toBe(false);
  });

  test('is safe when the memory list is missing or not an array', () => {
    expect(hasPendingTxDrift(undefined, [])).toBe(false);
    expect(hasPendingTxDrift(null, ['a'])).toBe(false);
  });
});
