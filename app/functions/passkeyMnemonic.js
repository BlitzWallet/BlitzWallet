// Web only: locks the wallet seed with a passkey instead of a password.
//
// The WebAuthn PRF extension makes the passkey return a deterministic 32-byte
// secret, and only after user verification (face, fingerprint, device PIN).
// HKDF turns it into an AES-256-GCM key, and the encrypted seed is stored in
// the existing `encryptedMnemonic` slot with the same field shape as the v3
// password envelope, plus `kdf: 'webauthn-prf'`, `credentialId` and
// `createdAt`. Nothing in the envelope is secret. No server is involved: the
// assertion signature is never verified, the GCM tag check is the
// verification.
//
// rp.id / rpId are never set, so the passkey is bound to the serving hostname,
// the same origin as the IndexedDB that holds its envelope.
//
// Imports flow one way (this file -> handleMnemonic/gcmEnvelope/secureStore),
// so there is no require cycle.
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import crypto from 'react-native-quick-crypto';
import {
  isPasskeyMnemonicFormat,
  MNEMONIC_AAD,
  PIN_MARKER,
} from './handleMnemonic';
import { decryptGCM } from './gcmEnvelope';
import { retrieveData, storeData } from './secureStore';

// Retain creation time across confirmation retries so the stored date matches
// the name registered with the password manager, even across midnight.
const credentialCreationTimes = new Map();

const HKDF_INFO = Buffer.from('blitz.encryptedMnemonic.passkey.v1', 'utf8');

// Never use Buffer's 'base64url' encoding: the web Buffer polyfill
// (buffer@5) doesn't have it. Its 'base64' decoder accepts '-' and '_'.
const toBase64Url = bytes =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .split('=')[0];
const fromBase64Url = str => Buffer.from(str, 'base64');

const deriveKey = prfOutput =>
  hkdf(sha256, prfOutput, undefined, HKDF_INFO, 32);

// The name the password manager lists the passkey under. Settings rebuilds it
// from the envelope's createdAt, so both must come from this one function.
export const passkeyName = time =>
  `Blitz Wallet · ${new Date(time).toLocaleDateString()}`;

// One passkey prompt. Returns the 32-byte PRF output; null when the prompt
// failed or was cancelled (NotAllowedError covers cancel, timeout and "no
// such passkey on this device", so retrying is safe); false when the
// authenticator answered without a PRF result (it can't do PRF).
async function getPrfOutput(credentialId, salt) {
  const publicKey = {
    challenge: crypto.randomBytes(32),
    allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }],
    userVerification: 'required',
    extensions: { prf: { eval: { first: salt } } },
  };
  let assertion;
  try {
    assertion = await navigator.credentials.get({ publicKey });
  } catch (err) {
    console.log('passkey prompt error', err);
    return null;
  }
  if (!assertion) return null;
  const first = assertion.getClientExtensionResults()?.prf?.results?.first;
  return first?.byteLength === 32 ? new Uint8Array(first) : false;
}

// Capability flags don't reflect the user's password manager, so this only
// decides whether to offer a passkey; the setup ceremony is the real test.
// Browsers without getClientCapabilities (or without PublicKeyCredential at
// all) throw here and get the password flow.
export async function isPasskeySupported() {
  try {
    const capabilities =
      await window.PublicKeyCredential.getClientCapabilities();
    return capabilities?.['extension:prf'] === true;
  } catch {
    return false;
  }
}

// First setup prompt ("Create"). The key never comes from create(): some
// providers report PRF here and then fail every get() (Microsoft Password
// Manager), others only return PRF from get() (Samsung Pass). The confirm
// get() in storeMnemonicWithPasskey covers both.
export async function createPasskey() {
  const createdAt = Date.now();
  const name = passkeyName(createdAt);
  let credential;
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'Blitz Wallet' },
        // Random, never derived from the seed.
        user: { id: crypto.randomBytes(16), name, displayName: name },
        challenge: crypto.randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
        },
        extensions: { prf: {} },
      },
    });
  } catch (err) {
    console.log('create passkey error', err);
    const cancelled =
      err?.name === 'NotAllowedError' || err?.name === 'AbortError';
    return { status: cancelled ? 'cancelled' : 'unsupported' };
  }
  if (!credential) return { status: 'cancelled' };
  const credentialId = toBase64Url(new Uint8Array(credential.rawId));
  if (credential.getClientExtensionResults()?.prf?.enabled === false) {
    // Created but useless for encryption (e.g. NordPass): drop it.
    await forgetPasskey(credentialId);
    return { status: 'unsupported' };
  }
  credentialCreationTimes.set(credentialId, createdAt);
  return { status: 'ok', credentialId };
}

// Second setup prompt ("Confirm"), then the write. Nothing is written until
// the key has come from get() and the envelope has decrypted back to the seed
// in memory; each write is then read back. Ciphertext first, marker last, the
// same order as storeMnemonicWithPinSecurity. That single encryptedMnemonic
// write is what switches a wallet's unlock method.
// Returns 'ok' | 'confirm-failed' (retry on the same credential) |
// 'unsupported' (no PRF result) | 'failed' (storage).
export async function storeMnemonicWithPasskey(mnemonic, credentialId) {
  try {
    if (!validateMnemonic(mnemonic, wordlist)) return 'failed';
    const salt = crypto.randomBytes(32);
    const prfOutput = await getPrfOutput(credentialId, salt);
    if (prfOutput === null) return 'confirm-failed';
    if (!prfOutput) return 'unsupported';

    const key = deriveKey(prfOutput);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(MNEMONIC_AAD);
    const ct = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()]);
    const envelope = JSON.stringify({
      v: 3,
      alg: 'aes-256-gcm',
      kdf: 'webauthn-prf',
      credentialId,
      salt: salt.toString('hex'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ct: ct.toString('base64'),
      createdAt: credentialCreationTimes.get(credentialId) ?? Date.now(),
    });
    if (decryptGCM(envelope, key, MNEMONIC_AAD) !== mnemonic) return 'failed';

    const ok = await storeData('encryptedMnemonic', envelope);
    if (!ok) return 'failed';
    const readback = await retrieveData('encryptedMnemonic');
    if (!readback.didWork || readback.value !== envelope) return 'failed';
    const pinOk = await storeData('pinHash', PIN_MARKER);
    if (!pinOk) return 'failed';
    const pinReadback = await retrieveData('pinHash');
    if (!pinReadback.didWork || pinReadback.value !== PIN_MARKER)
      return 'failed';
    credentialCreationTimes.delete(credentialId);
    return 'ok';
  } catch (err) {
    console.log('store mnemonic with passkey error', err);
    return 'failed';
  }
}

// Tri-state, like decryptMnemonicWithBiometrics: the seed on success; null
// when the prompt was cancelled or storage couldn't be read (retry is safe);
// false on a definitive failure (not a passkey envelope, no PRF result, GCM
// tag mismatch, not a valid mnemonic).
export async function decryptMnemonicWithPasskey() {
  try {
    const stored = await retrieveData('encryptedMnemonic');
    if (!stored.didWork) return null;
    if (!isPasskeyMnemonicFormat(stored.value)) return false;

    const { credentialId, salt } = JSON.parse(stored.value);
    const prfOutput = await getPrfOutput(
      credentialId,
      Buffer.from(salt, 'hex'),
    );
    if (prfOutput === null) return null;
    if (!prfOutput) return false;

    const mnemonic = decryptGCM(
      stored.value,
      deriveKey(prfOutput),
      MNEMONIC_AAD,
    );
    return validateMnemonic(mnemonic, wordlist) ? mnemonic : false;
  } catch (err) {
    // GCM tag mismatch (wrong key or tampered envelope) lands here.
    console.log('decrypt mnemonic with passkey error', err);
    return false;
  }
}

// { credentialId, createdAt } for a passkey wallet, null otherwise. The
// envelope is the only source of truth for the unlock method: onboarding's
// wipe clears the login-mode flags.
export async function getStoredPasskeyInfo() {
  const stored = await retrieveData('encryptedMnemonic');
  if (!stored.didWork) throw new Error('Unable to read wallet storage');
  if (!isPasskeyMnemonicFormat(stored.value)) return null;
  const { credentialId, createdAt } = JSON.parse(stored.value);
  return { credentialId, createdAt };
}

// Best-effort: asks the password manager to drop a passkey this wallet no
// longer uses. Browsers without the Signal API skip it. Never throws.
export async function forgetPasskey(credentialId) {
  credentialCreationTimes.delete(credentialId);
  try {
    await window.PublicKeyCredential.signalUnknownCredential?.({
      rpId: window.location.hostname,
      credentialId,
    });
  } catch (err) {
    console.log('forget passkey error', err);
  }
}
