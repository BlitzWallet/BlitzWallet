/* eslint-env jest */
// Full leak-set suite for wipeLocalWalletData: every wallet-local SQLite table
// must be dropped + recreated empty, AsyncStorage must be cleared (except the
// preserved userSelectedLanguage), and the filesystem image caches wiped.
//
// The regression guard for the fail-closed contract (B1): a brand-new wallet
// (all tables already empty) MUST return success — the old design gated on
// heterogeneous per-delete return values and blocked every onboarding.

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const connections = new Map();
  let poisonDb = null;
  const openDatabaseAsync = jest.fn(async name => {
    if (!connections.has(name)) {
      connections.set(name, new DB(':memory:'));
    }
    const sqlite = connections.get(name);
    const maybePoison = () => {
      if (poisonDb === name) {
        throw new Error(`poisoned db: ${name}`);
      }
    };
    return {
      execAsync: async sql => {
        maybePoison();
        sqlite.exec(sql);
      },
      runAsync: async (sql, params = []) => {
        maybePoison();
        const r = sqlite.prepare(sql).run(...params);
        return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
      },
      getAllAsync: async (sql, params = []) => {
        maybePoison();
        return sqlite.prepare(sql).all(...params);
      },
      getFirstAsync: async (sql, params = []) => {
        maybePoison();
        return sqlite.prepare(sql).get(...params) ?? null;
      },
    };
  });
  return {
    __esModule: true,
    openDatabaseAsync,
    __connections: connections,
    __setPoisonDb: name => {
      poisonDb = name;
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    __store: store,
    default: {
    getItem: async key =>
      store.has(key) ? store.get(key) : null,
    setItem: async (key, value) => {
      store.set(key, String(value));
    },
    removeItem: async key => {
      store.delete(key);
    },
    getAllKeys: async () => [...store.keys()],
    multiRemove: async keys => {
      for (const key of keys) store.delete(key);
    },
    multiGet: async keys => keys.map(key => [key, store.get(key) ?? null]),
    multiSet: async pairs => {
      for (const [key, value] of pairs) store.set(key, String(value));
    },
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  deleteAsync: jest.fn(async () => true),
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

jest.mock('../../app/functions/secureStore', () => ({
  wipeStaleWalletKeychain: jest.fn(async () => true),
  armWipeInProgress: jest.fn(async () => true),
  disarmWipeInProgress: jest.fn(async () => true),
}));

const {
  initLeavesDb,
} = require('../../app/functions/spark/leavesStorage');
const {
  NWCInvoiceManager,
} = require('../../app/functions/nwc/cachedNWCTxs');
const {
  nwcEventLedger,
} = require('../../app/functions/nwc/eventLedger');
const {
  getLastModified,
  initBTCMapDB,
  deleteBtcMapTable,
} = require('../../app/functions/btcMap/btcMapStorage');
const {
  initializeAllDatabases,
} = require('../../app/functions/initializeAllDatabases');
const {
  deleteAllLocalWalletTables,
  default: wipeLocalWalletData,
} = require('../../app/functions/wipeLocalWalletData');
const {
  wipeStaleWalletKeychain,
  armWipeInProgress,
  disarmWipeInProgress,
} = require('../../app/functions/secureStore');
const { deleteAsync } = require('expo-file-system/legacy');

// ---------------------------------------------------------------------------
// Fixtures: every wallet-local table (db file name, table name, seed row)
// ---------------------------------------------------------------------------

// btcmap.db is intentionally NOT wallet-local — public merchant cache that
// persists cross-wallet and is only opened JIT on BTCMap screen visit
const TABLES = [
  ['CASHED_CONTACTS_MESSAGES.db', 'messagesTable'],
  ['POS_TRANSACTIONS.db', 'POS_TRANSACTIONS'],
  ['SPARK_INFORMATION_DATABASE.db', 'SPARK_TRANSACTIONS'],
  ['SPARK_INFORMATION_DATABASE.db', 'LIGHTNING_REQUEST_IDS'],
  ['SPARK_INFORMATION_DATABASE.db', 'SPARK_REQUEST_IDS'],
  ['SPARK_INFORMATION_DATABASE.db', 'spend_and_replace_intents'],
  ['SPARK_INFORMATION_DATABASE.db', 'account_balance_snapshots'],
  ['SAVED_GIFTS.db', 'giftsTable'],
  ['giftCards.db', 'giftCardsTable'],
  ['SAVED_POOLS.db', 'poolsTable'],
  ['SAVED_POOLS.db', 'contributionsTable'],
  ['SAVED_SAVINGS.db', 'savings_goals'],
  ['SAVED_SAVINGS.db', 'savings_transactions'],
  ['SAVED_SAVINGS.db', 'savings_payouts'],
  ['WALLET_LEAVES.db', 'wallet_leaves'],
  ['WALLET_LEAVES.db', 'wallet_leaf_exit_nodes'],
  ['WALLET_LEAVES.db', 'leaves_meta'],
  ['ROOTSTOCK_SWAPS.db', 'saved_rootstock_swaps'],
  ['nwc_invoices.db', 'invoices'],
  ['nwc_event_ledger.db', 'handled_events'],
  ['nwc_event_ledger.db', 'nwc_ledger_state'],
];

const BTCMAP_TABLES = [
  ['btcmap.db', 'btcmap_places'],
  ['btcmap.db', 'provider_places'],
  ['btcmap.db', 'btcmap_meta'],
];

const SEEDS = [
  ["CASHED_CONTACTS_MESSAGES.db", "messagesTable",
    "INSERT INTO messagesTable (contactPubKey, message, messageUUID, timestamp) VALUES ('pub', 'msg', 'uuid', 1)"],
  ["POS_TRANSACTIONS.db", "POS_TRANSACTIONS",
    "INSERT INTO POS_TRANSACTIONS (tipAmountSats, orderAmountSats, serverName, timestamp, dbDateAdded, didPay) VALUES (1, 2, 's', 3, 4, 0)"],
  ["SPARK_INFORMATION_DATABASE.db", "SPARK_TRANSACTIONS",
    "INSERT INTO SPARK_TRANSACTIONS (sparkID, paymentStatus, paymentType, accountId, details) VALUES ('s', 'completed', 'lightning', 'acc', '{}')"],
  ["SPARK_INFORMATION_DATABASE.db", "LIGHTNING_REQUEST_IDS",
    "INSERT INTO LIGHTNING_REQUEST_IDS (sparkID, amount, expiration, description, shouldNavigate) VALUES ('s', 1, 2, 'd', 0)"],
  ["SPARK_INFORMATION_DATABASE.db", "SPARK_REQUEST_IDS",
    "INSERT INTO SPARK_REQUEST_IDS (sparkID, description, sendersPubkey, details) VALUES ('s', 'd', 'pk', '{}')"],
  ["SPARK_INFORMATION_DATABASE.db", "spend_and_replace_intents",
    "INSERT INTO spend_and_replace_intents (payment_id, account_id, amount_sats, status, created_at, updated_at) VALUES ('p', 'acc', 1, 'pending', 1, 1)"],
  ["SPARK_INFORMATION_DATABASE.db", "account_balance_snapshots",
    "INSERT INTO account_balance_snapshots (identityPubKey, balance, tokens, updatedAt) VALUES ('pk', 1, '{}', 1)"],
  ["SAVED_GIFTS.db", "giftsTable",
    "INSERT INTO giftsTable (uuid, createdBy, storageObject, lastUpdated) VALUES ('u', 'pk', '{}', 1)"],
  ["giftCards.db", "giftCardsTable",
    "INSERT INTO giftCardsTable (invoice, giftCardData, lastUpdated, status) VALUES ('inv', '{}', 1, 'Pending')"],
  ["SAVED_POOLS.db", "poolsTable",
    "INSERT INTO poolsTable (uuid, createdBy, storageObject, lastUpdated) VALUES ('u', 'pk', '{}', 1)"],
  ["SAVED_POOLS.db", "contributionsTable",
    "INSERT INTO contributionsTable (contributionId, poolId, storageObject, createdAtSeconds, createdAtNanos) VALUES ('c', 'p', '{}', 1, 0)"],
  ["SAVED_SAVINGS.db", "savings_goals",
    "INSERT INTO savings_goals (id, name, targetAmountMicros, createdAt, updatedAt) VALUES ('g', 'name', 1, 1, 1)"],
  ["SAVED_SAVINGS.db", "savings_transactions",
    "INSERT INTO savings_transactions (id, goalId, type, amountMicros, timestamp) VALUES ('t', 'g', 'deposit', 1, 1)"],
  ["SAVED_SAVINGS.db", "savings_payouts",
    "INSERT INTO savings_payouts (payoutSats, status, txId, createdAt, day, paidAt) VALUES (1, 'pending', 'tx', 1, 1, 1)"],
  ["btcmap.db", "btcmap_places",
    "INSERT INTO btcmap_places (id, lat, lon, icon, name) VALUES (1, 0, 0, '', 'name')"],
  ["btcmap.db", "provider_places",
    "INSERT INTO provider_places (source, native_id, lat, lon, icon, name, category) VALUES ('src', 'n', 0, 0, '', 'name', NULL)"],
  ["btcmap.db", "btcmap_meta",
    "INSERT INTO btcmap_meta (key, value) VALUES ('k', 'v')"],
  ["WALLET_LEAVES.db", "wallet_leaves",
    "INSERT INTO wallet_leaves (id, treeId, value, status, parentNodeId, data, updatedAt) VALUES ('l', 't', 1, 'UNKNOWN', NULL, '{}', 1)"],
  ["WALLET_LEAVES.db", "wallet_leaf_exit_nodes",
    "INSERT INTO wallet_leaf_exit_nodes (ownerIdentityPubKey, leafId, id, treeId, value, status, data, snapshotVersion, updatedAt) VALUES (NULL, 'l', 'e', 't', 1, 's', '{}', 0, 1)"],
  ["WALLET_LEAVES.db", "leaves_meta",
    "INSERT INTO leaves_meta (ownerIdentityPubKey, snapshotVersion) VALUES ('pk', 0)"],
  ["ROOTSTOCK_SWAPS.db", "saved_rootstock_swaps",
    "INSERT INTO saved_rootstock_swaps (id, type, data) VALUES ('id', 'submarine', '{}')"],
  ["nwc_invoices.db", "invoices",
    "INSERT INTO invoices (payment_hash, invoice, created_at, updated_at) VALUES ('ph', 'inv', 1, 1)"],
  ["nwc_event_ledger.db", "handled_events",
    "INSERT INTO handled_events (event_id, account_pubkey, created_at, status, attempts, processed_at) VALUES ('ev', 'pk', 1, 'done', 1, 1)"],
  ["nwc_event_ledger.db", "nwc_ledger_state",
    "INSERT INTO nwc_ledger_state (account_pubkey, budget_sent_msat, window_start) VALUES ('pk', 1, 1)"],
];

function raw(dbName) {
  return require('expo-sqlite').__connections.get(dbName);
}

function countRows(dbName, table) {
  return raw(dbName).prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
}

function tableExists(dbName, table) {
  return !!raw(dbName)
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
}

// Opens every db file (creating all tables) so seeds have real schemas.
async function openAllDatabases() {
  await initializeAllDatabases();
  await initLeavesDb(); // leaves tables already covered above; kept for clarity
  await getLastModified(); // opens btcmap.db (lazy, not in initializeAllDatabases)
  await NWCInvoiceManager.resetDatabase();
  await nwcEventLedger.resetDatabase();
}

function seedAllTables() {
  for (const [dbName, table, sql] of SEEDS) {
    raw(dbName).prepare(sql).run();
  }
}

describe('wipeLocalWalletData', () => {
  beforeEach(async () => {
    require('expo-sqlite').__setPoisonDb(null);
    require('@react-native-async-storage/async-storage').__store.clear();
    // A full wipe is the cleanest reset: wallet-local tables empty +
    // AsyncStorage empty. btcmap is NOT wallet-local (public, JIT, cross-wallet)
    // so the wipe intentionally leaves it intact — clear it explicitly for a
    // deterministic per-test baseline.
    await wipeLocalWalletData();
    await deleteBtcMapTable();
    await openAllDatabases();
    // Drop the reset wipe's calls (scrub + marker arm/disarm + cache deletes)
    // so tests only count their own invocation.
    jest.clearAllMocks();
  });

  afterEach(() => {
    require('expo-sqlite').__setPoisonDb(null);
  });

  test('drops every table and recreates it empty', async () => {
    seedAllTables();
    const store = require('@react-native-async-storage/async-storage').__store;
    store.set('someKey', 'value');
    store.set('otherKey', 'value');

    const result = await wipeLocalWalletData();

    expect(result).toBe(true);
    expect(store.size).toBe(0);
    for (const [dbName, table] of TABLES) {
      expect(tableExists(dbName, table)).toBe(true);
      expect(countRows(dbName, table)).toBe(0);
    }
    expect(deleteAsync).toHaveBeenCalledWith('file://cache/profile_images/', {
      idempotent: true,
    });
    expect(deleteAsync).toHaveBeenCalledWith('file://cache/tokenImages/', {
      idempotent: true,
    });
  });

  test('btcMap tables persist cross-wallet (not wiped)', async () => {
    seedAllTables();
    const { openDatabaseAsync } = require('expo-sqlite');
    const btcmapBefore = BTCMAP_TABLES.map(([db, tbl]) => [
      db,
      tbl,
      countRows(db, tbl),
    ]);

    await wipeLocalWalletData();

    // btcmap is public merchant cache, intentionally excluded from the
    // wallet-local wipe — it must survive and remain readable on the live
    // handle (no GC-poison of the expo-sqlite wrapper).
    expect(openDatabaseAsync).not.toHaveBeenCalled();
    for (const [dbName, table, beforeCount] of btcmapBefore) {
      expect(tableExists(dbName, table)).toBe(true);
      expect(countRows(dbName, table)).toBe(beforeCount);
    }
    // verify live handle still usable (seed's meta key 'k' survives)
    expect(await getLastModified()).toBe(null); // last_modified still null, meta 'k' untouched by wipe
    // explicit deleteBtcMapTable still works on same connection when called directly
    const connBefore = openDatabaseAsync.mock.calls.length;
    await deleteBtcMapTable();
    expect(openDatabaseAsync).not.toHaveBeenCalledWith('btcmap.db');
    expect(openDatabaseAsync.mock.calls.length).toBe(connBefore);
    for (const [dbName, table] of BTCMAP_TABLES) {
      expect(tableExists(dbName, table)).toBe(true);
      expect(countRows(dbName, table)).toBe(0);
    }
  });

  test('initBTCMapDB recreates the schema on the live handle (post-wipe repair path)', async () => {
    // Regression guard: every other module's init* re-runs setup on the live
    // connection via reinitialize(), so the re-init pass after a wipe repairs
    // a db whose tables were dropped without a successful recreate.
    // initBTCMapDB must do the same rather than just awaiting the memoized
    // openDB() promise.
    const { openDatabaseAsync } = require('expo-sqlite');
    raw('btcmap.db').exec('DROP TABLE btcmap_places');
    expect(tableExists('btcmap.db', 'btcmap_places')).toBe(false);

    expect(await initBTCMapDB()).toBe(true);

    expect(openDatabaseAsync).not.toHaveBeenCalled(); // same connection
    expect(tableExists('btcmap.db', 'btcmap_places')).toBe(true);
    expect(countRows('btcmap.db', 'btcmap_places')).toBe(0);
  });

  test('a brand-new wallet (all tables already empty) returns success', async () => {
    // beforeEach already left every table empty — the exact state a fresh
    // install has. This is the B1 regression guard: the wipe must not fail on
    // empty databases.
    const result = await wipeLocalWalletData();

    expect(result).toBe(true);
    for (const [dbName, table] of TABLES) {
      if (dbName !== 'btcmap.db') {
        expect(countRows(dbName, table)).toBe(0);
      }
    }
  });

  test('preserves userSelectedLanguage and didViewSeedPhrase across the wipe', async () => {
    seedAllTables();
    const store = require('@react-native-async-storage/async-storage').__store;
    store.set('userSelectedLanguage', 'de-DE');
    // pin.js writes this for the new wallet just before navigating; the wipe
    // runs after, so it must survive (a null default would flip a brand-new
    // wallet to "already viewed" and suppress the seed-backup nudge).
    store.set('didViewSeedPhrase', 'false');
    store.set('homepageTxPreferance', '25');

    const result = await wipeLocalWalletData();

    expect(result).toBe(true);
    expect(store.get('userSelectedLanguage')).toBe('de-DE');
    expect(store.get('didViewSeedPhrase')).toBe('false');
    expect(store.has('homepageTxPreferance')).toBe(false);
  });

  test('calls wipeStaleWalletKeychain during the wipe', async () => {
    await wipeLocalWalletData();

    expect(wipeStaleWalletKeychain).toHaveBeenCalledTimes(1);
  });

  test('wipeLocalWalletData returns false when the keychain scrub fails', async () => {
    seedAllTables();
    wipeStaleWalletKeychain.mockResolvedValueOnce(false);

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
  });

  test('deleteAllLocalWalletTables returns false when a delete rejects', async () => {
    seedAllTables();
    require('expo-sqlite').__setPoisonDb('SAVED_SAVINGS.db');

    const result = await deleteAllLocalWalletTables();

    expect(result).toBe(false);
  });

  test('wipeLocalWalletData returns false when a delete rejects', async () => {
    seedAllTables();
    require('expo-sqlite').__setPoisonDb('SAVED_SAVINGS.db');

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
  });

  test('wipeLocalWalletData returns false when re-init fails', async () => {
    seedAllTables();

    // Deletes succeed; only the re-init pass is poisoned (init* returns false
    // on a broken db, so initializeAllDatabases rejects with dbInitError).
    const originalInit = initializeAllDatabases;
    jest.spyOn(require('../../app/functions/initializeAllDatabases'), 'initializeAllDatabases')
      .mockImplementationOnce(async () => {
        throw new Error('dbInitError');
      });

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
    expect(originalInit).toBeDefined();
  });

  // ── Re-arm marker lifecycle (wipeInProgress) ───────────────────────────

  test('arms the marker before destructive steps and disarms only on success', async () => {
    seedAllTables();

    const result = await wipeLocalWalletData();

    expect(result).toBe(true);
    expect(armWipeInProgress).toHaveBeenCalledTimes(1);
    expect(disarmWipeInProgress).toHaveBeenCalledTimes(1);
    // Arm runs before any destructive step; disarm runs only after the
    // keychain scrub (the last failure-checked step) succeeded.
    expect(armWipeInProgress.mock.invocationCallOrder[0]).toBeLessThan(
      wipeStaleWalletKeychain.mock.invocationCallOrder[0],
    );
    expect(wipeStaleWalletKeychain.mock.invocationCallOrder[0]).toBeLessThan(
      disarmWipeInProgress.mock.invocationCallOrder[0],
    );
  });

  test('keeps the marker armed when clearing AsyncStorage fails', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage')
      .default;
    jest
      .spyOn(AsyncStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
    expect(armWipeInProgress).toHaveBeenCalledTimes(1);
    expect(disarmWipeInProgress).not.toHaveBeenCalled();
  });

  test('keeps the marker armed when the keychain scrub fails', async () => {
    seedAllTables();
    wipeStaleWalletKeychain.mockResolvedValueOnce(false);

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
    expect(armWipeInProgress).toHaveBeenCalledTimes(1);
    expect(disarmWipeInProgress).not.toHaveBeenCalled();
  });

  test('keeps the marker armed when a table delete rejects', async () => {
    seedAllTables();
    require('expo-sqlite').__setPoisonDb('SAVED_SAVINGS.db');

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
    expect(disarmWipeInProgress).not.toHaveBeenCalled();
  });

  test('keeps the marker armed when re-init fails', async () => {
    seedAllTables();
    jest
      .spyOn(
        require('../../app/functions/initializeAllDatabases'),
        'initializeAllDatabases',
      )
      .mockImplementationOnce(async () => {
        throw new Error('dbInitError');
      });

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
    expect(disarmWipeInProgress).not.toHaveBeenCalled();
  });

  test('returns false and keeps the marker when the disarm verification fails', async () => {
    disarmWipeInProgress.mockResolvedValueOnce(false);

    const result = await wipeLocalWalletData();

    expect(result).toBe(false);
  });

  test('still wipes when arming the marker fails (best-effort arm)', async () => {
    seedAllTables();
    armWipeInProgress.mockResolvedValueOnce(false);

    const result = await wipeLocalWalletData();

    expect(result).toBe(true);
    expect(wipeStaleWalletKeychain).toHaveBeenCalledTimes(1);
    expect(disarmWipeInProgress).toHaveBeenCalledTimes(1);
  });
});
