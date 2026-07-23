// Web shim for react-native-quick-crypto.
// Implements only the surface the app actually uses, on top of @noble libs
// (already dependencies). AES output is byte-identical to Node's crypto, so
// data encrypted here interops with the mobile app and the backend.
import { Buffer } from 'buffer';
import { cbc, gcm } from '@noble/ciphers/aes';
import { sha256 } from '@noble/hashes/sha2';
import { sha512 } from '@noble/hashes/sha2';
import { pbkdf2 as noblePbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2';
import { argon2id } from '@noble/hashes/argon2';

const HASHES = { sha256, sha512 };

function toBytes(data, encoding) {
  if (data == null) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return new Uint8Array(Buffer.from(data, encoding || 'utf8'));
  return new Uint8Array(Buffer.from(data));
}

export function randomBytes(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

// --- createHash: incremental update()/digest(), sha256 + sha512 only ---
export function createHash(algorithm) {
  const fn = HASHES[algorithm.toLowerCase()];
  if (!fn) throw new Error(`quick-crypto shim: unsupported hash ${algorithm}`);
  const h = fn.create();
  return {
    update(data, enc) {
      h.update(toBytes(data, enc));
      return this;
    },
    digest(encoding) {
      const out = Buffer.from(h.digest());
      return encoding ? out.toString(encoding) : out;
    },
  };
}

// --- createCipheriv / createDecipheriv ---
// One-shot under the hood (buffers updates, runs on final). Both app callers
// concat update()+final(), so byte output matches Node exactly.
// ponytail: one-shot cipher; add true streaming only if a consumer needs
// incremental output mid-stream.
function makeCipher(algorithm, key, iv, decrypt) {
  const alg = algorithm.toLowerCase();
  const keyB = toBytes(key);
  const ivB = toBytes(iv);
  const chunks = [];
  let authTag = null; // GCM decrypt: caller-provided tag
  const isGcm = alg.endsWith('-gcm');

  function build() {
    if (alg === 'aes-256-cbc' || alg === 'aes-128-cbc')
      return cbc(keyB, ivB);
    if (isGcm) return gcm(keyB, ivB);
    throw new Error(`quick-crypto shim: unsupported cipher ${algorithm}`);
  }

  return {
    update(data, inputEnc) {
      chunks.push(toBytes(data, inputEnc));
      return Buffer.alloc(0); // output deferred to final()
    },
    final(outputEnc) {
      const input = Buffer.concat(chunks.map(c => Buffer.from(c)));
      const cipher = build();
      let out;
      if (decrypt) {
        const payload = isGcm && authTag
          ? new Uint8Array(Buffer.concat([input, authTag]))
          : new Uint8Array(input);
        out = Buffer.from(cipher.decrypt(payload));
      } else {
        const full = Buffer.from(cipher.encrypt(new Uint8Array(input)));
        if (isGcm) {
          authTag = full.slice(full.length - 16);
          out = full.slice(0, full.length - 16);
        } else {
          out = full;
        }
      }
      return outputEnc ? out.toString(outputEnc) : out;
    },
    getAuthTag() {
      return authTag;
    },
    setAuthTag(tag) {
      authTag = Buffer.from(toBytes(tag));
      return this;
    },
    setAAD() {
      throw new Error('quick-crypto shim: AAD not supported');
    },
  };
}

export function createCipheriv(algorithm, key, iv) {
  return makeCipher(algorithm, key, iv, false);
}
export function createDecipheriv(algorithm, key, iv) {
  return makeCipher(algorithm, key, iv, true);
}

// --- pbkdf2 (async callback) / pbkdf2Sync ---
function hashFor(digest) {
  const fn = HASHES[(digest || 'sha256').toLowerCase()];
  if (!fn) throw new Error(`quick-crypto shim: unsupported pbkdf2 digest ${digest}`);
  return fn;
}
export function pbkdf2Sync(password, salt, iterations, keylen, digest) {
  const out = noblePbkdf2(hashFor(digest), toBytes(password), toBytes(salt), {
    c: iterations,
    dkLen: keylen,
  });
  return Buffer.from(out);
}
export function pbkdf2(password, salt, iterations, keylen, digest, callback) {
  pbkdf2Async(hashFor(digest), toBytes(password), toBytes(salt), {
    c: iterations,
    dkLen: keylen,
  })
    .then(out => callback(null, Buffer.from(out)))
    .catch(err => callback(err));
}

// --- argon2 (callback API matching react-native-quick-crypto) ---
// handleMnemonic.js calls: argon2('argon2id', {message, nonce, tagLength,
// memory, passes, parallelism}, cb)
export function argon2(algorithm, params, callback) {
  try {
    if (algorithm.toLowerCase() !== 'argon2id')
      throw new Error(`quick-crypto shim: unsupported argon2 variant ${algorithm}`);
    const key = argon2id(toBytes(params.message), toBytes(params.nonce), {
      t: params.passes,
      m: params.memory,
      p: params.parallelism,
      dkLen: params.tagLength,
    });
    callback(null, Buffer.from(key));
  } catch (err) {
    callback(err);
  }
}

export const subtle = crypto.subtle;

const quickCrypto = {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  pbkdf2,
  pbkdf2Sync,
  argon2,
  subtle,
  getRandomValues: crypto.getRandomValues.bind(crypto),
};

export default quickCrypto;
