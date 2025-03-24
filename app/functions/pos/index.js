import * as SQLite from 'expo-sqlite';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
import {getTwoWeeksAgoDate} from '../rotateAddressDateChecker';
import {decryptMessage} from '../messaging/encodingAndDecodingMessages';
import EventEmitter from 'events';
export const POS_TRANSACTION_TABLE_NAME = 'POS_TRANSACTIONS';

export const POS_LAST_RECEIVED_TIME = 'LAST_RECEIVED_POS_EVENT';
export const POS_EVENT_UPDATE = 'POS_EVENT_UPDATE';
export const DID_OPEN_TABLES_EVENT_NAME = 'DID_OPEN_POS_TABLES';
export const pointOfSaleEventEmitter = new EventEmitter();

let sqlLiteDB;
let messageQueue = [];
let isProcessing = false;

if (!sqlLiteDB) {
  async function openDBConnection() {
    sqlLiteDB = await SQLite.openDatabaseAsync(
      `${POS_TRANSACTION_TABLE_NAME}.db`,
    );
  }
  openDBConnection();
}

export const initializePOSTransactionsDatabase = async () => {
  try {
    await sqlLiteDB.execAsync('PRAGMA journal_mode = WAL;');

    await sqlLiteDB.execAsync(`
      CREATE TABLE IF NOT EXISTS ${POS_TRANSACTION_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipAmountSats INTEGER NOT NULL,
        orderAmountSats INTEGER NOT NULL,
        serverName TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        dbDateAdded INTEGER NOT NULL UNIQUE,
        didPay INTEGER DEFAULT 0
      );
    `);

    // Now check if the column exists and add it if necessary
    const result = await sqlLiteDB.getFirstAsync(`
      SELECT COUNT(*) AS count FROM pragma_table_info('${POS_TRANSACTION_TABLE_NAME}') 
      WHERE name='didPay';
    `);

    if (result.count === 0) {
      // Add the new column if it doesn't exist
      await sqlLiteDB.execAsync(`
        ALTER TABLE ${POS_TRANSACTION_TABLE_NAME} 
        ADD COLUMN didPay INTEGER DEFAULT 0;
      `);
    }

    console.log('POS TRANSACTIONS TABLE READY');
    pointOfSaleEventEmitter.emit(DID_OPEN_TABLES_EVENT_NAME, 'opened');
    return true;
  } catch (err) {
    console.log(err);
    pointOfSaleEventEmitter.emit(DID_OPEN_TABLES_EVENT_NAME, 'not opened');
    return false;
  }
};
export const getSavedPOSTransactions = async () => {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${POS_TRANSACTION_TABLE_NAME} ORDER BY timestamp DESC;`,
    );

    if (!result.length) return [];

    console.log('result', result);
    let newestTimestap = result[0].timestamp;

    const retrivedLocalStorageItem = await getLocalStorageItem(
      POS_LAST_RECEIVED_TIME,
    );
    const savedNewestTime = JSON.parse(retrivedLocalStorageItem) || 0;
    const convertedTime = newestTimestap || getTwoWeeksAgoDate();

    console.log(
      'timestapms in get cached messsages(savedTime, convertedTime)',
      savedNewestTime,
      convertedTime,
    );
    if (savedNewestTime < convertedTime) {
      newestTimestap = convertedTime;
    } else newestTimestap = savedNewestTime;
    return result;
  } catch (err) {
    console.log(err, 'get cached message SQL error');
    return false;
  }
};

const processQueue = async () => {
  if (messageQueue.length === 0) return;
  if (isProcessing) return;
  isProcessing = true;
  while (messageQueue.length > 0) {
    const {transactionsList, privateKey} = messageQueue.shift();
    try {
      await setPOSTransactions({
        transactionsList,
        privateKey,
      });
    } catch (err) {
      console.error('Error processing batch in queue:', err);
    }
  }

  isProcessing = false;
};
export const queuePOSTransactions = ({transactionsList, privateKey}) => {
  messageQueue.push({
    transactionsList,
    privateKey,
  });
  if (messageQueue.length === 1) {
    processQueue();
  }
};

const setPOSTransactions = async ({transactionsList, privateKey}) => {
  try {
    // Start a database transaction for better performance
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');

    for (const newMessage of transactionsList) {
      const decryptedMessage = decryptMessage(
        privateKey,
        process.env.BACKEND_PUB_KEY,
        newMessage.tx,
      );

      if (!decryptedMessage) continue;
      const parsedMessage = JSON.parse(decryptedMessage);
      await sqlLiteDB.runAsync(
        `INSERT INTO ${POS_TRANSACTION_TABLE_NAME} (tipAmountSats, orderAmountSats, serverName, timestamp, dbDateAdded)
            VALUES (?, ?, ?, ?, ?);`,
        [
          parsedMessage.tipAmountSats,
          parsedMessage.orderAmountSats,
          parsedMessage.serverName,
          parsedMessage.time,
          newMessage.dateAdded,
        ],
      );
    }

    // Commit the transaction after all operations
    await sqlLiteDB.execAsync('COMMIT;');
    console.log('Bulk transactions processed successfully');
    return true;
  } catch (err) {
    // Rollback the transaction in case of an error
    await sqlLiteDB.execAsync('ROLLBACK;');
    console.error(err, 'set transactions SQL error');
    return false;
  } finally {
    const newTimesatmp = transactionsList.sort((a, b) => {
      return b.dateAdded - a.dateAdded;
    })[0].dateAdded;
    console.log(newTimesatmp, 'TIME BEING SET IN SET FUNCTION ');
    await setLocalStorageItem(
      POS_LAST_RECEIVED_TIME,
      JSON.stringify(newTimesatmp),
    );
    pointOfSaleEventEmitter.emit(POS_EVENT_UPDATE, 'set pos transaction');
  }
};
export const bulkUpdateDidPay = async dbDateAddedArray => {
  if (!dbDateAddedArray || dbDateAddedArray.length === 0) {
    console.log('No transactions to update.');
    return;
  }

  try {
    // Generate placeholders for the query (?, ?, ?)
    const placeholders = dbDateAddedArray.map(() => '?').join(', ');

    await sqlLiteDB.runAsync(
      `UPDATE ${POS_TRANSACTION_TABLE_NAME} 
       SET didPay = 1 
       WHERE dbDateAdded IN (${placeholders});`,
      dbDateAddedArray,
    );

    console.log(
      `Updated ${dbDateAddedArray.length} transactions to didPay = 1`,
    );
    pointOfSaleEventEmitter.emit(POS_EVENT_UPDATE, 'bulk updated did pay');
  } catch (err) {
    console.error('Error updating transactions:', err);
  }
};

export const updateDidPayForSingleTx = async (didPaySetting, dbDateAdded) => {
  if (!dbDateAdded) {
    console.log('No transactions to update.');
    return;
  }
  try {
    await sqlLiteDB.runAsync(
      `UPDATE ${POS_TRANSACTION_TABLE_NAME} 
       SET didPay = ?
       WHERE dbDateAdded = ?;`,
      [didPaySetting, dbDateAdded],
    );

    console.log(
      `Updated ${dbDateAdded} transactions to didPay = ${didPaySetting}`,
    );
    pointOfSaleEventEmitter.emit(
      POS_EVENT_UPDATE,
      'updated did pay for sinlge tx',
    );
  } catch (err) {
    console.error('Error updating transactions:', err);
  }
};

export const deleteEmployee = async employeeName => {
  try {
    await sqlLiteDB.runAsync(
      `DELETE FROM ${POS_TRANSACTION_TABLE_NAME} WHERE LOWER(serverName) = LOWER(?);`,
      [employeeName],
    );

    console.log(`Deleted all messages for employee: ${employeeName}`);
    pointOfSaleEventEmitter.emit(POS_EVENT_UPDATE, 'delted employee');
    return true;
  } catch (error) {
    console.error('Error deleting messages:', error);
    return false;
  }
};

export const deletePOSTransactionsTable = async () => {
  try {
    await sqlLiteDB.runAsync(
      `DROP TABLE IF EXISTS ${POS_TRANSACTION_TABLE_NAME};`,
    );
    console.log(`Table ${POS_TRANSACTION_TABLE_NAME} deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};
