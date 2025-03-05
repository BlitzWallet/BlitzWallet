import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
import * as SQLite from 'expo-sqlite';
import {getTwoWeeksAgoDate} from '../rotateAddressDateChecker';
import EventEmitter from 'events';
export const CACHED_MESSAGES_KEY = 'CASHED_CONTACTS_MESSAGES';
export const SQL_TABLE_NAME = 'messagesTable';
export const LOCALSTORAGE_LAST_RECEIVED_TIME_KEY =
  'LAST_RECEIVED_CONTACT_MESSAGE';
export const CONTACTS_TRANSACTION_UPDATE_NAME = 'RECEIVED_CONTACTS EVENT';
export const contactsSQLEventEmitter = new EventEmitter();

let sqlLiteDB;
let messageQueue = [];
let isProcessing = false;

if (!sqlLiteDB) {
  async function openDBConnection() {
    sqlLiteDB = await SQLite.openDatabaseAsync(`${CACHED_MESSAGES_KEY}.db`);
  }
  openDBConnection();
}
export const initializeDatabase = async () => {
  try {
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
    console.log(err);
    return false;
  }
};
export const getCachedMessages = async () => {
  try {
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
      'timestapms in get cached messsages(savedTime, convertedTime)',
      savedNewestTime,
      convertedTime,
    );
    if (savedNewestTime < convertedTime) {
      newestTimestap = convertedTime;
    } else newestTimestap = savedNewestTime;
    return {...returnObj, lastMessageTimestamp: newestTimestap};
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
    const {newMessagesList, myPubKey} = messageQueue.shift();
    try {
      await setCashedMessages({
        newMessagesList,
        myPubKey,
      });
    } catch (err) {
      console.error('Error processing batch in queue:', err);
    }
  }

  isProcessing = false;
};
export const queueSetCashedMessages = ({newMessagesList, myPubKey}) => {
  messageQueue.push({
    newMessagesList,
    myPubKey,
  });
  if (messageQueue.length === 1) {
    processQueue();
  }
};

const setCashedMessages = async ({newMessagesList, myPubKey}) => {
  try {
    // Start a database transaction for better performance
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');

    for (const newMessage of newMessagesList) {
      const hasSavedMessage = await sqlLiteDB.getFirstAsync(
        `SELECT * FROM ${SQL_TABLE_NAME} WHERE messageUUID = $newMessageUUID;`,
        {$newMessageUUID: newMessage.message.uuid},
      );

      const parsedMessage = !!hasSavedMessage
        ? JSON.parse(hasSavedMessage.message)
        : null;

      const addedProperties =
        newMessage.toPubKey === myPubKey
          ? {wasSeen: false, didSend: false}
          : {wasSeen: true, didSend: true};

      const contactsPubKey =
        newMessage.toPubKey === myPubKey
          ? newMessage.fromPubKey
          : newMessage.toPubKey;

      if (!parsedMessage) {
        // Insert new message if it doesn't exist
        const insertedMessage = {
          ...newMessage,
          message: {...newMessage.message, ...addedProperties},
        };
        await sqlLiteDB.runAsync(
          `INSERT INTO ${SQL_TABLE_NAME} (contactPubKey, message, messageUUID, timestamp)
          VALUES (?, ?, ?, ?);`,
          [
            contactsPubKey,
            JSON.stringify(insertedMessage),
            newMessage.message.uuid,
            newMessage.timestamp,
          ],
        );
        console.log('Message created:', insertedMessage);
      } else {
        const updatedMessage = {
          ...parsedMessage,
          message: {
            ...parsedMessage.message,
            ...newMessage.message,
          },
          timestamp: newMessage.timestamp,
        };

        await sqlLiteDB.runAsync(
          `UPDATE ${SQL_TABLE_NAME} 
           SET message = ?, timestamp = ? 
           WHERE messageUUID = ?;`,
          [
            JSON.stringify(updatedMessage),
            newMessage.timestamp,
            parsedMessage.message.uuid,
          ],
        );
        console.log('Message updated:', updatedMessage);
      }
    }

    // Commit the transaction after all operations
    await sqlLiteDB.execAsync('COMMIT;');
    console.log('Bulk messages processed successfully');
    return true;
  } catch (err) {
    // Rollback the transaction in case of an error
    await sqlLiteDB.execAsync('ROLLBACK;');
    console.error(err, 'set cached messages SQL error');
    return false;
  } finally {
    const newTimesatmp = newMessagesList.sort((a, b) => {
      return b.timestamp - a.timestamp;
    })[0].timestamp;
    console.log(newTimesatmp, 'TIME BEING SET IN SET FUNCTION ');
    await setLocalStorageItem(
      LOCALSTORAGE_LAST_RECEIVED_TIME_KEY,
      JSON.stringify(newTimesatmp),
    );
    contactsSQLEventEmitter.emit(
      CONTACTS_TRANSACTION_UPDATE_NAME,
      'addedMessage',
    );
  }
};

export const deleteCachedMessages = async contactPubKey => {
  try {
    await sqlLiteDB.runAsync(
      `DELETE FROM ${SQL_TABLE_NAME} WHERE contactPubKey = ?;`,
      [contactPubKey],
    );

    console.log(`Deleted all messages for contactPubKey: ${contactPubKey}`);
    contactsSQLEventEmitter.emit(
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
    await sqlLiteDB.runAsync(`DROP TABLE IF EXISTS ${SQL_TABLE_NAME};`);
    console.log(`Table ${SQL_TABLE_NAME} deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};
