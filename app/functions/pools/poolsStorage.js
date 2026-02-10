import * as SQLite from 'expo-sqlite';

export const CACHED_POOLS = 'SAVED_POOLS';
const CACHED_POOLS_TABLE = 'poolsTable';

let sqlLiteDB = null;
let isInitialized = false;
let initPromise = null;

async function openDBConnection() {
  if (!initPromise) {
    initPromise = (async () => {
      console.log('Opening pools database connection...');
      sqlLiteDB = await SQLite.openDatabaseAsync(`${CACHED_POOLS}.db`);
      console.log('Pools database connection opened');
      return sqlLiteDB;
    })();
  }
  return initPromise;
}

export const isPoolDatabaseOpen = () => {
  return isInitialized;
};

const ensurePoolDatabaseReady = async () => {
  if (!sqlLiteDB) {
    await openDBConnection();
  }
  return sqlLiteDB;
};

const getDatabase = async () => {
  try {
    await ensurePoolDatabaseReady();

    if (!isInitialized) {
      await initPoolDb();
    }

    return sqlLiteDB;
  } catch (error) {
    console.error('getDatabase error (pools):', error);
    throw new Error(`Failed to get pools database: ${error.message}`);
  }
};

export const initPoolDb = async () => {
  try {
    console.log('Initializing pools database...');

    await ensurePoolDatabaseReady();

    await sqlLiteDB.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ${CACHED_POOLS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        createdBy TEXT NOT NULL,
        storageObject TEXT NOT NULL,
        lastUpdated INTEGER NOT NULL
      );
    `);

    try {
      await sqlLiteDB.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_pool_uuid ON ${CACHED_POOLS_TABLE}(uuid);
        CREATE INDEX IF NOT EXISTS idx_pool_lastUpdated ON ${CACHED_POOLS_TABLE}(lastUpdated);
      `);
    } catch (indexError) {
      console.warn('Pool index creation warning (can be ignored):', indexError);
    }

    isInitialized = true;
    console.log('Pools database initialized successfully');
    return true;
  } catch (err) {
    console.error('initPoolDb error:', err);
    isInitialized = false;
    return false;
  }
};

export const savePoolLocal = async poolObj => {
  try {
    if (!poolObj?.poolId) {
      throw new Error('Pool poolId is required');
    }
    if (!poolObj?.creatorUUID) {
      throw new Error('Pool creatorUUID is required');
    }

    const db = await getDatabase();

    if (!db) {
      throw new Error('Database connection is not available');
    }

    let existing = null;
    try {
      existing = await db.getFirstAsync(
        `SELECT * FROM ${CACHED_POOLS_TABLE} WHERE uuid = ?`,
        [poolObj.poolId],
      );
    } catch (queryError) {
      console.warn(
        'Query for existing pool failed, proceeding with insert:',
        queryError,
      );
    }

    const serialized = JSON.stringify(poolObj);
    const lastUpdated = poolObj.lastUpdated || Date.now();

    if (!existing) {
      console.log('Inserting new pool...');
      await db.runAsync(
        `INSERT INTO ${CACHED_POOLS_TABLE} (uuid, createdBy, storageObject, lastUpdated)
         VALUES (?, ?, ?, ?)`,
        [poolObj.poolId, poolObj.creatorUUID, serialized, lastUpdated],
      );
    } else {
      console.log('Updating existing pool...');
      await db.runAsync(
        `UPDATE ${CACHED_POOLS_TABLE}
         SET storageObject = ?, lastUpdated = ?, createdBy = ?
         WHERE uuid = ?`,
        [serialized, lastUpdated, poolObj.creatorUUID, poolObj.poolId],
      );
    }

    console.log('Pool saved locally:', poolObj.poolId);
    return true;
  } catch (err) {
    console.error('savePoolLocal error:', err);
    throw new Error(`Unable to save pool locally: ${err.message}`);
  }
};

export const deletePoolLocal = async poolId => {
  try {
    if (!poolId) {
      throw new Error('No poolId provided for deletion');
    }

    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM ${CACHED_POOLS_TABLE} WHERE uuid = ?`,
      [poolId],
    );

    console.log(`Deleted ${result.changes} pool(s) with ID: ${poolId}`);
    return result.changes > 0;
  } catch (err) {
    console.error('deletePoolLocal error:', err);
    throw new Error(`Unable to delete pool: ${err.message}`);
  }
};

export const getAllLocalPools = async () => {
  try {
    const db = await getDatabase();
    const result = await db.getAllAsync(
      `SELECT * FROM ${CACHED_POOLS_TABLE} ORDER BY lastUpdated DESC`,
    );

    console.log(`Retrieved ${result.length} pools from database`);

    const pools = result
      .map(r => {
        try {
          return JSON.parse(r.storageObject);
        } catch (parseErr) {
          console.error(
            'Error parsing pool object:',
            parseErr,
            'Raw data:',
            r.storageObject,
          );
          return null;
        }
      })
      .filter(pool => pool !== null);

    return pools;
  } catch (err) {
    console.error('getAllLocalPools error:', err);
    return [];
  }
};

export const getPoolByUuid = async poolId => {
  try {
    if (!poolId) {
      console.error('No poolId provided for query');
      return null;
    }

    const db = await getDatabase();
    const result = await db.getFirstAsync(
      `SELECT * FROM ${CACHED_POOLS_TABLE} WHERE uuid = ?`,
      [poolId],
    );

    if (!result) {
      console.log(`No pool found with ID: ${poolId}`);
      return null;
    }

    try {
      return JSON.parse(result.storageObject);
    } catch (parseErr) {
      console.error('Error parsing pool object:', parseErr);
      return null;
    }
  } catch (err) {
    console.error('getPoolByUuid error:', err);
    return null;
  }
};

export const updatePoolLocal = async (poolId, updatedFields) => {
  try {
    if (!poolId) {
      throw new Error('Pool poolId is required');
    }

    const db = await getDatabase();

    if (!db) {
      throw new Error('Database connection is not available');
    }

    const existing = await db.getFirstAsync(
      `SELECT * FROM ${CACHED_POOLS_TABLE} WHERE uuid = ?`,
      [poolId],
    );

    if (!existing) {
      throw new Error(`Pool with ID ${poolId} not found`);
    }

    let existingPool;
    try {
      existingPool = JSON.parse(existing.storageObject);
    } catch (parseErr) {
      throw new Error('Failed to parse existing pool data');
    }

    const updatedPool = {
      ...existingPool,
      ...updatedFields,
      poolId,
      lastUpdated: Date.now(),
    };

    const serialized = JSON.stringify(updatedPool);

    const result = await db.runAsync(
      `UPDATE ${CACHED_POOLS_TABLE}
       SET storageObject = ?, lastUpdated = ?, createdBy = ?
       WHERE uuid = ?`,
      [serialized, updatedPool.lastUpdated, updatedPool.creatorUUID, poolId],
    );

    if (result.changes === 0) {
      throw new Error('Pool update failed - no rows affected');
    }

    console.log('Pool updated successfully:', poolId);
    return updatedPool;
  } catch (err) {
    console.error('updatePoolLocal error:', err);
    throw new Error(`Unable to update pool: ${err.message}`);
  }
};

export const deletePoolTable = async () => {
  try {
    const db = await getDatabase();
    await db.runAsync(`DROP TABLE IF EXISTS ${CACHED_POOLS_TABLE};`);
    console.log(`Table ${CACHED_POOLS_TABLE} deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};
