import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'btcmap.db';
const PLACES_TABLE = 'btcmap_places';
const PROVIDER_TABLE = 'provider_places';
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
      CREATE TABLE IF NOT EXISTS ${PROVIDER_TABLE} (
        source            TEXT NOT NULL,
        native_id         TEXT NOT NULL,
        lat               REAL NOT NULL,
        lon               REAL NOT NULL,
        icon              TEXT DEFAULT '',
        name              TEXT DEFAULT '',
        category          TEXT DEFAULT '',
        address           TEXT,
        website           TEXT,
        phone             TEXT,
        email             TEXT,
        lightning_address TEXT,
        PRIMARY KEY (source, native_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pp_lat_lon ON ${PROVIDER_TABLE}(lat, lon);
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

// Aux providers (Bitcoin Jungle, MoneyBadger) change slowly, so they sync on
// their own weekly cadence — separate from BTC Map's 4-hour last_sync_time.
export async function getProviderLastSyncTime() {
  await openDB();
  const row = await db.getFirstAsync(
    `SELECT value FROM ${META_TABLE} WHERE key = 'provider_last_sync_time'`,
  );
  return row ? Number(row.value) : null;
}

export async function setProviderLastSyncTime(ts) {
  await openDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES ('provider_last_sync_time', ?)`,
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

// --- Aux providers (Bitcoin Jungle, MoneyBadger) ---------------------------

// Full-replace a single source: called once (with `clear: true`) for the first
// batch of a provider's NDJSON, then appended to for subsequent batches.
export async function replaceProviderPlaces(source, rows, { clear } = {}) {
  await openDB();
  await db.withTransactionAsync(async () => {
    if (clear) {
      await db.runAsync(`DELETE FROM ${PROVIDER_TABLE} WHERE source = ?`, [
        source,
      ]);
    }
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const values = batch.flatMap(p => [
        source,
        String(p.native_id),
        p.lat,
        p.lon,
        p.icon || '',
        p.name || '',
        p.category || '',
        p.address ?? null,
        p.website ?? null,
        p.phone ?? null,
        p.email ?? null,
        p.lightning_address ?? null,
      ]);
      await db.runAsync(
        `INSERT OR REPLACE INTO ${PROVIDER_TABLE}
         (source, native_id, lat, lon, icon, name, category, address, website, phone, email, lightning_address)
         VALUES ${placeholders}`,
        values,
      );
    }
  });
}

export async function getProviderPlace(source, nativeId) {
  await openDB();
  return db.getFirstAsync(
    `SELECT * FROM ${PROVIDER_TABLE} WHERE source = ? AND native_id = ?`,
    [source, String(nativeId)],
  );
}

// Unioned viewport query. Both tables project to the same row shape
// {id, source, lat, lon, icon, name, category} so clustering/merge/list code is
// source-agnostic. `id` is the per-source native id (numeric for BTC Map, the
// stored native_id for aux) and doubles as the detail lookup key. BTC Map rows
// have no stored category (resolved from `icon` at render); aux rows carry a
// pre-resolved bucket in `category` and a blank `icon`.
export async function getAllPlacesInBbox(minLat, maxLat, minLon, maxLon) {
  await openDB();
  const [btc, aux] = await Promise.all([
    db.getAllAsync(
      `SELECT id, lat, lon, icon, name FROM ${PLACES_TABLE}
       WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
      [minLat, maxLat, minLon, maxLon],
    ),
    db.getAllAsync(
      `SELECT native_id AS id, source, lat, lon, icon, name, category FROM ${PROVIDER_TABLE}
       WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
      [minLat, maxLat, minLon, maxLon],
    ),
  ]);
  const btcRows = btc.map(p => ({
    id: p.id,
    source: 'btcmap',
    lat: p.lat,
    lon: p.lon,
    icon: p.icon,
    name: p.name,
    category: null,
  }));
  return btcRows.concat(aux);
}

export const deleteBtcMapTable = async () => {
  try {
    await openDB();
    await db.runAsync(`DROP TABLE IF EXISTS ${PLACES_TABLE};`);
    await db.runAsync(`DROP TABLE IF EXISTS ${PROVIDER_TABLE};`);
    await db.runAsync(`DROP TABLE IF EXISTS ${META_TABLE};`);
    console.log(`btc map places and metadata deleted successfully`);
  } catch (error) {
    console.error('Error deleting table:', error);
  } finally {
    initPromise = null;
    db = null;
  }
};
