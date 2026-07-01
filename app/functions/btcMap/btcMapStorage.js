import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'btcmap.db';
const PLACES_TABLE = 'btcmap_places';
const META_TABLE = 'btcmap_meta';
const BATCH_SIZE = 250;

let db = null;
let initPromise = null;

async function openDB() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    db = await openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ${PLACES_TABLE} (
        id   INTEGER PRIMARY KEY,
        lat  REAL    NOT NULL,
        lon  REAL    NOT NULL,
        icon TEXT    DEFAULT '',
        name TEXT    DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_lat ON ${PLACES_TABLE}(lat);
      CREATE INDEX IF NOT EXISTS idx_lon ON ${PLACES_TABLE}(lon);
      CREATE INDEX IF NOT EXISTS idx_lat_lon ON ${PLACES_TABLE}(lat, lon);
      CREATE TABLE IF NOT EXISTS ${META_TABLE} (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Migrate existing installs that predate the `name` column.
    try {
      await db.execAsync(`ALTER TABLE ${PLACES_TABLE} ADD COLUMN name TEXT`);
    } catch (_) {
      // Column already exists — ignore "duplicate column name" error.
    }
    return db;
  })();
  initPromise.catch(() => {
    initPromise = null;
    db = null;
  });
  return initPromise;
}

export async function initBTCMapDB() {
  await openDB();
}

export async function getLastModified() {
  await openDB();
  const row = await db.getFirstAsync(
    `SELECT value FROM ${META_TABLE} WHERE key = 'last_modified'`,
  );
  return row ? row.value : null;
}

export async function setLastModified(timestamp) {
  await openDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES ('last_modified', ?)`,
    [timestamp],
  );
}

export async function getLastSyncTime() {
  await openDB();
  const row = await db.getFirstAsync(
    `SELECT value FROM ${META_TABLE} WHERE key = 'last_sync_time'`,
  );
  return row ? Number(row.value) : null;
}

export async function setLastSyncTime(ts) {
  await openDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES ('last_sync_time', ?)`,
    [String(ts)],
  );
}
export async function upsertPlaces(places) {
  if (!places.length) return;
  await openDB();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < places.length; i += BATCH_SIZE) {
      const batch = places.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?,?,?,?,?)').join(',');
      const values = batch.flatMap(p => [
        p.id,
        p.lat,
        p.lon,
        p.icon || '',
        p.name || '',
      ]);
      await db.runAsync(
        `INSERT OR REPLACE INTO ${PLACES_TABLE} (id, lat, lon, icon, name) VALUES ${placeholders}`,
        values,
      );
    }
  });
}

export async function needsToResyncMapsData() {
  try {
    await openDB();

    const row = await db.getFirstAsync(`
      SELECT EXISTS (
        SELECT 1
        FROM ${PLACES_TABLE}
        WHERE name IS NULL OR name = ''
      ) AS missing
    `);

    console.log(row); // inspect actual result shape
    return Boolean(row?.missing);
  } catch (err) {
    console.log(err);
    return false;
  }
}

export async function deletePlaces(ids) {
  if (!ids.length) return;
  await openDB();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      await db.runAsync(
        `DELETE FROM ${PLACES_TABLE} WHERE id IN (${placeholders})`,
        batch,
      );
    }
  });
}

export async function truncateAndInsertPlaces(places) {
  await openDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM ${PLACES_TABLE}`);
    for (let i = 0; i < places.length; i += BATCH_SIZE) {
      const batch = places.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?,?,?,?,?)').join(',');
      const values = batch.flatMap(p => [
        p.id,
        p.lat,
        p.lon,
        p.icon || '',
        p.name || '',
      ]);
      await db.runAsync(
        `INSERT INTO ${PLACES_TABLE} (id, lat, lon, icon, name) VALUES ${placeholders}`,
        values,
      );
    }
  });
}

export async function getPlacesInBbox(minLat, maxLat, minLon, maxLon) {
  await openDB();
  return db.getAllAsync(
    `SELECT id, lat, lon, icon, name FROM ${PLACES_TABLE}
     WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
    [minLat, maxLat, minLon, maxLon],
  );
}

export const deleteBtcMapTable = async () => {
  try {
    await openDB();
    await db.runAsync(`DROP TABLE IF EXISTS ${PLACES_TABLE};`);
    await db.runAsync(`DROP TABLE IF EXISTS ${META_TABLE};`);
    console.log(`btc map places and metadata deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  } finally {
    initPromise = null;
    db = null;
  }
};
