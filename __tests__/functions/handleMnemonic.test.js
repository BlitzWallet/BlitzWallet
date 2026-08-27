// Mock the native module before any imports using Node.js crypto as a drop-in.
// The argon2 mock mirrors real argon2id in the one way that matters for KDF
// correctness: a different m/t/p parameter set yields a different key, with
// `passes` also driving the PBKDF2 iteration count. The legacy-param (no m/t/p)
// fallback therefore only decrypts if production actually derives with the
// legacy params — a wrong fallback produces a wrong key and a GCM/padding
// failure.
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

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
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
  decryptMnemonicWithBiometrics,
  encryptAndStoreMnemonicWithBiometrics,
  generateAndStoreEncryptionKeyForMnemoinc,
  decryptMnemonic,
  encryptMnemonic,
  isArgon2Format,
  isV3MnemonicFormat,
  isEncryptedMnemonicFormat,
  isLegacyEvpKDF,
  PIN_MARKER,
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
const MNEMONIC_AAD = Buffer.from('blitz.encryptedMnemonic.v3', 'utf8');

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
    // Clamp for degenerate-param fixtures (t:0): production throws on parse
    // before deriving, so the forge only needs a well-formed ciphertext.
    Math.max(1, params.passes),
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

// Forge a v3 envelope the way production would (mock KDF + AES-256-GCM).
function forgeV3(
  plaintext,
  secret,
  { params = CURRENT_PARAMS, aad = MNEMONIC_AAD, salt } = {},
) {
  const nodeCrypto = require('node:crypto');
  const saltHex = salt || nodeCrypto.randomBytes(16).toString('hex');
  const key = forgeKDF(
    Buffer.from(secret, 'utf8'),
    Buffer.from(saltHex, 'hex'),
    params,
  );
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  return JSON.stringify({
    v: 3,
    alg: 'aes-256-gcm',
    kdf: 'argon2id',
    salt: saltHex,
    m: params.memory,
    t: params.passes,
    p: params.parallelism,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  });
}

// In-memory SecureStore: storeData writes through, retrieveData reads back.
function installMemoryStore(initialValue) {
  let stored = initialValue;
  storeData.mockImplementation((key, value) => {
    if (key === 'encryptedMnemonic') stored = value;
    return Promise.resolve(true);
  });
  retrieveData.mockImplementation(() =>
    Promise.resolve({ didWork: true, value: stored }),
  );
  return () => stored;
}

describe('storeMnemonicWithPinSecurity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores a v3 GCM Argon2 JSON ciphertext and a pin hash', async () => {
    let storedEnc = null;
    let storedPinHash = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedEnc = value;
      if (key === 'pinHash') storedPinHash = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === 'encryptedMnemonic')
        return Promise.resolve({ didWork: true, value: storedEnc });
      if (key === 'pinHash')
        return Promise.resolve({ didWork: true, value: storedPinHash });
      return Promise.resolve({ didWork: true, value: null });
    });

    const ok = await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);

    expect(ok).toBe(true);
    expect(storeData).toHaveBeenCalledWith('pinHash', expect.any(String));
    const [[, cipherText]] = storeData.mock.calls.filter(
      c => c[0] === 'encryptedMnemonic',
    );
    const parsed = JSON.parse(cipherText);
    expect(parsed.v).toBe(3);
    expect(parsed.alg).toBe('aes-256-gcm');
    expect(parsed.kdf).toBe('argon2id');
    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.tag).toBe('string');
    expect(typeof parsed.ct).toBe('string');
  });

  it('returns false when storeData throws', async () => {
    storeData.mockRejectedValue(new Error('storage error'));
    const ok = await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    expect(ok).toBe(false);
  });
});

describe('decryptMnemonicWithPin – v3 format', () => {
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

  it('writes a v3 envelope with the expected shape', () => {
    const parsed = JSON.parse(storedCipher);
    expect(parsed.v).toBe(3);
    expect(parsed.alg).toBe('aes-256-gcm');
    expect(parsed.kdf).toBe('argon2id');
    expect(Buffer.from(parsed.iv, 'base64')).toHaveLength(12);
    expect(typeof parsed.tag).toBe('string');
    expect(typeof parsed.ct).toBe('string');
    expect(parsed.m).toBe(19456);
    expect(parsed.t).toBe(2);
    expect(parsed.p).toBe(1);
  });

  it('decrypts correctly with the right pin', async () => {
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
  });

  it('returns null when the wrong pin is given', async () => {
    const result = await decryptMnemonicWithPin(WRONG_PIN_JSON);
    expect(result).toBeNull();
  });

  it('returns null when the tag is dropped and never overwrites the stored value', async () => {
    const tampered = JSON.parse(storedCipher);
    delete tampered.tag;
    storedCipher = JSON.stringify(tampered);

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
    expect(storedCipher).toBe(JSON.stringify(tampered));
  });
});

describe('decryptMnemonicWithPin – v3 tamper detection', () => {
  let storedCipher;

  beforeEach(() => {
    jest.clearAllMocks();
    storedCipher = forgeV3(MNEMONIC, PIN_JSON);
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: storedCipher }),
    );
  });

  it.each(['ct', 'iv', 'tag', 'salt'])(
    'returns null and never overwrites when %s is tampered',
    async field => {
      const tampered = JSON.parse(storedCipher);
      if (field === 'salt') {
        tampered[field] = require('node:crypto').randomBytes(16).toString('hex');
      } else {
        tampered[field] = require('node:crypto')
          .randomBytes(field === 'iv' ? 12 : 16)
          .toString('base64');
      }
      storedCipher = JSON.stringify(tampered);

      const result = await decryptMnemonicWithPin(PIN_JSON);
      expect(result).toBeNull();
      expect(storedCipher).toBe(JSON.stringify(tampered));
    },
  );

  it('returns null when the envelope was bound to a different AAD', async () => {
    const otherAad = Buffer.from('blitz.custodyAccounts.v3', 'utf8');
    const wrongAadEnvelope = forgeV3(MNEMONIC, PIN_JSON, { aad: otherAad });
    storedCipher = wrongAadEnvelope;

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
    expect(storedCipher).toBe(wrongAadEnvelope);
  });

  it('returns null for garbage input', async () => {
    storedCipher = 'not an envelope';
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
    expect(storedCipher).toBe('not an envelope');
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

  it('upgrades the stored ciphertext to v3 format after decryption (awaited CAS + read-back)', async () => {
    const legacy = encryptMnemonic(MNEMONIC, PIN_JSON);
    let stored = legacy;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') stored = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: stored }),
    );

    await decryptMnemonicWithPin(PIN_JSON);
    await flushAsync();

    const parsed = JSON.parse(stored);
    expect(parsed.v).toBe(3);
    expect(parsed.alg).toBe('aes-256-gcm');
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

  it('never overwrites the stored ciphertext when the pin is wrong (legacy EvpKDF)', async () => {
    // crypto-es never validates PKCS7 padding, so a wrong PIN on a legacy
    // EvpKDF ciphertext returns a truthy garbage string a small fraction of the
    // time (~0.3% empirically — NOT the ~1/3 sometimes quoted, but still a
    // permanent-fund-loss event). The login path must NOT re-encrypt that
    // garbage: doing so overwrites the real encryptedMnemonic with a v3
    // wrapper around random bytes, so the user's correct PIN can no longer
    // unlock the wallet.
    //
    // LEGACY_CT is a real crypto-es blob captured by brute-force search: the
    // correct PIN [1,2,3,4] recovers MNEMONIC, and the wrong PIN [9,9,9,9]
    // decrypts to the truthy string " " — the exact vulnerable input.
    const LEGACY_CT =
      'U2FsdGVkX1+wWbWkXaf6ltLTLW3mTN/8jBaQOKSI/X0djVc/cL15l4gao5+w07Nz318TVWGtFEsey48Yk7s7oqhXGQZD0XgSd4fudFGfrn39/MKctOlaa2UnhphrIxQPZrAOZKfIzRFA07CEwArBsQ==';
    expect(decryptMnemonic(LEGACY_CT, PIN_JSON)).toBe(MNEMONIC);
    expect(decryptMnemonic(LEGACY_CT, WRONG_PIN_JSON)).toBeTruthy();

    let stored = LEGACY_CT;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') stored = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: stored }),
    );

    const result = await decryptMnemonicWithPin(WRONG_PIN_JSON);
    expect(result).toBeNull();

    for (let i = 0; i < 8; i++) await flushAsync();

    // The real ciphertext must be untouched. Buggy code re-encrypts the garbage
    // and writes it here, destroying the wallet.
    expect(stored).toBe(LEGACY_CT);
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

  it('scrubs pinHash to the marker on a successful v3 decrypt', async () => {
    await storeMnemonicWithPinSecurity(MNEMONIC, PIN_ARRAY);
    storeData.mockClear();
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
    expect(storeData).toHaveBeenCalledWith('pinHash', 'pin-secured');
  });

  it('decrypts a legacy-param ciphertext (no m/t/p) and re-encrypts to v3 19456', async () => {
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
    expect(JSON.parse(reencrypt[1]).v).toBe(3);
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

  it('rejects a v2 ciphertext with attacker-inflated memory (m: 128 MiB)', async () => {
    storedCipher = forgeV2(MNEMONIC, PIN_JSON, {
      params: { memory: 128 * 1024, passes: 2, parallelism: 1 },
    });

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
  });

  it('rejects a v2 ciphertext with degenerate t/p or non-integer params', async () => {
    for (const params of [
      { memory: 19456, passes: 0, parallelism: 1 },
      { memory: 19456, passes: 9, parallelism: 1 },
      { memory: 19456, passes: 2, parallelism: 9 },
      { memory: 19456.5, passes: 2, parallelism: 1 },
    ]) {
      storedCipher = forgeV2(MNEMONIC, PIN_JSON, { params });
      const result = await decryptMnemonicWithPin(PIN_JSON);
      expect(result).toBeNull();
    }
  });

  it('rejects a v3 ciphertext with attacker-inflated memory (m: 128 MiB)', async () => {
    storedCipher = forgeV3(MNEMONIC, PIN_JSON, {
      params: { memory: 128 * 1024, passes: 2, parallelism: 1 },
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
    expect(isArgon2Format(forgeV3(MNEMONIC, PIN_JSON))).toBe(false);
  });

  it('skips the migration write when the ciphertext changed mid-flight (CAS)', async () => {
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

  it('performs the migration write when the ciphertext is unchanged (CAS) and verifies the read-back', async () => {
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
    expect(JSON.parse(encWrites[encWrites.length - 1][1]).v).toBe(3);
    // Read-back verified: the stored value is now the v3 envelope.
    expect(JSON.parse(storedCipher).v).toBe(3);
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

  it('still returns the mnemonic when the migration write fails on a v2 ciphertext', async () => {
    storedCipher = forgeV2(MNEMONIC, PIN_JSON, {
      params: LEGACY_PARAMS,
      embedParams: false,
    });
    // Only the awaited migration re-encrypt fails; the pinHash scrub still
    // works. A failed migration must not sink an otherwise-valid login.
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

describe('v2 → v3 migration matrix', () => {
  let getStored;

  const cases = [
    ['v2 with embedded params', () => forgeV2(MNEMONIC, PIN_JSON)],
    [
      'v2 without m/t/p (legacy fallback)',
      () =>
        forgeV2(MNEMONIC, PIN_JSON, { params: LEGACY_PARAMS, embedParams: false }),
    ],
    [
      'v2 with weak params (p=1, low m)',
      () => forgeV2(MNEMONIC, PIN_JSON, { params: { memory: 8192, passes: 1, parallelism: 1 } }),
    ],
    ['legacy EvpKDF', () => encryptMnemonic(MNEMONIC, PIN_JSON)],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(cases)(
    '%s: correct PIN decrypts, migrates to v3, and read-back is verified',
    async (_label, forge) => {
      getStored = installMemoryStore(forge());

      const result = await decryptMnemonicWithPin(PIN_JSON);
      expect(result).toBe(MNEMONIC);
      await flushAsync();

      const encWrites = storeData.mock.calls.filter(
        c => c[0] === 'encryptedMnemonic',
      );
      expect(encWrites.length).toBeGreaterThan(0);
      const written = JSON.parse(encWrites[encWrites.length - 1][1]);
      expect(written.v).toBe(3);
      expect(written.alg).toBe('aes-256-gcm');
      // Read-back verified: the store now holds the v3 envelope.
      expect(JSON.parse(getStored()).v).toBe(3);
      expect(getStored()).toBe(encWrites[encWrites.length - 1][1]);
    },
  );

  it.each(cases)(
    '%s: wrong PIN returns null and never writes',
    async (_label, forge) => {
      installMemoryStore(forge());

      const result = await decryptMnemonicWithPin(WRONG_PIN_JSON);
      expect(result).toBeNull();
      await flushAsync();

      expect(
        storeData.mock.calls.filter(c => c[0] === 'encryptedMnemonic'),
      ).toHaveLength(0);
    },
  );

  it('still returns the mnemonic on a migration write failure, and the next call migrates', async () => {
    installMemoryStore(encryptMnemonic(MNEMONIC, PIN_JSON));
    storeData.mockImplementation((key, value) =>
      key === 'encryptedMnemonic'
        ? Promise.reject(new Error('disk full'))
        : Promise.resolve(true),
    );

    const first = await decryptMnemonicWithPin(PIN_JSON);
    expect(first).toBe(MNEMONIC);

    // Next call (store healthy again) migrates the still-legacy value.
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') getStored = () => value;
      return Promise.resolve(true);
    });
    const second = await decryptMnemonicWithPin(PIN_JSON);
    expect(second).toBe(MNEMONIC);
    await flushAsync();

    const encWrites = storeData.mock.calls.filter(
      c => c[0] === 'encryptedMnemonic',
    );
    expect(encWrites.length).toBeGreaterThan(0);
    expect(JSON.parse(encWrites[encWrites.length - 1][1]).v).toBe(3);
  });

  it.each(cases)(
    '%s: every success path scrubs pinHash to PIN_MARKER (B2)',
    async (_label, forge) => {
      installMemoryStore(forge());

      const result = await decryptMnemonicWithPin(PIN_JSON);
      expect(result).toBe(MNEMONIC);
      await flushAsync();

      expect(storeData).toHaveBeenCalledWith('pinHash', PIN_MARKER);
    },
  );

  it('v3 success path also scrubs pinHash to PIN_MARKER (B2)', async () => {
    installMemoryStore(forgeV3(MNEMONIC, PIN_JSON));

    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBe(MNEMONIC);
    expect(storeData).toHaveBeenCalledWith('pinHash', PIN_MARKER);
  });
});

describe('decryptMnemonicWithPin – storage errors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when retrieveData reports failure (B3-lite)', async () => {
    retrieveData.mockResolvedValue({ didWork: false, value: false });
    const result = await decryptMnemonicWithPin(PIN_JSON);
    expect(result).toBeNull();
    expect(storeData).not.toHaveBeenCalled();
  });
});

describe('envelope format detection', () => {
  it('isV3MnemonicFormat detects v3 only', () => {
    expect(isV3MnemonicFormat(forgeV3(MNEMONIC, PIN_JSON))).toBe(true);
    expect(isV3MnemonicFormat(forgeV2(MNEMONIC, PIN_JSON))).toBe(false);
    expect(isV3MnemonicFormat(MNEMONIC)).toBe(false);
    expect(isV3MnemonicFormat('U2FsdGVkX1+garbage')).toBe(false);
    expect(isV3MnemonicFormat('garbage')).toBe(false);
    expect(isV3MnemonicFormat(null)).toBe(false);
  });

  it('isLegacyEvpKDF detects the Salted__ prefix only', () => {
    expect(isLegacyEvpKDF('U2FsdGVkX1+garbage')).toBe(true);
    expect(isLegacyEvpKDF(encryptMnemonic(MNEMONIC, PIN_JSON))).toBe(true);
    expect(isLegacyEvpKDF(MNEMONIC)).toBe(false);
    expect(isLegacyEvpKDF(forgeV2(MNEMONIC, PIN_JSON))).toBe(false);
    expect(isLegacyEvpKDF(forgeV3(MNEMONIC, PIN_JSON))).toBe(false);
    expect(isLegacyEvpKDF('garbage')).toBe(false);
  });

  it('isEncryptedMnemonicFormat accepts v2/v3/EvpKDF and rejects plaintext/garbage', () => {
    expect(isEncryptedMnemonicFormat(forgeV3(MNEMONIC, PIN_JSON))).toBe(true);
    expect(isEncryptedMnemonicFormat(forgeV2(MNEMONIC, PIN_JSON))).toBe(true);
    expect(isEncryptedMnemonicFormat(encryptMnemonic(MNEMONIC, PIN_JSON))).toBe(
      true,
    );
    expect(isEncryptedMnemonicFormat(MNEMONIC)).toBe(false); // plaintext seed
    expect(isEncryptedMnemonicFormat('garbage')).toBe(false);
  });
});

describe('biometric crypto', () => {
  const BIOMETRIC_KEY = 'biometricEncryptionKey';

  beforeEach(() => jest.clearAllMocks());

  it('new enrollment stores a 64-char hex key with requireAuthentication and a v3 envelope', async () => {
    let storedKey = null;
    let storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === BIOMETRIC_KEY) storedKey = value;
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY) return Promise.resolve({ didWork: true, value: storedKey });
      return Promise.resolve({ didWork: true, value: storedCipher });
    });

    const ok = await encryptAndStoreMnemonicWithBiometrics(MNEMONIC);

    expect(ok).toBe(true);
    expect(storedKey).toMatch(/^[0-9a-f]{64}$/);
    expect(storeData).toHaveBeenCalledWith(BIOMETRIC_KEY, storedKey, {
      requireAuthentication: true,
    });
    expect(JSON.parse(storedCipher).v).toBe(3);
    expect(JSON.parse(storedCipher).alg).toBe('aes-256-gcm');

    // Round-trip through the biometric decrypt path.
    const decrypted = await decryptMnemonicWithBiometrics();
    expect(decrypted).toBe(MNEMONIC);
  });

  it('reuses an existing stored key without rotating it', async () => {
    const existingKey = 'existing-mnemonic-string-key';
    let storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY)
        return Promise.resolve({ didWork: true, value: existingKey });
      return Promise.resolve({ didWork: true, value: storedCipher });
    });

    const key1 = await generateAndStoreEncryptionKeyForMnemoinc();
    expect(key1).toBe(existingKey);
    expect(storeData).not.toHaveBeenCalledWith(BIOMETRIC_KEY, expect.anything(), {
      requireAuthentication: true,
    });

    const ok = await encryptAndStoreMnemonicWithBiometrics(MNEMONIC);
    expect(ok).toBe(true);
    expect(JSON.parse(storedCipher).v).toBe(3);
  });

  it('migrates a legacy EvpKDF biometric envelope to v3 and reuses the same key string', async () => {
    const existingKey = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const legacyCipher = encryptMnemonic(MNEMONIC, existingKey);
    let storedCipher = legacyCipher;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY)
        return Promise.resolve({ didWork: true, value: existingKey });
      return Promise.resolve({ didWork: true, value: storedCipher });
    });

    const first = await decryptMnemonicWithBiometrics();
    expect(first).toBe(MNEMONIC);
    await flushAsync();
    expect(JSON.parse(storedCipher).v).toBe(3);

    // Subsequent login reads the migrated v3 envelope with the same key string.
    const second = await decryptMnemonicWithBiometrics();
    expect(second).toBe(MNEMONIC);
    expect(JSON.parse(storedCipher).v).toBe(3);
  });

  it('returns false on a wrong biometric key and never writes', async () => {
    const existingKey = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const legacyCipher = encryptMnemonic(MNEMONIC, existingKey);
    let storedCipher = legacyCipher;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY)
        return Promise.resolve({ didWork: true, value: 'wrong-key-string' });
      return Promise.resolve({ didWork: true, value: storedCipher });
    });

    const result = await decryptMnemonicWithBiometrics();
    expect(result).toBe(false);
    await flushAsync();
    expect(storedCipher).toBe(legacyCipher);
  });

  it('returns false when decrypt yields non-BIP39 garbage (C1 gate)', async () => {
    const existingKey = 'existing-key';
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY)
        return Promise.resolve({ didWork: true, value: existingKey });
      return Promise.resolve({
        didWork: true,
        value: forgeV3('not a valid bip39 seed phrase here', existingKey),
      });
    });
    storeData.mockResolvedValue(true);

    const result = await decryptMnemonicWithBiometrics();
    expect(result).toBe(false);
  });

  it('returns null when the key read fails', async () => {
    retrieveData.mockImplementation(key =>
      key === BIOMETRIC_KEY
        ? Promise.resolve({ didWork: false })
        : Promise.resolve({ didWork: true, value: 'x' }),
    );
    const result = await decryptMnemonicWithBiometrics();
    expect(result).toBeNull();
  });

  it('fails closed without rotating the key when the key read errors', async () => {
    retrieveData.mockImplementation(key =>
      key === BIOMETRIC_KEY
        ? Promise.resolve({ didWork: false, value: false })
        : Promise.resolve({ didWork: true, value: null }),
    );

    const key = await generateAndStoreEncryptionKeyForMnemoinc();
    expect(key).toBe(false);
    expect(storeData).not.toHaveBeenCalledWith(
      BIOMETRIC_KEY,
      expect.anything(),
      { requireAuthentication: true },
    );
  });

  it('generates a fresh key only when the key is truly absent', async () => {
    // Absent keys resolve as didWork:true + null value (expo-secure-store),
    // distinct from the read-error shape pinned above — this is the
    // first-time-enrollment half of the boundary.
    retrieveData.mockImplementation(() =>
      Promise.resolve({ didWork: true, value: null }),
    );

    const key = await generateAndStoreEncryptionKeyForMnemoinc();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(storeData).toHaveBeenCalledWith(BIOMETRIC_KEY, key, {
      requireAuthentication: true,
    });
  });

  it('returns null when the ciphertext read fails (retryable), not false', async () => {
    retrieveData.mockImplementation(key =>
      key === BIOMETRIC_KEY
        ? Promise.resolve({ didWork: true, value: 'some-key' })
        : Promise.resolve({ didWork: false, value: false }),
    );
    const result = await decryptMnemonicWithBiometrics();
    expect(result).toBeNull();
  });

  it('refuses to encrypt-and-store over a different valid plaintext seed', async () => {
    const otherSeed =
      'legal winner thank year wave sausage worth useful legal winner thank yellow';
    let storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY)
        return Promise.resolve({ didWork: true, value: 'some-key' });
      return Promise.resolve({ didWork: true, value: otherSeed });
    });

    const ok = await encryptAndStoreMnemonicWithBiometrics(MNEMONIC);
    expect(ok).toBe(false);
    expect(storedCipher).toBeNull();
  });

  it('allows re-storing the same plaintext seed (crashed-migration resume)', async () => {
    let storedCipher = null;
    storeData.mockImplementation((key, value) => {
      if (key === 'encryptedMnemonic') storedCipher = value;
      return Promise.resolve(true);
    });
    retrieveData.mockImplementation(key => {
      if (key === BIOMETRIC_KEY)
        return Promise.resolve({ didWork: true, value: 'some-key' });
      // Guard read returns plaintext; readback after write returns the stored cipher
      if (storedCipher !== null) return Promise.resolve({ didWork: true, value: storedCipher });
      return Promise.resolve({ didWork: true, value: MNEMONIC });
    });

    const ok = await encryptAndStoreMnemonicWithBiometrics(MNEMONIC);
    expect(ok).toBe(true);
    expect(JSON.parse(storedCipher).v).toBe(3);
  });
});
