import * as SQLite from 'expo-sqlite';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
import {getTwoWeeksAgoDate} from '../rotateAddressDateChecker';
import {decryptMessage} from '../messaging/encodingAndDecodingMessages';
export const POS_TRANSACTION_TABLE_NAME = 'POS_TRANSACTIONS';

export const POS_LAST_RECEIVED_TIME = 'LAST_RECEIVED_POS_EVENT';
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
    await sqlLiteDB.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ${POS_TRANSACTION_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipAmountSats INTEGER NOT NULL,
        orderAmountSats INTEGER NOT NULL,
        serverName TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        dbDateAdded INTEGER NOT NULL
      );`);
    console.log('OPENED POS TRANSACTIONS TABLE');
    return true;
  } catch (err) {
    console.log(err);
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
    const {transactionsList, privateKey, updateTxListFunction} =
      messageQueue.shift();
    try {
      await setPOSTransactions({
        transactionsList,
        privateKey,
        updateTxListFunction,
      });
    } catch (err) {
      console.error('Error processing batch in queue:', err);
    }
  }

  isProcessing = false;
};
export const queuePOSTransactions = ({
  transactionsList,
  privateKey,
  updateTxListFunction,
}) => {
  messageQueue.push({transactionsList, privateKey, updateTxListFunction});
  if (messageQueue.length === 1) {
    processQueue();
  }
};

const setPOSTransactions = async ({
  transactionsList,
  privateKey,
  updateTxListFunction,
}) => {
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
    updateTxListFunction();
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
