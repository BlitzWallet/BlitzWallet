import * as SQLite from 'expo-sqlite';

export const CACHED_SAVINGS = 'SAVED_SAVINGS';

const GOALS_TABLE = 'savings_goals';
const TRANSACTIONS_TABLE = 'savings_transactions';
const PAYOUTS_TABLE = 'savings_payouts';

let sqlLiteDB = null;
let initPromise = null;
let isInitialized = false;

async function openDBConnection() {
  if (!initPromise) {
    initPromise = (async () => {
      sqlLiteDB = await SQLite.openDatabaseAsync(`${CACHED_SAVINGS}.db`);
      return sqlLiteDB;
    })();
  }

  return initPromise;
}

async function ensureSavingsDatabaseReady() {
  if (!sqlLiteDB) {
    await openDBConnection();
  }

  return sqlLiteDB;
}

export const isSavingsDatabaseOpen = () => {
  return isInitialized;
};

async function getDatabase() {
  await ensureSavingsDatabaseReady();

  if (!isInitialized) {
    await initSavingsDb();
  }

  return sqlLiteDB;
}

/**
 * Initializes SQLite tables for savings goals and transactions.
 * @returns {Promise<boolean>}
 */
export async function initSavingsDb() {
  try {
    await ensureSavingsDatabaseReady();

    await sqlLiteDB.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = OFF;

      CREATE TABLE IF NOT EXISTS ${GOALS_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        targetAmountMicros INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS ${TRANSACTIONS_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        goalId TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        amountMicros INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

       CREATE TABLE IF NOT EXISTS ${PAYOUTS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payoutSats INTEGER NOT NULL,
        status TEXT NOT NULL,
        txId TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL,
        day INTEGER NOT NULL,
        paidAt INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_savings_goals_createdAt ON ${GOALS_TABLE}(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_savings_tx_goal_timestamp ON ${TRANSACTIONS_TABLE}(goalId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_savings_tx_timestamp ON ${TRANSACTIONS_TABLE}(timestamp DESC);
    `);

    await migrateRemoveTransactionsForeignKey();

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('initSavingsDb error:', error);
    isInitialized = false;
    return false;
  }
}

/**
 * One-time migration: drop the FOREIGN KEY constraint from savings_transactions
 * by recreating the table. Safe to run on every init — the guard checks whether
 * the FK is present before doing anything.
 */
async function migrateRemoveTransactionsForeignKey() {
  try {
    // Check if the old FK-bearing table exists by inspecting its CREATE statement.
    const row = await sqlLiteDB.getFirstAsync(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [TRANSACTIONS_TABLE],
    );

    if (!row?.sql || !row.sql.includes('FOREIGN KEY')) {
      return; // Already migrated or freshly created — nothing to do.
    }

    // Recreate the table without the FK using SQLite's recommended pattern.
    await sqlLiteDB.execAsync(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE ${TRANSACTIONS_TABLE} RENAME TO ${TRANSACTIONS_TABLE}_old;

      CREATE TABLE ${TRANSACTIONS_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        goalId TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        amountMicros INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      INSERT INTO ${TRANSACTIONS_TABLE} (id, goalId, type, amountMicros, timestamp)
        SELECT id, goalId, type, amountMicros, timestamp FROM ${TRANSACTIONS_TABLE}_old;

      DROP TABLE ${TRANSACTIONS_TABLE}_old;

      CREATE INDEX IF NOT EXISTS idx_savings_tx_goal_timestamp ON ${TRANSACTIONS_TABLE}(goalId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_savings_tx_timestamp ON ${TRANSACTIONS_TABLE}(timestamp DESC);
    `);
  } catch (err) {
    console.error('migrateRemoveTransactionsForeignKey error:', err);
  }
}

/**
 * @param {SavingsGoal} goal
 * @returns {Promise<SavingsGoal>}
 */
export async function createSavingsGoal(goal) {
  const db = await getDatabase();

  if (!goal?.id) throw new Error('Goal id is required');
  if (!goal?.name?.trim()) throw new Error('Goal name is required');

  const now = Date.now();
  const goalToSave = {
    id: goal.id,
    name: String(goal.name).trim(),
    targetAmountMicros: Math.max(
      0,
      Math.round(Number(goal.targetAmountMicros || 0)),
    ),
    createdAt: Number(goal.createdAt || now),
    updatedAt: Number(goal.updatedAt || now),
    metadata: goal.metadata ?? null,
  };

  await db.runAsync(
    `INSERT INTO ${GOALS_TABLE} (id, name, targetAmountMicros, createdAt, updatedAt, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      goalToSave.id,
      goalToSave.name,
      goalToSave.targetAmountMicros,
      goalToSave.createdAt,
      goalToSave.updatedAt,
      goalToSave.metadata,
    ],
  );

  return goalToSave;
}

/**
 * @param {string} goalId
 * @param {Partial<SavingsGoal>} patch
 * @returns {Promise<SavingsGoal | null>}
 */
export async function updateSavingsGoal(goalId, patch) {
  const existing = await getSavingsGoalById(goalId);
  if (!existing) return null;

  const db = await getDatabase();
  const nextName =
    patch && Object.prototype.hasOwnProperty.call(patch, 'name')
      ? String(patch.name || '').trim()
      : existing.name;
  const nextTargetAmountMicros =
    patch && Object.prototype.hasOwnProperty.call(patch, 'targetAmountMicros')
      ? Math.max(0, Math.round(Number(patch.targetAmountMicros || 0)))
      : existing.targetAmountMicros;
  const nextMetadata =
    patch && Object.prototype.hasOwnProperty.call(patch, 'metadata')
      ? patch.metadata ?? null
      : existing.metadata ?? null;

  const updatedGoal = {
    ...existing,
    id: existing.id,
    name: nextName,
    targetAmountMicros: nextTargetAmountMicros,
    metadata: nextMetadata,
    updatedAt: Date.now(),
  };

  if (!updatedGoal.name) throw new Error('Goal name is required');

  await db.runAsync(
    `UPDATE ${GOALS_TABLE}
     SET name = ?, targetAmountMicros = ?, updatedAt = ?, metadata = ?
     WHERE id = ?`,
    [
      updatedGoal.name,
      updatedGoal.targetAmountMicros,
      updatedGoal.updatedAt,
      updatedGoal.metadata ?? null,
      goalId,
    ],
  );

  return updatedGoal;
}

/**
 * @param {string} goalId
 * @returns {Promise<boolean>}
 */
export async function deleteSavingsGoal(goalId) {
  const db = await getDatabase();
  // Delete goal-attributed transactions explicitly (no FK cascade any more).
  await db.runAsync(`DELETE FROM ${TRANSACTIONS_TABLE} WHERE goalId = ?`, [
    goalId,
  ]);
  const result = await db.runAsync(`DELETE FROM ${GOALS_TABLE} WHERE id = ?`, [
    goalId,
  ]);
  return Number(result?.changes || 0) > 0;
}

/**
 * @param {string} goalId
 * @returns {Promise<SavingsGoal | null>}
 */
export async function getSavingsGoalById(goalId) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT id, name, targetAmountMicros, createdAt, updatedAt, metadata
     FROM ${GOALS_TABLE}
     WHERE id = ?`,
    [goalId],
  );

  if (!row) return null;

  return {
    id: String(row.id),
    name: String(row.name || ''),
    targetAmountMicros: Number(row.targetAmountMicros || 0),
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    metadata: row.metadata ?? null,
  };
}

/**
 * @returns {Promise<SavingsGoal[]>}
 */
export async function getSavingsGoals() {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT id, name, targetAmountMicros, createdAt, updatedAt, metadata
     FROM ${GOALS_TABLE}
     ORDER BY createdAt DESC`,
  );

  return rows.map(row => ({
    id: String(row.id),
    name: String(row.name || ''),
    targetAmountMicros: Number(row.targetAmountMicros || 0),
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    metadata: row.metadata ?? null,
  }));
}

/**
 * Upserts an array of payout transactions.
 * Inserts new payouts.
 * Updates existing payouts if they already exist.
 *
 * @param {PayoutTransaction[]} payouts
 */
export async function setPayoutsTransactions(payouts) {
  const BATCH_SIZE = 25;
  const db = await getDatabase();

  try {
    if (!Array.isArray(payouts)) {
      throw new Error('payouts must be an array');
    }

    for (let i = 0; i < payouts.length; i += BATCH_SIZE) {
      const batch = payouts.slice(i, i + BATCH_SIZE);

      await db.execAsync('BEGIN TRANSACTION;');

      for (const payout of batch) {
        try {
          if (!payout?.txId) continue;

          const tx = {
            payoutSats: payout.payoutSats,
            status: payout.status,
            txId: payout.txId,
            createdAt: new Date(payout.createdAt).getTime(),
            day: new Date(payout.day).getTime(),
            paidAt: new Date(payout.paidAt).getTime(),
          };

          await db.runAsync(
            `
            INSERT INTO ${PAYOUTS_TABLE}
              (payoutSats, status, txId, createdAt, day, paidAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(txId) DO UPDATE SET
              payoutSats = excluded.payoutSats,
              status     = excluded.status,
              createdAt  = excluded.createdAt,
              day        = excluded.day,
              paidAt     = excluded.paidAt
            `,
            [
              tx.payoutSats,
              tx.status,
              tx.txId,
              tx.createdAt,
              tx.day,
              tx.paidAt,
            ],
          );
        } catch (innerErr) {
          console.error(
            'Error inserting/updating payout:',
            payout?.txId,
            innerErr,
          );
        }
      }

      await db.execAsync('COMMIT;');
    }

    console.log('All payout batches processed successfully');
    return true;
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    console.error('Fatal error in setPayoutsTransactions:', err);
    return false;
  }
}

/**
 * @returns {Promise<PayoutTransaction[]>}
 */
export async function getAllPayoutsTransactions() {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT *
     FROM ${PAYOUTS_TABLE}
     ORDER BY day DESC`,
  );

  return rows.map(row => ({
    payoutSats: row.payoutSats,
    status: row.status,
    txId: row.txId,
    createdAt: row.createdAt,
    day: row.day,
    paidAt: row.paidAt,
  }));
}

/**
 * @param {SavingsTransaction} transaction
 * @returns {Promise<SavingsTransaction>}
 */
export async function createSavingsTransaction(transaction) {
  const db = await getDatabase();

  if (!transaction?.id) throw new Error('Transaction id is required');
  if (!transaction?.goalId) throw new Error('goalId is required');
  if (!['deposit', 'withdrawal'].includes(transaction.type)) {
    throw new Error('Transaction type must be "deposit" or "withdrawal"');
  }

  const tx = {
    id: transaction.id,
    goalId: transaction.goalId,
    type: transaction.type,
    amountMicros: Math.max(
      0,
      Math.round(Number(transaction.amountMicros || 0)),
    ),
    timestamp: Number(transaction.timestamp || Date.now()),
  };

  await db.runAsync(
    `INSERT INTO ${TRANSACTIONS_TABLE} (id, goalId, type, amountMicros, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [tx.id, tx.goalId, tx.type, tx.amountMicros, tx.timestamp],
  );

  return tx;
}

/**
 * @param {string} goalId
 * @returns {Promise<SavingsTransaction[]>}
 */
export async function getSavingsTransactions(goalId) {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT id, goalId, type, amountMicros, timestamp
     FROM ${TRANSACTIONS_TABLE}
     WHERE goalId = ?
     ORDER BY timestamp DESC`,
    [goalId],
  );

  return rows.map(row => ({
    id: String(row.id),
    goalId: String(row.goalId),
    type: row.type,
    amountMicros: Number(row.amountMicros || 0),
    timestamp: Number(row.timestamp || 0),
  }));
}

/**
 * @returns {Promise<SavingsTransaction[]>}
 */
export async function getAllSavingsTransactions() {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT id, goalId, type, amountMicros, timestamp
     FROM ${TRANSACTIONS_TABLE}
     ORDER BY timestamp DESC`,
  );

  return rows.map(row => ({
    id: String(row.id),
    goalId: String(row.goalId),
    type: row.type,
    amountMicros: Number(row.amountMicros || 0),
    timestamp: Number(row.timestamp || 0),
  }));
}

export async function deleteSavingsGoalsTable() {
  const db = await getDatabase();
  await db.runAsync(`DROP TABLE IF EXISTS ${GOALS_TABLE};`);
}

export async function deleteSavingsTransactionsTable() {
  const db = await getDatabase();
  await db.runAsync(`DROP TABLE IF EXISTS ${TRANSACTIONS_TABLE};`);
}
export async function deleteSavingsPayoutsTable() {
  const db = await getDatabase();
  await db.runAsync(`DROP TABLE IF EXISTS ${PAYOUTS_TABLE};`);
}
