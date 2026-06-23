// i18next is not initialised under Jest; mock it locally so changeLanguage calls
// don't produce console warnings and can be spied on.
jest.mock('i18next', () => ({
  changeLanguage: jest.fn(),
}));

jest.mock('../../../app/functions/secureStore', () => ({
  MIGRATION_FLAG: 'secureStoreMigrationComplete',
  SECURE_MIGRATION_V2_FLAG: 'secureStoreMigrationV2Complete',
  retrieveData: jest.fn(),
  storeData: jest.fn(),
  deleteItem: jest.fn(),
  runPinAndMnemoicMigration: jest.fn(),
  runSecureStoreMigrationV2: jest.fn(),
}));

jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
  removeLocalStorageItem: jest.fn(),
}));

jest.mock('../../../app/constants', () => ({
  BIOMETRIC_KEY: 'biometricEncryptionKey',
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  LOGIN_SECURITY_MODE_TYPE_KEY: 'LOGIN_SECURITY_MODE_TYPE',
}));

const {
  retrieveData,
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
} = require('../../../app/functions/secureStore');

const { getLocalStorageItem } = require('../../../app/functions/localStorage');

const { BIOMETRIC_KEY, LOGIN_SECUITY_MODE_KEY, LOGIN_SECURITY_MODE_TYPE_KEY } =
  require('../../../app/constants');

const i18next = require('i18next');
const { getLocales } = require('react-native-localize');
const { setLocalStorageItem } = require('../../../app/functions/localStorage');

// Helper: set up retrieveData to return values keyed by the storage key.
const setupRetrieveData = (values = {}) => {
  retrieveData.mockImplementation(key => {
    const val = values[key];
    if (val === undefined) return Promise.resolve({ didWork: false, value: false });
    return Promise.resolve({ didWork: true, value: val });
  });
};

const { loadLoginState } = require('../../../app/functions/login/loadLoginState');

describe('loadLoginState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runPinAndMnemoicMigration.mockResolvedValue(undefined);
    runSecureStoreMigrationV2.mockResolvedValue(undefined);
    getLocalStorageItem.mockResolvedValue(null);
  });

  // 1. Migrations are awaited before reads
  it('calls both migrations before storage reads', async () => {
    const callOrder = [];
    runPinAndMnemoicMigration.mockImplementation(() => {
      callOrder.push('migration1');
      return Promise.resolve();
    });
    runSecureStoreMigrationV2.mockImplementation(() => {
      callOrder.push('migration2');
      return Promise.resolve();
    });
    retrieveData.mockImplementation(key => {
      callOrder.push(`read:${key}`);
      return Promise.resolve({ didWork: false, value: false });
    });
    getLocalStorageItem.mockImplementation(key => {
      callOrder.push(`ls:${key}`);
      return Promise.resolve(null);
    });

    await loadLoginState();

    expect(runPinAndMnemoicMigration).toHaveBeenCalled();
    expect(runSecureStoreMigrationV2).toHaveBeenCalled();

    const m1Idx = callOrder.indexOf('migration1');
    const m2Idx = callOrder.indexOf('migration2');
    const firstReadIdx = callOrder.findIndex(e => e.startsWith('read:') || e.startsWith('ls:'));

    expect(m1Idx).toBeLessThan(m2Idx);
    expect(m2Idx).toBeLessThan(firstReadIdx);
  });

  // 2. No account → NO_ACCOUNT
  it('returns NO_ACCOUNT when encryptedMnemonic is absent', async () => {
    setupRetrieveData({});
    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('NO_ACCOUNT');
  });

  // 3. PIN account
  it('returns PIN when encryptedMnemonic + pinHash + modeType=pin present', async () => {
    setupRetrieveData({
      encryptedMnemonic: 'enc-mnemonic',
      pinHash: 'some-hash',
      [LOGIN_SECURITY_MODE_TYPE_KEY]: 'pin',
    });
    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('PIN');
  });

  // 4. Biometric account
  it('returns BIOMETRIC when encryptedMnemonic + biometricKey + modeType=biometric present', async () => {
    setupRetrieveData({
      encryptedMnemonic: 'enc-mnemonic',
      [BIOMETRIC_KEY]: 'bio-key-value',
      [LOGIN_SECURITY_MODE_TYPE_KEY]: 'biometric',
    });
    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('BIOMETRIC');
  });

  // 5. Plain → NO_LOGIN
  it('returns NO_LOGIN when encryptedMnemonic present and modeType=plain', async () => {
    setupRetrieveData({
      encryptedMnemonic: 'enc-mnemonic',
      [LOGIN_SECURITY_MODE_TYPE_KEY]: 'plain',
    });
    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('NO_LOGIN');
  });

  // 6. iOS reinstall biometric: keychain has mnemonic + BIOMETRIC_KEY but modeType is absent;
  //    AsyncStorage is wiped — routing must rely on BIOMETRIC_KEY presence alone.
  it('returns BIOMETRIC on iOS reinstall when only BIOMETRIC_KEY survives (no modeType, no AsyncStorage)', async () => {
    setupRetrieveData({
      encryptedMnemonic: 'enc-mnemonic',
      [BIOMETRIC_KEY]: 'bio-key-value',
      // LOGIN_SECURITY_MODE_TYPE_KEY deliberately absent → value: false
    });
    getLocalStorageItem.mockResolvedValue(null);

    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('BIOMETRIC');
  });

  // 7. Flaky keychain but localStorage has pin settings
  it('falls back to localStorage JSON for PIN when keychain reads fail', async () => {
    // All keychain reads fail except encryptedMnemonic
    retrieveData.mockImplementation(key => {
      if (key === 'encryptedMnemonic')
        return Promise.resolve({ didWork: true, value: 'enc-mnemonic' });
      return Promise.resolve({ didWork: false, value: false });
    });
    getLocalStorageItem.mockResolvedValue(
      '{"isSecurityEnabled":true,"isPinEnabled":true,"isBiometricEnabled":false}',
    );

    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('PIN');
  });

  // 8. Rejecting read does not throw
  it('does not throw when a retrieveData call rejects', async () => {
    retrieveData.mockImplementation(key => {
      if (key === 'encryptedMnemonic') return Promise.reject(new Error('keychain error'));
      return Promise.resolve({ didWork: false, value: false });
    });

    await expect(loadLoginState()).resolves.toBeDefined();
  });

  // 9. Correct keys requested
  it('calls retrieveData with LOGIN_SECURITY_MODE_TYPE_KEY, pinHash, encryptedMnemonic, BIOMETRIC_KEY', async () => {
    setupRetrieveData({});
    await loadLoginState();

    const calledKeys = retrieveData.mock.calls.map(c => c[0]);
    expect(calledKeys).toContain(LOGIN_SECURITY_MODE_TYPE_KEY);
    expect(calledKeys).toContain('pinHash');
    expect(calledKeys).toContain('encryptedMnemonic');
    expect(calledKeys).toContain(BIOMETRIC_KEY);
    expect(getLocalStorageItem).toHaveBeenCalledWith(LOGIN_SECUITY_MODE_KEY);
  });

  // 10. securitySettingsRaw passed through raw (no keychain, localStorage has isSecurityEnabled:false)
  it('returns NO_LOGIN when localStorage has isSecurityEnabled:false and no keychain modeType', async () => {
    setupRetrieveData({ encryptedMnemonic: 'enc-mnemonic' });
    getLocalStorageItem.mockResolvedValue('{"isSecurityEnabled":false}');

    const { loginRoute } = await loadLoginState();
    expect(loginRoute).toBe('NO_LOGIN');
  });

  // 11. Migration rejection does not prevent loadLoginState from resolving.
  //     Each migration is best-effort; a rejection must not propagate.
  it('resolves a valid route even when runPinAndMnemoicMigration rejects', async () => {
    runPinAndMnemoicMigration.mockRejectedValue(new Error('keychain locked'));
    setupRetrieveData({ encryptedMnemonic: 'enc-mnemonic', [LOGIN_SECURITY_MODE_TYPE_KEY]: 'plain' });

    await expect(loadLoginState()).resolves.toMatchObject({ loginRoute: 'NO_LOGIN' });
  });

  it('resolves a valid route even when runSecureStoreMigrationV2 rejects', async () => {
    runSecureStoreMigrationV2.mockRejectedValue(new Error('v2 migration failed'));
    setupRetrieveData({ encryptedMnemonic: 'enc-mnemonic', [LOGIN_SECURITY_MODE_TYPE_KEY]: 'plain' });

    await expect(loadLoginState()).resolves.toMatchObject({ loginRoute: 'NO_LOGIN' });
  });
});

describe('loadLoginState — language resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runPinAndMnemoicMigration.mockResolvedValue(undefined);
    runSecureStoreMigrationV2.mockResolvedValue(undefined);
    setupRetrieveData({});
  });

  // 1. Stored language: use it directly, skip device-locale lookup and write-back
  it('uses stored language and does not write back when userSelectedLanguage is set', async () => {
    // Return JSON-stringified language string, matching what the app writes
    getLocalStorageItem.mockImplementation(key => {
      if (key === 'userSelectedLanguage') return Promise.resolve('"es"');
      return Promise.resolve(null);
    });

    await loadLoginState();

    expect(i18next.changeLanguage).toHaveBeenCalledWith('es');
    // No write-back: setLocalStorageItem should NOT have been called for userSelectedLanguage
    const writeCalls = setLocalStorageItem.mock.calls.filter(
      c => c[0] === 'userSelectedLanguage',
    );
    expect(writeCalls).toHaveLength(0);
    // getLocales should not have been consulted
    expect(getLocales).not.toHaveBeenCalled();
  });

  // 2. No stored language, device locale matches a supported language
  it('falls back to device locale when no stored language and writes it to storage', async () => {
    getLocalStorageItem.mockResolvedValue(null);
    // Override the global mock to return a Spanish locale
    getLocales.mockReturnValueOnce([
      { languageCode: 'es', countryCode: 'ES', languageTag: 'es-ES', isRTL: false },
    ]);

    await loadLoginState();

    expect(i18next.changeLanguage).toHaveBeenCalledWith('es');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'userSelectedLanguage',
      JSON.stringify('es'),
    );
  });

  // 3. No stored language, device locale has no match → falls back to 'en'
  it('falls back to "en" when device locale has no supported match', async () => {
    getLocalStorageItem.mockResolvedValue(null);
    // Use a locale with no entry in supportedLanguagesList
    getLocales.mockReturnValueOnce([
      { languageCode: 'ja', countryCode: 'JP', languageTag: 'ja-JP', isRTL: false },
    ]);

    await loadLoginState();

    expect(i18next.changeLanguage).toHaveBeenCalledWith('en');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'userSelectedLanguage',
      JSON.stringify('en'),
    );
  });
});
