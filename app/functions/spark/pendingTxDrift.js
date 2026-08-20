// Backstop for lost SPARK_TX_UPDATE events. The in-memory transactions list is
// a projection of the DB that only refreshes on that event; if the event is
// lost, a row completed in the DB can stay "pending" in memory until an app
// restart. Given the in-memory list and the sparkIDs the DB currently reports
// as pending, returns true when memory holds a "pending" row the DB no longer
// lists — i.e. the DB advanced and the projection is stale.
export function hasPendingTxDrift(memoryTransactions, dbPendingIds) {
  if (!Array.isArray(memoryTransactions)) return false;
  const pendingSet =
    dbPendingIds instanceof Set ? dbPendingIds : new Set(dbPendingIds || []);
  return memoryTransactions.some(
    tx => tx?.paymentStatus === 'pending' && !pendingSet.has(tx.sparkID),
  );
}
