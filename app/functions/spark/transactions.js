import * as SQLite from 'expo-sqlite';
import EventEmitter from 'events';
import {handleEventEmitterPost} from '../handleEventEmitters';
export const SPARK_TRANSACTIONS_DATABASE_NAME = 'SPARK_INFORMATION_DATABASE';
export const SPARK_TRANSACTIONS_TABLE_NAME = 'SPARK_TRANSACTIONS';
export const LIGHTNING_REQUEST_IDS_TABLE_NAME = 'LIGHTNING_REQUEST_IDS';
export const sparkTransactionsEventEmitter = new EventEmitter();
export const SPARK_TX_UPDATE_ENVENT_NAME = 'UPDATE_SPARK_STATE';
let bulkUpdateTransactionQueue = [];
let isProcessingBulkUpdate = false;

let sqlLiteDB;

if (!sqlLiteDB) {
  async function openDBConnection() {
    sqlLiteDB = await SQLite.openDatabaseAsync(
      `${SPARK_TRANSACTIONS_DATABASE_NAME}.db`,
    );
  }
  openDBConnection();
}

export const initializeSparkDatabase = async () => {
  try {
    // Payment status: pending, completed, failed
    await sqlLiteDB.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS ${SPARK_TRANSACTIONS_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sparkID TEXT NOT NULL,
        paymentStatus TEXT NOT NULL, 
        paymentType TEXT NOT NULL,
        accountId TEXT NOT NULL,
        details TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ${LIGHTNING_REQUEST_IDS_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sparkID TEXT NOT NULL,
        amount INTEGER NOT NULL,
        expiration INTEGER NOT NULL,
        description TEXT NOT NULL,
        shouldNavigate INTEGER NOT NULL,
        details TEXT
      );
    `);

    console.log('Opened spark transaction and contacts tables');
    return true;
  } catch (err) {
    console.log('Database initialization failed:', err);
    return false;
  }
};

export const getAllSparkTransactions = async () => {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME}`,
    );

    return result.sort(
      (a, b) => JSON.parse(b.details).time - JSON.parse(a.details).time,
    );
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
};

export const getAllPendingSparkPayments = async () => {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE paymentStatus = ?`,
      ['pending'],
    );
    return result;
  } catch (error) {
    console.error('Error fetching pending spark payments:', error);
    return [];
  }
};

export const getAllUnpaidSparkLightningInvoices = async () => {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME}`,
    );
    return result;
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
};
export const addSingleUnpaidSparkLightningTransaction = async tx => {
  if (!tx || !tx.id) {
    console.error('Invalid transaction object');
    return false;
  }

  try {
    await sqlLiteDB.runAsync(
      `INSERT INTO ${LIGHTNING_REQUEST_IDS_TABLE_NAME}
       (sparkID, amount, expiration, description, shouldNavigate, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        Number(tx.amount),
        tx.expiration,
        tx.description,
        tx.shouldNavigate !== undefined ? (tx.shouldNavigate ? 0 : 1) : 0,
        JSON.stringify(tx.details),
      ],
    );
    return true;
  } catch (error) {
    console.error('Error adding spark transaction:', error);
    return false;
  }
};

export const updateSingleSparkTransaction = async (saved_spark_id, updates) => {
  // updates should be an object like { status: 'COMPLETED' }
  // saved_spark_id needs to match that of the stored transaction and then you can update the saved_id
  try {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await sqlLiteDB.runAsync(
      `UPDATE ${SPARK_TRANSACTIONS_TABLE_NAME} SET ${fields} WHERE sparkID = ?`,
      ...values,
      saved_spark_id,
    );
    // Emit event
    handleEventEmitterPost(
      sparkTransactionsEventEmitter,
      SPARK_TX_UPDATE_ENVENT_NAME,
      'transactions',
    );

    return true;
  } catch (error) {
    console.error(`Error updating transaction:`, error);
    return false;
  }
};

export const bulkUpdateSparkTransactions = async (transactions, ...data) => {
  const [updateType = 'transactions', fee = 0, passedBalance = 0] = data;
  console.log(transactions, 'transactions list in bulk updates');
  if (!Array.isArray(transactions) || transactions.length === 0) return;

  return addToBulkUpdateQueue(async () => {
    try {
      console.log('Running bulk updates', updateType);
      console.log(transactions);

      // Step 1: Format and deduplicate transactions
      const processedTransactions = new Map();

      // First pass: collect and merge transactions by final sparkID
      for (const tx of transactions) {
        const finalSparkId = tx.id; // This is the final ID we want to use
        const tempSparkId = tx.useTempId ? tx.tempId : tx.id;

        if (processedTransactions.has(finalSparkId)) {
          // Merge with existing transaction
          const existingTx = processedTransactions.get(finalSparkId);

          // Merge details - only override if new value is not empty
          let mergedDetails = {...existingTx.details};
          for (const key in tx.details) {
            const value = tx.details[key];
            if (value !== '' && value !== null && value !== undefined) {
              mergedDetails[key] = value;
            }
          }

          // Update the transaction with merged data
          processedTransactions.set(finalSparkId, {
            sparkID: finalSparkId,
            tempSparkId: existingTx.tempSparkId || tempSparkId, // Keep track of temp ID if it exists
            paymentStatus: tx.paymentStatus || existingTx.paymentStatus,
            paymentType: tx.paymentType || existingTx.paymentType || 'unknown',
            accountId: tx.accountId || existingTx.accountId || 'unknown',
            details: mergedDetails,
            useTempId: tx.useTempId || existingTx.useTempId,
          });
        } else {
          // Add new transaction
          processedTransactions.set(finalSparkId, {
            sparkID: finalSparkId,
            tempSparkId: tx.useTempId ? tempSparkId : null,
            paymentStatus: tx.paymentStatus,
            paymentType: tx.paymentType || 'unknown',
            accountId: tx.accountId || 'unknown',
            details: tx.details,
            useTempId: tx.useTempId,
          });
        }
      }

      // Step 2: Begin database transaction
      await sqlLiteDB.execAsync('BEGIN TRANSACTION');

      // Step 3: Process each unique transaction
      for (const [finalSparkId, processedTx] of processedTransactions) {
        // Check if transaction exists by final sparkID
        const existingTx = await sqlLiteDB.getFirstAsync(
          `SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME} 
           WHERE sparkID = ? 
           LIMIT 1`,
          [finalSparkId],
        );

        // Also check if temp ID exists (if different from final ID)
        let existingTempTx = null;
        if (
          processedTx.tempSparkId &&
          processedTx.tempSparkId !== finalSparkId
        ) {
          existingTempTx = await sqlLiteDB.getFirstAsync(
            `SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME} 
             WHERE sparkID = ? 
             LIMIT 1`,
            [processedTx.tempSparkId],
          );
        }

        if (existingTx) {
          // Update existing transaction with final ID
          let existingDetails;
          try {
            existingDetails = JSON.parse(existingTx.details);
          } catch {
            existingDetails = {};
          }

          let mergedDetails = {...existingDetails};
          for (const key in processedTx.details) {
            const value = processedTx.details[key];
            if (value !== '' && value !== null && value !== undefined) {
              mergedDetails[key] = value;
            }
          }

          await sqlLiteDB.runAsync(
            `UPDATE ${SPARK_TRANSACTIONS_TABLE_NAME}
             SET paymentStatus = ?, paymentType = ?, accountId = ?, details = ?
             WHERE sparkID = ?`,
            [
              processedTx.paymentStatus,
              processedTx.paymentType,
              processedTx.accountId,
              JSON.stringify(mergedDetails),
              finalSparkId,
            ],
          );

          // Delete temp transaction if it exists and is different
          if (existingTempTx && processedTx.tempSparkId !== finalSparkId) {
            await sqlLiteDB.runAsync(
              `DELETE FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE sparkID = ?`,
              [processedTx.tempSparkId],
            );
          }
        } else if (existingTempTx) {
          // Update temp transaction to use final sparkID
          let existingDetails;
          try {
            existingDetails = JSON.parse(existingTempTx.details);
          } catch {
            existingDetails = {};
          }

          let mergedDetails = {...existingDetails};
          for (const key in processedTx.details) {
            const value = processedTx.details[key];
            if (value !== '' && value !== null && value !== undefined) {
              mergedDetails[key] = value;
            }
          }

          await sqlLiteDB.runAsync(
            `UPDATE ${SPARK_TRANSACTIONS_TABLE_NAME}
             SET sparkID = ?, paymentStatus = ?, paymentType = ?, accountId = ?, details = ?
             WHERE sparkID = ?`,
            [
              finalSparkId,
              processedTx.paymentStatus,
              processedTx.paymentType,
              processedTx.accountId,
              JSON.stringify(mergedDetails),
              processedTx.tempSparkId,
            ],
          );
        } else {
          // Insert new transaction
          await sqlLiteDB.runAsync(
            `INSERT INTO ${SPARK_TRANSACTIONS_TABLE_NAME}
             (sparkID, paymentStatus, paymentType, accountId, details)
             VALUES (?, ?, ?, ?, ?)`,
            [
              finalSparkId,
              processedTx.paymentStatus,
              processedTx.paymentType,
              processedTx.accountId,
              JSON.stringify(processedTx.details),
            ],
          );
        }
      }

      console.log('committing transactions');
      // Commit transaction
      await sqlLiteDB.execAsync('COMMIT');
      console.log('running sql event emitter');
      handleEventEmitterPost(
        sparkTransactionsEventEmitter,
        SPARK_TX_UPDATE_ENVENT_NAME,
        updateType,
        fee,
        passedBalance,
      );
      return true;
    } catch (error) {
      console.error('Error upserting transactions batch:', error);
      // Rollback on error
      try {
        await sqlLiteDB.execAsync('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
      return false;
    }
  });
};

export const addSingleSparkTransaction = async tx => {
  if (!tx || !tx.id) {
    console.error('Invalid transaction object');
    return false;
  }

  try {
    const newDetails = tx.details;
    await sqlLiteDB.runAsync(
      `INSERT INTO ${SPARK_TRANSACTIONS_TABLE_NAME}
       (sparkID, paymentStatus, paymentType, accountId, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.paymentStatus,
        tx.paymentType ?? 'unknown',
        tx.accountId ?? 'unknown',
        JSON.stringify(newDetails),
      ],
    );
    // Emit event

    handleEventEmitterPost(
      sparkTransactionsEventEmitter,
      SPARK_TX_UPDATE_ENVENT_NAME,
      'transactions',
    );

    return true;
  } catch (error) {
    console.error('Error adding spark transaction:', error);
    return false;
  }
};

export const deleteSparkTransaction = async sparkID => {
  try {
    await sqlLiteDB.runAsync(
      `DELETE FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE sparkID = ?`,
      sparkID,
    );
    // Emit event
    handleEventEmitterPost(
      sparkTransactionsEventEmitter,
      SPARK_TX_UPDATE_ENVENT_NAME,
      'transactions',
    );

    return true;
  } catch (error) {
    console.error(`Error deleting transaction ${sparkID}:`, error);
    return false;
  }
};
export const deleteUnpaidSparkLightningTransaction = async sparkID => {
  try {
    await sqlLiteDB.runAsync(
      `DELETE FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME} WHERE sparkID = ?`,
      sparkID,
    );
    return true;
  } catch (error) {
    console.error(`Error deleting transaction ${sparkID}:`, error);
    return false;
  }
};

export const deleteSparkTransactionTable = async () => {
  try {
    await sqlLiteDB.execAsync(
      `DROP TABLE IF EXISTS ${SPARK_TRANSACTIONS_TABLE_NAME}`,
    );
    return true;
  } catch (error) {
    console.error('Error deleting spark_transactions table:', error);
    return false;
  }
};
export const deleteUnpaidSparkLightningTransactionTable = async () => {
  try {
    await sqlLiteDB.execAsync(
      `DROP TABLE IF EXISTS ${LIGHTNING_REQUEST_IDS_TABLE_NAME}`,
    );
    return true;
  } catch (error) {
    console.error('Error deleting spark_transactions table:', error);
    return false;
  }
};

export const cleanStalePendingSparkLightningTransactions = async () => {
  try {
    const now = new Date().getTime();
    // Delete where status is 'INVOICE_CREATED' and expires_at_time is not null and in the past
    await sqlLiteDB.runAsync(
      `DELETE FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME}
       WHERE expiration < ?`,
      now,
    );
    console.log('Stale spark transactions cleaned up');
    return true;
  } catch (error) {
    console.error('Error cleaning stale spark transactions:', error);
    return false;
  }
};

const formatDetailsJSON = tx => {
  const newDetails = {
    direction: tx.transferDirection ?? null,
    fee: tx.fee ?? 0,
    address: tx.address ?? '',
    amount: tx.totalValue ?? 0,
    paymentTime: tx.updatedTime ?? tx.createdTime ?? Date.now(),
    description: tx.description ?? '',
    status: tx.status ?? 'pending',
    sparkID: tx.id ?? '',
    l1TxId: tx.l1TxId ?? null,
    preimage: tx.preimage ?? null,
    paymentHash: tx.paymentHash ?? null,
  };
  return newDetails;
};

const addToBulkUpdateQueue = async operation => {
  console.log('Adding transaction to bulk updates que');
  return new Promise((resolve, reject) => {
    bulkUpdateTransactionQueue.push({
      operation,
      resolve,
      reject,
    });

    if (!isProcessingBulkUpdate) {
      processBulkUpdateQueue();
    }
  });
};

const processBulkUpdateQueue = async () => {
  console.log('Processing bulk updates que');
  if (isProcessingBulkUpdate || bulkUpdateTransactionQueue.length === 0) {
    return;
  }

  isProcessingBulkUpdate = true;

  while (bulkUpdateTransactionQueue.length > 0) {
    const {operation, resolve, reject} = bulkUpdateTransactionQueue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  isProcessingBulkUpdate = false;
};
