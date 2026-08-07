/* eslint-env jest */
// ---------------------------------------------------------------------------
// custodyAccountsCrypto — v3 seed-derived Argon2id + AES-256-GCM account list.
//
// The mock argon2 mirrors real argon2id in the one way that matters for KDF
// correctness: a different m/t/p parameter set yields a different key, with
// `passes` also driving the PBKDF2 iteration count. The legacy-param fallback
// therefore only decrypts if production actually derives with the legacy
// params — a wrong fallback produces a wrong key and a GCM tag failure.
// ---------------------------------------------------------------------------

// Mock the native module before any imports using Node.js crypto as a drop-in.
jest.mock('react-native-quick-crypto', () => {
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

jest.mock('../../app/constants', () => ({
  BIOMETRIC_KEY: 'biometricEncryptionKey',
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  LOGIN_SECURITY_MODE_TYPE_KEY: 'LOGIN_SECURITY_MODE_TYPE',
  CUSTODY_ACCOUNTS_STORAGE_KEY: 'CUSTODY_ACCOUNTS',
}));

jest.mock('../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
  removeLocalStorageItem: jest.fn(),
}));

// The v3 account-list path must NEVER touch the keychain — the whole point of
// seed-derived keys is that a user restoring from the seed can decrypt the
// list after a keychain loss. If the module ever calls these, the tests throw.
jest.mock('../../app/functions/secureStore', () => ({
  MIGRATION_FLAG: 'secureStoreMigrationComplete',
  SECURE_MIGRATION_V2_FLAG: 'secureStoreMigrationV2Complete',
  storeData: jest.fn(() => {
    throw new Error('account-list path must not touch the keychain');
  }),
  retrieveData: jest.fn(() => {
    throw new Error('account-list path must not touch the keychain');
  }),
  deleteItem: jest.fn(() => {
    throw new Error('account-list path must not touch the keychain');
  }),
}));

jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn() }));

const {
  getLocalStorageItem,
  setLocalStorageItem,
} = require('../../app/functions/localStorage');
const cryptoMod = require('../../app/functions/custodyAccountsCrypto');
// Real handleMnemonic (crypto-es EvpKDF) — used to forge legacy ciphertexts
// AND as the production legacy decryptor, so the migration is tested against
// the actual legacy implementation.
const { encryptMnemonic } = require('../../app/functions/handleMnemonic');

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_SEED =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';
const CURRENT_PARAMS = { memory: 19456, passes: 2, parallelism: 1 };
const LEGACY_PARAMS = { memory: 16384, passes: 2, parallelism: 1 };
const AAD = Buffer.from('blitz.custodyAccounts.v3', 'utf8');

const account1 = {
  uuid: 'u-1',
  name: 'Imported A',
  mnemoinc: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
  accountType: 'imported',
  dateCreated: 1,
  isActive: false,
  profileEmoji: '',
};
const account2 = {
  ...account1,
  uuid: 'u-2',
  name: 'Imported B',
};

const canonicalSeed = seed => seed.trim().toLowerCase().split(/\s+/).join(' ');

// Mirror the mock argon2 derivation above (same domain-separation context and
// iteration count) so forged ciphertexts decrypt under the mock.
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

// Forge a v3 envelope the way production would, using the mock argon2 KDF.
function forgeV3(
  plaintext,
  seed,
  { saltHex, params = CURRENT_PARAMS, embedParams = true, aad = AAD } = {},
) {
  const nodeCrypto = require('node:crypto');
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : nodeCrypto.randomBytes(16);
  const key = forgeKDF(Buffer.from(canonicalSeed(seed), 'utf8'), salt, params);
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const obj = {
    v: 3,
    alg: 'aes-256-gcm',
    kdf: 'argon2id',
    salt: salt.toString('hex'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  };
  if (embedParams) {
    obj.m = params.memory;
    obj.t = params.passes;
    obj.p = params.parallelism;
  }
  return JSON.stringify(obj);
}

function legacyCiphertexts(accounts, seed) {
  return JSON.stringify(
    accounts.map(a => encryptMnemonic(JSON.stringify(a), seed)),
  );
}

function v3Envelope(value) {
  return JSON.parse(value);
}

function ctxFor(seed, saltHex, params = CURRENT_PARAMS) {
  const nodeCrypto = require('node:crypto');
  return {
    seed: canonicalSeed(seed),
    salt: saltHex,
    params,
    key: forgeKDF(
      Buffer.from(canonicalSeed(seed), 'utf8'),
      Buffer.from(saltHex, 'hex'),
      params,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // mockReset clears queued mockResolvedValueOnce values — a leftover once
  // from a previous test would otherwise be consumed by the next test's
  // getLocalStorageItem and poison its "stored" state.
  getLocalStorageItem.mockReset();
  setLocalStorageItem.mockReset();
  getLocalStorageItem.mockResolvedValue(null);
  setLocalStorageItem.mockResolvedValue(true);
  cryptoMod.resetCustodyCryptoState();
});

describe('encryptCustodyAccounts / decryptCustodyAccounts', () => {
  it('round-trips and embeds a versioned, parameterized envelope', () => {
    const ctx = ctxFor(SEED, 'aa'.repeat(16));
    const env = cryptoMod.encryptCustodyAccounts(
      JSON.stringify([account1]),
      ctx,
    );
    const parsed = v3Envelope(env);
    expect(parsed.v).toBe(3);
    expect(parsed.alg).toBe('aes-256-gcm');
    expect(parsed.kdf).toBe('argon2id');
    expect(parsed.salt).toBe('aa'.repeat(16));
    expect(parsed.m).toBe(CURRENT_PARAMS.memory);
    expect(parsed.t).toBe(CURRENT_PARAMS.passes);
    expect(parsed.p).toBe(CURRENT_PARAMS.parallelism);
    expect(parsed.iv).toEqual(expect.any(String));
    expect(parsed.tag).toEqual(expect.any(String));
    expect(parsed.ct).toEqual(expect.any(String));
    expect(JSON.parse(cryptoMod.decryptCustodyAccounts(env, ctx.key))).toEqual([
      account1,
    ]);
  });

  it('uses a fresh IV per encryption (same plaintext, different ciphertext)', () => {
    const ctx = ctxFor(SEED, 'bb'.repeat(16));
    const a = cryptoMod.encryptCustodyAccounts(JSON.stringify([account1]), ctx);
    const b = cryptoMod.encryptCustodyAccounts(JSON.stringify([account1]), ctx);
    expect(a).not.toBe(b);
    expect(JSON.parse(cryptoMod.decryptCustodyAccounts(a, ctx.key))).toEqual(
      JSON.parse(cryptoMod.decryptCustodyAccounts(b, ctx.key)),
    );
  });

  it('rejects tampering with ct, iv, or tag (GCM authenticity)', () => {
    const ctx = ctxFor(SEED, 'cc'.repeat(16));
    const env = cryptoMod.encryptCustodyAccounts(
      JSON.stringify([account1]),
      ctx,
    );
    const parsed = v3Envelope(env);

    const flip = s => {
      const buf = Buffer.from(s, 'base64');
      // eslint-disable-next-line no-bitwise -- intentional ciphertext tampering
      buf[0] ^= 0x01;
      return buf.toString('base64');
    };
    const tamperedCt = { ...parsed, ct: flip(parsed.ct) };
    const tamperedIv = { ...parsed, iv: flip(parsed.iv) };
    const tamperedTag = { ...parsed, tag: flip(parsed.tag) };

    expect(() =>
      cryptoMod.decryptCustodyAccounts(JSON.stringify(tamperedCt), ctx.key),
    ).toThrow();
    expect(() =>
      cryptoMod.decryptCustodyAccounts(JSON.stringify(tamperedIv), ctx.key),
    ).toThrow();
    expect(() =>
      cryptoMod.decryptCustodyAccounts(JSON.stringify(tamperedTag), ctx.key),
    ).toThrow();
  });

  it('rejects a wrong key (wrong seed)', () => {
    const ctxA = ctxFor(SEED, 'dd'.repeat(16));
    const ctxB = ctxFor(OTHER_SEED, 'dd'.repeat(16));
    const env = cryptoMod.encryptCustodyAccounts(
      JSON.stringify([account1]),
      ctxA,
    );
    expect(() =>
      cryptoMod.decryptCustodyAccounts(env, ctxB.key),
    ).toThrow();
  });

  it('rejects an envelope bound to a different AAD context', () => {
    const ctx = ctxFor(SEED, 'ee'.repeat(16));
    const env = forgeV3(JSON.stringify([account1]), SEED, {
      saltHex: 'ee'.repeat(16),
      aad: Buffer.from('some-other-context'),
    });
    expect(() =>
      cryptoMod.decryptCustodyAccounts(env, ctx.key),
    ).toThrow();
  });
});

describe('isCustodyAccountsV3', () => {
  it('accepts a v3 envelope and rejects everything else', () => {
    expect(
      cryptoMod.isCustodyAccountsV3(
        forgeV3(JSON.stringify([account1]), SEED),
      ),
    ).toBe(true);
    expect(cryptoMod.isCustodyAccountsV3(legacyCiphertexts([account1], SEED))).toBe(
      false,
    );
    expect(cryptoMod.isCustodyAccountsV3('[]')).toBe(false);
    expect(cryptoMod.isCustodyAccountsV3('not json')).toBe(false);
    expect(cryptoMod.isCustodyAccountsV3('{"v":3,"alg":"aes-256-gcm"}')).toBe(
      false,
    );
    expect(cryptoMod.isCustodyAccountsV3(null)).toBe(false);
  });
});

describe('loadCustodyAccounts — v3 read path', () => {
  it('decrypts a v3 envelope', async () => {
    const raw = forgeV3(JSON.stringify([account1, account2]), SEED);
    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1, account2]);
  });

  it('returns [] for an absent value without writing', async () => {
    expect(await cryptoMod.loadCustodyAccounts(null, SEED)).toEqual([]);
    expect(await cryptoMod.loadCustodyAccounts('', SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed on a wrong seed and preserves the stored envelope', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    expect(await cryptoMod.loadCustodyAccounts(raw, OTHER_SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed on a tampered envelope and preserves it', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    const parsed = v3Envelope(raw);
    const buf = Buffer.from(parsed.ct, 'base64');
    // eslint-disable-next-line no-bitwise -- intentional ciphertext tampering
    buf[0] ^= 0x01;
    const tampered = JSON.stringify({ ...parsed, ct: buf.toString('base64') });
    getLocalStorageItem.mockResolvedValue(tampered);
    expect(await cryptoMod.loadCustodyAccounts(tampered, SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed when the decrypted plaintext is not an array', async () => {
    const raw = forgeV3(JSON.stringify({ not: 'an array' }), SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    expect(await cryptoMod.loadCustodyAccounts(raw, SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed on malformed JSON', async () => {
    expect(await cryptoMod.loadCustodyAccounts('{not json', SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });
});

describe('loadCustodyAccounts — legacy EvpKDF migration', () => {
  it('migrates a legacy array to one v3 envelope, decryptable by seed alone', async () => {
    const raw = legacyCiphertexts([account1, account2], SEED);
    getLocalStorageItem.mockResolvedValue(raw);

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1, account2]);
    expect(setLocalStorageItem).toHaveBeenCalledTimes(1);

    const written = setLocalStorageItem.mock.calls[0][1];
    const parsed = v3Envelope(written);
    expect(parsed.v).toBe(3);
    expect(parsed.m).toBe(CURRENT_PARAMS.memory);
    // No per-item EvpKDF `Salted__` blobs survive in the new format.
    expect(written).not.toContain('Salted__');

    // The written envelope decrypts on a subsequent load (self-consistent).
    getLocalStorageItem.mockResolvedValue(written);
    expect(await cryptoMod.loadCustodyAccounts(written, SEED)).toEqual([
      account1,
      account2,
    ]);
  });

  it('skips corrupt entries and migrates the survivors', async () => {
    const raw = JSON.stringify([
      encryptMnemonic(JSON.stringify(account1), SEED),
      'this-is-not-ciphertext',
      42,
      encryptMnemonic(JSON.stringify(account2), SEED),
    ]);
    getLocalStorageItem.mockResolvedValue(raw);

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1, account2]);
    const written = v3Envelope(setLocalStorageItem.mock.calls[0][1]);
    expect(written.v).toBe(3);
  });

  it('skips legacy items that decrypt to non-object JSON', async () => {
    const raw = JSON.stringify([
      encryptMnemonic(JSON.stringify(account1), SEED),
      encryptMnemonic(JSON.stringify('just-a-string'), SEED),
    ]);
    getLocalStorageItem.mockResolvedValue(raw);

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1]);
    expect(setLocalStorageItem).toHaveBeenCalledTimes(1);
  });

  it('migrates an empty legacy array to an empty v3 envelope', async () => {
    getLocalStorageItem.mockResolvedValue('[]');
    expect(await cryptoMod.loadCustodyAccounts('[]', SEED)).toEqual([]);
    expect(setLocalStorageItem).toHaveBeenCalledTimes(1);
    expect(v3Envelope(setLocalStorageItem.mock.calls[0][1]).v).toBe(3);
  });

  it('preserves legacy data when nothing decrypts (corrupt / wrong seed)', async () => {
    // Deterministic garbage (not wrong-seed-encrypted fixtures): decrypting
    // crypto-es blobs with the wrong password can yield truthy garbage that
    // JSON.parses, so the structural plausibility check is what must reject
    // these. Fixed inputs keep the test deterministic.
    const raw = JSON.stringify([
      'U2FsdGVkX1+AAAA-not-a-real-ciphertext',
      'more-garbage',
    ]);
    getLocalStorageItem.mockResolvedValue(raw);

    expect(await cryptoMod.loadCustodyAccounts(raw, SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed on legacy JSON that is not an array', async () => {
    getLocalStorageItem.mockResolvedValue('{"v":2,"salt":"deadbeef"}');
    expect(
      await cryptoMod.loadCustodyAccounts('{"v":2,"salt":"deadbeef"}', SEED),
    ).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('still returns the decrypted list when the migration write fails', async () => {
    const raw = legacyCiphertexts([account1, account2], SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    setLocalStorageItem.mockRejectedValue(new Error('disk full'));

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1, account2]);

    // The session context is kept, so a subsequent write persists as v3 and
    // self-heals the failed migration.
    setLocalStorageItem.mockResolvedValue(true);
    await cryptoMod.writeCustodyAccounts([account1, account2], SEED);
    const written = v3Envelope(setLocalStorageItem.mock.calls[1][1]);
    expect(written.v).toBe(3);
    getLocalStorageItem.mockResolvedValue(setLocalStorageItem.mock.calls[1][1]);
    expect(
      await cryptoMod.loadCustodyAccounts(
        setLocalStorageItem.mock.calls[1][1],
        SEED,
      ),
    ).toEqual([account1, account2]);
  });
});

describe('loadCustodyAccounts — KDF parameter upgrade', () => {
  it('decrypts a legacy-param (16384) envelope and re-encrypts with current params', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED, {
      params: LEGACY_PARAMS,
    });
    const oldSalt = v3Envelope(raw).salt;
    getLocalStorageItem.mockResolvedValue(raw);

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1]);
    expect(setLocalStorageItem).toHaveBeenCalledTimes(1);

    const written = v3Envelope(setLocalStorageItem.mock.calls[0][1]);
    expect(written.m).toBe(CURRENT_PARAMS.memory);
    expect(written.salt).not.toBe(oldSalt);

    getLocalStorageItem.mockResolvedValue(setLocalStorageItem.mock.calls[0][1]);
    expect(
      await cryptoMod.loadCustodyAccounts(
        setLocalStorageItem.mock.calls[0][1],
        SEED,
      ),
    ).toEqual([account1]);
  });

  it('decrypts a pre-embedding envelope (no m/t/p) and upgrades it', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED, {
      params: LEGACY_PARAMS,
      embedParams: false,
    });
    getLocalStorageItem.mockResolvedValue(raw);

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1]);
    const written = v3Envelope(setLocalStorageItem.mock.calls[0][1]);
    expect(written.m).toBe(CURRENT_PARAMS.memory);
  });

  it('skips the upgrade write if the stored value changed concurrently (CAS)', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED, {
      params: LEGACY_PARAMS,
    });
    const concurrent = forgeV3(JSON.stringify([account2]), SEED);
    // loadCustodyAccounts receives `raw` from the caller; the CAS re-read is
    // the only storage read inside the module, so it must return the
    // concurrent value for the write to be skipped.
    getLocalStorageItem.mockResolvedValueOnce(concurrent);

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('does not rewrite an already-current envelope', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    expect(await cryptoMod.loadCustodyAccounts(raw, SEED)).toEqual([account1]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed on attacker-bloated KDF params (OOM DoS guard)', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    const parsed = v3Envelope(raw);
    // Tampered envelope: m asks Argon2 for 256 MiB on every login attempt
    // (over the 128 MiB cap, but under the pre-tightening 1 GiB cap).
    const bloated = JSON.stringify({ ...parsed, m: 256 * 1024 });
    getLocalStorageItem.mockResolvedValue(bloated);

    expect(await cryptoMod.loadCustodyAccounts(bloated, SEED)).toEqual([]);
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('fails closed on degenerate or non-integer KDF params', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    const parsed = v3Envelope(raw);
    for (const bad of [
      { ...parsed, m: 'x' },
      { ...parsed, m: 1 },
      { ...parsed, t: 0 },
      { ...parsed, p: 999 },
    ]) {
      const tampered = JSON.stringify(bad);
      getLocalStorageItem.mockResolvedValue(tampered);
      expect(await cryptoMod.loadCustodyAccounts(tampered, SEED)).toEqual([]);
      expect(setLocalStorageItem).not.toHaveBeenCalled();
    }
  });

  it('still returns the decrypted list when the upgrade write fails', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED, {
      params: LEGACY_PARAMS,
    });
    getLocalStorageItem.mockResolvedValue(raw);
    setLocalStorageItem.mockRejectedValue(new Error('disk full'));

    const accounts = await cryptoMod.loadCustodyAccounts(raw, SEED);
    expect(accounts).toEqual([account1]);

    // Session remains usable with the stored (legacy) params; the upgrade
    // retries on the next login. The write must still land and decrypt.
    setLocalStorageItem.mockResolvedValue(true);
    await cryptoMod.writeCustodyAccounts([account1, account2], SEED);
    const written = v3Envelope(setLocalStorageItem.mock.calls[1][1]);
    expect(written.v).toBe(3);
    expect(written.m).toBe(LEGACY_PARAMS.memory);
    getLocalStorageItem.mockResolvedValue(setLocalStorageItem.mock.calls[1][1]);
    expect(
      await cryptoMod.loadCustodyAccounts(
        setLocalStorageItem.mock.calls[1][1],
        SEED,
      ),
    ).toEqual([account1, account2]);
  });
});

describe('writeCustodyAccounts', () => {
  it('writes a v3 envelope with the session context after a load', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    await cryptoMod.loadCustodyAccounts(raw, SEED);
    setLocalStorageItem.mockClear();

    await cryptoMod.writeCustodyAccounts([account1, account2], SEED);
    expect(setLocalStorageItem).toHaveBeenCalledTimes(1);
    const written = setLocalStorageItem.mock.calls[0][1];
    expect(v3Envelope(written).v).toBe(3);

    getLocalStorageItem.mockResolvedValue(written);
    expect(await cryptoMod.loadCustodyAccounts(written, SEED)).toEqual([
      account1,
      account2,
    ]);
  });

  it('rebuilds from the stored envelope when no session context exists', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    const salt = v3Envelope(raw).salt;
    getLocalStorageItem.mockResolvedValue(raw);

    await cryptoMod.writeCustodyAccounts([account2], SEED);
    expect(v3Envelope(setLocalStorageItem.mock.calls[0][1]).salt).toBe(salt);
  });

  it('generates a fresh salt when nothing is stored yet', async () => {
    await cryptoMod.writeCustodyAccounts([account1], SEED);
    expect(setLocalStorageItem).toHaveBeenCalledTimes(1);
    const written = setLocalStorageItem.mock.calls[0][1];
    const parsed = v3Envelope(written);
    expect(parsed.v).toBe(3);
    expect(parsed.salt).toHaveLength(32);
  });

  it('never overwrites unloaded legacy data', async () => {
    const raw = legacyCiphertexts([account1], SEED);
    getLocalStorageItem.mockResolvedValue(raw);

    await expect(
      cryptoMod.writeCustodyAccounts([account1], SEED),
    ).rejects.toThrow();
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('re-derives with the passed seed when it differs from the cached one', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    await cryptoMod.loadCustodyAccounts(raw, SEED);
    setLocalStorageItem.mockClear();

    await cryptoMod.writeCustodyAccounts([account2], OTHER_SEED);
    const written = setLocalStorageItem.mock.calls[0][1];
    expect(v3Envelope(written).v).toBe(3);

    // Decryptable with OTHER_SEED, NOT with the cached SEED.
    getLocalStorageItem.mockResolvedValue(written);
    expect(await cryptoMod.loadCustodyAccounts(written, OTHER_SEED)).toEqual([
      account2,
    ]);
    expect(await cryptoMod.loadCustodyAccounts(written, SEED)).toEqual([]);
  });

  it('recovers after resetCustodyCryptoState clears the session cache', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    getLocalStorageItem.mockResolvedValue(raw);
    await cryptoMod.loadCustodyAccounts(raw, SEED);
    cryptoMod.resetCustodyCryptoState();

    await cryptoMod.writeCustodyAccounts([account1, account2], SEED);
    const written = setLocalStorageItem.mock.calls[0][1];
    getLocalStorageItem.mockResolvedValue(written);
    expect(await cryptoMod.loadCustodyAccounts(written, SEED)).toEqual([
      account1,
      account2,
    ]);
  });
});

describe('seed normalization', () => {
  it('derives the same key regardless of casing and whitespace', async () => {
    const raw = forgeV3(JSON.stringify([account1]), SEED);
    const sloppy = `  ${SEED.toUpperCase()}  `;
    expect(await cryptoMod.loadCustodyAccounts(raw, sloppy)).toEqual([
      account1,
    ]);
  });
});
