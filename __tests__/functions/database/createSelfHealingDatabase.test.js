jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import { openDatabaseAsync } from 'expo-sqlite';
import { createSelfHealingDatabase } from '../../../app/functions/database/createSelfHealingDatabase';

const releasedError = () =>
  new Error(
    "Call to function 'NativeDatabase.prepareAsync' has been rejected.\nCannot use shared object that was already released",
  );

function makeHandle(overrides = {}) {
  return {
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

test('reopens and retries once when the native handle was released', async () => {
  const dead = makeHandle({
    getAllAsync: jest.fn().mockRejectedValue(releasedError()),
  });
  const fresh = makeHandle({
    getAllAsync: jest.fn().mockResolvedValue([{ id: 1 }]),
  });
  openDatabaseAsync.mockResolvedValueOnce(dead).mockResolvedValueOnce(fresh);

  const conn = createSelfHealingDatabase({ name: 'X.db' });
  const rows = await conn.db.getAllAsync('SELECT 1');

  expect(rows).toEqual([{ id: 1 }]);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  expect(dead.getAllAsync).toHaveBeenCalledTimes(1);
  expect(fresh.getAllAsync).toHaveBeenCalledTimes(1);
});

test('re-runs setup on the reopened connection (per-connection pragmas)', async () => {
  const setup = jest.fn().mockResolvedValue(undefined);
  const dead = makeHandle({
    runAsync: jest.fn().mockRejectedValue(releasedError()),
  });
  const fresh = makeHandle();
  openDatabaseAsync.mockResolvedValueOnce(dead).mockResolvedValueOnce(fresh);

  const conn = createSelfHealingDatabase({ name: 'X.db', setup });
  await conn.ensureReady();
  await conn.db.runAsync('INSERT ...');

  expect(setup).toHaveBeenCalledTimes(2); // initial open + reopen
  expect(setup).toHaveBeenLastCalledWith(fresh);
});

test('does not reopen on an unrelated error', async () => {
  const handle = makeHandle({
    getAllAsync: jest.fn().mockRejectedValue(new Error('no such table')),
  });
  openDatabaseAsync.mockResolvedValueOnce(handle);

  const conn = createSelfHealingDatabase({ name: 'X.db' });
  await expect(conn.db.getAllAsync('SELECT 1')).rejects.toThrow('no such table');
  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
});

test('reinitialize re-runs setup on the same connection', async () => {
  const setup = jest.fn().mockResolvedValue(undefined);
  const handle = makeHandle();
  openDatabaseAsync.mockResolvedValue(handle);

  const conn = createSelfHealingDatabase({ name: 'X.db', setup });
  await conn.ensureReady();
  await conn.reinitialize();

  expect(setup).toHaveBeenCalledTimes(2);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(1); // no reopen
});

// Regression for the pools/leaves crash: setup runs raw execAsync on the
// handle (setupPoolsSchema/setupLeavesSchema). If the handle dies (OOM / GC of a
// sibling wrapper, expo/expo#48999) the released error surfaces inside setup —
// outside the query self-heal — as "NativeDatabase.execAsync has been rejected".
test('reopens and re-runs setup when the handle dies during schema setup', async () => {
  const setup = jest.fn(db => db.execAsync('CREATE TABLE ...'));
  const dead = makeHandle({
    execAsync: jest.fn().mockRejectedValue(releasedError()),
  });
  const fresh = makeHandle();
  openDatabaseAsync.mockResolvedValueOnce(dead).mockResolvedValueOnce(fresh);

  const conn = createSelfHealingDatabase({ name: 'X.db', setup });

  await expect(conn.ensureReady()).resolves.toBeDefined();
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  expect(dead.execAsync).toHaveBeenCalledTimes(1);
  expect(fresh.execAsync).toHaveBeenCalledTimes(1);
});

test('reinitialize recovers when the live handle died before schema recreate', async () => {
  const setup = jest.fn(db => db.execAsync('CREATE TABLE ...'));
  // Same handle across the first open; its setup succeeds once, then the handle
  // dies, so the reinitialize() setup pass rejects with the released error.
  const dead = makeHandle({
    execAsync: jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(releasedError()),
  });
  const fresh = makeHandle();
  openDatabaseAsync.mockResolvedValueOnce(dead).mockResolvedValueOnce(fresh);

  const conn = createSelfHealingDatabase({ name: 'X.db', setup });
  await conn.ensureReady();
  await expect(conn.reinitialize()).resolves.toBeDefined();
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  expect(fresh.execAsync).toHaveBeenCalledTimes(1);
});

test('setup that fails with an unrelated error still propagates (no reopen)', async () => {
  const setup = jest.fn().mockRejectedValue(new Error('disk I/O error'));
  openDatabaseAsync.mockResolvedValue(makeHandle());

  const conn = createSelfHealingDatabase({ name: 'X.db', setup });
  await expect(conn.ensureReady()).rejects.toThrow('disk I/O error');
  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
});

test('a failed open is not cached; the next call retries', async () => {
  openDatabaseAsync
    .mockRejectedValueOnce(new Error('open failed'))
    .mockResolvedValueOnce(makeHandle());

  const conn = createSelfHealingDatabase({ name: 'X.db' });
  await expect(conn.ensureReady()).rejects.toThrow('open failed');
  await expect(conn.ensureReady()).resolves.toBeDefined();
  expect(conn.isOpen()).toBe(true);
});
