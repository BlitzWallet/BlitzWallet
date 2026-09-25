// Web branch of initializeAllDatabases: the foreground-time limit on SQLite
// setup (expo-sqlite never answers if its worker failed to load) and how the
// result is memoized.
jest.mock('react-native', () => {
  const listeners = new Set();
  return {
    Platform: { OS: 'web' },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn((type, listener) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      }),
      // What RN Web does on visibilitychange.
      mockChange(state) {
        this.currentState = state;
        listeners.forEach(listener => listener(state));
      },
    },
  };
});
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///',
  makeDirectoryAsync: jest.fn(),
}));
jest.mock('../../app/functions/webDatabaseOwnership', () => ({
  acquireWebDatabaseOwnership: jest.fn(async () => true),
}));
jest.mock('../../app/functions/messaging/cachedMessages', () => ({
  initializeDatabase: jest.fn(),
}));
jest.mock('../../app/functions/contacts/giftCardStorage', () => ({
  initializeGiftCardDatabase: jest.fn(),
}));
jest.mock('../../app/functions/pos', () => ({
  initializePOSTransactionsDatabase: jest.fn(),
}));
jest.mock('../../app/functions/spark/transactions', () => ({
  initializeSparkDatabase: jest.fn(),
}));
jest.mock('../../app/functions/boltz/rootstock/swapDb', () => ({
  initRootstockSwapDB: jest.fn(),
}));
jest.mock('../../app/functions/gift/giftsStorage', () => ({
  initGiftDb: jest.fn(),
}));
jest.mock('../../app/functions/pools/poolsStorage', () => ({
  initPoolDb: jest.fn(),
}));
jest.mock('../../app/functions/savings/savingsStorage', () => ({
  initSavingsDb: jest.fn(),
}));
jest.mock('../../app/functions/spark/leavesStorage', () => ({
  initLeavesDb: jest.fn(),
}));

describe('initializeAllDatabases on web', () => {
  let databases;
  let AppState;
  let initializeDatabase;
  let initLeavesDb;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    ({ AppState } = require('react-native'));
    const initializers = [
      require('../../app/functions/messaging/cachedMessages').initializeDatabase,
      require('../../app/functions/contacts/giftCardStorage')
        .initializeGiftCardDatabase,
      require('../../app/functions/pos').initializePOSTransactionsDatabase,
      require('../../app/functions/spark/transactions').initializeSparkDatabase,
      require('../../app/functions/boltz/rootstock/swapDb').initRootstockSwapDB,
      require('../../app/functions/gift/giftsStorage').initGiftDb,
      require('../../app/functions/pools/poolsStorage').initPoolDb,
      require('../../app/functions/savings/savingsStorage').initSavingsDb,
      require('../../app/functions/spark/leavesStorage').initLeavesDb,
    ];
    initializers.forEach(init => init.mockResolvedValue(true));
    initializeDatabase = initializers[0];
    initLeavesDb = initializers[8];
    databases = require('../../app/functions/initializeAllDatabases');
  });

  afterEach(() => jest.useRealTimers());

  // Observes settlement without leaving an unhandled rejection behind.
  function track(promise) {
    const state = { settled: false };
    promise
      .catch(() => {})
      .finally(() => {
        state.settled = true;
      });
    return state;
  }

  it('resolves once every database has opened', async () => {
    const setup = databases.initializeAllDatabases();
    await jest.advanceTimersByTimeAsync(1000);
    await expect(setup).resolves.toBe(true);
  });

  it('gives up with dbInitTimeout after 20 s in the foreground', async () => {
    initializeDatabase.mockReturnValue(new Promise(() => {})); // stalled worker
    const setup = databases.initializeAllDatabases();
    const state = track(setup);

    await jest.advanceTimersByTimeAsync(19999);
    expect(state.settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(setup).rejects.toThrow(databases.DB_INIT_TIMEOUT_ERROR);
    expect(databases.DB_INIT_TIMEOUT_ERROR).toBe('dbInitTimeout');
  });

  it('does not count background time, and restarts the window on return', async () => {
    initializeDatabase.mockReturnValue(new Promise(() => {}));
    const setup = databases.initializeAllDatabases();
    const state = track(setup);

    await jest.advanceTimersByTimeAsync(15000);
    AppState.mockChange('background'); // screen off: hidden, then frozen
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(state.settled).toBe(false);

    AppState.mockChange('active');
    await jest.advanceTimersByTimeAsync(19999);
    expect(state.settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(setup).rejects.toThrow('dbInitTimeout');
  });

  it('never starts another open sequence after a timeout, even after a reset', async () => {
    initializeDatabase.mockReturnValue(new Promise(() => {}));
    const first = databases.initializeAllDatabases();
    track(first);
    await jest.advanceTimersByTimeAsync(20000);
    await expect(first).rejects.toThrow('dbInitTimeout');

    databases.resetDatabaseInitialization(); // what wipeLocalWalletData does
    await expect(databases.initializeAllDatabases()).rejects.toThrow(
      'dbInitTimeout',
    );
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
  });

  it('lets a later call retry after a startup-critical database fails to open', async () => {
    initLeavesDb.mockResolvedValueOnce(false);
    const first = databases.initializeAllDatabases();
    track(first);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(first).rejects.toThrow('dbInitError');

    const second = databases.initializeAllDatabases();
    await jest.advanceTimersByTimeAsync(1000);
    await expect(second).resolves.toBe(true);
    expect(initializeDatabase).toHaveBeenCalledTimes(2);
  });
});
