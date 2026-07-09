import * as SQLite from 'expo-sqlite';
import { TreeNode } from '@buildonspark/spark-sdk/proto/spark';

export const LEAVES_DATABASE = 'WALLET_LEAVES';
const LEAVES_TABLE = 'wallet_leaves';
const EXIT_NODES_TABLE = 'wallet_leaf_exit_nodes';
const LEAVES_META_TABLE = 'leaves_meta';

// exitNodesStatus values on wallet_leaves.
const EXIT_STATUS_PENDING = 0; // ancestors not yet cached
const EXIT_STATUS_COMPLETE = 1; // ancestors cached (or none needed)
const EXIT_STATUS_SKIPPED = 2; // below EXIT_MIN_SATS, never needs a backup

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

// Serializes every writer that opens a manual transaction on the single shared
// connection (replaceAllLeaves + saveExitNodesForLeaf). expo-sqlite interleaves
// statements from concurrent async callers, so without this two overlapping
// BEGINs would throw "cannot start a transaction within a transaction". Failures
// are swallowed for the chain (each caller still sees its own rejection) so one
// bad run can't wedge every subsequent call.
let writeQueue = Promise.resolve();
function enqueueWrite(fn) {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

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

    // foreign_keys is a per-connection pragma; it must be set here so the
    // exit-node ON DELETE CASCADE actually fires when a leaf leaves a snapshot.
    await sqlLiteDB.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS ${LEAVES_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        treeId TEXT NOT NULL,
        value INTEGER NOT NULL,
        status TEXT NOT NULL,
        parentNodeId TEXT,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        ownerIdentityPubKey TEXT,
        snapshotVersion INTEGER NOT NULL DEFAULT 0,
        exitNodesStatus INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_leaves_tree ON ${LEAVES_TABLE}(treeId);

      CREATE TABLE IF NOT EXISTS ${EXIT_NODES_TABLE} (
        ownerIdentityPubKey TEXT,
        leafId TEXT NOT NULL,
        id TEXT NOT NULL,
        treeId TEXT,
        value INTEGER,
        status TEXT,
        data TEXT NOT NULL,
        snapshotVersion INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (leafId, id),
        FOREIGN KEY (leafId) REFERENCES ${LEAVES_TABLE}(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_exit_nodes_leaf ON ${EXIT_NODES_TABLE}(leafId);
      CREATE INDEX IF NOT EXISTS idx_exit_nodes_owner ON ${EXIT_NODES_TABLE}(ownerIdentityPubKey);

      CREATE TABLE IF NOT EXISTS ${LEAVES_META_TABLE} (
        ownerIdentityPubKey TEXT PRIMARY KEY,
        snapshotVersion INTEGER
      );
    `);

    // Migrate DBs created before per-account scoping existed. The three columns
    // are added when absent; legacy rows predate scoping (pre-release branch) so
    // we wipe the table once — the next per-account reconcile repopulates it.
    const columns = await sqlLiteDB.getAllAsync(
      `PRAGMA table_info(${LEAVES_TABLE});`,
    );
    const hasOwnerColumn = columns.some(
      col => col.name === 'ownerIdentityPubKey',
    );
    if (!hasOwnerColumn) {
      await sqlLiteDB.execAsync(`
        ALTER TABLE ${LEAVES_TABLE} ADD COLUMN ownerIdentityPubKey TEXT;
        ALTER TABLE ${LEAVES_TABLE} ADD COLUMN snapshotVersion INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE ${LEAVES_TABLE} ADD COLUMN exitNodesStatus INTEGER NOT NULL DEFAULT 0;
        DELETE FROM ${LEAVES_TABLE};
      `);
    }

    await sqlLiteDB.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_wallet_leaves_owner ON ${LEAVES_TABLE}(ownerIdentityPubKey);`,
    );

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

// Accepts the same shapes as bytesToHex and returns a Uint8Array. The TreeNode
// protobuf encoder reads `.length` on every bytes field, so callers must never
// hand it undefined — empty bytes default to a zero-length array.
function bytesToUint8(value) {
  if (value == null) return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string')
    return Uint8Array.from(Buffer.from(value, 'hex'));
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (typeof value === 'object') return Uint8Array.from(Object.values(value));
  return new Uint8Array(0);
}

// Converts an ISO string / Date / epoch-ms into a Date (or undefined) for the
// protobuf Timestamp encoder, which calls `.getTime()` on it.
function toDateOrUndefined(value) {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function signingKeyshareForProto(keyshare) {
  if (!keyshare || typeof keyshare !== 'object') return undefined;
  const publicShares = {};
  if (keyshare.publicShares && typeof keyshare.publicShares === 'object') {
    for (const [id, share] of Object.entries(keyshare.publicShares)) {
      publicShares[id] = bytesToUint8(share);
    }
  }
  return {
    ownerIdentifiers: keyshare.ownerIdentifiers ?? [],
    threshold: Number(keyshare.threshold || 0),
    publicKey: bytesToUint8(keyshare.publicKey),
    publicShares,
    updatedTime: toDateOrUndefined(keyshare.updatedTime),
  };
}

// Encodes a raw SDK leaf into the single protobuf-hex string
// (`treeNodeHex`) that the spark-unilateral-exit tooling consumes for recovery.
// Computed from the raw leaf (before lossy normalization) so it is byte-faithful
// regardless of runtime path (native returns Uint8Array; webview returns hex or
// {"0":n,...} maps). Returns null on failure so one bad leaf can't abort a
// snapshot.
export function treeNodeHexFromRaw(raw) {
  try {
    const message = {
      id: raw.id ?? '',
      treeId: raw.treeId ?? '',
      value: Number(raw.value || 0),
      parentNodeId: raw.parentNodeId ?? undefined,
      nodeTx: bytesToUint8(raw.nodeTx),
      refundTx: bytesToUint8(raw.refundTx),
      vout: Number(raw.vout || 0),
      verifyingPublicKey: bytesToUint8(raw.verifyingPublicKey),
      ownerIdentityPublicKey: bytesToUint8(raw.ownerIdentityPublicKey),
      signingKeyshare: signingKeyshareForProto(raw.signingKeyshare),
      status: raw.status ?? '',
      network: Number(raw.network || 0),
      createdTime: toDateOrUndefined(raw.createdTime),
      updatedTime: toDateOrUndefined(raw.updatedTime),
      ownerSigningPublicKey: bytesToUint8(raw.ownerSigningPublicKey),
      directTx: bytesToUint8(raw.directTx),
      directRefundTx: bytesToUint8(raw.directRefundTx),
      directFromCpfpRefundTx: bytesToUint8(raw.directFromCpfpRefundTx),
      treenodeStatus: Number(raw.treenodeStatus || 0),
    };
    return Buffer.from(TreeNode.encode(message).finish()).toString('hex');
  } catch (err) {
    console.log('treeNodeHexFromRaw error', err);
    return null;
  }
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
    // Canonical alias the spark-unilateral-exit tooling reads.
    valueSats: Number(raw.value || 0),
    status: raw.status ?? 'UNKNOWN',
    parentNodeId: raw.parentNodeId ?? null,
    vout: raw.vout ?? 0,
    network: raw.network ?? null,
    createdTime: raw.createdTime ?? null,
    updatedTime: raw.updatedTime ?? null,
    treenodeStatus: raw.treenodeStatus ?? null,
    signingKeyshare: normalizeSigningKeyshare(raw.signingKeyshare),
    // Single protobuf-encoded TreeNode the recovery tooling decodes.
    treeNodeHex: treeNodeHexFromRaw(raw),
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
 * Merges a fresh leaf snapshot into this account's store using a snapshot
 * version so surviving leaves keep their already-cached exit nodes (leaf ids are
 * UUIDs, so a surviving id has the same ancestor chain — no re-fetch). New
 * exit-eligible leaves are flagged pending; leaves that left the snapshot are
 * stale-swept and their exit nodes cascade away. Processes in batches, yielding
 * between them, so a large leaf set never blocks the JS thread. Scoped to one
 * account — never touches another account's rows.
 * @param {string} identityPubKey account this snapshot belongs to
 * @param {Array<object>} rawTreeNodes leaves as returned by getSparkLeaves
 * @returns {Promise<number>} number of leaves stored
 */
export function replaceAllLeaves(identityPubKey, rawTreeNodes) {
  // Queue behind any in-flight writer so transactions never overlap.
  return enqueueWrite(() =>
    replaceAllLeavesInternal(identityPubKey, rawTreeNodes),
  );
}

async function replaceAllLeavesInternal(identityPubKey, rawTreeNodes) {
  if (!identityPubKey) return 0;
  const db = await getDatabase();
  const leaves = Array.isArray(rawTreeNodes) ? rawTreeNodes : [];
  const now = Date.now();

  // Bump this account's snapshot version. Every leaf in the new snapshot is
  // stamped with it; anything left on an older version is stale and swept below.
  const metaRow = await db.getFirstAsync(
    `SELECT snapshotVersion FROM ${LEAVES_META_TABLE} WHERE ownerIdentityPubKey = ?`,
    [identityPubKey],
  );
  const newVersion = Number(metaRow?.snapshotVersion || 0) + 1;
  await db.runAsync(
    `INSERT INTO ${LEAVES_META_TABLE} (ownerIdentityPubKey, snapshotVersion)
     VALUES (?, ?)
     ON CONFLICT(ownerIdentityPubKey) DO UPDATE SET snapshotVersion = excluded.snapshotVersion`,
    [identityPubKey, newVersion],
  );

  let stored = 0;
  for (let i = 0; i < leaves.length; i += BATCH_SIZE) {
    const batch = leaves.slice(i, i + BATCH_SIZE);

    await db.execAsync('BEGIN TRANSACTION;');
    try {
      for (const raw of batch) {
        if (!raw?.id) continue;
        const normalized = normalizeLeaf(raw);
        // Exit status a NEW (or changed) leaf gets: pending if exit-eligible,
        // else skipped.
        const initialExitStatus =
          normalized.value >= EXIT_MIN_SATS
            ? EXIT_STATUS_PENDING
            : EXIT_STATUS_SKIPPED;
        await db.runAsync(
          `INSERT INTO ${LEAVES_TABLE}
             (id, treeId, value, status, parentNodeId, data, updatedAt,
              ownerIdentityPubKey, snapshotVersion, exitNodesStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             treeId = excluded.treeId,
             value = excluded.value,
             status = excluded.status,
             parentNodeId = excluded.parentNodeId,
             data = excluded.data,
             updatedAt = excluded.updatedAt,
             ownerIdentityPubKey = excluded.ownerIdentityPubKey,
             snapshotVersion = excluded.snapshotVersion,
             -- A leaf whose exit-relevant state is unchanged keeps its
             -- cached-ancestor status; a changed one is re-derived (re-pending /
             -- re-skipped) so reconcileExitNodes refetches its ancestors instead
             -- of exporting a stale exit path. We compare only stable fields
             -- (value/status/treenodeStatus/updatedTime), NOT the whole data
             -- blob, which re-serializes with reordered arrays (e.g.
             -- signingKeyshare.ownerIdentifiers) on an otherwise-identical leaf.
             -- IS is null-safe so an absent updatedTime isn't seen as a change.
             exitNodesStatus = CASE
               WHEN ${LEAVES_TABLE}.value IS excluded.value
                AND ${LEAVES_TABLE}.status IS excluded.status
                AND json_extract(${LEAVES_TABLE}.data, '$.treenodeStatus')
                    IS json_extract(excluded.data, '$.treenodeStatus')
                AND json_extract(${LEAVES_TABLE}.data, '$.updatedTime')
                    IS json_extract(excluded.data, '$.updatedTime')
                 THEN ${LEAVES_TABLE}.exitNodesStatus
               ELSE excluded.exitNodesStatus
             END`,
          [
            normalized.id,
            normalized.treeId,
            normalized.value,
            normalized.status,
            normalized.parentNodeId,
            JSON.stringify(normalized),
            now,
            identityPubKey,
            newVersion,
            initialExitStatus,
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

  // Stale-sweep, scoped to this account: drop any leaf that wasn't in the new
  // snapshot. FK cascade removes the exit nodes of any leaf that left.
  await db.runAsync(
    `DELETE FROM ${LEAVES_TABLE}
     WHERE ownerIdentityPubKey = ? AND snapshotVersion != ?`,
    [identityPubKey, newVersion],
  );

  return stored;
}

/**
 * Leaf ids still needing their exit-node ancestors cached, highest-value first.
 * @param {string} identityPubKey
 * @param {number} limit
 * @returns {Promise<string[]>}
 */
export async function getPendingExitNodeLeafIds(identityPubKey, limit = 8) {
  if (!identityPubKey) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT id FROM ${LEAVES_TABLE}
     WHERE ownerIdentityPubKey = ? AND exitNodesStatus = ?
     ORDER BY value DESC
     LIMIT ?`,
    [identityPubKey, EXIT_STATUS_PENDING, limit],
  );
  return rows.map(row => String(row.id));
}

/**
 * Caches one leaf's exit-node ancestors, race-safe: if the leaf no longer exists
 * for this account (a newer snapshot / account switch removed it) the write is
 * skipped rather than inserting an FK orphan. Only call for leaves the fetch
 * succeeded on (present in the returned map); a genuinely-empty chain still marks
 * the leaf complete with zero rows.
 * @param {string} identityPubKey
 * @param {string} leafId
 * @param {Array<object>} rawNodes ancestor TreeNodes as returned by Spark
 * @returns {Promise<boolean>} whether the leaf was marked complete
 */
export function saveExitNodesForLeaf(identityPubKey, leafId, rawNodes) {
  if (!identityPubKey || !leafId) return Promise.resolve(false);
  // Queue behind any in-flight writer so this transaction never overlaps a
  // replaceAllLeaves snapshot on the shared connection.
  return enqueueWrite(async () => {
    const db = await getDatabase();
    const nodes = Array.isArray(rawNodes) ? rawNodes : [];
    const now = Date.now();

    await db.execAsync('BEGIN TRANSACTION;');
    try {
      const leafRow = await db.getFirstAsync(
        `SELECT snapshotVersion FROM ${LEAVES_TABLE}
         WHERE id = ? AND ownerIdentityPubKey = ?`,
        [leafId, identityPubKey],
      );
      if (!leafRow) {
        // Leaf gone (newer snapshot / account switch) — never insert an orphan.
        await db.execAsync('ROLLBACK;');
        return false;
      }
      const snapshotVersion = Number(leafRow.snapshotVersion || 0);

      await db.runAsync(`DELETE FROM ${EXIT_NODES_TABLE} WHERE leafId = ?`, [
        leafId,
      ]);

      for (const raw of nodes) {
        const normalized = normalizeLeaf(raw);
        if (!normalized?.id || !normalized?.treeNodeHex) continue;
        await db.runAsync(
          `INSERT INTO ${EXIT_NODES_TABLE}
             (ownerIdentityPubKey, leafId, id, treeId, value, status, data,
              snapshotVersion, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(leafId, id) DO UPDATE SET
             ownerIdentityPubKey = excluded.ownerIdentityPubKey,
             treeId = excluded.treeId,
             value = excluded.value,
             status = excluded.status,
             data = excluded.data,
             snapshotVersion = excluded.snapshotVersion,
             updatedAt = excluded.updatedAt`,
          [
            identityPubKey,
            leafId,
            normalized.id,
            normalized.treeId,
            normalized.value,
            normalized.status,
            JSON.stringify(normalized),
            snapshotVersion,
            now,
          ],
        );
      }

      await db.runAsync(
        `UPDATE ${LEAVES_TABLE} SET exitNodesStatus = ?
         WHERE id = ? AND ownerIdentityPubKey = ?`,
        [EXIT_STATUS_COMPLETE, leafId, identityPubKey],
      );

      await db.execAsync('COMMIT;');
      return true;
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      console.error('saveExitNodesForLeaf error:', err);
      return false;
    }
  });
}

/**
 * Backfill progress for one account: how many exit-eligible leaves still need
 * their ancestors cached vs. how many are done.
 * @param {string} identityPubKey
 * @returns {Promise<{pending: number, complete: number}>}
 */
export async function getExitNodeSyncProgress(identityPubKey) {
  if (!identityPubKey) return { pending: 0, complete: 0 };
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT
       COALESCE(SUM(CASE WHEN exitNodesStatus = ? THEN 1 ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN exitNodesStatus = ? THEN 1 ELSE 0 END), 0) AS complete
     FROM ${LEAVES_TABLE}
     WHERE ownerIdentityPubKey = ?`,
    [EXIT_STATUS_PENDING, EXIT_STATUS_COMPLETE, identityPubKey],
  );
  return {
    pending: Number(row?.pending || 0),
    complete: Number(row?.complete || 0),
  };
}

/**
 * Per-tree aggregates for the collapsed view. O(#trees), computed in SQL so the
 * JS side never iterates the full leaf array.
 * @returns {Promise<Array<{treeId, leafCount, totalValue, exitEligibleCount}>>}
 */
export async function getTreeSummaries(identityPubKey) {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT treeId,
            COUNT(*) AS leafCount,
            COALESCE(SUM(value), 0) AS totalValue,
            COALESCE(SUM(CASE WHEN value >= ? THEN 1 ELSE 0 END), 0) AS exitEligibleCount
     FROM ${LEAVES_TABLE}
     WHERE ownerIdentityPubKey = ?
     GROUP BY treeId
     ORDER BY totalValue DESC`,
    [EXIT_MIN_SATS, identityPubKey],
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
export async function getLeavesForTree(
  identityPubKey,
  treeId,
  limit = 100,
  offset = 0,
) {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT id, value, status, parentNodeId
     FROM ${LEAVES_TABLE}
     WHERE treeId = ? AND ownerIdentityPubKey = ?
     ORDER BY value DESC
     LIMIT ? OFFSET ?`,
    [treeId, identityPubKey, limit, offset],
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
 * @returns {Promise<{totalLeaves, totalValue, exitEligible, exitEligibleValue, treeCount, lastSyncedAt}>}
 */
export async function getGlobalLeafStats(identityPubKey) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS totalLeaves,
            COALESCE(SUM(value), 0) AS totalValue,
            COALESCE(SUM(CASE WHEN value >= ? THEN 1 ELSE 0 END), 0) AS exitEligible,
            COALESCE(SUM(CASE WHEN value >= ? THEN value ELSE 0 END), 0) AS exitEligibleValue,
            COUNT(DISTINCT treeId) AS treeCount,
            COALESCE(MAX(updatedAt), 0) AS lastSyncedAt
     FROM ${LEAVES_TABLE}
     WHERE ownerIdentityPubKey = ?`,
    [EXIT_MIN_SATS, EXIT_MIN_SATS, identityPubKey],
  );
  return {
    totalLeaves: Number(row?.totalLeaves || 0),
    totalValue: Number(row?.totalValue || 0),
    exitEligible: Number(row?.exitEligible || 0),
    exitEligibleValue: Number(row?.exitEligibleValue || 0),
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
export async function getAllLeavesStream(identityPubKey, onBatch) {
  const db = await getDatabase();
  let offset = 0;
  while (true) {
    const rows = await db.getAllAsync(
      `SELECT data FROM ${LEAVES_TABLE}
       WHERE ownerIdentityPubKey = ?
       ORDER BY treeId, id LIMIT ? OFFSET ?`,
      [identityPubKey, BATCH_SIZE, offset],
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
 * Streams this account's distinct cached exit-node ancestors for export. The
 * same ancestor can back many leaves, so we dedup by node id (GROUP BY id) and
 * hand each yielding batch to `onBatch`.
 * @param {string} identityPubKey
 * @param {(nodes: object[]) => (void|Promise<void>)} onBatch
 */
export async function getAllExitNodesStream(identityPubKey, onBatch) {
  const db = await getDatabase();
  let offset = 0;
  while (true) {
    const rows = await db.getAllAsync(
      `SELECT data FROM ${EXIT_NODES_TABLE}
       WHERE ownerIdentityPubKey = ?
       GROUP BY id
       ORDER BY id LIMIT ? OFFSET ?`,
      [identityPubKey, BATCH_SIZE, offset],
    );
    if (!rows.length) break;

    const parsed = [];
    for (const row of rows) {
      try {
        parsed.push(JSON.parse(row.data));
      } catch (err) {
        console.log('getAllExitNodesStream parse error', err);
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
    await db.execAsync(`
      DROP TABLE IF EXISTS ${EXIT_NODES_TABLE};
      DROP TABLE IF EXISTS ${LEAVES_META_TABLE};
      DROP TABLE IF EXISTS ${LEAVES_TABLE};
    `);
    isInitialized = false;
    return true;
  } catch (err) {
    console.error('deleteLeavesTable error:', err);
    return false;
  }
}
