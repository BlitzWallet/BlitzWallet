import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import { getTwoWeeksAgoDate } from '../rotateAddressDateChecker';
import EventEmitter from 'events';
import { handleEventEmitterPost } from '../handleEventEmitters';
import { openDatabaseAsync } from 'expo-sqlite';
import i18next from 'i18next';
import {
  addBulkUnpaidSparkContactTransactions,
  bulkUpdateSparkTransactions,
  deleteBulkSparkContactTransactions,
  getAllSparkContactInvoices,
  getBulkSparkTransactions,
} from '../spark/transactions';
export const CACHED_MESSAGES_KEY = 'CASHED_CONTACTS_MESSAGES';
export const SQL_TABLE_NAME = 'messagesTable';
export const LOCALSTORAGE_LAST_RECEIVED_TIME_KEY =
  'LAST_RECEIVED_CONTACT_MESSAGE';
export const CONTACTS_TRANSACTION_UPDATE_NAME = 'RECEIVED_CONTACTS EVENT';
export const contactsSQLEventEmitter = new EventEmitter();

let sqlLiteDB;
let messageQueue = [];
let isProcessing = false;
let isInitialized = false;
let initPromise = null;

async function openDBConnection() {
  if (!initPromise) {
    initPromise = (async () => {
      sqlLiteDB = await openDatabaseAsync(`${CACHED_MESSAGES_KEY}.db`);
      isInitialized = true;
      return sqlLiteDB;
    })();
  }
  return initPromise;
}

export const isMessagesDatabaseOpen = () => {
  return isInitialized;
};

export const ensureDatabaseReady = async () => {
  if (!isInitialized) {
    await openDBConnection();
  }
  return sqlLiteDB;
};

export const initializeDatabase = async () => {
  try {
    await ensureDatabaseReady();
    await sqlLiteDB.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ${SQL_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contactPubKey TEXT NOT NULL,
        message TEXT NOT NULL,
        messageUUID TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );`);
    console.log('didOPEN');
    return true;
  } catch (err) {
    console.log('error opening messages database', err);
    return false;
  }
};

export const getCachedMessages = async () => {
  try {
    await ensureDatabaseReady();
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${SQL_TABLE_NAME} ORDER BY timestamp ASC;`,
    );
    let returnObj = {};
    let newestTimestap = 0;
    for (const doc of result) {
      let savingKey = doc.contactPubKey;
      const parsedMessage = JSON.parse(doc.message);
      if (doc.timestamp > newestTimestap) {
        newestTimestap = doc.timestamp;
      }
      const hasSavedConvorsation = returnObj[savingKey];
      if (!hasSavedConvorsation) {
        returnObj[savingKey] = {
          messages: [parsedMessage],
          lastUpdated: doc.timestamp,
        };
      } else {
        returnObj[savingKey] = {
          messages: [parsedMessage].concat(returnObj[savingKey].messages),
          lastUpdated: doc.timestamp,
        };
      }
    }

    const retrivedLocalStorageItem = await getLocalStorageItem(
      LOCALSTORAGE_LAST_RECEIVED_TIME_KEY,
    );
    const savedNewestTime = JSON.parse(retrivedLocalStorageItem) || 0;
    const convertedTime = newestTimestap || getTwoWeeksAgoDate();

    console.log(
      'timestapms in get contacts cached messsages(savedTime, convertedTime)',
      savedNewestTime,
      convertedTime,
    );
    if (savedNewestTime < convertedTime) {
      newestTimestap = convertedTime;
    } else newestTimestap = savedNewestTime;
    return { ...returnObj, lastMessageTimestamp: newestTimestap };
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
    const { newMessagesList, myPubKey } = messageQueue.shift();
    try {
      await Promise.all([
        addUnpaidContactTransactions({ newMessagesList, myPubKey }),
        setCashedMessages({
          newMessagesList,
          myPubKey,
        }),
      ]);
    } catch (err) {
      console.error('Error processing batch in queue:', err);
    }
  }

  isProcessing = false;
};
export const queueSetCashedMessages = ({ newMessagesList, myPubKey }) => {
  messageQueue.push({
    newMessagesList,
    myPubKey,
  });
  if (messageQueue.length === 1) {
    processQueue();
  }
};

const addUnpaidContactTransactions = async ({ newMessagesList, myPubKey }) => {
  let newTransactions = [];
  let txsToUpdate = [];

  const txids = [
    ...new Set(
      newMessagesList
        .filter(m => m.isReceived && m.message?.txid)
        .map(m => m.message.txid),
    ),
  ];

  const existingTxMap = await getBulkSparkTransactions(txids);

  for (const message of newMessagesList) {
    const parsedMessage = message.message;
    if (!message.isReceived || !parsedMessage?.txid) continue;

    const savedTX = existingTxMap.get(parsedMessage.txid);

    if (savedTX) {
      console.log(
        'Transaction already exists, updating with contact details:',
        parsedMessage.txid,
      );
      const priorDetails = savedTX.details ? JSON.parse(savedTX.details) : {};

      txsToUpdate.push({
        id: parsedMessage.txid,
        paymentStatus: savedTX.paymentStatus,
        paymentType: savedTX.paymentType,
        accountId: savedTX.accountId,
        details: {
          ...priorDetails,
          description:
            parsedMessage.description ||
            i18next.t('contacts.sendAndRequestPage.contactMessage', {
              name: parsedMessage?.name || '',
            }),
          sendingUUID: message.sendersPubkey,
          isBlitzContactPayment: true,
        },
      });
    } else {
      console.log('New unpaid transaction, adding:', parsedMessage.txid);
      newTransactions.push({
        id: parsedMessage.txid,
        description:
          parsedMessage.description ||
          i18next.t('contacts.sendAndRequestPage.contactMessage', {
            name: parsedMessage?.name || '',
          }),
        sendersPubkey: message.sendersPubkey,
        details: '',
      });
    }
  }

  if (newTransactions.length > 0) {
    await addBulkUnpaidSparkContactTransactions(newTransactions);
    handleEventEmitterPost(
      contactsSQLEventEmitter,
      CONTACTS_TRANSACTION_UPDATE_NAME,
      'hanleContactRace',
    );
  }

  if (txsToUpdate.length > 0) {
    await bulkUpdateSparkTransactions(
      txsToUpdate,
      'contactDetailsUpdate',
      0,
      0,
      true,
    );
  }
};

const setCashedMessages = async ({ newMessagesList, myPubKey }) => {
  const BATCH_SIZE = 25;
  try {
    await ensureDatabaseReady();
    for (let i = 0; i < newMessagesList.length; i += BATCH_SIZE) {
      const batch = newMessagesList.slice(i, i + BATCH_SIZE);

      await sqlLiteDB.execAsync('BEGIN TRANSACTION;');

      for (const newMessage of batch) {
        try {
          const hasSavedMessage = await sqlLiteDB.getFirstAsync(
            `SELECT * FROM ${SQL_TABLE_NAME} WHERE messageUUID = $newMessageUUID;`,
            { $newMessageUUID: newMessage.message.uuid },
          );

          const parsedMessage = !!hasSavedMessage
            ? JSON.parse(hasSavedMessage.message)
            : null;

          const addedProperties =
            newMessage.toPubKey === myPubKey
              ? { wasSeen: false, didSend: false }
              : { wasSeen: true, didSend: true };

          const contactsPubKey =
            newMessage.toPubKey === myPubKey
              ? newMessage.fromPubKey
              : newMessage.toPubKey;

          const timestamp = newMessage.timestamp;
          // typeof newMessage.serverTimestamp === 'object' ||
          // !newMessage.serverTimestamp
          //   ? newMessage.timestamp
          //   : newMessage.serverTimestamp;

          if (!parsedMessage) {
            const insertedMessage = {
              ...newMessage,
              message: { ...newMessage.message, ...addedProperties },
            };
            await sqlLiteDB.runAsync(
              `INSERT INTO ${SQL_TABLE_NAME} (contactPubKey, message, messageUUID, timestamp)
              VALUES (?, ?, ?, ?);`,
              [
                contactsPubKey,
                JSON.stringify(insertedMessage),
                newMessage.message.uuid,
                timestamp,
              ],
            );
          } else {
            const updatedMessage = {
              ...parsedMessage,
              message: {
                ...parsedMessage.message,
                ...newMessage.message,
              },
              timestamp: timestamp,
            };

            await sqlLiteDB.runAsync(
              `UPDATE ${SQL_TABLE_NAME} 
               SET message = ?, timestamp = ? 
               WHERE messageUUID = ?;`,
              [
                JSON.stringify(updatedMessage),
                timestamp,
                parsedMessage.message.uuid,
              ],
            );
          }
        } catch (innerErr) {
          console.error(
            'Error inserting/updating message:',
            newMessage.timestamp,
            innerErr,
          );
        }
      }

      await sqlLiteDB.execAsync('COMMIT;');
    }

    console.log('All message batches processed successfully');
    return true;
  } catch (err) {
    await sqlLiteDB.execAsync('ROLLBACK;');
    console.error('Fatal error in setCashedMessages:', err);
    return false;
  } finally {
    if (newMessagesList?.length) {
      const newTimestamp = newMessagesList.sort(
        (a, b) => b.timestamp - a.timestamp,
      )[0].timestamp;
      await setLocalStorageItem(
        LOCALSTORAGE_LAST_RECEIVED_TIME_KEY,
        JSON.stringify(newTimestamp),
      );
    }
    handleEventEmitterPost(
      contactsSQLEventEmitter,
      CONTACTS_TRANSACTION_UPDATE_NAME,
      'addedMessage',
    );
  }
};

export const deleteCachedMessages = async contactPubKey => {
  try {
    await ensureDatabaseReady();
    await sqlLiteDB.runAsync(
      `DELETE FROM ${SQL_TABLE_NAME} WHERE contactPubKey = ?;`,
      [contactPubKey],
    );

    console.log(`Deleted all messages for contactPubKey: ${contactPubKey}`);
    handleEventEmitterPost(
      contactsSQLEventEmitter,
      CONTACTS_TRANSACTION_UPDATE_NAME,
      'deleatedMessage',
    );

    return true;
  } catch (error) {
    console.error('Error deleting messages:', error);
    return false;
  }
};
export const deleteTable = async () => {
  try {
    await ensureDatabaseReady();
    await sqlLiteDB.runAsync(`DROP TABLE IF EXISTS ${SQL_TABLE_NAME};`);
    console.log(`Table ${SQL_TABLE_NAME} deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};

// Store active retry timers and state to prevent concurrent executions
const activeRetryTimers = new Map();

export const retryUnpaidContactTransactionsWithBackoff = async (
  attempt = 0,
  maxAttempts = 2,
) => {
  const retryKey = 'contactRaceRetry';

  try {
    // Get all unpaid contact transactions
    const unpaidTransactions = await getAllSparkContactInvoices();

    if (!unpaidTransactions || unpaidTransactions.length === 0) {
      console.log('No unpaid contact transactions to check');
      activeRetryTimers.delete(retryKey);

      return;
    }

    console.log(
      `Checking ${
        unpaidTransactions.length
      } unpaid contact transactions (attempt ${attempt + 1}/${maxAttempts})`,
    );

    const sparkIDs = unpaidTransactions.map(tx => tx.sparkID);
    const savedTxMap = await getBulkSparkTransactions(sparkIDs);

    const txsToUpdate = [];
    const txsStillPending = [];
    const txsToDelete = [];

    // Check each unpaid transaction
    for (const unpaidTx of unpaidTransactions) {
      const savedTX = savedTxMap.get(unpaidTx.sparkID);
      if (savedTX) {
        const priorDetails = JSON.parse(savedTX.details);
        // Transaction now exists - prepare update
        console.log(
          `Found transaction for unpaid contact: ${unpaidTx.sparkID}`,
          savedTX,
        );
        txsToUpdate.push({
          id: unpaidTx.sparkID,
          paymentStatus: savedTX.paymentStatus,
          paymentType: savedTX.paymentType,
          accountId: savedTX.accountId,
          details: {
            ...priorDetails,
            description: unpaidTx.description,
            sendingUUID: unpaidTx.sendersPubkey,
            isBlitzContactPayment: true,
          },
        });

        // Delete from unpaid table since we're updating the main transaction
        txsToDelete.push(unpaidTx.sparkID);
      } else {
        txsStillPending.push(unpaidTx.sparkID);
      }
    }

    // Delete from unpaid table
    if (txsToDelete.length > 0) {
      console.log(txsToDelete, 'transactions to delete');
      await deleteBulkSparkContactTransactions(txsToDelete);
    }

    // Update transactions that were found
    if (txsToUpdate.length > 0) {
      console.log(
        `Updating ${txsToUpdate.length} transactions with contact details`,
      );
      await bulkUpdateSparkTransactions(
        txsToUpdate,
        'contactDetailsUpdate',
        0,
        0,
        true,
      );
    }

    // If there are still pending transactions and we haven't exceeded max attempts, retry
    if (txsStillPending.length > 0 && attempt < maxAttempts - 1) {
      const delay = 500 * Math.pow(2, attempt); // 500ms, 1s,
      console.log(
        `${txsStillPending.length} transactions still pending, retrying in ${delay}ms`,
      );

      const timeoutId = setTimeout(() => {
        retryUnpaidContactTransactionsWithBackoff(attempt + 1, maxAttempts);
      }, delay);

      activeRetryTimers.set(retryKey, timeoutId);
    } else {
      if (txsStillPending.length > 0) {
        console.log(
          `Max retry attempts reached. ${txsStillPending.length} transactions remain unpaid`,
        );
      } else {
        console.log('All unpaid contact transactions resolved');
      }
      activeRetryTimers.delete(retryKey);
    }
  } catch (err) {
    console.error('Error in retry unpaid contact transactions:', err);
    activeRetryTimers.delete(retryKey);
  }
};

export const startContactPaymentMatchRetrySequance = () => {
  // Clear any existing retry timers
  clearContactRaceRetryTimers();

  // Start new retry sequence
  console.log('Starting new exponential backoff retry sequence');

  retryUnpaidContactTransactionsWithBackoff();
};

export const clearContactRaceRetryTimers = () => {
  for (const [key, timeoutId] of activeRetryTimers) {
    clearTimeout(timeoutId);
    console.log(`Cleared contact retry timer: ${key}`);
  }
  activeRetryTimers.clear();
};
