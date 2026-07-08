import * as SQLite from 'expo-sqlite';

export const LEAVES_DATABASE = 'WALLET_LEAVES';
const LEAVES_TABLE = 'wallet_leaves';

// Leaves below this value cannot be unilaterally exited economically (fees
// exceed value). Mirrors the Spark unilateral-exit minimum.
export const EXIT_MIN_SATS = 16348;

// How many leaves we map/serialize/insert (and later read/parse) per slice.
// getLeaves() can return thousands of entries, each carrying several hex tx
// blobs, so every CPU-bound stage is chunked and yields between slices to keep
// the JS thread free for frames/gestures.
const BATCH_SIZE = 100;

let sqlLiteDB = null;
let initPromise = null;
let isInitialized = false;

async function openDBConnection() {
  if (!initPromise) {
    initPromise = (async () => {
      sqlLiteDB = await SQLite.openDatabaseAsync(`${LEAVES_DATABASE}.db`);
      return sqlLiteDB;
    })();
  }
  return initPromise;
}

async function ensureLeavesDatabaseReady() {
  if (!sqlLiteDB) {
    await openDBConnection();
  }
  return sqlLiteDB;
}

async function getDatabase() {
  await ensureLeavesDatabaseReady();
  if (!isInitialized) {
    await initLeavesDb();
  }
  return sqlLiteDB;
}

// Releases the JS thread so the UI can render between heavy slices.
const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Initializes the leaves SQLite table.
 * @returns {Promise<boolean>}
 */
export async function initLeavesDb() {
  try {
    await ensureLeavesDatabaseReady();

    await sqlLiteDB.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS ${LEAVES_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        treeId TEXT NOT NULL,
        value INTEGER NOT NULL,
        status TEXT NOT NULL,
        parentNodeId TEXT,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_leaves_tree ON ${LEAVES_TABLE}(treeId);
    `);

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('initLeavesDb error:', error);
    isInitialized = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Normalization: raw SDK TreeNode -> JSON-serializable, all bytes hex-encoded.
// Every field returned by getLeaves() is public (public keys, FROST public
// shares, and Bitcoin transactions that pay back to the owner), so nothing here
// is encrypted. We keep the FULL leaf (including the directTx variants the
// SDK's WalletLeaf DTO drops) so the export is a complete unilateral-exit copy.
// ---------------------------------------------------------------------------

// Accepts a Uint8Array, a plain number[], or the {"0":n,"1":n,...} object form
// that a JSON round-trip produces, and returns a lowercase hex string.
function bytesToHex(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value; // already hex (webview path)
  if (value instanceof Uint8Array || Array.isArray(value)) {
    return Buffer.from(value).toString('hex');
  }
  if (typeof value === 'object') {
    return Buffer.from(Object.values(value)).toString('hex');
  }
  return null;
}

const TX_FIELDS = [
  'nodeTx',
  'refundTx',
  'directTx',
  'directRefundTx',
  'directFromCpfpRefundTx',
];
const PUBKEY_FIELDS = [
  'verifyingPublicKey',
  'ownerIdentityPublicKey',
  'ownerSigningPublicKey',
];

function normalizeSigningKeyshare(keyshare) {
  if (!keyshare || typeof keyshare !== 'object') return keyshare ?? null;
  const publicShares = {};
  if (keyshare.publicShares && typeof keyshare.publicShares === 'object') {
    for (const [id, share] of Object.entries(keyshare.publicShares)) {
      publicShares[id] = bytesToHex(share);
    }
  }
  return {
    ownerIdentifiers: keyshare.ownerIdentifiers ?? [],
    threshold: keyshare.threshold ?? null,
    publicKey: bytesToHex(keyshare.publicKey),
    publicShares,
  };
}

// Returns the fully hex-encoded leaf (safe to JSON.stringify) for one raw node.
export function normalizeLeaf(raw) {
  const normalized = {
    id: raw.id,
    treeId: raw.treeId,
    value: Number(raw.value || 0),
    status: raw.status ?? 'UNKNOWN',
    parentNodeId: raw.parentNodeId ?? null,
    vout: raw.vout ?? 0,
    network: raw.network ?? null,
    createdTime: raw.createdTime ?? null,
    updatedTime: raw.updatedTime ?? null,
    treenodeStatus: raw.treenodeStatus ?? null,
    signingKeyshare: normalizeSigningKeyshare(raw.signingKeyshare),
  };
  for (const field of TX_FIELDS) {
    if (raw[field] != null) normalized[field] = bytesToHex(raw[field]);
  }
  for (const field of PUBKEY_FIELDS) {
    if (raw[field] != null) normalized[field] = bytesToHex(raw[field]);
  }
  return normalized;
}

/**
 * Replaces the entire leaves store with a fresh snapshot. Processes in batches,
 * yielding between them, so a large leaf set never blocks the JS thread.
 * @param {Array<object>} rawTreeNodes leaves as returned by getSparkLeaves
 * @returns {Promise<number>} number of leaves stored
 */
export async function replaceAllLeaves(rawTreeNodes) {
  const db = await getDatabase();
  const leaves = Array.isArray(rawTreeNodes) ? rawTreeNodes : [];
  const now = Date.now();

  await db.execAsync(`DELETE FROM ${LEAVES_TABLE};`);

  let stored = 0;
  for (let i = 0; i < leaves.length; i += BATCH_SIZE) {
    const batch = leaves.slice(i, i + BATCH_SIZE);

    await db.execAsync('BEGIN TRANSACTION;');
    try {
      for (const raw of batch) {
        if (!raw?.id) continue;
        const normalized = normalizeLeaf(raw);
        await db.runAsync(
          `INSERT INTO ${LEAVES_TABLE}
             (id, treeId, value, status, parentNodeId, data, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             treeId = excluded.treeId,
             value = excluded.value,
             status = excluded.status,
             parentNodeId = excluded.parentNodeId,
             data = excluded.data,
             updatedAt = excluded.updatedAt`,
          [
            normalized.id,
            normalized.treeId,
            normalized.value,
            normalized.status,
            normalized.parentNodeId,
            JSON.stringify(normalized),
            now,
          ],
        );
        stored++;
      }
      await db.execAsync('COMMIT;');
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      console.error('replaceAllLeaves batch error:', err);
    }

    await yieldToEventLoop();
  }

  return stored;
}

/**
 * Per-tree aggregates for the collapsed view. O(#trees), computed in SQL so the
 * JS side never iterates the full leaf array.
 * @returns {Promise<Array<{treeId, leafCount, totalValue, exitEligibleCount}>>}
 */
export async function getTreeSummaries() {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT treeId,
            COUNT(*) AS leafCount,
            COALESCE(SUM(value), 0) AS totalValue,
            COALESCE(SUM(CASE WHEN value >= ? THEN 1 ELSE 0 END), 0) AS exitEligibleCount
     FROM ${LEAVES_TABLE}
     GROUP BY treeId
     ORDER BY totalValue DESC`,
    [EXIT_MIN_SATS],
  );
  return rows.map(row => ({
    treeId: String(row.treeId),
    leafCount: Number(row.leafCount || 0),
    totalValue: Number(row.totalValue || 0),
    exitEligibleCount: Number(row.exitEligibleCount || 0),
  }));
}

/**
 * Clear-column leaf rows for one tree, paginated. Never reads/parses `data`.
 * @returns {Promise<Array<{id, value, status, parentNodeId}>>}
 */
export async function getLeavesForTree(treeId, limit = 100, offset = 0) {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT id, value, status, parentNodeId
     FROM ${LEAVES_TABLE}
     WHERE treeId = ?
     ORDER BY value DESC
     LIMIT ? OFFSET ?`,
    [treeId, limit, offset],
  );
  return rows.map(row => ({
    id: String(row.id),
    value: Number(row.value || 0),
    status: String(row.status || 'UNKNOWN'),
    parentNodeId: row.parentNodeId ?? null,
  }));
}

/**
 * Header totals in a single query.
 * @returns {Promise<{totalLeaves, totalValue, exitEligible, treeCount, lastSyncedAt}>}
 */
export async function getGlobalLeafStats() {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS totalLeaves,
            COALESCE(SUM(value), 0) AS totalValue,
            COALESCE(SUM(CASE WHEN value >= ? THEN 1 ELSE 0 END), 0) AS exitEligible,
            COUNT(DISTINCT treeId) AS treeCount,
            COALESCE(MAX(updatedAt), 0) AS lastSyncedAt
     FROM ${LEAVES_TABLE}`,
    [EXIT_MIN_SATS],
  );
  return {
    totalLeaves: Number(row?.totalLeaves || 0),
    totalValue: Number(row?.totalValue || 0),
    exitEligible: Number(row?.exitEligible || 0),
    treeCount: Number(row?.treeCount || 0),
    lastSyncedAt: Number(row?.lastSyncedAt || 0),
  };
}

/**
 * Streams the full stored leaves for export, one batch at a time. Parses and
 * hands each batch to `onBatch`, yielding between slices, so the whole decoded
 * set is never materialized at once.
 * @param {(leaves: object[]) => (void|Promise<void>)} onBatch
 */
export async function getAllLeavesStream(onBatch) {
  const db = await getDatabase();
  let offset = 0;
  while (true) {
    const rows = await db.getAllAsync(
      `SELECT data FROM ${LEAVES_TABLE} ORDER BY treeId, id LIMIT ? OFFSET ?`,
      [BATCH_SIZE, offset],
    );
    if (!rows.length) break;

    const parsed = [];
    for (const row of rows) {
      try {
        parsed.push(JSON.parse(row.data));
      } catch (err) {
        console.log('getAllLeavesStream parse error', err);
      }
    }
    await onBatch(parsed);

    offset += rows.length;
    if (rows.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
}

/**
 * Teardown for wallet delete.
 * @returns {Promise<boolean>}
 */
export async function deleteLeavesTable() {
  try {
    const db = await getDatabase();
    await db.execAsync(`DROP TABLE IF EXISTS ${LEAVES_TABLE};`);
    isInitialized = false;
    return true;
  } catch (err) {
    console.error('deleteLeavesTable error:', err);
    return false;
  }
}
