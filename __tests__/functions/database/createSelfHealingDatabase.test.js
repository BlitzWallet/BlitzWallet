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

test('a failed open is not cached; the next call retries', async () => {
  openDatabaseAsync
    .mockRejectedValueOnce(new Error('open failed'))
    .mockResolvedValueOnce(makeHandle());

  const conn = createSelfHealingDatabase({ name: 'X.db' });
  await expect(conn.ensureReady()).rejects.toThrow('open failed');
  await expect(conn.ensureReady()).resolves.toBeDefined();
  expect(conn.isOpen()).toBe(true);
});
