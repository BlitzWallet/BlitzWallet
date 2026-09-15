const WEB = '../../app/functions/webDatabaseOwnership.web.js';
const NATIVE = '../../app/functions/webDatabaseOwnership.js';

// Minimal origin-wide Web Locks fake: exclusive, ifAvailable, released when
// the callback's returned promise settles.
function makeLocks() {
  const held = new Set();
  return {
    request: jest.fn(async (name, opts, cb) => {
      if (held.has(name)) return cb(null);
      held.add(name);
      try {
        return await cb({ name });
      } finally {
        held.delete(name);
      }
    }),
  };
}

// Each "tab" is a fresh module instance sharing the same origin locks.
function loadTab(mod = WEB) {
  jest.resetModules();
  return require(mod);
}

describe('webDatabaseOwnership', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'locks', {
      value: makeLocks(),
      configurable: true,
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('first tab owns for its lifetime, second tab conflicts', async () => {
    const tabA = loadTab();
    await expect(tabA.acquireWebDatabaseOwnership()).resolves.toBe(true);
    // Idempotent: same tab re-acquiring reuses the held lock.
    await expect(tabA.acquireWebDatabaseOwnership()).resolves.toBe(true);
    expect(navigator.locks.request).toHaveBeenCalledTimes(1);

    const tabB = loadTab();
    const err = await tabB.acquireWebDatabaseOwnership().catch(e => e);
    expect(err.message).toBe(tabB.WEB_DB_TAB_CONFLICT_ERROR);
    expect(tabB.isTabConflictError(err)).toBe(true);
  });

  test('conflict is not memoized, so a later attempt re-requests', async () => {
    loadTab().acquireWebDatabaseOwnership();
    const tabB = loadTab();
    await expect(tabB.acquireWebDatabaseOwnership()).rejects.toThrow();
    await expect(tabB.acquireWebDatabaseOwnership()).rejects.toThrow();
    expect(navigator.locks.request).toHaveBeenCalledTimes(3);
  });

  test('native stub is a no-op and never matches conflict errors', async () => {
    const native = loadTab(NATIVE);
    await expect(native.acquireWebDatabaseOwnership()).resolves.toBe(true);
    expect(navigator.locks.request).not.toHaveBeenCalled();
    const web = loadTab();
    expect(
      native.isTabConflictError(new Error(web.WEB_DB_TAB_CONFLICT_ERROR)),
    ).toBe(false);
  });

  test('web only maps the explicit conflict error', () => {
    const tab = loadTab();
    expect(tab.isTabConflictError(new Error('SQLITE_CANTOPEN'))).toBe(false);
    expect(tab.isTabConflictError(new Error('dbInitError'))).toBe(false);
  });
});
