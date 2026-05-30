// Labels an incoming spend-and-replace (SAR) BTC tx on its first displayable
// write so the "received → spend and replace incoming" flip never happens.
//
// SAR state lives entirely in the DB (getPendingSpendAndReplaceFundingLegs).
// The only thing held in memory is the session auth credential (nostr
// private/public key) that fetchBackend's encrypted bridge requires — these are
// not and should not be persisted. This module intentionally does NOT import
// transactions.js (the db handle is always passed in) to avoid an import cycle.
import fetchBackend from '../../../db/handleBackend';
import i18next from 'i18next';
import { getPendingSpendAndReplaceFundingLegs } from './spendAndReplaceStorage';

let authKeys = null;

// Bounds the whole backend phase: correlation runs inside the serialized
// bulkUpdate queue, so an unbounded backend stall would hold up every
// subsequent write. On timeout we skip labeling — the restore poll is the
// idempotent fallback.
const BACKEND_TIMEOUT_MS = 10_000;
const TIMEOUT = Symbol('sar-correlation-timeout');

// Short-TTL memo keyed by funding leg spark id so rapid successive bulk updates
// don't re-issue the same status check.
const MEMO_TTL_MS = 5_000;
const statusMemo = new Map();

export const setSpendAndReplaceAuthKeys = (privateKey, publicKey) => {
  // Null out on falsy keys so a logged-out/empty or account-switch state can't
  // leave a previous user's credential in module memory.
  authKeys = privateKey && publicKey ? { privateKey, publicKey } : null;
  statusMemo.clear();
};

const parseDetails = details => {
  if (typeof details !== 'string') return details ?? {};
  try {
    return JSON.parse(details);
  } catch {
    return {};
  }
};

const withTimeout = promise => {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(TIMEOUT), BACKEND_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Resolves to the incoming BTC tx hash for a finalized funding leg, or null.
// Memoized (with a short TTL) and shared by funding leg spark id.
const getLegIncomingHash = leg => {
  const key = leg.funding_leg_spark_id;
  const now = Date.now();
  const cached = statusMemo.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = (async () => {
    const statusResult = await fetchBackend(
      'checkFlashnetStablecoinStatus',
      {
        quoteId: leg.quote_id,
        sourceSparkAddress: leg.source_spark_address,
        sparkTxHash: leg.funding_leg_spark_id,
      },
      authKeys.privateKey,
      authKeys.publicKey,
    );

    if (
      statusResult &&
      !statusResult.error &&
      statusResult.status === 'completed' &&
      statusResult.sparkTxHash
    ) {
      return statusResult.sparkTxHash;
    }
    return null;
  })();

  statusMemo.set(key, { promise, expiresAt: now + MEMO_TTL_MS });
  return promise;
};

// Mutates matching incoming SAR txs in `transactions` in place. Never throws.
export const labelSpendAndReplaceIncoming = async (transactions, db) => {
  try {
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    // 1. Cheap in-memory pre-filter: only run the DB query / backend call when an
    // incoming, non-funding-leg spark tx is actually present in this batch.
    const candidates = [];
    for (const tx of transactions) {
      if (!tx?.id || tx.paymentType !== 'spark') continue;
      const details = parseDetails(tx.details);
      if (details.direction !== 'INCOMING' || details.isFlashnetStablecoin) {
        continue;
      }
      candidates.push({ tx, details });
    }
    if (!candidates.length) return;

    // 2. fetchBackend's encrypted bridge needs the session auth credential.
    if (!authKeys) return;

    // 3. Group by accountId (a batch is usually one account, but handle several
    // defensively) and collect every pending funding leg.
    const accountIds = [...new Set(candidates.map(c => c.tx.accountId))];
    const legResults = await Promise.all(
      accountIds.map(accountId =>
        getPendingSpendAndReplaceFundingLegs(db, accountId),
      ),
    );
    const legs = legResults.flat().filter(leg => leg?.funding_leg_spark_id);
    if (!legs.length) return;

    // 4. Query the backend for all pending legs in parallel, bounded by a short
    // timeout. allSettled so one failed leg doesn't drop the others.
    const settled = await withTimeout(
      Promise.allSettled(legs.map(getLegIncomingHash)),
    );
    if (settled === TIMEOUT) return;

    const incomingHashes = new Set();
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) incomingHashes.add(r.value);
    }
    if (!incomingHashes.size) return;

    // 5. Label each candidate whose id matches a returned incoming hash.
    for (const { tx, details } of candidates) {
      if (!incomingHashes.has(tx.id)) continue;
      details.description = i18next.t(
        'screens.inAccount.sendAndReplace.acceptingDescription',
      );
      details.isSARIncoming = true;
      if (typeof tx.details === 'string') tx.details = details;
      tx.paymentStatus = 'completed';
    }
  } catch (e) {
    // Never throw into the write path.
    console.warn('SAR incoming correlation error:', e);
  }
};
