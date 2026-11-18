import { openDatabaseAsync } from 'expo-sqlite';
import i18next from 'i18next';

export class ExitDowngradeError extends Error {}
export class ExitCorruptError extends Error {}

let dbPromise = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync('unilateralExit.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS exit_record (
          identity TEXT PRIMARY KEY,
          json TEXT,
          revision INTEGER,
          updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS exit_archive (
          identity TEXT,
          finished_at INTEGER,
          json TEXT
        );
        CREATE TABLE IF NOT EXISTS exit_recoveries (
          id TEXT PRIMARY KEY,
          identity TEXT,
          json TEXT,
          updated_at INTEGER
        );`);
      return db;
    })();
    // A failed open must be retryable, not cached forever.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function parseRow(row, identity) {
  try {
    const record = JSON.parse(row.json);
    if (record?.v !== 1 || record.identity !== identity) return null;
    return record;
  } catch {
    return null;
  }
}

const readRow = (db, identity) =>
  db.getFirstAsync(
    'SELECT json, revision FROM exit_record WHERE identity = ?',
    [identity],
  );

export async function loadExitRecord(identity) {
  const row = await readRow(await getDB(), identity);
  if (!row) return { record: null, corrupt: false };
  const record = parseRow(row, identity);
  return { record, corrupt: record === null };
}

export async function saveExitRecord(
  identity,
  record,
  { replaceCorrupt } = {},
) {
  const db = await getDB();
  const row = await readRow(db, identity);
  let revision = 0;
  if (row) {
    const stored = parseRow(row, identity);
    if (stored) {
      revision = stored.revision ?? 0;
      if (
        stored.recovery != null &&
        record.recovery == null &&
        record.status !== 'done'
      ) {
        throw new ExitDowngradeError(
          i18next.t('settings.unilateralExit.errStoreRecoveryDropped'),
        );
      }
    } else if (!replaceCorrupt) {
      throw new ExitCorruptError(
        i18next.t('settings.unilateralExit.errStoreCorrupt'),
      );
    } else {
      revision = row.revision ?? 0;
    }
  }
  const saved = { ...record, identity, v: 1, revision: revision + 1 };
  await db.runAsync(
    `INSERT INTO exit_record (identity, json, revision, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(identity) DO UPDATE SET
       json = excluded.json,
       revision = excluded.revision,
       updated_at = excluded.updated_at`,
    [identity, JSON.stringify(saved), saved.revision, Date.now()],
  );
  return saved;
}

export async function archiveExitRecord(identity) {
  const db = await getDB();
  const row = await readRow(db, identity);
  if (!row) return;
  await db.runAsync(
    'INSERT INTO exit_archive (identity, finished_at, json) VALUES (?, ?, ?)',
    [identity, Date.now(), row.json],
  );
  await db.runAsync('DELETE FROM exit_record WHERE identity = ?', [identity]);
}

// A live recover-mode record never blocks; an unreadable row still does.
export async function hasActiveExit(identity) {
  const row = await readRow(await getDB(), identity);
  if (!row) return false;
  return parseRow(row, identity)?.mode !== 'recover';
}

export async function listKeptRecoveries(identity) {
  const rows = await (
    await getDB()
  ).getAllAsync('SELECT json FROM exit_recoveries WHERE identity = ?', [
    identity,
  ]);
  return rows.map(row => parseRow(row, identity)).filter(Boolean);
}

export async function saveKeptRecovery(identity, record) {
  const saved = { ...record, identity, v: 1 };
  await (
    await getDB()
  ).runAsync(
    `INSERT INTO exit_recoveries (id, identity, json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       json = excluded.json,
       updated_at = excluded.updated_at`,
    [saved.id, identity, JSON.stringify(saved), Date.now()],
  );
  return saved;
}

export async function archiveKeptRecovery(identity, id) {
  const db = await getDB();
  const row = await db.getFirstAsync(
    'SELECT json FROM exit_recoveries WHERE id = ?',
    [id],
  );
  if (!row) return;
  await db.runAsync(
    'INSERT INTO exit_archive (identity, finished_at, json) VALUES (?, ?, ?)',
    [identity, Date.now(), row.json],
  );
  await db.runAsync('DELETE FROM exit_recoveries WHERE id = ?', [id]);
}

export async function clearInactiveExitData() {
  const db = await getDB();
  if (await db.getFirstAsync('SELECT 1 FROM exit_record LIMIT 1')) return;
  if (await db.getFirstAsync('SELECT 1 FROM exit_recoveries LIMIT 1')) return;
  await db.runAsync('DELETE FROM exit_record');
  await db.runAsync('DELETE FROM exit_archive');
}
