import { v4 as uuidv4 } from 'uuid';
import { getSparkDatabase } from './transactions';
import { asSendResult, classifyBreezError } from './breezErrors';

export const INTENT_STATES = {
  prepared: 'prepared',
  sent: 'sent',
  unknown: 'unknown',
  done: 'done',
  abandoned: 'abandoned',
};

export async function beginSendIntent({
  accountId,
  rail,
  requestHash,
  amount,
  tokenId,
  intentId,
}) {
  const db = await getSparkDatabase();
  const id = intentId || uuidv4();
  await db.runAsync(
    `INSERT INTO breez_send_intents
       (intent_id, account_id, rail, request_hash, amount, token_id, created_at, state, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'prepared', 0)
     ON CONFLICT(intent_id) DO NOTHING`,
    [
      id,
      accountId,
      rail,
      requestHash,
      String(amount ?? 0),
      tokenId ?? null,
      Date.now(),
    ],
  );
  return id;
}

export async function markIntent(intentId, state, patch = {}) {
  const db = await getSparkDatabase();
  await db.runAsync(
    `UPDATE breez_send_intents
       SET state = ?, payment_id = COALESCE(?, payment_id),
           attempts = attempts + 1, last_error = ?
     WHERE intent_id = ?`,
    [state, patch.paymentId ?? null, patch.error ?? null, intentId],
  );
}

export async function getIntent(intentId) {
  const db = await getSparkDatabase();
  return db.getFirstAsync(
    `SELECT * FROM breez_send_intents WHERE intent_id = ?`,
    [intentId],
  );
}

// Payment ids already recorded on some other intent: the resolver must not
// adopt one of these for a second intent.
export async function listClaimedPaymentIds(accountId, exceptIntentId) {
  const db = await getSparkDatabase();
  const rows = await db.getAllAsync(
    `SELECT payment_id FROM breez_send_intents
     WHERE account_id = ? AND intent_id != ? AND payment_id IS NOT NULL`,
    [accountId, exceptIntentId],
  );
  return new Set(rows.map(r => r.payment_id));
}

export async function listOpenIntents(accountId) {
  const db = await getSparkDatabase();
  return db.getAllAsync(
    `SELECT * FROM breez_send_intents
     WHERE account_id = ? AND state IN ('prepared','sent','unknown')
     ORDER BY created_at ASC`,
    [accountId],
  );
}

export async function beginBulkGroup({
  groupId,
  accountId,
  kind,
  asset,
  rows,
}) {
  const db = await getSparkDatabase();
  const now = Date.now();
  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync(
      `INSERT OR IGNORE INTO breez_bulk_groups
        (group_id, account_id, kind, asset, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'planned', ?, ?)`,
      [groupId, accountId, kind, asset, now, now],
    );
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await db.runAsync(
        `INSERT OR IGNORE INTO breez_bulk_items
          (group_id, item_index, account_id, recipient, amount, token_id,
           idempotency_key, ref_id, state, attempts, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned', 0, ?)`,
        [
          groupId,
          i,
          accountId,
          r.recipient,
          String(r.amount),
          r.tokenId ?? null,
          uuidv4(),
          r.refId ?? null,
          now,
        ],
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function setBulkItemState(groupId, itemIndex, state, patch = {}) {
  const db = await getSparkDatabase();
  await db.runAsync(
    `UPDATE breez_bulk_items
       SET state = ?, payment_id = COALESCE(?, payment_id),
           attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE group_id = ? AND item_index = ?`,
    [
      state,
      patch.paymentId ?? null,
      patch.error ?? null,
      Date.now(),
      groupId,
      itemIndex,
    ],
  );
}

export async function listBulkItems(groupId) {
  const db = await getSparkDatabase();
  return db.getAllAsync(
    `SELECT * FROM breez_bulk_items WHERE group_id = ? ORDER BY item_index ASC`,
    [groupId],
  );
}

// Persist the intent BEFORE the SDK call, mark it after. Never throws:
// { ok: true, payment, intentId } or { ok: false, result } where result is the
// asSendResult shape ({ didWork:false, error, outcome, intentId }). A refusal
// that provably sent nothing is 'abandoned'; anything else stays 'unknown'.
export async function withSendIntent(params, run) {
  const intentId = await beginSendIntent(params);
  // A reused intent id whose send already went out (or may have) must not run
  // again: token rails have no SDK idempotency key to catch it.
  if (params.intentId) {
    const prior = await getIntent(intentId);
    if (['sent', 'done', 'unknown'].includes(prior?.state)) {
      return {
        ok: false,
        result: {
          didWork: false,
          error: 'This payment was already sent or may still be in flight',
          outcome: 'unknown',
          intentId,
        },
      };
    }
  }
  let payment;
  try {
    payment = await run(intentId);
  } catch (e) {
    // prepare() failures (tagged preSend by walletRuntime) provably sent nothing.
    const result = e?.preSend
      ? {
          didWork: false,
          error: classifyBreezError(e).message,
          outcome: 'failed',
          intentId,
        }
      : asSendResult(e, { intentId });
    await markIntent(
      intentId,
      result.outcome === 'unknown' ? 'unknown' : 'abandoned',
      { error: result.error },
    ).catch(() => {});
    return { ok: false, result };
  }
  // The payment exists: a bookkeeping failure must never turn it into a failure.
  await markIntent(intentId, 'sent', { paymentId: payment?.id }).catch(err =>
    console.log('markIntent after send failed', err),
  );
  return { ok: true, payment, intentId };
}
