import { openDatabaseAsync } from 'expo-sqlite';

export const ROOTSTOCK_DB_NAME = 'ROOTSTOCK_SWAPS';
export const ROOTSTOCK_TABLE_NAME = 'saved_rootstock_swaps';
let sqlLiteDB;

if (!sqlLiteDB) {
  async function openDBConnection() {
    sqlLiteDB = await openDatabaseAsync(`${ROOTSTOCK_DB_NAME}.db`);
  }
  openDBConnection();
}

export async function initRootstockSwapDB() {
  try {
    await sqlLiteDB.execAsync(`PRAGMA journal_mode = WAL;
       CREATE TABLE IF NOT EXISTS ${ROOTSTOCK_TABLE_NAME} (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT,
        data TEXT
          );`);
    console.log('opened rootstock swaps db');
    return true;
  } catch (err) {
    console.log('error opening roostock swaps db', err);
    return false;
  }
}

export const isRoostockDatabaseOpen = () => {
  return !!sqlLiteDB;
};

// Save swap as JSON string
export async function saveSwap(id, type, data) {
  try {
    await sqlLiteDB.runAsync(
      `INSERT OR REPLACE INTO ${ROOTSTOCK_TABLE_NAME} (id, type, data) VALUES (?, ?, ?)`,
      [id, type, JSON.stringify(data)],
    );
  } catch (err) {
    console.log('error saving rootstock swap', err);
  }
}

// Update swap with new details properties
export async function updateSwap(id, newDetails) {
  try {
    // First, get the existing swap data
    const existingSwap = await sqlLiteDB.getFirstAsync(
      `SELECT data FROM ${ROOTSTOCK_TABLE_NAME} WHERE id = ?`,
      [id],
    );

    if (!existingSwap) {
      throw new Error(`Swap with id ${id} not found`);
    }

    // Parse the existing data
    const existingData = JSON.parse(existingSwap.data);

    // Merge existing data with new details
    const updatedData = {
      ...existingData,
      ...newDetails,
    };

    // Update the record with merged data
    await sqlLiteDB.runAsync(
      `UPDATE ${ROOTSTOCK_TABLE_NAME} SET data = ? WHERE id = ?`,
      [JSON.stringify(updatedData), id],
    );

    console.log(`Swap ${id} updated successfully`);
    return updatedData;
  } catch (err) {
    console.log('error updating swap', err);
    throw err;
  }
}

// Load all swaps
export async function loadSwaps() {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${ROOTSTOCK_TABLE_NAME}`,
    );
    return result.map(swap => ({
      id: swap.id,
      type: swap.type,
      data: JSON.parse(swap.data),
    }));
  } catch (error) {
    console.error('Error fetching rootstock swaps:', error);
  }
}

// Load single swap by id
export async function getSwapById(id) {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${ROOTSTOCK_TABLE_NAME} WHERE id = ?`,
      [id],
    );
    return result.map(swap => ({
      id: swap.id,
      type: swap.type,
      data: JSON.parse(swap.data),
    }));
  } catch (error) {
    console.error('Error fetching single rootstock swaps:', error);
  }
}

/**
 * Delete a swap by its id
 * @param {string} id
 */
export async function deleteSwapById(id) {
  try {
    await sqlLiteDB.runAsync(
      `DELETE FROM ${ROOTSTOCK_TABLE_NAME} WHERE id = ?`,
      [id],
    );
    console.log(`Deleted swap with id: ${id}`);
    return true;
  } catch (err) {
    console.error(`Error deleting swap with id ${id}:`, err);
    return false;
  }
}
