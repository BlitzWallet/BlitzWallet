import * as SQLite from 'expo-sqlite';

export const CACHED_GIFTS = 'SAVED_GIFTS';

let sqlLiteDB = null;
let isInitialized = false;
let initPromise = null;

async function openDBConnection() {
  if (!initPromise) {
    initPromise = (async () => {
      console.log('Opening database connection...');
      sqlLiteDB = await SQLite.openDatabaseAsync(`${CACHED_GIFTS}.db`);
      console.log('Database connection opened');
      return sqlLiteDB;
    })();
  }
  return initPromise;
}

export const isGiftDatabaseOpen = () => {
  return isInitialized;
};

const ensureGiftDatabaseReady = async () => {
  if (!sqlLiteDB) {
    await openDBConnection();
  }
  return sqlLiteDB;
};

const getDatabase = async () => {
  try {
    await ensureGiftDatabaseReady();

    // Initialize database if not already done
    if (!isInitialized) {
      await initGiftDb();
    }

    return sqlLiteDB;
  } catch (error) {
    console.error('getDatabase error:', error);
    throw new Error(`Failed to get database: ${error.message}`);
  }
};

export const initGiftDb = async () => {
  try {
    console.log('Initializing gift database...');

    await ensureGiftDatabaseReady();

    await sqlLiteDB.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS giftsTable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        createdBy TEXT NOT NULL,
        storageObject TEXT NOT NULL,
        lastUpdated INTEGER NOT NULL
      );
    `);

    try {
      await sqlLiteDB.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_uuid ON giftsTable(uuid);
        CREATE INDEX IF NOT EXISTS idx_lastUpdated ON giftsTable(lastUpdated);
      `);
    } catch (indexError) {
      console.warn('Index creation warning (can be ignored):', indexError);
    }

    isInitialized = true;
    console.log('Gift database initialized successfully');
    return true;
  } catch (err) {
    console.error('initGiftDb error:', err);
    isInitialized = false;
    return false;
  }
};

export const saveGiftLocal = async giftObj => {
  console.log('saveGiftLocal called with:', {
    uuid: giftObj?.uuid,
    createdBy: giftObj?.createdBy,
    hasStorageObject: !!giftObj?.storageObject,
  });

  try {
    if (!giftObj?.uuid) {
      throw new Error('Gift UUID is required');
    }
    if (!giftObj?.createdBy) {
      throw new Error('Gift createdBy is required');
    }

    const db = await getDatabase();

    // Validate database connection
    if (!db) {
      throw new Error('Database connection is not available');
    }

    // Check if gift already exists
    let existing = null;
    try {
      existing = await db.getFirstAsync(
        `SELECT * FROM giftsTable WHERE uuid = ?`,
        [giftObj.uuid],
      );
      console.log('Existing gift check:', existing ? 'found' : 'not found');
    } catch (queryError) {
      console.warn(
        'Query for existing gift failed, proceeding with insert:',
        queryError,
      );
    }

    const serialized = JSON.stringify(giftObj);
    const lastUpdated = giftObj.lastUpdated || Date.now();

    if (!existing) {
      // Insert new gift
      console.log('Inserting new gift...');
      const result = await db.runAsync(
        `INSERT INTO giftsTable (uuid, createdBy, storageObject, lastUpdated)
         VALUES (?, ?, ?, ?)`,
        [giftObj.uuid, giftObj.createdBy, serialized, lastUpdated],
      );
      console.log('Insert result:', result);
    } else {
      // Update existing gift
      console.log('Updating existing gift...');
      const result = await db.runAsync(
        `UPDATE giftsTable 
         SET storageObject = ?, lastUpdated = ?, createdBy = ?
         WHERE uuid = ?`,
        [serialized, lastUpdated, giftObj.createdBy, giftObj.uuid],
      );
      console.log('Update result:', result);
    }

    console.log('Gift saved successfully');
    return true;
  } catch (err) {
    console.error('saveGiftLocal error:', err);
    console.error('Error details:', {
      giftObj: giftObj
        ? {
            uuid: giftObj.uuid,
            createdBy: giftObj.createdBy,
            lastUpdated: giftObj.lastUpdated,
          }
        : 'null',
      errorMessage: err.message,
      errorStack: err.stack,
    });

    // Return the error so calling code can handle it
    throw new Error(`Unable to save gift locally: ${err.message}`);
  }
};

export const deleteGiftLocal = async uuid => {
  try {
    if (!uuid) {
      throw new Error('No UUID provided for deletion');
    }

    const db = await getDatabase();
    const result = await db.runAsync(`DELETE FROM giftsTable WHERE uuid = ?`, [
      uuid,
    ]);

    console.log(`Deleted ${result.changes} gift(s) with UUID: ${uuid}`);
    return result.changes > 0;
  } catch (err) {
    console.error('deleteGiftLocal error:', err);
    throw new Error(`Unable to delete gift: ${err.message}`);
  }
};

export const getAllLocalGifts = async () => {
  try {
    const db = await getDatabase();
    const result = await db.getAllAsync(
      `SELECT * FROM giftsTable ORDER BY lastUpdated DESC`,
    );

    console.log(`Retrieved ${result.length} gifts from database`);

    const gifts = result
      .map(r => {
        try {
          return JSON.parse(r.storageObject);
        } catch (parseErr) {
          console.error(
            'Error parsing gift object:',
            parseErr,
            'Raw data:',
            r.storageObject,
          );
          return null;
        }
      })
      .filter(gift => gift !== null);

    return gifts;
  } catch (err) {
    console.error('getAllLocalGifts error:', err);
    return [];
  }
};

export const getGiftByUuid = async uuid => {
  try {
    if (!uuid) {
      console.error('No UUID provided for query');
      return null;
    }

    const db = await getDatabase();
    const result = await db.getFirstAsync(
      `SELECT * FROM giftsTable WHERE uuid = ?`,
      [uuid],
    );

    if (!result) {
      console.log(`No gift found with UUID: ${uuid}`);
      return null;
    }

    try {
      return JSON.parse(result.storageObject);
    } catch (parseErr) {
      console.error('Error parsing gift object:', parseErr);
      return null;
    }
  } catch (err) {
    console.error('getGiftByUuid error:', err);
    return null;
  }
};

export const updateGiftLocal = async (uuid, updatedFields) => {
  console.log('updateGiftLocal called with:', {
    uuid,
    updatedFields: Object.keys(updatedFields || {}),
  });

  try {
    if (!uuid) {
      throw new Error('Gift UUID is required');
    }

    const db = await getDatabase();

    // Validate database connection
    if (!db) {
      throw new Error('Database connection is not available');
    }

    // Check if gift exists
    const existing = await db.getFirstAsync(
      `SELECT * FROM giftsTable WHERE uuid = ?`,
      [uuid],
    );

    if (!existing) {
      throw new Error(`Gift with UUID ${uuid} not found`);
    }

    // Parse existing gift and merge with updates
    let existingGift;
    try {
      existingGift = JSON.parse(existing.storageObject);
    } catch (parseErr) {
      throw new Error('Failed to parse existing gift data');
    }

    // Merge updated fields with existing gift
    const updatedGift = {
      ...existingGift,
      ...updatedFields,
      uuid, // Ensure UUID cannot be changed
      lastUpdated: Date.now(), // Always update timestamp
    };

    const serialized = JSON.stringify(updatedGift);

    // Update the gift
    console.log('Updating gift...');
    const result = await db.runAsync(
      `UPDATE giftsTable 
       SET storageObject = ?, lastUpdated = ?, createdBy = ?
       WHERE uuid = ?`,
      [serialized, updatedGift.lastUpdated, updatedGift.createdBy, uuid],
    );

    console.log('Update result:', result);

    if (result.changes === 0) {
      throw new Error('Gift update failed - no rows affected');
    }

    console.log('Gift updated successfully');
    return updatedGift;
  } catch (err) {
    console.error('updateGiftLocal error:', err);
    throw new Error(`Unable to update gift: ${err.message}`);
  }
};

export const deleteGiftsTable = async () => {
  try {
    const db = await getDatabase();
    await db.runAsync(`DROP TABLE IF EXISTS giftsTable;`);
    console.log(`Table giftsTable deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};
