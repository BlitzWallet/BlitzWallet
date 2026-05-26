// Mock the native module before any imports using Node.js crypto as a drop-in.
// argon2 mock uses pbkdf2Sync so the KDF is deterministic but exercising the
// same salt/IV plumbing as production.
jest.mock('react-native-quick-crypto', () => {
  // 'crypto' is aliased → react-native-quick-crypto by Babel; 'node:crypto' bypasses that alias
  const nodeCrypto = require('node:crypto');
  return {
    __esModule: true,
    default: {
      randomBytes: n => nodeCrypto.randomBytes(n),
      createCipheriv: (...args) => nodeCrypto.createCipheriv(...args),
      createDecipheriv: (...args) => nodeCrypto.createDecipheriv(...args),
    },
    argon2: (_variant, opts, cb) => {
      const msg =
        typeof opts.message === 'string'
          ? Buffer.from(opts.message, 'utf8')
          : opts.message;
      const key = nodeCrypto.pbkdf2Sync(msg, opts.nonce, 1, 32, 'sha256');
      cb(null, key);
    },
  };
});

jest.mock('../../app/functions/secureStore', () => ({
  MIGRATION_FLAG: 'secureStoreMigrationComplete',
  SECURE_MIGRATION_V2_FLAG: 'secureStoreMigrationV2Complete',
  storeData: jest.fn(),
  retrieveData: jest.fn(),
  deleteItem: jest.fn(),
  runPinAndMnemoicMigration: jest.fn(),
  runSecureStoreMigrationV2: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn() }));

jest.mock('../../app/functions/localStorage', () => ({
  removeLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../../app/functions/hash', () => ({
  __esModule: true,
  default: str => `hash(${str})`,
}));

jest.mock('../../app/constants', () => ({
  BIOMETRIC_KEY: 'biometricEncryptionKey',
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  LOGIN_SECURITY_MODE_TYPE_KEY: 'LOGIN_SECURITY_MODE_TYPE',
}));

const { storeData, retrieveData } = require('../../app/functions/secureStore');
const {
  storeMnemonicWithPinSecurity,
  decryptMnemonicWithPin,
  encryptMnemonic,
} = require('../../app/functions/handleMnemonic');

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// decryptMnemonicWithPin receives the pin already JSON.stringify'd by the call site
const PIN_ARRAY = [1, 2, 3, 4];
const PIN_JSON = JSON.stringify(PIN_ARRAY);
const WRONG_PIN_JSON = JSON.stringify([9, 9, 9, 9]);

// Flush all pending microtasks + macrotasks spawned by fire-and-forget Promises
const flushAsync = () => new Promise(resolve => setImmediate(resolve));

describe('storeMnemonicWithPinSecurity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores a v2 Argon2 JSON ciphertext and a pin hash', async () => {
    storeData.mockResolvedValue(true);

    const ok = await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);

    expect(ok).toBe(true);
    expect(storeData).toHaveBeenCalledWith('pinHash', expect.any(String));
    const [[, cipherText]] = storeData.mock.calls.filter(
      c => c[0] === 'encryptedMnemonic',
    );
    const parsed = JSON.parse(cipherText);
    expect(parsed.v).toBe(2);
    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.ct).toBe('string');
  });

  it('returns false when storeData throws', async () => {
    storeData.mockRejectedValue(new Error('storage error'));
    const ok = await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    expect(ok).toBe(false);
  });
});

describe('decryptMnemonicWithPin – Argon2 v2 format', () => {
  let storedCipher;

  beforeEach(async () => {
    jest.clearAllMocks();
    storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: storedCipher }),
    );
    await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
  });

  it('decrypts correctly with the right pin', async () => {
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
  });

  it('returns null when the wrong pin is given', async () => {
    const result = await decryptMnemonicWithPin(WRONG_PIN_JSON);
    expect(result).toBeNull();
  });
});

describe('decryptMnemonicWithPin – legacy EvpKDF format migration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('decrypts a legacy-format ciphertext', async () => {
    const legacy = encryptMnemonic(MNEMONIC, PIN_JSON);
    retrieveData.mockResolvedValue({ didWork: true, value: legacy });
    storeData.mockResolvedValue(true);

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
  });

  it('upgrades the stored ciphertext to v2 format after decryption', async () => {
    const legacy = encryptMnemonic(MNEMONIC, PIN_JSON);
    retrieveData.mockResolvedValue({ didWork: true, value: legacy });
    storeData.mockResolvedValue(true);

    await decryptMnemonicWithPin(PIN_JSON);
    await flushAsync();

    const migrateCall = storeData.mock.calls.find(
      c => c[0] === 'encryptedMnemonic',
    );
    expect(migrateCall).toBeDefined();
    const parsed = JSON.parse(migrateCall[1]);
    expect(parsed.v).toBe(2);
  });

  it('still returns the mnemonic when the migration write fails', async () => {
    const legacy = encryptMnemonic(MNEMONIC, PIN_JSON);
    retrieveData.mockResolvedValue({ didWork: true, value: legacy });
    storeData.mockRejectedValue(new Error('disk full'));

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
  });

  it('returns null when the wrong pin is given for a legacy ciphertext', async () => {
    const legacy = encryptMnemonic(MNEMONIC, PIN_JSON);
    retrieveData.mockResolvedValue({ didWork: true, value: legacy });

    const result = await decryptMnemonicWithPin(WRONG_PIN_JSON);
    expect(result).toBeNull();
  });
});

describe('decryptMnemonicWithPin – storage errors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when retrieveData reports failure', async () => {
    retrieveData.mockResolvedValue({ didWork: false });
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
  });
});
