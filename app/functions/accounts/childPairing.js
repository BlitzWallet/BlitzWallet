import { Buffer } from 'buffer';
import { getSharedSecret, schnorr } from '@noble/secp256k1';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'react-native-quick-crypto';

// ECDH pairing crypto for the child-account seed handoff. Nothing secret ever
// crosses the wire: the parent encrypts the child seed under a key derived from
// ECDH(parentWalletPriv, childEphPub). A 6-digit SAS binding the two pubkeys
// (NOT the ciphertext) lets the two people defeat an active MITM by voice.
// nostr pubkeys are x-only, so we reuse the `'02'+pub` even-y convention that
// app/functions/messaging/encodingAndDecodingMessages.js already relies on.

const SEED_INFO = 'blitz-child-pairing:v1:seed';
const SAS_INFO = 'blitz-child-pairing:v1:sas';
const RENDEZVOUS_PREFIX = 'blitz-child-pairing:v1:';

// Ambiguous-free alphabet (no I/O/0/1) for the human-typed pairing code.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/** Fresh in-memory ephemeral keypair for one pairing session. Never persisted. */
export function makeChildEphKey() {
  const privBytes = randomBytes(32);
  const priv = Buffer.from(privBytes).toString('hex');
  const pub = Buffer.from(schnorr.getPublicKey(privBytes)).toString('hex');
  return { priv, pub };
}

/** Short, human-typeable rendezvous code the parent shows and the child types. */
export function makePairingCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Firestore rendezvous doc id derived from the typed code (no secret in it). */
export function rendezvousId(code) {
  const norm = String(code || '')
    .trim()
    .toUpperCase();
  return Buffer.from(
    sha256(new TextEncoder().encode(RENDEZVOUS_PREFIX + norm)),
  ).toString('hex');
}

/** ECDH shared X coordinate (32 bytes) from our priv + the peer's x-only pub. */
export function deriveSharedX(privHex, peerPubHex) {
  const point = getSharedSecret(
    Buffer.from(privHex, 'hex'),
    Buffer.from('02' + peerPubHex, 'hex'),
    true,
  );
  return Buffer.from(point.slice(1, 33));
}

function hkdfKey(sharedX, info) {
  const ikm = sharedX instanceof Uint8Array ? sharedX : Uint8Array.from(sharedX);
  return Buffer.from(
    hkdf(sha256, ikm, new Uint8Array(0), new TextEncoder().encode(info), 32),
  );
}

export function deriveSeedKey(sharedX) {
  return hkdfKey(sharedX, SEED_INFO);
}

export function deriveSasKey(sharedX) {
  return hkdfKey(sharedX, SAS_INFO);
}

/**
 * 6-digit short-authentication-string binding the two pubkeys. Excludes the
 * ciphertext so both sides can compute and compare it before the seed is sent.
 */
export function computeSAS(sharedX, childEphPub, parentWalletPub) {
  const transcript = Buffer.concat([
    deriveSasKey(sharedX),
    Buffer.from(childEphPub, 'hex'),
    Buffer.from(parentWalletPub, 'hex'),
  ]);
  const digest = Buffer.from(sha256(transcript));
  const n = digest.readUInt32BE(0) % 1000000;
  return String(n).padStart(6, '0');
}

/** AES-256-GCM encrypt the seed payload. Returns base64 iv/ct/tag. */
export function encryptSeedPayload(seedKey, payload) {
  const iv = Buffer.from(randomBytes(12));
  const cipher = createCipheriv('aes-256-gcm', seedKey, iv);
  let ct = cipher.update(JSON.stringify(payload), 'utf8', 'base64');
  ct += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return { iv: iv.toString('base64'), ct, tag };
}

/** AES-256-GCM decrypt. Throws on tag mismatch (tamper / wrong key). */
export function decryptSeedPayload(seedKey, { iv, ct, tag }) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    seedKey,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  let pt = decipher.update(ct, 'base64', 'utf8');
  pt += decipher.final('utf8');
  return JSON.parse(pt);
}
