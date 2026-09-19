const WEB = '../../app/functions/webDatabaseOwnership.web.js';
const NATIVE = '../../app/functions/webDatabaseOwnership.js';

// Origin-wide Web Locks fake: exclusive, queued waiters, abortable via
// `signal`. A holder keeps the lock until the test calls release() (what a
// tab reload does in the browser).
function makeLocks() {
  let held = false;
  const waiters = [];
  const grant = waiter => {
    held = true;
    waiter.cb({ name: 'lock' });
  };
  return {
    release() {
      held = false;
      const next = waiters.shift();
      if (next) grant(next);
    },
    request: jest.fn(
      (name, opts, cb) =>
        new Promise((resolve, reject) => {
          const waiter = { cb };
          if (!held) return grant(waiter);
          waiters.push(waiter);
          opts?.signal?.addEventListener('abort', () => {
            const i = waiters.indexOf(waiter);
            if (i === -1) return;
            waiters.splice(i, 1);
            reject(new Error('AbortError'));
          });
        }),
    ),
  };
}

// Async cross-tab delivery, like the real BroadcastChannel.
const channels = new Set();
class FakeBroadcastChannel {
  constructor() {
    channels.add(this);
    this.onmessage = null;
    this.sent = [];
  }
  postMessage(data) {
    this.sent.push(data);
    channels.forEach(c => {
      if (c !== this) setTimeout(() => c.onmessage?.({ data }));
    });
  }
  close() {
    channels.delete(this);
  }
}

// Each "tab" is a fresh module instance sharing the same origin locks.
function loadTab(mod = WEB) {
  jest.resetModules();
  return require(mod);
}

const flush = () => new Promise(res => setTimeout(res, 0));

describe('webDatabaseOwnership', () => {
  let session;

  beforeEach(() => {
    channels.clear();
    session = new Map();
    Object.defineProperty(navigator, 'locks', {
      value: makeLocks(),
      configurable: true,
    });
    global.BroadcastChannel = FakeBroadcastChannel;
    global.sessionStorage = {
      getItem: k => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => session.set(k, String(v)),
      removeItem: k => session.delete(k),
    };
    global.window.location = { reload: jest.fn() };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    delete global.BroadcastChannel;
    delete global.sessionStorage;
  });

  test('first tab owns for its lifetime, re-acquire is idempotent', async () => {
    const tabA = loadTab();
    await expect(tabA.acquireWebDatabaseOwnership()).resolves.toBe(true);
    await expect(tabA.acquireWebDatabaseOwnership()).resolves.toBe(true);
    expect(navigator.locks.request).toHaveBeenCalledTimes(1);
  });

  test('newer tab takes over: old tab marks itself displaced and reloads', async () => {
    const tabA = loadTab();
    await tabA.acquireWebDatabaseOwnership();
    // The reload unloads tab A, which releases its lock.
    window.location.reload.mockImplementation(() => navigator.locks.release());

    const tabB = loadTab();
    await expect(tabB.acquireWebDatabaseOwnership()).resolves.toBe(true);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(tabA.isTabDisplaced()).toBe(true);
  });

  test('displaced tab never broadcasts or requests the lock', async () => {
    session.set('blitzwallet-tab-displaced', '1');
    const tab = loadTab();
    const err = await tab.acquireWebDatabaseOwnership().catch(e => e);
    expect(tab.isTabConflictError(err)).toBe(true);
    expect(navigator.locks.request).not.toHaveBeenCalled();
    expect(channels.size).toBe(0);
  });

  test('owner that never yields (frozen tab) times out into a memoized conflict', async () => {
    jest.useFakeTimers();
    loadTab().acquireWebDatabaseOwnership();
    const tabB = loadTab();
    const pending = tabB.acquireWebDatabaseOwnership().catch(e => e);
    await jest.advanceTimersByTimeAsync(3000);
    expect(tabB.isTabConflictError(await pending)).toBe(true);

    // No automatic re-claim: a second broadcast could displace the real owner
    // while this tab is already showing the tab-in-use screen.
    await expect(tabB.acquireWebDatabaseOwnership()).rejects.toThrow();
    expect(navigator.locks.request).toHaveBeenCalledTimes(2);
  });

  test('owner ignores unrelated messages', async () => {
    const tabA = loadTab();
    await tabA.acquireWebDatabaseOwnership();
    new FakeBroadcastChannel().postMessage('hello');
    await flush();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  test('takeOverFromOtherTab clears the displaced flag and reloads', () => {
    session.set('blitzwallet-tab-displaced', '1');
    const tab = loadTab();
    tab.takeOverFromOtherTab();
    expect(tab.isTabDisplaced()).toBe(false);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
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

  test('simultaneous boot: waiter hears takeovers before the lock is granted', async () => {
    // Deferred grant: the winner's grant callback runs after the loser's
    // broadcast was already posted. The listener must already be installed.
    // Fake timers so the pending 3s abort timer doesn't keep jest alive.
    jest.useFakeTimers();
    navigator.locks.request.mockImplementation(
      () => new Promise(() => {}), // never grants
    );
    const tab = loadTab();
    tab.acquireWebDatabaseOwnership().catch(() => {});
    const ch = [...channels].pop();
    expect(ch).toBeDefined();
    expect(typeof ch.onmessage).toBe('function');
    // A takeover arriving while queued comes from a newer tab: yield.
    ch.onmessage({ data: 'takeover' });
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(tab.isTabDisplaced()).toBe(true);
  });

  test('web only maps the explicit conflict error', () => {
    const tab = loadTab();
    expect(tab.isTabConflictError(new Error('SQLITE_CANTOPEN'))).toBe(false);
    expect(tab.isTabConflictError(new Error('dbInitError'))).toBe(false);
  });
});
