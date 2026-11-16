// Tiny Map-backed fake of expo-sqlite; answers only the SQL exitStore issues
// (matched on leading keyword + table name).
const mockDb = { live: new Map(), archive: [], kept: new Map() };

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    getFirstAsync: async (sql, p = []) => {
      if (/FROM exit_recoveries WHERE id/.test(sql)) {
        return mockDb.kept.get(p[0]) ?? null;
      }
      if (/FROM exit_recoveries/.test(sql)) {
        return [...mockDb.kept.values()][0] ?? null;
      }
      if (/FROM exit_record WHERE/.test(sql)) {
        return mockDb.live.get(p[0]) ?? null;
      }
      if (/FROM exit_record/.test(sql)) {
        const first = [...mockDb.live.values()][0];
        return first ?? null;
      }
      throw new Error(`unexpected getFirstAsync: ${sql}`);
    },
    runAsync: async (sql, p = []) => {
      if (/^INSERT INTO exit_recoveries/.test(sql)) {
        mockDb.kept.set(p[0], {
          id: p[0],
          identity: p[1],
          json: p[2],
          updated_at: p[3],
        });
      } else if (/^DELETE FROM exit_recoveries WHERE/.test(sql)) {
        mockDb.kept.delete(p[0]);
      } else if (/^INSERT INTO exit_record/.test(sql)) {
        mockDb.live.set(p[0], {
          identity: p[0],
          json: p[1],
          revision: p[2],
          updated_at: p[3],
        });
      } else if (/^INSERT INTO exit_archive/.test(sql)) {
        mockDb.archive.push({ identity: p[0], finished_at: p[1], json: p[2] });
      } else if (/^DELETE FROM exit_record WHERE/.test(sql)) {
        mockDb.live.delete(p[0]);
      } else if (/^DELETE FROM exit_record/.test(sql)) {
        mockDb.live.clear();
      } else if (/^DELETE FROM exit_archive/.test(sql)) {
        mockDb.archive.length = 0;
      } else {
        throw new Error(`unexpected runAsync: ${sql}`);
      }
    },
    getAllAsync: async (sql, p = []) =>
      /FROM exit_recoveries/.test(sql)
        ? [...mockDb.kept.values()].filter(r => r.identity === p[0])
        : [],
  }),
}));

let store;
beforeEach(() => {
  mockDb.live.clear();
  mockDb.archive.length = 0;
  mockDb.kept.clear();
  jest.resetModules();
  store = require('../../../app/functions/unilateralExit/exitStore');
});

const rec = (over = {}) => ({
  status: 'active',
  recovery: null,
  leafIds: ['a'],
  ...over,
});

describe('exitStore', () => {
  it('saves and loads a record', async () => {
    const saved = await store.saveExitRecord('id1', rec());
    expect(saved).toMatchObject({ identity: 'id1', v: 1, revision: 1 });
    expect(await store.loadExitRecord('id1')).toEqual({
      record: saved,
      corrupt: false,
    });
    const again = await store.saveExitRecord('id1', rec());
    expect(again.revision).toBe(2);
    expect(await store.hasActiveExit('id1')).toBe(true);
    expect(await store.loadExitRecord('nope')).toEqual({
      record: null,
      corrupt: false,
    });
  });

  it('refuses to downgrade a record that has a recovery', async () => {
    await store.saveExitRecord('id1', rec({ recovery: 'abc' }));
    await expect(
      store.saveExitRecord('id1', rec({ recovery: null })),
    ).rejects.toBeInstanceOf(store.ExitDowngradeError);
    expect((await store.loadExitRecord('id1')).record.recovery).toBe('abc');
  });

  it('allows null recovery when status is done', async () => {
    await store.saveExitRecord('id1', rec({ recovery: 'abc' }));
    const saved = await store.saveExitRecord(
      'id1',
      rec({ recovery: null, status: 'done' }),
    );
    expect(saved.status).toBe('done');
  });

  it('refuses to overwrite a corrupt record', async () => {
    mockDb.live.set('id1', { identity: 'id1', json: '{garbage', revision: 4 });
    expect(await store.loadExitRecord('id1')).toEqual({
      record: null,
      corrupt: true,
    });
    await expect(store.saveExitRecord('id1', rec())).rejects.toBeInstanceOf(
      store.ExitCorruptError,
    );
    expect(mockDb.live.get('id1').json).toBe('{garbage');
    const saved = await store.saveExitRecord('id1', rec(), {
      replaceCorrupt: true,
    });
    expect(saved.revision).toBe(5);
  });

  it('treats a record whose identity field differs as corrupt', async () => {
    mockDb.live.set('id1', {
      identity: 'id1',
      json: JSON.stringify({ v: 1, identity: 'other', status: 'active' }),
      revision: 1,
    });
    expect((await store.loadExitRecord('id1')).corrupt).toBe(true);
    mockDb.live.set('id2', {
      identity: 'id2',
      json: JSON.stringify({ v: 2, identity: 'id2' }),
      revision: 1,
    });
    expect((await store.loadExitRecord('id2')).corrupt).toBe(true);
  });

  it('isolates records by identity', async () => {
    await store.saveExitRecord('a', rec({ leafIds: ['x'] }));
    await store.saveExitRecord('b', rec({ leafIds: ['y'] }));
    expect((await store.loadExitRecord('a')).record.leafIds).toEqual(['x']);
    expect((await store.loadExitRecord('b')).record.leafIds).toEqual(['y']);
  });

  it('archive moves the row', async () => {
    await store.saveExitRecord('a', rec());
    await store.archiveExitRecord('a');
    expect(await store.hasActiveExit('a')).toBe(false);
    expect(mockDb.archive).toHaveLength(1);
    expect(mockDb.archive[0].identity).toBe('a');
    await store.archiveExitRecord('a'); // no live row: no-op
    expect(mockDb.archive).toHaveLength(1);
  });

  it('wipe keeps everything while an exit is live', async () => {
    await store.saveExitRecord('a', rec());
    mockDb.archive.push({ identity: 'z', finished_at: 1, json: '{}' });
    await store.clearInactiveExitData();
    expect(mockDb.live.size).toBe(1);
    expect(mockDb.archive).toHaveLength(1);
  });

  it('wipe clears everything when no exit is live', async () => {
    await store.saveExitRecord('a', rec());
    await store.archiveExitRecord('a');
    await store.clearInactiveExitData();
    expect(mockDb.live.size).toBe(0);
    expect(mockDb.archive).toHaveLength(0);
  });

  describe('kept recoveries', () => {
    const kept = (over = {}) => ({
      id: 'k1',
      mode: 'recover',
      ...rec(),
      ...over,
    });

    it('saves, lists, and archives a kept recovery', async () => {
      const saved = await store.saveKeptRecovery('a', kept());
      expect(saved).toMatchObject({ id: 'k1', identity: 'a', v: 1 });
      await store.saveKeptRecovery('a', kept({ id: 'k2' }));
      await store.saveKeptRecovery('b', kept({ id: 'k3' }));
      expect((await store.listKeptRecoveries('a')).map(r => r.id)).toEqual([
        'k1',
        'k2',
      ]);
      await store.archiveKeptRecovery('a', 'k1');
      expect((await store.listKeptRecoveries('a')).map(r => r.id)).toEqual([
        'k2',
      ]);
      expect(mockDb.archive).toHaveLength(1);
      expect(mockDb.archive[0].identity).toBe('a');
    });

    it('overwrites by id', async () => {
      await store.saveKeptRecovery('a', kept());
      await store.saveKeptRecovery('a', kept({ status: 'done' }));
      const list = await store.listKeptRecoveries('a');
      expect(list).toHaveLength(1);
      expect(list[0].status).toBe('done');
    });

    it('does not block a new exit', async () => {
      await store.saveKeptRecovery('a', kept());
      expect(await store.hasActiveExit('a')).toBe(false);
    });

    it('a live recover-mode record does not block, an old one does', async () => {
      await store.saveExitRecord('a', rec({ mode: 'recover' }));
      expect(await store.hasActiveExit('a')).toBe(false);
      await store.saveExitRecord('b', rec());
      expect(await store.hasActiveExit('b')).toBe(true);
    });

    it('a corrupt live row still blocks', async () => {
      mockDb.live.set('c', { identity: 'c', json: '{garbage', revision: 1 });
      expect(await store.hasActiveExit('c')).toBe(true);
    });

    it('wipe keeps everything while a kept recovery exists', async () => {
      await store.saveKeptRecovery('a', kept());
      mockDb.archive.push({ identity: 'z', finished_at: 1, json: '{}' });
      await store.clearInactiveExitData();
      expect(mockDb.archive).toHaveLength(1);
      expect(mockDb.kept.size).toBe(1);
    });
  });
});
