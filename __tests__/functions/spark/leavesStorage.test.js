// Storage-invariant suite for leavesStorage.js, focused on the exact contract
// reconcileLeaves + reconcileExitNodes (context-store/sparkContext.js) depend on:
//
//   reconcileLeaves   -> replaceAllLeaves       (snapshot version bump, stale
//                                                 sweep + FK cascade, surviving
//                                                 leaf status preservation)
//   reconcileExitNodes -> getPendingExitNodeLeafIds  (value-DESC pending only)
//                       -> saveExitNodesForLeaf  (orphan-safe, DELETE+reinsert
//                                                 replacement, marks COMPLETE)
//                       -> getExitNodeSyncProgress
//
// The real SQL runs against an in-memory node:sqlite (Node 22+), exposed through
// a thin adapter matching expo-sqlite's async surface. The adapter also tracks
// BEGIN/COMMIT nesting so the writeQueue serialization guarantee is assertable,
// and can inject an async hop to force interleaving of concurrent writers.

const { DatabaseSync } = require('node:sqlite');

// Shared, instrumented expo-sqlite mock. One in-memory connection per suite run
// (leavesStorage caches the connection at module scope); tests get a clean slate
// via deleteLeavesTable + initLeavesDb in beforeEach.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const state = {
    log: [],
    txDepth: 0,
    txViolations: 0, // a BEGIN issued while already inside a transaction
    delay: false, // when true, every statement awaits a macrotask hop
  };
  const openDatabaseAsync = async () => {
    const sqlite = new DB(':memory:');
    const hop = () =>
      state.delay ? new Promise(r => setImmediate(r)) : Promise.resolve();
    const track = sql => {
      const s = String(sql);
      if (/\bBEGIN\b/i.test(s)) {
        if (state.txDepth > 0) state.txViolations++;
        state.txDepth++;
      }
      if (/\bCOMMIT\b|\bROLLBACK\b/i.test(s)) {
        state.txDepth = Math.max(0, state.txDepth - 1);
      }
      state.log.push(s.trim().split('\n')[0].slice(0, 48));
    };
    return {
      execAsync: async sql => {
        await hop();
        track(sql);
        sqlite.exec(sql);
      },
      runAsync: async (sql, params = []) => {
        await hop();
        track(sql);
        const r = sqlite.prepare(sql).run(...params);
        return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
      },
      getAllAsync: async (sql, params = []) => {
        await hop();
        return sqlite.prepare(sql).all(...params);
      },
      getFirstAsync: async (sql, params = []) => {
        await hop();
        return sqlite.prepare(sql).get(...params) ?? null;
      },
      _raw: sqlite,
    };
  };
  return { __esModule: true, openDatabaseAsync, __state: state };
});

const { __state: sqlState } = require('expo-sqlite');
const {
  EXIT_MIN_SATS,
  initLeavesDb,
  deleteLeavesTable,
  replaceAllLeaves,
  getPendingExitNodeLeafIds,
  saveExitNodesForLeaf,
  getExitNodeSyncProgress,
  getGlobalLeafStats,
  getTreeSummaries,
  getAllExitNodesStream,
} = require('../../../app/functions/spark/leavesStorage');

const ACCT_A = 'pubkey-a';
const ACCT_B = 'pubkey-b';
const EXIT_STATUS_COMPLETE = 1; // mirrors leavesStorage internal enum

// ---- fixtures -------------------------------------------------------------
let uuidCounter = 0;
// Deterministic UUID-shaped ids (the store treats ids as immutable UUIDs).
const uid = () =>
  `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`;

// A raw SDK-shaped leaf. Only the fields normalizeLeaf/treeNodeHexFromRaw read
// need to be present; bytes default to empty so treeNodeHex still encodes.
// `updatedTime`/`treenodeStatus` are the stable exit-change signals; passing
// `ownerIdentifiers` lets a test vary only a volatile (reorderable) sub-field.
const rawLeaf = ({
  id = uid(),
  treeId = 'tree-1',
  value = 50_000,
  status = 'AVAILABLE',
  parentNodeId = null,
  updatedTime = null,
  treenodeStatus = null,
  ownerIdentifiers,
} = {}) => ({
  id,
  treeId,
  value,
  status,
  parentNodeId,
  vout: 0,
  network: 1,
  updatedTime,
  treenodeStatus,
  ...(ownerIdentifiers
    ? {
        signingKeyshare: {
          ownerIdentifiers,
          threshold: 2,
          publicKey: '02aa',
          publicShares: {},
        },
      }
    : {}),
});

// An exit-node ancestor is normalized the same way as a leaf.
const rawAncestor = ({ id = uid(), treeId = 'tree-1' } = {}) =>
  rawLeaf({ id, treeId, value: 1000, status: 'AVAILABLE' });

// Direct read of the live in-memory DB for assertions the public API can't make.
// leavesStorage keeps the only reference to the connection, so we wrap the mock's
// openDatabaseAsync to capture the raw sqlite handle the module actually uses.
let capturedRaw = null;
{
  const mod = require('expo-sqlite');
  const orig = mod.openDatabaseAsync;
  mod.openDatabaseAsync = async () => {
    const adapter = await orig();
    capturedRaw = adapter._raw;
    return adapter;
  };
}
const rows = (sql, params = []) => capturedRaw.prepare(sql).all(...params);
const first = (sql, params = []) => capturedRaw.prepare(sql).get(...params) ?? null;

beforeEach(async () => {
  // Fresh schema every test: drop all three tables, recreate on the same
  // connection. deleteLeavesTable/initLeavesDb also force the DB open, so
  // capturedRaw is populated before any test body runs.
  await deleteLeavesTable();
  await initLeavesDb();
  sqlState.log.length = 0;
  sqlState.txDepth = 0;
  sqlState.txViolations = 0;
  sqlState.delay = false;
  uuidCounter = 0;
});

describe('replaceAllLeaves — snapshot versioning & stale sweep', () => {
  it('stores every leaf and reflects aggregates', async () => {
    const stored = await replaceAllLeaves(ACCT_A, [
      rawLeaf({ value: 20_000, treeId: 't1' }),
      rawLeaf({ value: 30_000, treeId: 't1' }),
      rawLeaf({ value: 5_000, treeId: 't2' }),
    ]);
    expect(stored).toBe(3);

    const stats = await getGlobalLeafStats(ACCT_A);
    expect(stats.totalLeaves).toBe(3);
    expect(stats.totalValue).toBe(55_000);
    expect(stats.treeCount).toBe(2);
    // exitEligible counts only value >= EXIT_MIN_SATS
    expect(stats.exitEligible).toBe(2);
  });

  it('flags new exit-eligible leaves pending and sub-minimum leaves skipped', async () => {
    const big = uid();
    const small = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id: big, value: EXIT_MIN_SATS }),
      rawLeaf({ id: small, value: EXIT_MIN_SATS - 1 }),
    ]);

    const pending = await getPendingExitNodeLeafIds(ACCT_A, 10);
    expect(pending).toEqual([big]); // small is SKIPPED, not pending

    const progress = await getExitNodeSyncProgress(ACCT_A);
    expect(progress).toEqual({ pending: 1, complete: 0 }); // skipped counted in neither
  });

  it('sweeps leaves that dropped out of the new snapshot', async () => {
    const keep = uid();
    const drop = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id: keep, value: 20_000 }),
      rawLeaf({ id: drop, value: 20_000 }),
    ]);
    // Second snapshot omits `drop`.
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id: keep, value: 20_000 })]);

    const ids = rows(
      `SELECT id FROM wallet_leaves WHERE ownerIdentityPubKey = ?`,
      [ACCT_A],
    ).map(r => r.id);
    expect(ids).toEqual([keep]);
  });

  it('preserves exitNodesStatus for an UNCHANGED surviving leaf (byte-identical snapshot)', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);
    // Mark it complete via the real save path.
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]);
    expect((await getExitNodeSyncProgress(ACCT_A)).complete).toBe(1);

    // A later snapshot re-includes the identical raw leaf (nothing changed):
    // `data` is byte-identical, so the cached-ancestor status must survive.
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);

    const progress = await getExitNodeSyncProgress(ACCT_A);
    expect(progress).toEqual({ pending: 0, complete: 1 }); // stayed COMPLETE
    expect(await getPendingExitNodeLeafIds(ACCT_A, 10)).toEqual([]);
  });

  it('re-pends a CHANGED surviving leaf so its stale ancestors get refetched', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: 20_000, status: 'AVAILABLE' }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]);
    expect((await getExitNodeSyncProgress(ACCT_A)).complete).toBe(1);

    // Same id resurfaces mutated (e.g. timelock refresh / transfer changed its
    // txs). The cached ancestors are now stale — status must reset to pending.
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: 99_000, status: 'FROZEN' }),
    ]);

    const row = first(
      `SELECT value, status, exitNodesStatus FROM wallet_leaves WHERE id = ?`,
      [id],
    );
    expect(row.value).toBe(99_000); // column updated
    expect(row.status).toBe('FROZEN'); // column updated
    expect(row.exitNodesStatus).not.toBe(EXIT_STATUS_COMPLETE); // reset
    // And it is queued for a refetch again.
    expect(await getExitNodeSyncProgress(ACCT_A)).toEqual({
      pending: 1,
      complete: 0,
    });
    expect(await getPendingExitNodeLeafIds(ACCT_A, 10)).toEqual([id]);
  });

  it('does NOT re-pend on a benign re-serialization (reordered signingKeyshare identifiers)', async () => {
    const id = uid();
    const stable = {
      id,
      value: 20_000,
      updatedTime: '2026-07-01T00:00:00Z',
      treenodeStatus: 1,
    };
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ ...stable, ownerIdentifiers: ['01', '02', '03'] }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]);
    expect((await getExitNodeSyncProgress(ACCT_A)).complete).toBe(1);

    // Same leaf, identical stable fields, only the identifiers array reordered —
    // the serialized `data` blob differs but nothing exit-relevant changed.
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ ...stable, ownerIdentifiers: ['03', '02', '01'] }),
    ]);

    // Guard against a vacuous test: prove the stored blob actually reordered
    // (so a whole-`data` comparison WOULD have mis-fired here)...
    const stored = JSON.parse(
      first(`SELECT data FROM wallet_leaves WHERE id = ?`, [id]).data,
    );
    expect(stored.signingKeyshare.ownerIdentifiers).toEqual(['03', '02', '01']);
    // ...yet the cached-ancestor status survived (no needless refetch).
    expect(await getExitNodeSyncProgress(ACCT_A)).toEqual({
      pending: 0,
      complete: 1,
    });
  });

  it('re-pends when updatedTime advances (a real node modification)', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: 20_000, updatedTime: '2026-07-01T00:00:00Z' }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]);
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: 20_000, updatedTime: '2026-07-02T00:00:00Z' }),
    ]);
    expect(await getPendingExitNodeLeafIds(ACCT_A, 10)).toEqual([id]);
  });

  it('re-pends when treenodeStatus changes', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: 20_000, treenodeStatus: 1 }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]);
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: 20_000, treenodeStatus: 2 }),
    ]);
    expect(await getPendingExitNodeLeafIds(ACCT_A, 10)).toEqual([id]);
  });

  it('re-skips a CHANGED surviving leaf that drops below the exit minimum', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]);
    expect((await getExitNodeSyncProgress(ACCT_A)).complete).toBe(1);

    // Now the same leaf changes AND falls below EXIT_MIN_SATS: it should be
    // re-derived as SKIPPED, i.e. neither pending nor complete.
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id, value: EXIT_MIN_SATS - 1 }),
    ]);

    expect(await getExitNodeSyncProgress(ACCT_A)).toEqual({
      pending: 0,
      complete: 0,
    });
    expect(await getPendingExitNodeLeafIds(ACCT_A, 10)).toEqual([]);
  });

  it('is account-scoped: a snapshot for A never touches B rows', async () => {
    const aId = uid();
    const bId = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id: aId, value: 20_000 })]);
    await replaceAllLeaves(ACCT_B, [rawLeaf({ id: bId, value: 20_000 })]);

    // Re-snapshot A with a totally different leaf; B must be untouched.
    await replaceAllLeaves(ACCT_A, [rawLeaf({ value: 20_000 })]);

    const bStats = await getGlobalLeafStats(ACCT_B);
    expect(bStats.totalLeaves).toBe(1);
    expect(
      first(`SELECT id FROM wallet_leaves WHERE ownerIdentityPubKey = ?`, [
        ACCT_B,
      ]).id,
    ).toBe(bId);
  });

  it('empties an account when handed an empty snapshot', async () => {
    await replaceAllLeaves(ACCT_A, [rawLeaf({ value: 20_000 })]);
    const stored = await replaceAllLeaves(ACCT_A, []);
    expect(stored).toBe(0);
    expect((await getGlobalLeafStats(ACCT_A)).totalLeaves).toBe(0);
  });

  it('no-ops on missing identity or non-array input', async () => {
    expect(await replaceAllLeaves(null, [rawLeaf()])).toBe(0);
    expect(await replaceAllLeaves(ACCT_A, null)).toBe(0);
    expect((await getGlobalLeafStats(ACCT_A)).totalLeaves).toBe(0);
  });

  it('skips leaves with no id inside a snapshot', async () => {
    const good = uid();
    const stored = await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id: good, value: 20_000 }),
      { treeId: 't', value: 20_000 }, // no id
    ]);
    expect(stored).toBe(1);
  });
});

describe('DELETE CASCADE — exit nodes follow their leaf', () => {
  it('cascade-deletes a swept leaf exit nodes', async () => {
    const keep = uid();
    const drop = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id: keep, value: 20_000 }),
      rawLeaf({ id: drop, value: 20_000 }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, keep, [rawAncestor(), rawAncestor()]);
    await saveExitNodesForLeaf(ACCT_A, drop, [rawAncestor()]);
    expect(
      first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes`).c,
    ).toBe(3);

    // Sweep `drop` out.
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id: keep, value: 20_000 })]);

    // Only keep's 2 ancestors survive; drop's cascaded away.
    expect(
      first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes`).c,
    ).toBe(2);
    expect(
      first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes WHERE leafId = ?`, [
        drop,
      ]).c,
    ).toBe(0);
  });
});

describe('saveExitNodesForLeaf — orphan safety, replacement, completion', () => {
  it('marks the leaf complete and stores its ancestors', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);

    const ok = await saveExitNodesForLeaf(ACCT_A, id, [
      rawAncestor(),
      rawAncestor(),
    ]);
    expect(ok).toBe(true);
    expect(
      first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes WHERE leafId = ?`, [
        id,
      ]).c,
    ).toBe(2);
    expect(await getExitNodeSyncProgress(ACCT_A)).toEqual({
      pending: 0,
      complete: 1,
    });
  });

  it('refuses to write an orphan when the leaf no longer exists', async () => {
    // No leaf inserted for this id (simulates a newer snapshot / account switch
    // having removed it between the pending read and the save).
    const ok = await saveExitNodesForLeaf(ACCT_A, uid(), [rawAncestor()]);
    expect(ok).toBe(false);
    expect(first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes`).c).toBe(0);
  });

  it('refuses to write for the wrong account (scoped leaf lookup)', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);
    // Same leaf id, but claimed under B — must not match A's row.
    const ok = await saveExitNodesForLeaf(ACCT_B, id, [rawAncestor()]);
    expect(ok).toBe(false);
    expect(first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes`).c).toBe(0);
  });

  it('replaces previous ancestors on re-save (DELETE then insert, no duplicates)', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);
    await saveExitNodesForLeaf(ACCT_A, id, [
      rawAncestor({ id: 'anc-1' }),
      rawAncestor({ id: 'anc-2' }),
    ]);
    // Re-fetch returns a different ancestor set for the same leaf.
    await saveExitNodesForLeaf(ACCT_A, id, [rawAncestor({ id: 'anc-3' })]);

    const ancIds = rows(
      `SELECT id FROM wallet_leaf_exit_nodes WHERE leafId = ? ORDER BY id`,
      [id],
    ).map(r => r.id);
    expect(ancIds).toEqual(['anc-3']); // old two gone
  });

  it('marks a genuinely-empty ancestor chain complete with zero rows', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);
    const ok = await saveExitNodesForLeaf(ACCT_A, id, []);
    expect(ok).toBe(true);
    expect(await getExitNodeSyncProgress(ACCT_A)).toEqual({
      pending: 0,
      complete: 1,
    });
    expect(first(`SELECT COUNT(*) c FROM wallet_leaf_exit_nodes`).c).toBe(0);
  });

  it('skips malformed ancestor nodes (no id) but still completes the leaf', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);
    const ok = await saveExitNodesForLeaf(ACCT_A, id, [
      { treeId: 't', value: 1 }, // no id -> normalized.id undefined -> skipped
      rawAncestor({ id: 'anc-real' }),
    ]);
    expect(ok).toBe(true);
    const ancIds = rows(
      `SELECT id FROM wallet_leaf_exit_nodes WHERE leafId = ?`,
      [id],
    ).map(r => r.id);
    expect(ancIds).toEqual(['anc-real']);
  });

  it('no-ops on missing identity or leafId', async () => {
    expect(await saveExitNodesForLeaf(null, uid(), [rawAncestor()])).toBe(false);
    expect(await saveExitNodesForLeaf(ACCT_A, null, [rawAncestor()])).toBe(
      false,
    );
  });

  it('dedups shared ancestors by id in the export stream', async () => {
    // Two leaves share the same ancestor id; export must yield it once.
    const l1 = uid();
    const l2 = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id: l1, value: 20_000 }),
      rawLeaf({ id: l2, value: 20_000 }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, l1, [rawAncestor({ id: 'shared' })]);
    await saveExitNodesForLeaf(ACCT_A, l2, [rawAncestor({ id: 'shared' })]);

    const seen = [];
    await getAllExitNodesStream(ACCT_A, batch =>
      seen.push(...batch.map(n => n.id)),
    );
    expect(seen).toEqual(['shared']);
  });
});

describe('getPendingExitNodeLeafIds — ordering & filtering', () => {
  it('returns only pending, highest-value first, honoring the limit', async () => {
    const low = uid();
    const mid = uid();
    const high = uid();
    const skipped = uid();
    const complete = uid();
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ id: low, value: 17_000 }),
      rawLeaf({ id: mid, value: 40_000 }),
      rawLeaf({ id: high, value: 90_000 }),
      rawLeaf({ id: skipped, value: 100 }), // SKIPPED
      rawLeaf({ id: complete, value: 50_000 }),
    ]);
    await saveExitNodesForLeaf(ACCT_A, complete, [rawAncestor()]); // -> COMPLETE

    expect(await getPendingExitNodeLeafIds(ACCT_A, 2)).toEqual([high, mid]);
    expect(await getPendingExitNodeLeafIds(ACCT_A, 10)).toEqual([
      high,
      mid,
      low,
    ]);
  });

  it('no-ops on missing identity', async () => {
    expect(await getPendingExitNodeLeafIds(null)).toEqual([]);
  });
});

describe('write serialization & concurrent snapshot overrides', () => {
  it('serializes overlapping writers — no nested BEGIN, consistent result', async () => {
    const id = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]);

    // Force interleaving pressure: every statement now awaits a macrotask.
    sqlState.delay = true;
    sqlState.txViolations = 0;

    // Fire a fresh snapshot and an exit-node save for the SAME account at once.
    await Promise.all([
      replaceAllLeaves(ACCT_A, [rawLeaf({ id, value: 20_000 })]),
      saveExitNodesForLeaf(ACCT_A, id, [rawAncestor()]),
    ]);
    sqlState.delay = false;

    // The writeQueue must have prevented any BEGIN-within-BEGIN.
    expect(sqlState.txViolations).toBe(0);
    // Regardless of interleave order the leaf ends COMPLETE with its ancestor,
    // and no orphan exit nodes exist.
    expect(await getExitNodeSyncProgress(ACCT_A)).toEqual({
      pending: 0,
      complete: 1,
    });
    const orphans = first(
      `SELECT COUNT(*) c FROM wallet_leaf_exit_nodes e
       LEFT JOIN wallet_leaves l ON l.id = e.leafId WHERE l.id IS NULL`,
    ).c;
    expect(orphans).toBe(0);
  });

  it('two concurrent snapshots converge on the last one (version override)', async () => {
    const a = uid();
    const b = uid();
    await replaceAllLeaves(ACCT_A, [rawLeaf({ id: a, value: 20_000 })]);

    sqlState.delay = true;
    // Snapshot 1 keeps `a`; snapshot 2 replaces it with `b`. Enqueued in order,
    // the store must end with exactly snapshot 2's contents (highest version
    // wins, older-version rows swept).
    await Promise.all([
      replaceAllLeaves(ACCT_A, [rawLeaf({ id: a, value: 20_000 })]),
      replaceAllLeaves(ACCT_A, [rawLeaf({ id: b, value: 20_000 })]),
    ]);
    sqlState.delay = false;

    expect(sqlState.txViolations).toBe(0);
    const ids = rows(
      `SELECT id FROM wallet_leaves WHERE ownerIdentityPubKey = ?`,
      [ACCT_A],
    ).map(r => r.id);
    expect(ids).toEqual([b]);
  });
});

describe('getTreeSummaries — grouped aggregates reconcileLeaves surfaces', () => {
  it('groups by tree with per-tree totals and exit-eligible counts', async () => {
    await replaceAllLeaves(ACCT_A, [
      rawLeaf({ treeId: 'big', value: 60_000 }),
      rawLeaf({ treeId: 'big', value: 40_000 }),
      rawLeaf({ treeId: 'small', value: 100 }),
    ]);
    const summaries = await getTreeSummaries(ACCT_A);
    // Ordered by totalValue DESC.
    expect(summaries).toEqual([
      {
        treeId: 'big',
        leafCount: 2,
        totalValue: 100_000,
        exitEligibleCount: 2,
      },
      { treeId: 'small', leafCount: 1, totalValue: 100, exitEligibleCount: 0 },
    ]);
  });
});
