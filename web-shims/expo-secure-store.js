// Web shim for expo-secure-store: an IndexedDB key/value store.
// Only ciphertext, pinHash and mode flags are ever stored here — the mnemonic
// is already password-encrypted (Argon2id -> AES) before it reaches storage.
const DB_NAME = 'blitz-secure-store';
const STORE = 'kv';

export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'afterFirstUnlockThisDeviceOnly';
export const WHEN_UNLOCKED = 'whenUnlocked';

let dbPromise = null;
function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Best-effort: ask the browser not to evict this origin's storage.
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  return dbPromise;
}

function tx(mode, fn) {
  return getDB().then(
    db =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const request = fn(store);
        t.oncomplete = () => resolve(request?.result ?? null);
        t.onerror = () => reject(t.error);
      }),
  );
}

export async function setItemAsync(key, value) {
  await tx('readwrite', s => s.put(value, key));
}

export async function getItemAsync(key) {
  const v = await tx('readonly', s => s.get(key));
  return v == null ? null : v;
}

export async function deleteItemAsync(key) {
  await tx('readwrite', s => s.delete(key));
}

export async function isAvailableAsync() {
  return typeof indexedDB !== 'undefined';
}

export default {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  WHEN_UNLOCKED,
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
  isAvailableAsync,
};
