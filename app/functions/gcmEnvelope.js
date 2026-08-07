// Shared AES-256-GCM envelope primitives, parameterized by AAD so each storage
// context (mnemonic at rest, custody accounts, ...) binds ciphertexts to its
// own AAD and can apply its own KDF-param bounds. Mirrors the proven custody
// primitives in custodyAccountsCrypto.js (same field encoding: salt hex,
// iv/tag/ct base64) so mobile<->web byte-parity is preserved.
//
// Security properties:
//  - AES-256-GCM authenticates every byte: tamper or a wrong key makes
//    decipher.final() throw (fail closed, no padding-oracle behavior).
//  - AAD binds the envelope to a storage context so it can't be replayed.
//  - KDF params are validated against caller-supplied bounds (anti-OOM /
//    degenerate-params DoS) before the caller ever allocates Argon2 memory.
//  - Salt is NOT authenticated by GCM (it is consumed by the caller's key
//    derivation), so any tampered salt yields a different key and fails the
//    tag check downstream.

import crypto from 'react-native-quick-crypto';

// Params shipped before m/t/p were embedded in envelopes; used when reading
// those legacy envelopes (mirrors LEGACY_KDF_PARAMS in custodyAccountsCrypto).
const LEGACY_PARAMS = { memory: 16384, passes: 2, parallelism: 1 };
// Attacker-influenced m/t/p must not pick degenerate KDF settings. Legit
// envelopes only ever contain current (19456) or legacy (16384) params.
const MAX_KDF_PASSES = 8;
const MAX_KDF_PARALLELISM = 8;

export function encryptGCM(plaintextUtf8, { key, salt, params }, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([
    cipher.update(plaintextUtf8, 'utf8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    v: 3,
    alg: 'aes-256-gcm',
    kdf: 'argon2id',
    salt,
    m: params.memory,
    t: params.passes,
    p: params.parallelism,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  });
}

export function decryptGCM(envelopeStr, key, aad) {
  const { iv, tag, ct } = JSON.parse(envelopeStr);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, 'base64')),
    decipher.final(), // throws on tamper / wrong key
  ]).toString('utf8');
}

export function parseKdfParams(env, { minMemoryKiB, maxMemoryKiB }) {
  // Absent m/t/p => an envelope written before params were embedded, which
  // shipped only with the legacy params. This fallback is the
  // backward-compat hinge (mirrors paramsFromEnv in custodyAccountsCrypto).
  const memory = env.m ?? LEGACY_PARAMS.memory;
  const passes = env.t ?? LEGACY_PARAMS.passes;
  const parallelism = env.p ?? LEGACY_PARAMS.parallelism;
  if (
    !Number.isInteger(memory) ||
    memory < minMemoryKiB ||
    memory > maxMemoryKiB ||
    !Number.isInteger(passes) ||
    passes < 1 ||
    passes > MAX_KDF_PASSES ||
    !Number.isInteger(parallelism) ||
    parallelism < 1 ||
    parallelism > MAX_KDF_PARALLELISM
  ) {
    throw new Error('Envelope has invalid KDF params');
  }
  return { memory, passes, parallelism };
}

export function isGcmV3(value, alg = 'aes-256-gcm', kdf = 'argon2id') {
  try {
    const p = JSON.parse(value);
    return (
      p?.v === 3 &&
      p.alg === alg &&
      p.kdf === kdf &&
      typeof p.salt === 'string' &&
      typeof p.iv === 'string' &&
      typeof p.tag === 'string' &&
      typeof p.ct === 'string'
    );
  } catch {
    return false;
  }
}
