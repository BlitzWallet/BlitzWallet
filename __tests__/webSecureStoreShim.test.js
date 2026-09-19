// Web expo-secure-store shim must open write transactions with strict
// durability so `complete` means flushed to disk. The legacy migration deletes
// the only other seed copy right after that event (review F-08).
function installFakeIndexedDB() {
  const calls = [];
  const data = new Map();
  const db = {
    transaction(store, mode, options) {
      calls.push({ mode, options });
      const t = {};
      const wrap = fn => {
        const request = { result: fn() };
        setTimeout(() => t.oncomplete());
        return request;
      };
      t.objectStore = () => ({
        put: (v, k) => wrap(() => data.set(k, v) && undefined),
        get: k => wrap(() => data.get(k)),
        delete: k => wrap(() => data.delete(k) && undefined),
      });
      return t;
    },
  };
  global.indexedDB = {
    open() {
      const req = { result: db };
      setTimeout(() => req.onsuccess());
      return req;
    },
  };
  return calls;
}

describe('web expo-secure-store shim', () => {
  let calls;
  let store;
  beforeEach(() => {
    jest.resetModules();
    calls = installFakeIndexedDB();
    store = require('../web-shims/expo-secure-store');
  });
  afterEach(() => {
    delete global.indexedDB;
  });

  it('opens writes and deletes with strict durability', async () => {
    await store.setItemAsync('encryptedMnemonic', 'envelope');
    await store.deleteItemAsync('encryptedMnemonic');
    const writes = calls.filter(c => c.mode === 'readwrite');
    expect(writes).toHaveLength(2);
    writes.forEach(c => expect(c.options).toEqual({ durability: 'strict' }));
  });

  it('still round-trips values', async () => {
    await store.setItemAsync('k', 'v');
    expect(await store.getItemAsync('k')).toBe('v');
  });
});
