// SQLite identifiers are case-insensitive, so this resolves to the
// SPARK_TRANSACTIONS table created in transactions.js. Referenced as a literal
// (not imported from transactions.js) to avoid a circular import — this module
// must never import from transactions.js; the db handle is always passed in.
const SPARK_TRANSACTIONS_TABLE = 'spark_transactions';
const SPEND_AND_REPLACE_TABLE = 'spend_and_replace_intents';

export const createSpendAndReplaceTable = async db => {
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS ${SPEND_AND_REPLACE_TABLE} (
    payment_id           TEXT NOT NULL,
    account_id           TEXT NOT NULL,
    amount_sats          INTEGER NOT NULL,
    status               TEXT NOT NULL DEFAULT 'pending',
    swap_request_id      TEXT,
    amount_swapped_micro INTEGER,
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL,
    PRIMARY KEY (payment_id, account_id)
  );
`);
};

// Eligible = confirmed + marked as Bitcoin-funded + not yet claimed, scoped to
// the account. Keyed on the FINAL sparkID (the temp→final rename has already
// happened by the time paymentStatus is 'completed').
export const getEligiblePayments = async (db, accountId) => {
  return await db.getAllAsync(
    `SELECT t.sparkID AS payment_id,
            json_extract(t.details, '$.amount') AS amount_sats
     FROM ${SPARK_TRANSACTIONS_TABLE} t
     LEFT JOIN ${SPEND_AND_REPLACE_TABLE} i
            ON i.payment_id = t.sparkID AND i.account_id = t.accountId
     WHERE t.accountId = ?
       AND t.paymentStatus = 'completed'
       AND json_extract(t.details, '$.direction') = 'OUTGOING'
       AND json_extract(t.details, '$.isBitcoinFundedSend') = 1
       AND i.payment_id IS NULL
     ORDER BY t.id ASC`,
    [accountId],
  );
};

// Pending SAR funding legs = submitted USD→BTC replacements whose incoming BTC
// has not been finalized yet (the leg flips to 'completed' once
// checkFlashnetStablecoinStatusLogic resolves it). Each row carries everything
// the backend status check needs to discover the incoming BTC tx hash. The
// json_valid + non-null guards skip malformed/legacy rows; ORDER BY t.id ASC is
// deterministic. Returns [] when no SAR is in flight.
export const getPendingSpendAndReplaceFundingLegs = async (db, accountId) => {
  return await db.getAllAsync(
    `SELECT t.sparkID AS funding_leg_spark_id,
            json_extract(t.details, '$.quoteId')            AS quote_id,
            json_extract(t.details, '$.sourceSparkAddress') AS source_spark_address
     FROM ${SPARK_TRANSACTIONS_TABLE} t
     WHERE t.accountId = ?
       AND json_valid(t.details)
       AND json_extract(t.details, '$.isFlashnetStablecoin') = 1
       AND json_extract(t.details, '$.sarFundingTx') = 1
       AND json_extract(t.details, '$.quoteId') IS NOT NULL
       AND json_extract(t.details, '$.sourceSparkAddress') IS NOT NULL
       AND t.paymentStatus = 'pending'
     ORDER BY t.id ASC`,
    [accountId],
  );
};

// Claim-first / claim-return: INSERT OR IGNORE per payment, then return only the
// rows actually inserted (changes === 1). Rows that lost a race or already
// existed are excluded so they never proceed to a duplicate swap.
export const claimIntents = async (db, accountId, payments) => {
  if (!payments?.length) return [];

  const now = Date.now();
  const claimed = [];

  await db.execAsync('BEGIN TRANSACTION');
  try {
    for (const payment of payments) {
      const amountSats = Number(payment.amount_sats) || 0;
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO ${SPEND_AND_REPLACE_TABLE}
           (payment_id, account_id, amount_sats, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [payment.payment_id, accountId, amountSats, now, now],
      );
      if (result?.changes === 1) {
        claimed.push({
          payment_id: payment.payment_id,
          amount_sats: amountSats,
        });
      }
    }
    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }

  return claimed;
};

// Undo a claim by deleting the intent rows so the payments are discovered again
// by getEligiblePayments on a later pass. Used for transient/network failures
// that occur BEFORE any funds move — the claim must be released so the retry can
// re-pick them up. (Terminal outcomes use resolveIntents instead, which keeps
// the row so the payment is never reprocessed.)
export const releaseIntents = async (db, accountId, paymentIds) => {
  if (!paymentIds?.length) return;

  await db.execAsync('BEGIN TRANSACTION');
  try {
    for (const paymentId of paymentIds) {
      await db.runAsync(
        `DELETE FROM ${SPEND_AND_REPLACE_TABLE}
         WHERE payment_id = ? AND account_id = ?`,
        [paymentId, accountId],
      );
    }
    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }
};

export const resolveIntents = async (
  db,
  accountId,
  paymentIds,
  { status, swapRequestId = null, amountSwappedMicro = null },
) => {
  if (!paymentIds?.length) return;

  const now = Date.now();

  await db.execAsync('BEGIN TRANSACTION');
  try {
    for (const paymentId of paymentIds) {
      await db.runAsync(
        `UPDATE ${SPEND_AND_REPLACE_TABLE}
           SET status = ?,
               swap_request_id = ?,
               amount_swapped_micro = ?,
               updated_at = ?
         WHERE payment_id = ? AND account_id = ?`,
        [status, swapRequestId, amountSwappedMicro, now, paymentId, accountId],
      );
    }
    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }
};
