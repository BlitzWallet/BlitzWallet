const asyncStorageStore = {};

// The global crashlytics mock doesn't provide the named log/recordError
// exports localStorage.js relies on (its error handler re-throws), so stub
// the wrapper module to keep the storage layer working under Jest.
jest.mock('../../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

// Module-scoped fake AsyncStorage whose backing object survives
// jest.resetModules(), so a "fresh" require of the store module simulates an
// app restart with previously persisted data intact.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async key => asyncStorageStore[key] ?? null),
    setItem: jest.fn(async (key, value) => {
      asyncStorageStore[key] = value;
    }),
    removeItem: jest.fn(async key => {
      delete asyncStorageStore[key];
    }),
    getAllKeys: jest.fn(async () => Object.keys(asyncStorageStore)),
    multiGet: jest.fn(async keys => keys.map(key => [key, asyncStorageStore[key] ?? null])),
    multiRemove: jest.fn(async keys => {
      keys.forEach(key => delete asyncStorageStore[key]);
    }),
  },
}));

const KEY = 'CHILD_ACCOUNT_EMOJIS';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('child account emoji store', () => {
  beforeEach(() => {
    Object.keys(asyncStorageStore).forEach(key => delete asyncStorageStore[key]);
    jest.resetModules();
  });

  it('returns an empty string for an account with no emoji', async () => {
    const { getChildAccountEmoji } = require('../../../app/functions/accounts/childAccountEmojis');
    await tick();
    expect(getChildAccountEmoji('child-1')).toBe('');
  });

  it('stores and returns an emoji for a child uuid', async () => {
    const { getChildAccountEmoji, setChildAccountEmoji } = require('../../../app/functions/accounts/childAccountEmojis');
    await setChildAccountEmoji('child-1', '🦊');
    expect(getChildAccountEmoji('child-1')).toBe('🦊');
  });

  it('keeps separate emojis per child uuid', async () => {
    const { getChildAccountEmoji, setChildAccountEmoji } = require('../../../app/functions/accounts/childAccountEmojis');
    await setChildAccountEmoji('child-1', '🦊');
    await setChildAccountEmoji('child-2', '🐸');
    expect(getChildAccountEmoji('child-1')).toBe('🦊');
    expect(getChildAccountEmoji('child-2')).toBe('🐸');
    expect(getChildAccountEmoji('child-3')).toBe('');
  });

  it('clearing with an empty string removes the emoji', async () => {
    const { getChildAccountEmoji, setChildAccountEmoji } = require('../../../app/functions/accounts/childAccountEmojis');
    await setChildAccountEmoji('child-1', '🦊');
    await setChildAccountEmoji('child-1', '');
    expect(getChildAccountEmoji('child-1')).toBe('');
  });

  it('ignores a falsy uuid', async () => {
    const { getChildAccountEmoji, setChildAccountEmoji } = require('../../../app/functions/accounts/childAccountEmojis');
    await setChildAccountEmoji(null, '🦊');
    expect(getChildAccountEmoji('child-1')).toBe('');
  });

  it('persists to AsyncStorage and reloads on a fresh app start', async () => {
    const firstLoad = require('../../../app/functions/accounts/childAccountEmojis');
    await firstLoad.setChildAccountEmoji('child-1', '🦊');

    // Simulate an app restart: a fresh module instance re-reads AsyncStorage.
    jest.resetModules();
    const secondLoad = require('../../../app/functions/accounts/childAccountEmojis');
    await tick();
    expect(secondLoad.getChildAccountEmoji('child-1')).toBe('🦊');

    // A cleared emoji stays cleared across restarts too.
    await secondLoad.setChildAccountEmoji('child-1', '');
    jest.resetModules();
    const thirdLoad = require('../../../app/functions/accounts/childAccountEmojis');
    await tick();
    expect(thirdLoad.getChildAccountEmoji('child-1')).toBe('');
  });

  it('writes the emoji map under the expected storage key', async () => {
    const { setChildAccountEmoji } = require('../../../app/functions/accounts/childAccountEmojis');
    await setChildAccountEmoji('child-1', '🦊');
    expect(asyncStorageStore[KEY]).toBe(JSON.stringify({ 'child-1': '🦊' }));
  });
});
