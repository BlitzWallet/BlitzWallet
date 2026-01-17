import EventEmitter from 'events';
import { handleEventEmitterPost } from '../handleEventEmitters';
import { openDatabaseAsync } from 'expo-sqlite';

export const SPARK_TRANSACTIONS_DATABASE_NAME = 'SPARK_INFORMATION_DATABASE';
export const SPARK_TRANSACTIONS_TABLE_NAME = 'SPARK_TRANSACTIONS';
export const LIGHTNING_REQUEST_IDS_TABLE_NAME = 'LIGHTNING_REQUEST_IDS';
export const SPARK_REQUEST_IDS_TABLE_NAME = 'SPARK_REQUEST_IDS';
export const sparkTransactionsEventEmitter = new EventEmitter();
export const SPARK_TX_UPDATE_ENVENT_NAME = 'UPDATE_SPARK_STATE';

export const HANDLE_FLASHNET_AUTO_SWAP = 'HANDLE_FLASHNET_AUTO_SWAP';
export const flashnetAutoSwapsEventListener = new EventEmitter();

let bulkUpdateTransactionQueue = [];
let isProcessingBulkUpdate = false;

let sqlLiteDB;
let isInitialized = false;
let initPromise = null;

async function openDBConnection() {
  if (!initPromise) {
    initPromise = (async () => {
      sqlLiteDB = await openDatabaseAsync(
        `${SPARK_TRANSACTIONS_DATABASE_NAME}.db`,
      );
      isInitialized = true;
      return sqlLiteDB;
    })();
  }
  return initPromise;
}

export const isSparkTxDatabaseOpen = () => {
  return isInitialized;
};

export const ensureSparkDatabaseReady = async () => {
  if (!isInitialized) {
    await openDBConnection();
  }
  return sqlLiteDB;
};

export const initializeSparkDatabase = async () => {
  try {
    await ensureSparkDatabaseReady();
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

       CREATE TABLE IF NOT EXISTS ${SPARK_REQUEST_IDS_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sparkID TEXT NOT NULL,
        description TEXT NOT NULL,
        sendersPubkey TEXT NOT NULL,
        details TEXT
      );
    `);

    console.log('Opened spark transaction and contacts tables');
    return true;
  } catch (err) {
    console.log('Spark Database initialization failed:', err);
    return false;
  }
};
export const getAllSparkTransactions = async (options = {}) => {
  try {
    await ensureSparkDatabaseReady();
    const {
      limit = null,
      offset = null,
      accountId = null,
      startRange = null,
      endRange = null,
      idsOnly = false,
    } = options;

    let query = idsOnly
      ? `SELECT sparkID FROM ${SPARK_TRANSACTIONS_TABLE_NAME}`
      : `SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME}`;
    let params = [];

    if (accountId) {
      query += ` WHERE accountId = ?`;
      params.push(String(accountId));
    }

    // Sort by time in details JSON for both cases
    query += ` ORDER BY json_extract(details, '$.time') DESC`;

    if (startRange !== null && endRange !== null) {
      const rangeLimit = endRange - startRange + 1;
      query += ` LIMIT ? OFFSET ?`;
      params.push(rangeLimit, startRange);
    } else if (limit !== null && offset !== null) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    } else if (limit !== null) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    const result = await sqlLiteDB.getAllAsync(query, params);

    return idsOnly ? result.map(row => row.sparkID) : result;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
};

export const getBulkSparkTransactions = async sparkIDs => {
  if (!sparkIDs || sparkIDs.length === 0) return [];

  try {
    await ensureSparkDatabaseReady();

    const placeholders = sparkIDs.map(() => '?').join(',');
    const query = `
      SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME}
      WHERE sparkID IN (${placeholders})
    `;

    const results = await sqlLiteDB.getAllAsync(query, sparkIDs);

    // Create a Map for O(1) lookups
    const txMap = new Map();
    for (const tx of results) {
      txMap.set(tx.sparkID, tx);
    }

    return txMap;
  } catch (error) {
    console.error('Error fetching bulk spark transactions:', error);
    return new Map();
  }
};

export const deleteBulkSparkContactTransactions = async sparkIDs => {
  if (!sparkIDs || sparkIDs.length === 0) return 0;

  try {
    await ensureSparkDatabaseReady();

    const placeholders = sparkIDs.map(() => '?').join(',');
    const query = `
      DELETE FROM ${SPARK_REQUEST_IDS_TABLE_NAME}
      WHERE sparkID IN (${placeholders})
    `;

    const result = await sqlLiteDB.runAsync(query, sparkIDs);

    // sqlite typically exposes number of affected rows like this
    return result?.changes ?? 0;
  } catch (error) {
    console.error('Error deleting bulk spark transactions:', error);
    return 0;
  }
};

export const getAllPendingSparkPayments = async accountId => {
  try {
    await ensureSparkDatabaseReady();
    let query = `
      SELECT * 
      FROM ${SPARK_TRANSACTIONS_TABLE_NAME} 
      WHERE paymentStatus = ?
    `;
    const params = ['pending'];

    if (accountId !== undefined && accountId !== null && accountId !== '') {
      query += ` AND accountId = ?`;
      params.push(String(accountId));
    }

    const result = await sqlLiteDB.getAllAsync(query.trim(), params);
    return result || [];
  } catch (error) {
    console.error('Error fetching pending spark payments:', error);
    return [];
  }
};

export const getAllSparkContactInvoices = async () => {
  try {
    await ensureSparkDatabaseReady();
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${SPARK_REQUEST_IDS_TABLE_NAME}`,
    );
    return result;
  } catch (error) {
    console.error('Error fetching contacts saved transactions:', error);
  }
};

export const addSingleUnpaidSparkTransaction = async tx => {
  if (!tx || !tx.id) {
    console.error('Invalid transaction object');
    return false;
  }

  try {
    await ensureSparkDatabaseReady();
    await sqlLiteDB.runAsync(
      `INSERT INTO ${SPARK_REQUEST_IDS_TABLE_NAME}
       (sparkID, description, sendersPubkey, details)
       VALUES (?, ?, ?, ?)`,
      [tx.id, tx.description, tx.sendersPubkey, JSON.stringify(tx.details)],
    );
    console.log('sucesfully added unpaid contacts invoice', tx);
    return true;
  } catch (error) {
    console.error('Error adding spark transaction:', error);
    return false;
  }
};

export const addBulkUnpaidSparkContactTransactions = async transactions => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    console.error('Invalid transactions array');
    return { success: false, added: 0, failed: 0 };
  }

  const validTransactions = transactions.filter(tx => tx && tx.id);

  if (validTransactions.length === 0) {
    console.error('No valid transactions to add');
    return { success: false, added: 0, failed: transactions.length };
  }

  try {
    await ensureSparkDatabaseReady();
    const placeholders = validTransactions.map(() => '(?, ?, ?, ?)').join(', ');

    const values = validTransactions.flatMap(tx => [
      tx.id,
      tx.description,
      tx.sendersPubkey,
      JSON.stringify(tx.details),
    ]);

    await sqlLiteDB.runAsync(
      `INSERT INTO ${SPARK_REQUEST_IDS_TABLE_NAME}
       (sparkID, description, sendersPubkey, details)
       VALUES ${placeholders}`,
      values,
    );

    console.log(
      `Successfully added ${validTransactions.length} unpaid contact invoices`,
    );
    return {
      success: true,
      added: validTransactions.length,
      failed: transactions.length - validTransactions.length,
    };
  } catch (error) {
    console.error('Error adding bulk spark contact transactions:', error);
    return { success: false, added: 0, failed: transactions.length };
  }
};

export const deleteSparkContactTransaction = async sparkID => {
  try {
    await ensureSparkDatabaseReady();
    await sqlLiteDB.runAsync(
      `DELETE FROM ${SPARK_REQUEST_IDS_TABLE_NAME} WHERE sparkID = ?`,
      sparkID,
    );

    return true;
  } catch (error) {
    console.error(`Error deleting transaction ${sparkID}:`, error);
    return false;
  }
};

export const getAllUnpaidSparkLightningInvoices = async () => {
  try {
    await ensureSparkDatabaseReady();
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
    await ensureSparkDatabaseReady();
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
    console.log('sucesfully added unpaid lightning invoice', tx);
    return true;
  } catch (error) {
    console.error('Error adding spark transaction:', error);
    return false;
  }
};
export const getSingleSparkLightningRequest = async sparkRequestID => {
  if (!sparkRequestID) {
    console.error('Invalid sparkRequestID provided');
    return null;
  }

  try {
    await ensureSparkDatabaseReady();
    const rows = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME} WHERE sparkID = ?`,
      [sparkRequestID],
    );

    if (!rows.length) {
      console.error('Lightning request not found for sparkID:', sparkRequestID);
      return null;
    }

    const request = rows[0];
    if (request.details) {
      try {
        request.details = JSON.parse(request.details);
      } catch (error) {
        console.warn('Failed to parse request details JSON');
      }
    }

    return request;
  } catch (error) {
    console.error('Error fetching single lightning request:', error);
    return null;
  }
};
export const updateSparkTransactionDetails = async (
  sparkRequestID,
  newDetails,
) => {
  if (!sparkRequestID || typeof newDetails !== 'object') {
    console.error('Invalid arguments passed to updateSparkTransactionDetails');
    return false;
  }

  try {
    await ensureSparkDatabaseReady();

    const rows = await sqlLiteDB.getAllAsync(
      `SELECT details FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME} WHERE sparkID = ?`,
      [sparkRequestID],
    );

    if (!rows.length) {
      console.error('Transaction not found for sparkID:', sparkRequestID);
      return false;
    }

    let existingDetails = {};
    try {
      existingDetails = rows[0].details ? JSON.parse(rows[0].details) : {};
    } catch {
      console.warn('Failed to parse existing details JSON, resetting it');
    }

    const mergedDetails = {
      ...existingDetails,
      ...newDetails,
    };

    await sqlLiteDB.runAsync(
      `UPDATE ${LIGHTNING_REQUEST_IDS_TABLE_NAME}
       SET details = ?
       WHERE sparkID = ?`,
      [JSON.stringify(mergedDetails), sparkRequestID],
    );

    if (newDetails.performSwaptoUSD) {
      flashnetAutoSwapsEventListener.emit(
        HANDLE_FLASHNET_AUTO_SWAP,
        sparkRequestID,
      );
    }

    return true;
  } catch (error) {
    console.error('Error updating spark transaction details:', error);
    return false;
  }
};

export const getPendingAutoSwaps = async () => {
  try {
    await ensureSparkDatabaseReady();

    const query = `
      SELECT * FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME}
      WHERE json_extract(details, '$.finalSparkID') IS NOT NULL
        AND (json_extract(details, '$.performSwaptoUSD') = 1
             OR json_extract(details, '$.performSwaptoUSD') IS NULL)
        AND (json_extract(details, '$.completedSwaptoUSD') IS NULL 
             OR json_extract(details, '$.completedSwaptoUSD') = 0)
    `;

    const result = await sqlLiteDB.getAllAsync(query);

    return result.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : {},
    }));
  } catch (error) {
    console.error('Error fetching pending auto swaps:', error);
    return [];
  }
};

export const getActiveAutoSwapByAmount = async amount => {
  try {
    await ensureSparkDatabaseReady();
    const query = `
      SELECT * FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME}
      WHERE json_extract(details, '$.swapInitiated') = 1
        AND json_extract(details, '$.swapAmount') = ?
        AND (json_extract(details, '$.completedSwaptoUSD') IS NULL 
             OR json_extract(details, '$.completedSwaptoUSD') = 0)
      ORDER BY json_extract(details, '$.lastSwapAttempt') DESC
      LIMIT 1
    `;
    const result = await sqlLiteDB.getAllAsync(query, [amount]);
    if (result.length > 0) {
      return {
        ...result[0],
        details: result[0].details ? JSON.parse(result[0].details) : {},
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding swap by amount:', error);
    return null;
  }
};

// export const updateSingleSparkTransaction = async (saved_spark_id, updates) => {
//   // updates should be an object like { status: 'COMPLETED' }
//   // saved_spark_id needs to match that of the stored transaction and then you can update the saved_id
//   try {
//     const fields = Object.keys(updates)
//       .map(key => `${key} = ?`)
//       .join(', ');
//     const values = Object.values(updates);

//     await sqlLiteDB.runAsync(
//       `UPDATE ${SPARK_TRANSACTIONS_TABLE_NAME} SET ${fields} WHERE sparkID = ?`,
//       ...values,
//       saved_spark_id,
//     );
//     // Emit event
//     handleEventEmitterPost(
//       sparkTransactionsEventEmitter,
//       SPARK_TX_UPDATE_ENVENT_NAME,
//       'transactions',
//     );

//     return true;
//   } catch (error) {
//     console.error(`Error updating transaction:`, error);
//     return false;
//   }
// };

export const bulkUpdateSparkTransactions = async (transactions, ...data) => {
  const [
    updateType = 'transactions',
    fee = 0,
    passedBalance = 0,
    shouldUpdateDescription = false,
  ] = data;
  console.log(transactions, 'transactions list in bulk updates');
  if (!Array.isArray(transactions) || transactions.length === 0) return;

  return addToBulkUpdateQueue(async () => {
    try {
      await ensureSparkDatabaseReady();
      console.log('Running bulk updates', updateType);
      console.log(transactions);

      // Step 1: Format and deduplicate transactions
      const processedTransactions = new Map();

      // First pass: collect and merge transactions by final sparkID
      for (const tx of transactions) {
        const finalSparkId = tx.id;
        const accountId = tx.accountId;
        const tempSparkId = tx.useTempId ? tx.tempId : tx.id;
        const removeDuplicateKey = `${finalSparkId}_${accountId}`;

        if (processedTransactions.has(removeDuplicateKey)) {
          const existingTx = processedTransactions.get(removeDuplicateKey);

          // Merge details efficiently - only override if new value is meaningful
          const mergedDetails = { ...existingTx.details };
          for (const key in tx.details) {
            const value = tx.details[key];
            if (
              value !== '' &&
              value !== null &&
              value !== undefined &&
              value !== 0
            ) {
              mergedDetails[key] = value;
            }
          }

          console.log('Existing details', existingTx.details);
          console.log('merged detials', mergedDetails);

          // Update with merged data
          existingTx.paymentStatus =
            tx.paymentStatus || existingTx.paymentStatus;
          existingTx.paymentType = tx.paymentType || existingTx.paymentType;
          existingTx.accountId = tx.accountId || existingTx.accountId;
          existingTx.details = mergedDetails;
          existingTx.useTempId = tx.useTempId || existingTx.useTempId;
        } else {
          processedTransactions.set(removeDuplicateKey, {
            sparkID: finalSparkId,
            tempSparkId: tx.useTempId ? tempSparkId : null,
            paymentStatus: tx.paymentStatus,
            paymentType: tx.paymentType || 'unknown',
            accountId: tx.accountId || 'unknown',
            details: tx.details ?? {},
            useTempId: tx.useTempId,
          });
        }
      }

      // Step 2: Batch fetch all existing transactions in one query
      const allSparkIds = [];
      const allTempIds = [];
      const accountIds = [];

      for (const [key, tx] of processedTransactions) {
        allSparkIds.push(tx.sparkID);
        accountIds.push(tx.accountId);
        if (tx.tempSparkId && tx.tempSparkId !== tx.sparkID) {
          allTempIds.push(tx.tempSparkId);
        }
      }

      // Create a single query with OR conditions for better performance
      const placeholders = allSparkIds.map(() => '?').join(',');
      const accountPlaceholders = accountIds.map(() => '?').join(',');

      let existingTxQuery = `
        SELECT * FROM ${SPARK_TRANSACTIONS_TABLE_NAME} 
        WHERE sparkID IN (${placeholders})
      `;

      if (allTempIds.length > 0) {
        const tempPlaceholders = allTempIds.map(() => '?').join(',');
        existingTxQuery += ` OR sparkID IN (${tempPlaceholders})`;
      }

      const existingTxs = await sqlLiteDB.getAllAsync(
        existingTxQuery,
        allTempIds.length > 0 ? [...allSparkIds, ...allTempIds] : allSparkIds,
      );

      // Build lookup maps for O(1) access
      const existingTxMap = new Map();
      const existingTempTxMap = new Map();

      for (const tx of existingTxs) {
        const key = `${tx.sparkID}_${tx.accountId}`;
        existingTxMap.set(key, tx);

        // Also map by sparkID for temp lookups
        for (const [_, processedTx] of processedTransactions) {
          if (processedTx.tempSparkId === tx.sparkID) {
            const tempKey = `${processedTx.tempSparkId}_${tx.accountId}`;
            existingTempTxMap.set(tempKey, tx);
          }
        }
      }

      // Step 3: Begin database transaction
      await sqlLiteDB.execAsync('BEGIN TRANSACTION');
      let includedFailed = false;

      // Helper function to merge details
      const mergeDetails = (existingDetailsStr, newDetails) => {
        let existingDetails = {};
        try {
          existingDetails = JSON.parse(existingDetailsStr);
        } catch {}

        const merged = { ...existingDetails };
        for (const key in newDetails) {
          const value = newDetails[key];
          if (
            (value !== '' &&
              value !== null &&
              value !== undefined &&
              value !== 0) ||
            (key === 'description' && shouldUpdateDescription)
          ) {
            merged[key] = value;
          }
        }
        return JSON.stringify(merged);
      };

      // Step 4: Process each unique transaction
      for (const [removeDuplicateKey, processedTx] of processedTransactions) {
        const [finalSparkId, accountId] = removeDuplicateKey.split('_');

        const existingTx = existingTxMap.get(removeDuplicateKey);
        const tempKey = processedTx.tempSparkId
          ? `${processedTx.tempSparkId}_${accountId}`
          : null;
        const existingTempTx = tempKey ? existingTempTxMap.get(tempKey) : null;

        if (processedTx.paymentStatus === 'failed') {
          includedFailed = true;
        }

        if (existingTx) {
          // if (processedTx.paymentStatus === 'failed') {
          //   includedFailed = true;
          //   await sqlLiteDB.runAsync(
          //     `DELETE FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE sparkID = ? AND accountId = ?`,
          //     [finalSparkId, accountId],
          //   );

          //   if (existingTempTx && processedTx.tempSparkId !== finalSparkId) {
          //     await sqlLiteDB.runAsync(
          //       `DELETE FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE sparkID = ? AND accountId = ?`,
          //       [processedTx.tempSparkId, accountId],
          //     );
          //   }
          // } else {
          const mergedDetails = mergeDetails(
            existingTx.details,
            processedTx.details,
          );

          await sqlLiteDB.runAsync(
            `UPDATE ${SPARK_TRANSACTIONS_TABLE_NAME}
               SET paymentStatus = ?, paymentType = ?, accountId = ?, details = ?
               WHERE sparkID = ? AND accountId = ?`,
            [
              processedTx.paymentStatus,
              processedTx.paymentType,
              processedTx.accountId,
              mergedDetails,
              finalSparkId,
              accountId,
            ],
          );

          if (existingTempTx && processedTx.tempSparkId !== finalSparkId) {
            await sqlLiteDB.runAsync(
              `DELETE FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE sparkID = ? AND accountId = ?`,
              [processedTx.tempSparkId, accountId],
            );
          }
          // }
        } else if (existingTempTx) {
          // if (processedTx.paymentStatus === 'failed') {
          //   includedFailed = true;
          //   await sqlLiteDB.runAsync(
          //     `DELETE FROM ${SPARK_TRANSACTIONS_TABLE_NAME} WHERE sparkID = ? AND accountId = ?`,
          //     [processedTx.tempSparkId, accountId],
          //   );
          // } else {
          const mergedDetails = mergeDetails(
            existingTempTx.details,
            processedTx.details,
          );

          await sqlLiteDB.runAsync(
            `UPDATE ${SPARK_TRANSACTIONS_TABLE_NAME}
               SET sparkID = ?, paymentStatus = ?, paymentType = ?, accountId = ?, details = ?
               WHERE sparkID = ? AND accountId = ?`,
            [
              finalSparkId,
              processedTx.paymentStatus,
              processedTx.paymentType,
              processedTx.accountId,
              mergedDetails,
              processedTx.tempSparkId,
              accountId,
            ],
          );
          // }
        } else {
          // if (processedTx.paymentStatus !== 'failed') {
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
          // } else {
          //   includedFailed = true;
          // }
        }
      }

      console.log('committing transactions');
      await sqlLiteDB.execAsync('COMMIT');
      console.log('running sql event emitter');

      handleEventEmitterPost(
        sparkTransactionsEventEmitter,
        SPARK_TX_UPDATE_ENVENT_NAME,
        includedFailed ? 'fullUpdate' : updateType,
        fee,
        passedBalance,
      );

      return true;
    } catch (error) {
      console.error('Error upserting transactions batch:', error);
      try {
        await sqlLiteDB.execAsync('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
      return false;
    }
  });
};

export const addSingleSparkTransaction = async (
  tx,
  updateType = 'fullUpdate',
) => {
  if (!tx || !tx.id) {
    console.error('Invalid transaction object');
    return false;
  }

  try {
    await ensureSparkDatabaseReady();
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
      updateType,
    );

    return true;
  } catch (error) {
    console.error('Error adding spark transaction:', error);
    return false;
  }
};

export const deleteSparkTransaction = async sparkID => {
  try {
    await ensureSparkDatabaseReady();
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
    await ensureSparkDatabaseReady();
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
    await ensureSparkDatabaseReady();
    await sqlLiteDB.execAsync(
      `DROP TABLE IF EXISTS ${SPARK_TRANSACTIONS_TABLE_NAME}`,
    );
    return true;
  } catch (error) {
    console.error('Error deleting spark_transactions table:', error);
    return false;
  }
};

export const deleteSparkContactsTransactionsTable = async () => {
  try {
    await ensureSparkDatabaseReady();
    await sqlLiteDB.execAsync(
      `DROP TABLE IF EXISTS ${SPARK_REQUEST_IDS_TABLE_NAME}`,
    );
    return true;
  } catch (error) {
    console.error('Error deleting spark_transactions table:', error);
    return false;
  }
};

export const deleteUnpaidSparkLightningTransactionTable = async () => {
  try {
    await ensureSparkDatabaseReady();
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
    await ensureSparkDatabaseReady();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();
    // Delete where status is 'INVOICE_CREATED' and expires_at_time is not null and in the past
    await sqlLiteDB.runAsync(
      `DELETE FROM ${LIGHTNING_REQUEST_IDS_TABLE_NAME}
       WHERE expiration < ?`,
      twoWeeksAgoISO,
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
    const { operation, resolve, reject } = bulkUpdateTransactionQueue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  isProcessingBulkUpdate = false;
};
