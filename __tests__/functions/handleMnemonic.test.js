// Mock the native module before any imports using Node.js crypto as a drop-in.
// The argon2 mock mirrors real argon2id in the one way that matters for KDF
// correctness: a different m/t/p parameter set yields a different key, with
// `passes` also driving the PBKDF2 iteration count. The legacy-param (no m/t/p)
// fallback therefore only decrypts if production actually derives with the
// legacy params — a wrong fallback produces a wrong key and a padding failure.
jest.mock('react-native-quick-crypto', () => {
  // 'crypto' is aliased → react-native-quick-crypto by Babel; 'node:crypto' bypasses that alias
  const nodeCrypto = require('node:crypto');
  // Must stay in sync with forgeKDF() below so forged ciphertexts decrypt.
  const deriveKey = (password, salt, params) =>
    nodeCrypto.pbkdf2Sync(
      password,
      Buffer.concat([
        salt,
        Buffer.from(
          `argon2id|m=${params.memory}|t=${params.passes}|p=${params.parallelism}`,
        ),
      ]),
      params.passes,
      32,
      'sha256',
    );
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
      cb(
        null,
        deriveKey(msg, opts.nonce, {
          memory: opts.memory,
          passes: opts.passes,
          parallelism: opts.parallelism,
        }),
      );
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
  isArgon2Format,
} = require('../../app/functions/handleMnemonic');

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// decryptMnemonicWithPin receives the pin already JSON.stringify'd by the call site
const PIN_ARRAY = [1, 2, 3, 4];
const PIN_JSON = JSON.stringify(PIN_ARRAY);
const WRONG_PIN_JSON = JSON.stringify([9, 9, 9, 9]);

// Flush all pending microtasks + macrotasks spawned by fire-and-forget Promises
const flushAsync = () => new Promise(resolve => setImmediate(resolve));

const CURRENT_PARAMS = { memory: 19456, passes: 2, parallelism: 1 };
const LEGACY_PARAMS = { memory: 16384, passes: 2, parallelism: 1 };

// Must mirror the mock argon2 derivation above (same domain-separation context
// and iteration count) so forged ciphertexts decrypt under the mock.
function forgeKDF(password, salt, params) {
  const nodeCrypto = require('node:crypto');
  return nodeCrypto.pbkdf2Sync(
    password,
    Buffer.concat([
      salt,
      Buffer.from(
        `argon2id|m=${params.memory}|t=${params.passes}|p=${params.parallelism}`,
      ),
    ]),
    params.passes,
    32,
    'sha256',
  );
}

// Forge a v2 ciphertext the way production would, using the mock argon2 KDF.
// `params` picks the parameter set the key is derived with; `embedParams`
// controls whether m/t/p are embedded in the JSON (false mimics ciphertexts
// shipped before m/t/p were embedded ⇒ they get opportunistically upgraded).
function forgeV2(plaintext, pinString, { params = CURRENT_PARAMS, embedParams = true } = {}) {
  const nodeCrypto = require('node:crypto');
  const salt = nodeCrypto.randomBytes(16);
  const iv = nodeCrypto.randomBytes(16);
  const key = forgeKDF(Buffer.from(pinString, 'utf8'), salt, params);
  const cipher = nodeCrypto.createCipheriv('aes-256-cbc', key, iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]).toString('base64');
  const obj = { v: 2, salt: salt.toString('hex'), iv: iv.toString('hex'), ct };
  if (embedParams) {
    obj.m = params.memory;
    obj.t = params.passes;
    obj.p = params.parallelism;
  }
  return JSON.stringify(obj);
}

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

describe('decryptMnemonicWithPin – no oracle + KDF params', () => {
  let storedCipher;

  beforeEach(() => {
    jest.clearAllMocks();
    storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: storedCipher }),
    );
  });

  it('stores the pin-secured marker, not a hash of the pin', async () => {
    await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    expect(storeData).toHaveBeenCalledWith('pinHash', 'pin-secured');
    expect(storeData).not.toHaveBeenCalledWith('pinHash', `hash(${PIN_JSON})`);
  });

  it('embeds the current argon2 params (m/t/p) in the ciphertext', async () => {
    await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    const parsed = JSON.parse(storedCipher);
    expect(parsed.m).toBe(19456);
    expect(parsed.t).toBe(2);
    expect(parsed.p).toBe(1);
  });

  it('scrubs pinHash to the marker on a successful decrypt', async () => {
    await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    storeData.mockClear();
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
    expect(storeData).toHaveBeenCalledWith('pinHash', 'pin-secured');
  });

  it('decrypts a legacy-param ciphertext (no m/t/p) and re-encrypts to 19456', async () => {
    // Forged with the LEGACY (16384) params and no embedded m/t/p, matching
    // ciphertexts shipped before the KDF raise. Decryption succeeds ONLY if the
    // missing-m/t-p fallback derives with the legacy params — a wrong fallback
    // (or a params-blind KDF) yields a different key and a padding failure.
    storedCipher = forgeV2(MNEMONIC, PIN_JSON, {
      params: LEGACY_PARAMS,
      embedParams: false,
    });

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);

    await flushAsync();
    const reencrypt = storeData.mock.calls.find(
      c => c[0] === 'encryptedMnemonic',
    );
    expect(reencrypt).toBeDefined();
    expect(JSON.parse(reencrypt[1]).m).toBe(19456);
  });

  it('rejects a no-params ciphertext forged with non-legacy params', async () => {
    // Negative control proving the missing-m/t-p fallback resolves to the
    // LEGACY params specifically (and that the mock honors params at all):
    // forge with the current 19456 params but embed no m/t/p. The fallback
    // derives with 16384 ⇒ different key ⇒ padding failure ⇒ null. If the
    // fallback used the current params, or the KDF ignored params, this would
    // "decrypt" to the mnemonic instead.
    storedCipher = forgeV2(MNEMONIC, PIN_JSON, {
      params: CURRENT_PARAMS,
      embedParams: false,
    });

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
  });
});

describe('PIN storage hardening', () => {
  let storedCipher;

  beforeEach(() => {
    jest.clearAllMocks();
    storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: storedCipher }),
    );
  });

  it('writes encryptedMnemonic before pinHash (crash-consistent order)', async () => {
    await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    const keys = storeData.mock.calls.map(c => c[0]);
    expect(keys.indexOf('encryptedMnemonic')).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf('encryptedMnemonic')).toBeLessThan(
      keys.indexOf('pinHash'),
    );
  });

  it('isArgon2Format recognizes v2 and rejects plaintext / legacy EvpKDF', () => {
    expect(isArgon2Format(forgeV2(MNEMONIC, PIN_JSON))).toBe(true);
    expect(isArgon2Format(MNEMONIC)).toBe(false); // plaintext seed
    expect(isArgon2Format(encryptMnemonic(MNEMONIC, PIN_JSON))).toBe(false);
  });

  it('skips the KDF-upgrade write when the ciphertext changed mid-flight (CAS)', async () => {
    const legacyV2 = forgeV2(MNEMONIC, PIN_JSON, {
      params: LEGACY_PARAMS,
      embedParams: false,
    });
    let reads = 0;
    retrieveData.mockImplementation(() => {
      reads++;
      // First read (the decrypt) sees the legacy ciphertext; the CAS re-read
      // sees a different value, as if a PIN change landed meanwhile.
      return Promise.resolve({
        didWork: true,
        value: reads === 1 ? legacyV2 : 'CHANGED_BY_PIN_CHANGE',
      });
    });

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
    await flushAsync();

    const encWrites = storeData.mock.calls.filter(
      c => c[0] === 'encryptedMnemonic',
    );
    expect(encWrites).toHaveLength(0);
  });

  it('performs the KDF-upgrade write when the ciphertext is unchanged (CAS)', async () => {
    storedCipher = forgeV2(MNEMONIC, PIN_JSON, {
      params: LEGACY_PARAMS,
      embedParams: false,
    });

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
    await flushAsync();

    const encWrites = storeData.mock.calls.filter(
      c => c[0] === 'encryptedMnemonic',
    );
    expect(encWrites.length).toBeGreaterThan(0);
    expect(JSON.parse(encWrites[encWrites.length - 1][1]).m).toBe(19456);
  });

  it('returns null when a padding-valid decrypt yields a non-BIP39 string', async () => {
    // Correct key/pin, but the plaintext isn't a valid mnemonic — the
    // validateMnemonic gate must reject it rather than hand back garbage.
    storedCipher = forgeV2('not a valid bip39 seed phrase here', PIN_JSON);

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
  });

  it('returns null when a wrong pin yields valid PKCS7 padding but garbage', async () => {
    // The ~1/256 wrong-key-yet-valid-padding case: an attacker-supplied wrong
    // pin derives a key that happens to pass AES/PKCS7 padding but decrypts to
    // a non-BIP39 string. Without the validateMnemonic gate this would be
    // mistaken for a successful login and hand back a garbage seed.
    storedCipher = forgeV2('not a valid bip39 seed phrase here', WRONG_PIN_JSON);

    const result = await decryptMnemonicWithPin(WRONG_PIN_JSON);
    expect(result).toBeNull();
  });

  it('still returns the mnemonic when the KDF-upgrade write fails on a v2 ciphertext', async () => {
    storedCipher = forgeV2(MNEMONIC, PIN_JSON, {
      params: LEGACY_PARAMS,
      embedParams: false,
    });
    // Only the fire-and-forget upgrade re-encrypt fails; the CAS re-read and
    // the pinHash scrub still work. A failed opportunistic upgrade must not
    // sink an otherwise-valid login.
    storeData.mockImplementation((key, value) =>
      key === 'encryptedMnemonic'
        ? Promise.reject(new Error('disk full'))
        : Promise.resolve(true),
    );

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
    await flushAsync();
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
