// POS tip records arrive from a Firestore catch-up query keyed on the stored
// row with the newest timestamp, so already-stored rows can be re-delivered.
// Ways ingestion can lose tips:
//  1. One re-delivered row fails the UNIQUE(dbDateAdded) insert and rolls back
//     the new rows batched with it, on every relaunch.
//  2. A re-delivered row overwrites the stored one (e.g. resets didPay).
jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const sqlite = new DB(':memory:');
  return {
    openDatabaseAsync: jest.fn(async () => ({
      execAsync: async sql => sqlite.exec(sql),
      runAsync: async (sql, params = []) => sqlite.prepare(sql).run(...params),
      getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
      getFirstAsync: async (sql, params = []) =>
        sqlite.prepare(sql).get(...params) ?? null,
    })),
    __sqlite: sqlite,
  };
});
jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(async () => null),
  setLocalStorageItem: jest.fn(async () => true),
}));
jest.mock('../../../app/functions/messaging/encodingAndDecodingMessages', () => ({
  decryptMessage: jest.fn((_k, _p, tx) => tx),
}));

const { __sqlite } = require('expo-sqlite');
const {
  initializePOSTransactionsDatabase,
  queuePOSTransactions,
  bulkUpdateDidPay,
} = require('../../../app/functions/pos');

const record = dateAdded => ({
  dateAdded,
  tx: JSON.stringify({ tipAmountSats: 5, orderAmountSats: 100, time: dateAdded }),
});
const flush = () => new Promise(r => setTimeout(r, 0));
const rows = () =>
  __sqlite
    .prepare('SELECT dbDateAdded, didPay FROM POS_TRANSACTIONS ORDER BY dbDateAdded')
    .all()
    .map(r => ({ ...r }));

test('a re-delivered row keeps the new rows of its batch and its own state (1, 2)', async () => {
  await initializePOSTransactionsDatabase();
  queuePOSTransactions({ transactionsList: [record(100)], privateKey: 'k' });
  await flush();
  await bulkUpdateDidPay([100]);

  queuePOSTransactions({
    transactionsList: [record(100), record(200)],
    privateKey: 'k',
  });
  await flush();

  expect(rows()).toEqual([
    { dbDateAdded: 100, didPay: 1 },
    { dbDateAdded: 200, didPay: 0 },
  ]);
});
