/* eslint-env jest */
// ---------------------------------------------------------------------------
// giftsStorage — the derived gift seed (restoreKey) must never cross the
// storage boundary, in either direction:
//   - Writes (saveGiftLocal / bulkSaveGiftsLocal) strip it before persisting,
//     even if a caller still passes a legacy gift object.
//   - Reads (getAllLocalGifts / getGiftByUuid) strip it from rows written by
//     older app versions.
//   - updateGiftLocal scrubs legacy rows from disk on their next update
//     (the merged object is written back without restoreKey).
// ---------------------------------------------------------------------------

const mockRows = new Map();

const mockDb = {
  execAsync: jest.fn(async () => {}),
  getFirstAsync: jest.fn(async (_sql, params) => {
    if (!params) return null;
    return mockRows.get(params[0]) || null;
  }),
  getAllAsync: jest.fn(async () => [...mockRows.values()]),
  runAsync: jest.fn(async (sql, params = []) => {
    if (sql.includes('INTO giftsTable')) {
      for (let i = 0; i < params.length; i += 4) {
        const [uuid, createdBy, storageObject, lastUpdated] = params.slice(
          i,
          i + 4,
        );
        mockRows.set(uuid, { uuid, createdBy, storageObject, lastUpdated });
      }
      return { changes: params.length / 4 };
    }
    if (sql.includes('UPDATE giftsTable')) {
      // Migration scrub: `SET storageObject = ? WHERE uuid = ?` (no lastUpdated).
      if (!sql.includes('lastUpdated')) {
        const [storageObject, uuid] = params;
        const prev = mockRows.get(uuid);
        mockRows.set(uuid, { ...prev, uuid, storageObject });
        return { changes: 1 };
      }
      const [storageObject, lastUpdated, createdBy, uuid] = params;
      mockRows.set(uuid, { uuid, createdBy, storageObject, lastUpdated });
      return { changes: 1 };
    }
    if (sql.includes('DELETE FROM giftsTable')) {
      mockRows.delete(params[0]);
      return { changes: 1 };
    }
    return { changes: 0 };
  }),
  withTransactionAsync: jest.fn(async fn => fn()),
};

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

const {
  saveGiftLocal,
  getAllLocalGifts,
  getGiftByUuid,
  updateGiftLocal,
  bulkSaveGiftsLocal,
  initGiftDb,
} = require('../../../app/functions/gift/giftsStorage');

const UUID = 'gift-uuid-1';
const CREATED_BY = 'me-uuid';

function seedRowWithRestoreKey(uuid = UUID) {
  mockRows.set(uuid, {
    uuid,
    createdBy: CREATED_BY,
    storageObject: JSON.stringify({
      uuid,
      createdBy: CREATED_BY,
      giftNum: 1001,
      state: 'Expired',
      restoreKey: 'twelve secret words go here',
    }),
    lastUpdated: 1,
  });
}

function persistedObject(uuid = UUID) {
  return JSON.parse(mockRows.get(uuid).storageObject);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.clear();
});

describe('giftsStorage — write path never persists restoreKey', () => {
  test('saveGiftLocal strips restoreKey before persisting', async () => {
    await saveGiftLocal({
      uuid: UUID,
      createdBy: CREATED_BY,
      giftNum: 1001,
      restoreKey: 'twelve secret words go here',
    });

    expect('restoreKey' in persistedObject()).toBe(false);
  });

  test('saveGiftLocal does not mutate the caller gift object', async () => {
    const gift = {
      uuid: UUID,
      createdBy: CREATED_BY,
      restoreKey: 'twelve secret words go here',
    };

    await saveGiftLocal(gift);

    expect(gift.restoreKey).toBe('twelve secret words go here');
  });

  test('bulkSaveGiftsLocal strips restoreKey before persisting', async () => {
    await bulkSaveGiftsLocal([
      {
        uuid: UUID,
        createdBy: CREATED_BY,
        giftNum: 1001,
        restoreKey: 'twelve secret words go here',
      },
    ]);

    expect('restoreKey' in persistedObject()).toBe(false);
  });
});

describe('giftsStorage — read path never surfaces a legacy restoreKey', () => {
  test('getAllLocalGifts strips a legacy persisted restoreKey', async () => {
    seedRowWithRestoreKey();

    const gifts = await getAllLocalGifts();

    expect(gifts).toHaveLength(1);
    expect('restoreKey' in gifts[0]).toBe(false);
  });

  test('getGiftByUuid strips a legacy persisted restoreKey', async () => {
    seedRowWithRestoreKey();

    const gift = await getGiftByUuid(UUID);

    expect(gift).toBeTruthy();
    expect('restoreKey' in gift).toBe(false);
  });
});

describe('giftsStorage — legacy rows are scrubbed on write-back', () => {
  test('updateGiftLocal removes restoreKey from a legacy row on the next update', async () => {
    seedRowWithRestoreKey();

    await updateGiftLocal(UUID, { state: 'Claimed' });

    const stored = persistedObject();
    expect(stored.state).toBe('Claimed');
    expect('restoreKey' in stored).toBe(false);
  });
});

describe('giftsStorage — init migration scrubs seeds already at rest', () => {
  test('initGiftDb rewrites a legacy Expired row so restoreKey leaves disk', async () => {
    // An already-Expired legacy row is never touched by updateGiftLocal again,
    // so the one-time init scrub is what actually removes it from disk.
    seedRowWithRestoreKey();
    expect('restoreKey' in persistedObject()).toBe(true);

    await initGiftDb();

    const stored = persistedObject();
    expect(stored.state).toBe('Expired');
    expect('restoreKey' in stored).toBe(false);
  });
});
