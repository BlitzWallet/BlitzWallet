const ENRICHED_TX_CACHE_LIMIT = 500;
const enrichedTxCache = new Map(); // sparkID -> { sig, obj }

export function clearEnrichedTxCache() {
  enrichedTxCache.clear();
}

// paymentDetails is optional: omitted, the JSON is parsed only on a cache miss.
export function getStableTx(currentTransaction, paymentDetails) {
  const sparkID = currentTransaction.sparkID;
  const sig = `${currentTransaction.paymentStatus}:${currentTransaction.status}:${currentTransaction.details}`;
  const hit = enrichedTxCache.get(sparkID);
  if (hit && hit.sig === sig) {
    enrichedTxCache.delete(sparkID);
    enrichedTxCache.set(sparkID, hit);
    return hit.obj;
  }
  const obj = {
    ...currentTransaction,
    details: paymentDetails ?? JSON.parse(currentTransaction.details),
  };
  enrichedTxCache.set(sparkID, { sig, obj });
  while (enrichedTxCache.size > ENRICHED_TX_CACHE_LIMIT) {
    const oldestKey = enrichedTxCache.keys().next().value;
    enrichedTxCache.delete(oldestKey);
  }
  return obj;
}
