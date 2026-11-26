/* eslint-env jest */
// Read-burst counting for NWC notification coalescing: the notify step counts
// this connection's recent handled read requests in the shared ledger. Ways
// this can go wrong, each covered below:
//  1. The current event is not counted (first read would post "0 requests").
//  2. Another connection's reads inflate the count.
//  3. failed / processing rows count as reads.
//  4. A read older than the 5-minute window keeps the burst alive.
//  5. Payment methods count as reads.

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const connections = new Map();
  return {
    __esModule: true,
    openDatabaseAsync: jest.fn(async name => {
      if (!connections.has(name)) connections.set(name, new DB(':memory:'));
      const sqlite = connections.get(name);
      return {
        execAsync: async sql => sqlite.exec(sql),
        runAsync: async (sql, params = []) => {
          const r = sqlite.prepare(sql).run(...params);
          return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
        },
        getAllAsync: async (sql, params = []) =>
          sqlite.prepare(sql).all(...params),
        getFirstAsync: async (sql, params = []) =>
          sqlite.prepare(sql).get(...params) ?? null,
      };
    }),
  };
});
jest.mock('../../../app/functions/nwc/sharedStorage', () => ({
  migrateNWCDatabase: jest.fn(),
  getNWCDatabaseDirectory: jest.fn(() => ''),
}));

const {
  nwcEventLedger,
  NWC_READ_METHODS,
  NWC_BURST_WINDOW_MS,
} = require('../../../app/functions/nwc/eventLedger');

const ACCOUNT = 'ab'.repeat(32);
const OTHER_ACCOUNT = 'cd'.repeat(32);
const NOW = 1_700_000_000_000;
let sequence = 0;

// Seeds a handled_events row the way backgroundNofifications.js does:
// claim → setMethod → done/failed.
const seed = async ({
  account = ACCOUNT,
  method,
  status = 'done',
  processedAt = NOW,
}) => {
  const eventId = `evt-${++sequence}`;
  await nwcEventLedger.claimEvent(eventId, account, 1, processedAt);
  await nwcEventLedger.setMethod(eventId, method);
  if (status === 'done') await nwcEventLedger.markDone(eventId, processedAt);
  if (status === 'failed') await nwcEventLedger.markFailed(eventId, processedAt);
};

beforeEach(async () => {
  await nwcEventLedger.resetDatabase();
});

describe('nwcEventLedger.countRecentReads', () => {
  test('exports the read set and burst window', () => {
    expect(NWC_BURST_WINDOW_MS).toBe(300000);
    expect(NWC_READ_METHODS).toEqual([
      'get_info',
      'get_balance',
      'list_transactions',
      'lookup_invoice',
    ]);
  });

  test('counts done reads for the account within 5 min (1)', async () => {
    await seed({ method: 'get_balance', processedAt: NOW - 1000 });
    await seed({ method: 'get_info', processedAt: NOW - 2000 });
    await seed({ method: 'list_transactions', processedAt: NOW - 3000 });

    expect(await nwcEventLedger.countRecentReads(ACCOUNT, NOW)).toBe(3);
  });

  test('excludes other accounts (2)', async () => {
    await seed({ method: 'get_balance', processedAt: NOW - 1000 });
    await seed({
      account: OTHER_ACCOUNT,
      method: 'get_balance',
      processedAt: NOW - 1000,
    });
    await seed({
      account: OTHER_ACCOUNT,
      method: 'get_info',
      processedAt: NOW - 2000,
    });

    expect(await nwcEventLedger.countRecentReads(ACCOUNT, NOW)).toBe(1);
  });

  test('excludes failed and processing rows (3)', async () => {
    await seed({ method: 'get_balance', processedAt: NOW - 1000 });
    await seed({
      method: 'get_balance',
      status: 'failed',
      processedAt: NOW - 1000,
    });
    await seed({
      method: 'get_balance',
      status: 'processing',
      processedAt: NOW - 1000,
    });

    expect(await nwcEventLedger.countRecentReads(ACCOUNT, NOW)).toBe(1);
  });

  test('excludes reads older than 5 min (4)', async () => {
    await seed({ method: 'get_balance', processedAt: NOW - 1000 });
    await seed({ method: 'get_balance', processedAt: NOW - 300001 });
    await seed({ method: 'get_balance', processedAt: NOW - 600000 });

    expect(await nwcEventLedger.countRecentReads(ACCOUNT, NOW)).toBe(1);
  });

  test('excludes pay_invoice and make_invoice (5)', async () => {
    await seed({ method: 'get_balance', processedAt: NOW - 1000 });
    await seed({ method: 'get_info', processedAt: NOW - 2000 });
    await seed({ method: 'lookup_invoice', processedAt: NOW - 3000 });
    await seed({ method: 'pay_invoice', processedAt: NOW - 1000 });
    await seed({ method: 'make_invoice', processedAt: NOW - 1000 });

    expect(await nwcEventLedger.countRecentReads(ACCOUNT, NOW)).toBe(3);
  });
});
