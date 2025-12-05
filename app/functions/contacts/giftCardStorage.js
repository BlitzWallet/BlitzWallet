// giftCardStorage.js
import { openDatabaseAsync } from 'expo-sqlite';
import fetchBackend from '../../../db/handleBackend';

export const GIFT_CARDS_TABLE_NAME = 'giftCardsTable';
export const GIFT_CARD_UPDATE_EVENT_NAME = 'GIFT_CARD_UPDATED';

let giftCardDB;
let isInitialized = false;
let initPromise = null;

async function openGiftCardDB() {
  if (!initPromise) {
    initPromise = (async () => {
      giftCardDB = await openDatabaseAsync('giftCards.db');
      isInitialized = true;
      return giftCardDB;
    })();
  }
  return initPromise;
}

export const isGiftCardDatabaseOpen = () => {
  return isInitialized;
};

export const ensureGiftCardDatabaseReady = async () => {
  if (!isInitialized) {
    await openGiftCardDB();
  }
  return giftCardDB;
};

export const initializeGiftCardDatabase = async () => {
  try {
    await ensureGiftCardDatabaseReady();
    await giftCardDB.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ${GIFT_CARDS_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice TEXT NOT NULL UNIQUE,
        giftCardData TEXT NOT NULL,
        lastUpdated INTEGER NOT NULL,
        status TEXT NOT NULL
      );`);
    console.log('Gift card database initialized');
    return true;
  } catch (err) {
    console.log('Error initializing gift card database:', err);
    return false;
  }
};

export const getGiftCardData = async invoice => {
  try {
    await ensureGiftCardDatabaseReady();
    const result = await giftCardDB.getFirstAsync(
      `SELECT * FROM ${GIFT_CARDS_TABLE_NAME} WHERE invoice = ?;`,
      [invoice],
    );

    if (result) {
      return {
        ...JSON.parse(result.giftCardData),
        lastUpdated: result.lastUpdated,
        isCached: true,
      };
    }

    return null;
  } catch (err) {
    console.log('Error getting gift card data:', err);
    return null;
  }
};

export const saveGiftCardData = async (invoice, giftCardData) => {
  try {
    await ensureGiftCardDatabaseReady();
    const existingData = await giftCardDB.getFirstAsync(
      `SELECT id FROM ${GIFT_CARDS_TABLE_NAME} WHERE invoice = ?;`,
      [invoice],
    );

    const timestamp = Date.now();

    if (existingData) {
      // Update existing record
      await giftCardDB.runAsync(
        `UPDATE ${GIFT_CARDS_TABLE_NAME} 
         SET giftCardData = ?, lastUpdated = ?, status = ? 
         WHERE invoice = ?;`,
        [
          JSON.stringify(giftCardData),
          timestamp,
          giftCardData.status || 'Unknown',
          invoice,
        ],
      );
    } else {
      // Insert new record
      await giftCardDB.runAsync(
        `INSERT INTO ${GIFT_CARDS_TABLE_NAME} (invoice, giftCardData, lastUpdated, status)
         VALUES (?, ?, ?, ?);`,
        [
          invoice,
          JSON.stringify(giftCardData),
          timestamp,
          giftCardData.status || 'Unknown',
        ],
      );
    }

    return true;
  } catch (err) {
    console.log('Error saving gift card data:', err);
    return false;
  }
};

export const fetchAndCacheGiftCardData = async (
  invoice,
  contactsPrivateKey,
  publicKey,
) => {
  try {
    // Check if we already have recent data (less than 1 hour old)
    const cachedData = await getGiftCardData(invoice);

    console.log(cachedData);

    if (cachedData && cachedData.status === 'Completed') {
      // Return cached data if it's recent and completed
      return cachedData;
    }

    // Fetch fresh data from backend
    const postData = {
      type: 'giftCardStatus',
      invoice: invoice,
    };

    const response = await fetchBackend(
      'theBitcoinCompanyV3',
      postData,
      contactsPrivateKey,
      publicKey,
    );

    if (response.statusCode !== 200) throw new Error('backend fetch error');
    const data = response.result[0];
    if (data && typeof data === 'object') {
      // Save to database
      await saveGiftCardData(invoice, data);
      return data;
    }

    // If fetch failed, return cached data if available
    if (cachedData) {
      return cachedData;
    }

    return null;
  } catch (err) {
    console.log('Error fetching gift card data:', err);

    // Return cached data as fallback
    const cachedData = await getGiftCardData(invoice);
    if (cachedData) {
      return cachedData;
    }

    return null;
  }
};

export const getAllGiftCards = async () => {
  try {
    await ensureGiftCardDatabaseReady();
    const result = await giftCardDB.getAllAsync(
      `SELECT * FROM ${GIFT_CARDS_TABLE_NAME} ORDER BY lastUpdated DESC;`,
    );

    return result.map(row => ({
      invoice: row.invoice,
      ...JSON.parse(row.giftCardData),
      lastUpdated: row.lastUpdated,
      isCached: true,
    }));
  } catch (err) {
    console.log('Error getting all gift cards:', err);
    return [];
  }
};

export const deleteGiftCardData = async invoice => {
  try {
    await ensureGiftCardDatabaseReady();
    await giftCardDB.runAsync(
      `DELETE FROM ${GIFT_CARDS_TABLE_NAME} WHERE invoice = ?;`,
      [invoice],
    );

    return true;
  } catch (err) {
    console.log('Error deleting gift card data:', err);
    return false;
  }
};
