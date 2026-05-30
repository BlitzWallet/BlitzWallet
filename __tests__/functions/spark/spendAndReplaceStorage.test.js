// Exercises the real discovery SQL against an in-memory SQLite (node:sqlite,
// available in Node 22+). A thin adapter exposes the expo-sqlite async interface
// (execAsync / runAsync / getAllAsync) used by the storage module in production.
const { DatabaseSync } = require('node:sqlite');

const {
  createSpendAndReplaceTable,
  getEligiblePayments,
  getPendingSpendAndReplaceFundingLegs,
  claimIntents,
  resolveIntents,
  releaseIntents,
} = require('../../../app/functions/spark/spendAndReplaceStorage');

const makeDb = () => {
  const sqlite = new DatabaseSync(':memory:');
  return {
    execAsync: async sql => {
      sqlite.exec(sql);
    },
    runAsync: async (sql, params = []) => {
      const stmt = sqlite.prepare(sql);
      const r = stmt.run(...params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
    },
    getAllAsync: async (sql, params = []) => {
      const stmt = sqlite.prepare(sql);
      return stmt.all(...params);
    },
    _raw: sqlite,
  };
};

const ACCOUNT = 'acct-1';

const insertTx = (db, { sparkID, accountId = ACCOUNT, paymentStatus, details }) => {
  db._raw
    .prepare(
      `INSERT INTO spark_transactions
         (sparkID, paymentStatus, paymentType, accountId, details)
       VALUES (?, ?, 'lightning', ?, ?)`,
    )
    .run(sparkID, paymentStatus, accountId, JSON.stringify(details));
};

const OUTGOING_BTC = {
  direction: 'OUTGOING',
  amount: 50_000,
  isBitcoinFundedSend: true,
};

describe('spendAndReplaceStorage discovery SQL', () => {
  let db;

  beforeEach(async () => {
    db = makeDb();
    db._raw.exec(`
      CREATE TABLE spark_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sparkID TEXT NOT NULL,
        paymentStatus TEXT NOT NULL,
        paymentType TEXT NOT NULL,
        accountId TEXT NOT NULL,
        details TEXT NOT NULL
      );
    `);
    await createSpendAndReplaceTable(db);
  });

  it('returns exactly the confirmed + marked + unclaimed payments', async () => {
    // included
    insertTx(db, { sparkID: 'p-eligible', paymentStatus: 'completed', details: OUTGOING_BTC });
    // excluded — pending (confirmed-only)
    insertTx(db, { sparkID: 'p-pending', paymentStatus: 'pending', details: OUTGOING_BTC });
    // excluded — confirmed but unmarked (USD-funded / legacy)
    insertTx(db, {
      sparkID: 'p-unmarked',
      paymentStatus: 'completed',
      details: { direction: 'OUTGOING', amount: 50_000 },
    });
    // excluded — incoming
    insertTx(db, {
      sparkID: 'p-incoming',
      paymentStatus: 'completed',
      details: { direction: 'INCOMING', amount: 50_000, isBitcoinFundedSend: true },
    });
    // excluded — different account
    insertTx(db, {
      sparkID: 'p-otheracct',
      accountId: 'acct-2',
      paymentStatus: 'completed',
      details: OUTGOING_BTC,
    });

    const rows = await getEligiblePayments(db, ACCOUNT);
    expect(rows.map(r => r.payment_id)).toEqual(['p-eligible']);
    expect(rows[0].amount_sats).toBe(50_000);
  });

  it('excludes payments already present in the intents table (claimed)', async () => {
    insertTx(db, { sparkID: 'p-a', paymentStatus: 'completed', details: OUTGOING_BTC });
    insertTx(db, { sparkID: 'p-b', paymentStatus: 'completed', details: OUTGOING_BTC });

    // claim p-a
    await claimIntents(db, ACCOUNT, [{ payment_id: 'p-a', amount_sats: 50_000 }]);

    const rows = await getEligiblePayments(db, ACCOUNT);
    expect(rows.map(r => r.payment_id)).toEqual(['p-b']);
  });

  it('orders results oldest-first by row id', async () => {
    insertTx(db, { sparkID: 'p-1', paymentStatus: 'completed', details: OUTGOING_BTC });
    insertTx(db, { sparkID: 'p-2', paymentStatus: 'completed', details: OUTGOING_BTC });
    insertTx(db, { sparkID: 'p-3', paymentStatus: 'completed', details: OUTGOING_BTC });

    const rows = await getEligiblePayments(db, ACCOUNT);
    expect(rows.map(r => r.payment_id)).toEqual(['p-1', 'p-2', 'p-3']);
  });

  it('returns pending SAR funding legs with backend correlation fields', async () => {
    insertTx(db, {
      sparkID: 'funding-1',
      paymentStatus: 'pending',
      details: {
        isFlashnetStablecoin: true,
        sarFundingTx: true,
        quoteId: 'quote-1',
        sourceSparkAddress: 'spark-addr-1',
      },
    });
    insertTx(db, {
      sparkID: 'funding-2',
      paymentStatus: 'pending',
      details: {
        isFlashnetStablecoin: true,
        sarFundingTx: true,
        quoteId: 'quote-2',
        sourceSparkAddress: 'spark-addr-2',
      },
    });

    // excluded — already resolved
    insertTx(db, {
      sparkID: 'completed',
      paymentStatus: 'completed',
      details: {
        isFlashnetStablecoin: true,
        sarFundingTx: true,
        quoteId: 'quote-completed',
        sourceSparkAddress: 'spark-addr-completed',
      },
    });
    // excluded — missing backend fields
    insertTx(db, {
      sparkID: 'missing-source',
      paymentStatus: 'pending',
      details: {
        isFlashnetStablecoin: true,
        sarFundingTx: true,
        quoteId: 'quote-missing-source',
      },
    });
    // excluded — malformed legacy details
    db._raw
      .prepare(
        `INSERT INTO spark_transactions
           (sparkID, paymentStatus, paymentType, accountId, details)
         VALUES (?, 'pending', 'spark', ?, ?)`,
      )
      .run('malformed', ACCOUNT, 'not-json');

    const rows = await getPendingSpendAndReplaceFundingLegs(db, ACCOUNT);

    expect(rows).toEqual([
      {
        funding_leg_spark_id: 'funding-1',
        quote_id: 'quote-1',
        source_spark_address: 'spark-addr-1',
      },
      {
        funding_leg_spark_id: 'funding-2',
        quote_id: 'quote-2',
        source_spark_address: 'spark-addr-2',
      },
    ]);
  });
});

describe('claimIntents', () => {
  let db;

  beforeEach(async () => {
    db = makeDb();
    await createSpendAndReplaceTable(db);
  });

  it('returns only freshly-inserted rows; a second claim of the same payment returns empty', async () => {
    const first = await claimIntents(db, ACCOUNT, [
      { payment_id: 'p-a', amount_sats: 10_000 },
      { payment_id: 'p-b', amount_sats: 20_000 },
    ]);
    expect(first.map(r => r.payment_id).sort()).toEqual(['p-a', 'p-b']);

    const second = await claimIntents(db, ACCOUNT, [
      { payment_id: 'p-a', amount_sats: 10_000 },
      { payment_id: 'p-b', amount_sats: 20_000 },
    ]);
    expect(second).toEqual([]);
  });

  it('returns only the new row when claiming a mix of new and existing', async () => {
    await claimIntents(db, ACCOUNT, [{ payment_id: 'p-a', amount_sats: 10_000 }]);

    const result = await claimIntents(db, ACCOUNT, [
      { payment_id: 'p-a', amount_sats: 10_000 },
      { payment_id: 'p-c', amount_sats: 30_000 },
    ]);
    expect(result.map(r => r.payment_id)).toEqual(['p-c']);
  });

  it('keys on the composite (payment_id, account_id): same payment id under two accounts both claim', async () => {
    const a = await claimIntents(db, 'acct-1', [
      { payment_id: 'shared', amount_sats: 10_000 },
    ]);
    const b = await claimIntents(db, 'acct-2', [
      { payment_id: 'shared', amount_sats: 10_000 },
    ]);
    expect(a.map(r => r.payment_id)).toEqual(['shared']);
    expect(b.map(r => r.payment_id)).toEqual(['shared']);
  });
});

describe('resolveIntents', () => {
  let db;

  beforeEach(async () => {
    db = makeDb();
    await createSpendAndReplaceTable(db);
  });

  it('updates status, swap_request_id and amount_swapped_micro by composite key', async () => {
    await claimIntents(db, ACCOUNT, [{ payment_id: 'p-a', amount_sats: 10_000 }]);

    await resolveIntents(db, ACCOUNT, ['p-a'], {
      status: 'completed',
      swapRequestId: 'swap-99',
      amountSwappedMicro: 4_200_000,
    });

    const row = db._raw
      .prepare(
        `SELECT status, swap_request_id, amount_swapped_micro
         FROM spend_and_replace_intents
         WHERE payment_id = ? AND account_id = ?`,
      )
      .get('p-a', ACCOUNT);

    expect(row.status).toBe('completed');
    expect(row.swap_request_id).toBe('swap-99');
    expect(row.amount_swapped_micro).toBe(4_200_000);
  });
});

describe('releaseIntents', () => {
  let db;

  beforeEach(async () => {
    db = makeDb();
    await createSpendAndReplaceTable(db);
  });

  it('deletes the claimed rows so the payment can be claimed again', async () => {
    await claimIntents(db, ACCOUNT, [
      { payment_id: 'p-a', amount_sats: 10_000 },
      { payment_id: 'p-b', amount_sats: 20_000 },
    ]);

    await releaseIntents(db, ACCOUNT, ['p-a']);

    const remaining = db._raw
      .prepare(
        'SELECT payment_id FROM spend_and_replace_intents WHERE account_id = ?',
      )
      .all(ACCOUNT)
      .map(r => r.payment_id);
    expect(remaining).toEqual(['p-b']);

    // the released payment is no longer claimed, so it can be re-claimed
    const reclaim = await claimIntents(db, ACCOUNT, [
      { payment_id: 'p-a', amount_sats: 10_000 },
    ]);
    expect(reclaim.map(r => r.payment_id)).toEqual(['p-a']);
  });

  it('is a no-op for an empty id list', async () => {
    await claimIntents(db, ACCOUNT, [{ payment_id: 'p-a', amount_sats: 10_000 }]);

    await releaseIntents(db, ACCOUNT, []);

    const remaining = db._raw
      .prepare(
        'SELECT payment_id FROM spend_and_replace_intents WHERE account_id = ?',
      )
      .all(ACCOUNT);
    expect(remaining).toHaveLength(1);
  });
});
