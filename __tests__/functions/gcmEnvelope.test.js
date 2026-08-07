// Unit tests for the shared GCM envelope helper. The global jest.setup.js
// mock maps react-native-quick-crypto to node:crypto, so the real GCM
// primitives run against Node's AES-256-GCM implementation.

const nodeCrypto = require('node:crypto');
const {
  encryptGCM,
  decryptGCM,
  parseKdfParams,
  isGcmV3,
} = require('../../app/functions/gcmEnvelope');

const KEY = nodeCrypto.randomBytes(32);
const SALT = nodeCrypto.randomBytes(16).toString('hex');
const PARAMS = { memory: 19456, passes: 2, parallelism: 1 };
const AAD = Buffer.from('blitz.encryptedMnemonic.v3', 'utf8');
const OTHER_AAD = Buffer.from('blitz.custodyAccounts.v3', 'utf8');
const PLAINTEXT = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function makeEnvelope(overrides = {}) {
  const env = JSON.parse(
    encryptGCM(PLAINTEXT, { key: KEY, salt: SALT, params: PARAMS }, AAD),
  );
  return JSON.stringify({ ...env, ...overrides });
}

describe('encryptGCM / decryptGCM round-trip', () => {
  it('round-trips plaintext with a fixed 32-byte key and AAD', () => {
    const env = encryptGCM(
      PLAINTEXT,
      { key: KEY, salt: SALT, params: PARAMS },
      AAD,
    );
    const parsed = JSON.parse(env);
    expect(parsed.v).toBe(3);
    expect(parsed.alg).toBe('aes-256-gcm');
    expect(parsed.kdf).toBe('argon2id');
    expect(parsed.salt).toBe(SALT);
    expect(parsed.m).toBe(19456);
    expect(parsed.t).toBe(2);
    expect(parsed.p).toBe(1);
    // Field encoding parity with custody: salt hex; iv/tag/ct base64.
    expect(Buffer.from(parsed.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(parsed.tag, 'base64')).toHaveLength(16);
    expect(typeof parsed.ct).toBe('string');

    expect(decryptGCM(env, KEY, AAD)).toBe(PLAINTEXT);
  });

  it('fails to decrypt with a wrong key', () => {
    const env = encryptGCM(
      PLAINTEXT,
      { key: KEY, salt: SALT, params: PARAMS },
      AAD,
    );
    expect(() => decryptGCM(env, nodeCrypto.randomBytes(32), AAD)).toThrow();
  });
});

describe('tamper detection', () => {
  it('throws when the ciphertext is tampered', () => {
    const env = JSON.parse(makeEnvelope());
    env.ct = Buffer.from('tampered').toString('base64');
    expect(() => decryptGCM(JSON.stringify(env), KEY, AAD)).toThrow();
  });

  it('throws when the iv is tampered', () => {
    expect(() =>
      decryptGCM(makeEnvelope({ iv: nodeCrypto.randomBytes(12).toString('base64') }), KEY, AAD),
    ).toThrow();
  });

  it('throws when the tag is tampered', () => {
    expect(() =>
      decryptGCM(makeEnvelope({ tag: nodeCrypto.randomBytes(16).toString('base64') }), KEY, AAD),
    ).toThrow();
  });

  it('throws when the tag is dropped', () => {
    const env = JSON.parse(makeEnvelope());
    delete env.tag;
    expect(() => decryptGCM(JSON.stringify(env), KEY, AAD)).toThrow();
  });

  it('throws when the AAD differs', () => {
    const env = encryptGCM(
      PLAINTEXT,
      { key: KEY, salt: SALT, params: PARAMS },
      AAD,
    );
    expect(() => decryptGCM(env, KEY, OTHER_AAD)).toThrow();
  });

  it('throws on garbage input', () => {
    expect(() => decryptGCM('not json', KEY, AAD)).toThrow();
    expect(() => decryptGCM('{}', KEY, AAD)).toThrow();
  });
});

describe('parseKdfParams', () => {
  const BOUNDS = { minMemoryKiB: 8 * 1024, maxMemoryKiB: 64 * 1024 };

  it('accepts current params (m:19456)', () => {
    expect(parseKdfParams({ m: 19456, t: 2, p: 1 }, BOUNDS)).toEqual({
      memory: 19456,
      passes: 2,
      parallelism: 1,
    });
  });

  it('accepts legacy params (m:16384)', () => {
    expect(parseKdfParams({ m: 16384, t: 2, p: 1 }, BOUNDS)).toEqual({
      memory: 16384,
      passes: 2,
      parallelism: 1,
    });
  });

  it('falls back to the legacy param set when m/t/p are absent', () => {
    expect(parseKdfParams({}, BOUNDS)).toEqual({
      memory: 16384,
      passes: 2,
      parallelism: 1,
    });
    expect(parseKdfParams({ salt: 'x' }, BOUNDS)).toEqual({
      memory: 16384,
      passes: 2,
      parallelism: 1,
    });
  });

  it('rejects memory above the caller-supplied ceiling (boundary at 64 MiB)', () => {
    expect(() => parseKdfParams({ m: 64 * 1024, t: 2, p: 1 }, BOUNDS)).not.toThrow();
    expect(() => parseKdfParams({ m: 64 * 1024 + 1, t: 2, p: 1 }, BOUNDS)).toThrow();
    expect(() => parseKdfParams({ m: 512 * 1024, t: 2, p: 1 }, BOUNDS)).toThrow();
  });

  it('rejects memory below the 8 MiB floor', () => {
    expect(() => parseKdfParams({ m: 4 * 1024, t: 2, p: 1 }, BOUNDS)).toThrow();
  });

  it('rejects non-integer m/t/p', () => {
    expect(() => parseKdfParams({ m: 19456.5, t: 2, p: 1 }, BOUNDS)).toThrow();
    expect(() => parseKdfParams({ m: 19456, t: 1.5, p: 1 }, BOUNDS)).toThrow();
    expect(() => parseKdfParams({ m: 19456, t: 2, p: 1.5 }, BOUNDS)).toThrow();
  });

  it('rejects t:0 and t above 8', () => {
    expect(() => parseKdfParams({ m: 19456, t: 0, p: 1 }, BOUNDS)).toThrow();
    expect(() => parseKdfParams({ m: 19456, t: 9, p: 1 }, BOUNDS)).toThrow();
  });

  it('rejects p:9 and p:0', () => {
    expect(() => parseKdfParams({ m: 19456, t: 2, p: 9 }, BOUNDS)).toThrow();
    expect(() => parseKdfParams({ m: 19456, t: 2, p: 0 }, BOUNDS)).toThrow();
  });

  it('honors caller-supplied bounds', () => {
    const tight = { minMemoryKiB: 16 * 1024, maxMemoryKiB: 32 * 1024 };
    expect(() => parseKdfParams({ m: 15000, t: 2, p: 1 }, tight)).toThrow();
    expect(() => parseKdfParams({ m: 40 * 1024, t: 2, p: 1 }, tight)).toThrow();
    expect(() => parseKdfParams({ m: 16384, t: 2, p: 1 }, tight)).not.toThrow();
  });
});

describe('isGcmV3', () => {
  it('is true for a well-formed v3 envelope', () => {
    expect(
      isGcmV3(encryptGCM(PLAINTEXT, { key: KEY, salt: SALT, params: PARAMS }, AAD)),
    ).toBe(true);
  });

  it('is false for a v2 envelope', () => {
    expect(
      isGcmV3(JSON.stringify({ v: 2, salt: SALT, iv: 'x', ct: 'y' })),
    ).toBe(false);
  });

  it('is false for plaintext', () => {
    expect(isGcmV3(PLAINTEXT)).toBe(false);
  });

  it('is false for garbage', () => {
    expect(isGcmV3('U2FsdGVkX1+garbage')).toBe(false);
    expect(isGcmV3('not json')).toBe(false);
    expect(isGcmV3(null)).toBe(false);
    expect(isGcmV3(undefined)).toBe(false);
  });

  it('honors custom alg/kdf arguments', () => {
    const env = encryptGCM(PLAINTEXT, { key: KEY, salt: SALT, params: PARAMS }, AAD);
    expect(isGcmV3(env, 'aes-256-gcm', 'argon2id')).toBe(true);
    expect(isGcmV3(env, 'aes-256-cbc', 'argon2id')).toBe(false);
    expect(isGcmV3(env, 'aes-256-gcm', 'scrypt')).toBe(false);
  });
});
