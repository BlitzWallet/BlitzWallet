// v3 custody-account list encryption: seed-derived Argon2id + AES-256-GCM.
//
// Security properties:
//  - The key is Argon2id(master mnemonic, salt) — memory-hard KDF (no EvpKDF),
//    and deliberately derived from the seed (not a keychain-stored DEK) so a
//    user re-entering the seed after a keychain loss can still decode the
//    account list. The salt is NOT secret; it travels with the ciphertext.
//  - AES-256-GCM authenticates every byte (tamper / wrong seed => hard fail).
//    AAD binds the ciphertext to this storage context so it can't be replayed
//    into another field.
//  - Fail closed: anything unreadable yields [] and the stored value is never
//    overwritten with a "successful" empty migration. Corrupt legacy entries
//    are skipped; if NOTHING legacy decrypts to a plausible account, the raw
//    legacy array is preserved for retry instead of being destroyed.
//  - The derived key is cached per session (cleared via
//    resetCustodyCryptoState on logout/wipe); writes are GCM-only, so the
//    Argon2 cost is paid once per login, not per account mutation.

import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import crypto, { argon2 as argon2KDF } from 'react-native-quick-crypto';
import { CUSTODY_ACCOUNTS_STORAGE_KEY } from '../constants';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { decryptMnemonic } from './handleMnemonic';

const SALT_BYTES = 16;
const KEY_LEN = 32;
// OWASP baseline — same KDF parameters as the v2 mnemonic envelope.
const KDF_PARAMS = { memory: 19456, passes: 2, parallelism: 1 };
// Params shipped before m/t/p were embedded; used to decrypt those envelopes.
const LEGACY_KDF_PARAMS = { memory: 16384, passes: 2, parallelism: 1 };
// Bounds for attacker-influenced params read from the stored envelope: a
// tampered m/t/p must not be able to make login allocate unbounded Argon2
// memory (OOM DoS) or pick degenerate parameters. Legit envelopes only ever
// contain current (19456) or legacy (16384) params; the ceiling is sized for
// low-end devices so a tampered high-m envelope can't OOM-kill the app.
const MAX_KDF_MEMORY_KIB = 128 * 1024; // 128 MiB
const MAX_KDF_PASSES = 8;
const MAX_KDF_PARALLELISM = 8;
const AAD = Buffer.from('blitz.custodyAccounts.v3', 'utf8');

// Per-session cache: { seed, salt, params, key }. Cleared on logout/wipe.
let context = null;

const canonicalSeed = seed =>
  seed.trim().toLowerCase().split(/\s+/).join(' ');

const randomSaltHex = () => crypto.randomBytes(SALT_BYTES).toString('hex');

function argon2Async(password, salt, params) {
  return new Promise((resolve, reject) =>
    argon2KDF(
      'argon2id',
      {
        message: password,
        nonce: salt,
        tagLength: KEY_LEN,
        ...params,
      },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

async function deriveContext(seed, saltHex, params) {
  const canonical = canonicalSeed(seed);
  const key = await argon2Async(canonical, Buffer.from(saltHex, 'hex'), params);
  return { seed: canonical, salt: saltHex, params, key };
}

function paramsFromEnv(env) {
  const memory = env.m ?? LEGACY_KDF_PARAMS.memory;
  const passes = env.t ?? LEGACY_KDF_PARAMS.passes;
  const parallelism = env.p ?? LEGACY_KDF_PARAMS.parallelism;
  if (
    !Number.isInteger(memory) ||
    memory < 8 * 1024 ||
    memory > MAX_KDF_MEMORY_KIB ||
    !Number.isInteger(passes) ||
    passes < 1 ||
    passes > MAX_KDF_PASSES ||
    !Number.isInteger(parallelism) ||
    parallelism < 1 ||
    parallelism > MAX_KDF_PARALLELISM
  ) {
    throw new Error('Custody accounts envelope has invalid KDF params');
  }
  return { memory, passes, parallelism };
}

function custodyNeedsUpgrade(env) {
  return env.m == null || env.m < KDF_PARAMS.memory;
}

// Legacy (EvpKDF) decrypts are unauthenticated — a wrong seed can yield
// truthy garbage ~1/3 of the time, so every decrypted item must pass a
// structural plausibility check before it is migrated (mirrors how the
// mnemonic path gates on validateMnemonic). Only shapes this app actually
// writes are accepted: imported (12-word BIP39 seed) or derived (modern
// derivationIndex, or legacy mnemoinc-bearing shape).
function isPlausibleAccount(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }
  if (typeof parsed.uuid !== 'string' || parsed.uuid.length === 0) return false;
  if (typeof parsed.name !== 'string') return false;
  const hasValidMnemonic =
    typeof parsed.mnemoinc === 'string' &&
    validateMnemonic(parsed.mnemoinc, wordlist);
  if (parsed.accountType === 'imported') return hasValidMnemonic;
  if (parsed.accountType === 'derived') {
    return Number.isInteger(parsed.derivationIndex) || hasValidMnemonic;
  }
  return false;
}

export function resetCustodyCryptoState() {
  context = null;
}

export function isCustodyAccountsV3(value) {
  try {
    const p = JSON.parse(value);
    return (
      p?.v === 3 &&
      p.alg === 'aes-256-gcm' &&
      p.kdf === 'argon2id' &&
      typeof p.salt === 'string' &&
      typeof p.iv === 'string' &&
      typeof p.tag === 'string' &&
      typeof p.ct === 'string'
    );
  } catch {
    return false;
  }
}

export function encryptCustodyAccounts(plaintextJson, { salt, params, key }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const ct = Buffer.concat([
    cipher.update(plaintextJson, 'utf8'),
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

export function decryptCustodyAccounts(envelopeStr, key) {
  const { iv, tag, ct } = JSON.parse(envelopeStr);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, 'base64')),
    decipher.final(), // throws on tamper / wrong seed
  ]).toString('utf8');
}

// Compare-and-swap: only overwrite the stored value if it still equals the
// one we decrypted, so a concurrent create/update can't be clobbered by a
// migration write (mirrors reEncryptIfUnchanged in handleMnemonic.js).
async function writeIfUnchanged(accounts, staleRaw, ctx) {
  const current = await getLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY);
  if (current !== staleRaw) {
    console.log('Custody accounts changed during migration; write skipped');
    return false;
  }
  await setLocalStorageItem(
    CUSTODY_ACCOUNTS_STORAGE_KEY,
    encryptCustodyAccounts(JSON.stringify(accounts), ctx),
  );
  return true;
}

async function loadV3(raw, seed) {
  const env = JSON.parse(raw);
  const ctx = await deriveContext(seed, env.salt, paramsFromEnv(env));
  let accounts;
  try {
    accounts = JSON.parse(decryptCustodyAccounts(raw, ctx.key));
  } catch (err) {
    console.log('Custody accounts decrypt failed (tamper or wrong seed)', err);
    return [];
  }
  if (!Array.isArray(accounts)) {
    console.log('Custody accounts plaintext is not an array; failing closed');
    return [];
  }
  context = ctx; // only cache a key that actually decrypted the list
  if (custodyNeedsUpgrade(env)) {
    // Re-encrypt with current KDF params + a fresh salt. The fresh context is
    // only cached if the CAS write lands; otherwise the session keeps the
    // params the stored envelope was actually written with.
    try {
      const freshCtx = await deriveContext(
        seed,
        randomSaltHex(),
        KDF_PARAMS,
      );
      const written = await writeIfUnchanged(accounts, raw, freshCtx);
      context = written ? freshCtx : ctx;
    } catch (err) {
      // A failed upgrade write must not blank a successful read: the session
      // keeps the stored params and the upgrade retries next login.
      console.log('Custody KDF upgrade write failed; will retry next login', err);
    }
  }
  return accounts;
}

async function loadLegacy(raw, seed) {
  const legacy = JSON.parse(raw);
  if (!Array.isArray(legacy)) {
    console.log('Custody accounts value is not a legacy array; failing closed');
    return [];
  }
  const accounts = [];
  for (const item of legacy) {
    if (typeof item !== 'string' || !item) continue;
    let decrypted;
    try {
      decrypted = decryptMnemonic(item, seed);
    } catch (err) {
      continue;
    }
    if (typeof decrypted !== 'string' || !decrypted) continue;
    let parsed;
    try {
      parsed = JSON.parse(decrypted);
    } catch (err) {
      continue;
    }
    if (isPlausibleAccount(parsed)) accounts.push(parsed);
  }
  if (legacy.length > 0 && accounts.length === 0) {
    // Wrong seed or fully corrupt: never replace the stored data with an
    // empty "successful" migration — preserve it for a future correct login.
    console.log('Custody accounts: nothing decryptable; preserving legacy data');
    return [];
  }
  const ctx = await deriveContext(seed, randomSaltHex(), KDF_PARAMS);
  try {
    const written = await writeIfUnchanged(accounts, raw, ctx);
    if (!written) {
      console.log('Custody migration skipped (concurrent change)');
    }
  } catch (err) {
    // Decryption succeeded; a failed migration write must not blank the
    // session. Keep the derived context so subsequent writes still persist as
    // v3 (state is the source of truth), and re-migrate on next login if the
    // legacy value survives.
    console.log('Custody migration write failed; retrying next login', err);
  }
  context = ctx;
  return accounts;
}

export async function loadCustodyAccounts(raw, seed) {
  if (!raw) return [];
  try {
    if (isCustodyAccountsV3(raw)) return await loadV3(raw, seed);
    return await loadLegacy(raw, seed);
  } catch (err) {
    console.log('Custody accounts load failed; failing closed', err);
    return [];
  }
}

async function contextFromStorageOrFresh(seed) {
  const raw = await getLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY);
  if (raw && isCustodyAccountsV3(raw)) {
    const env = JSON.parse(raw);
    return deriveContext(seed, env.salt, paramsFromEnv(env));
  }
  if (raw && raw !== '[]') {
    // Legacy/corrupt data on disk must go through loadCustodyAccounts first;
    // writing now would silently destroy it.
    throw new Error('Custody accounts must be loaded before writing');
  }
  return deriveContext(seed, randomSaltHex(), KDF_PARAMS);
}

export async function writeCustodyAccounts(accounts, seed) {
  const canonical = canonicalSeed(seed);
  const ctx =
    context && context.seed === canonical
      ? context
      : await contextFromStorageOrFresh(seed);
  const envelope = encryptCustodyAccounts(JSON.stringify(accounts), ctx);
  await setLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY, envelope);
  context = ctx;
  return envelope;
}
