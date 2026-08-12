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
// ECDH(parentEphPriv, childEphPub). Both sides use fresh per-session ephemeral
// keys (no long-term key, so nothing to precompute against). A commit-reveal
// binds the SAS: the parent publishes H(parentEphPub) before the child reveals
// childEphPub, and only reveals parentEphPub afterwards, so neither side can
// grind its key to force a matching SAS. The 9-shape SAS pattern (30^9 ≈ 2^44)
// then lets the two people defeat an active MITM by eye.
// The SAS is a pattern, not digits: a 3×3 grid where each cell is one of 30
// shapes (15 bases × outline/filled). Shapes are globally recognized, need no
// language/read-aloud, and 30 symbols/cell buys ~4.9 bits each vs a digit's 3.3,
// so 9 cells reaches ~44 bits (up from the old 6-char alphanumeric SAS at 32^6
// = 30 bits). See SasPatternGrid for the shape rendering (SVG, so both phones
// draw pixel-identical shapes).
// The rendezvous/pairing code stays digits-only (universal across keyboards/IMEs).
// nostr pubkeys are x-only, so we reuse the `'02'+pub` even-y convention that
// app/functions/messaging/encodingAndDecodingMessages.js already relies on.

const SEED_INFO = 'blitz-child-pairing:v1:seed';
const SAS_INFO = 'blitz-child-pairing:v1:sas';
const RENDEZVOUS_PREFIX = 'blitz-child-pairing:v1:';

// Digits only: universal across all keyboards/languages, no case, no letter/digit
// ambiguity. Used only by the (collision-only) pairing code — the SAS has its
// own 30-symbol alphabet in computeSAS.
const CODE_ALPHABET = '0123456789';
const CODE_LENGTH = 6; // pairing code: 10^6 rendezvous space, collision-only

/** Fresh in-memory ephemeral keypair for one pairing session. Never persisted. */
export function makeChildEphKey() {
  const privBytes = randomBytes(32);
  const priv = Buffer.from(privBytes).toString('hex');
  const pub = Buffer.from(schnorr.getPublicKey(privBytes)).toString('hex');
  return { priv, pub };
}

/** Short, human-typeable rendezvous code the parent shows and the child types. */
export function makePairingCode() {
  // Rejection sampling: keep only bytes < 250 (25 full sets of 10 digits) so
  // every digit is exactly uniform — 256 % 10 != 0 would bias 0-5 high.
  let out = '';
  while (out.length < CODE_LENGTH) {
    const bytes = randomBytes(CODE_LENGTH);
    for (let i = 0; i < bytes.length && out.length < CODE_LENGTH; i++) {
      if (bytes[i] >= 250) continue;
      out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
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

/** Commitment to an ephemeral pubkey, published before the peer reveals theirs. */
export function makeKeyCommitment(pubHex) {
  return Buffer.from(sha256(Buffer.from(pubHex, 'hex'))).toString('hex');
}

/** Verify a revealed pubkey matches the earlier commitment. */
export function verifyKeyCommitment(commitHex, pubHex) {
  if (!commitHex || !pubHex) return false;
  return makeKeyCommitment(pubHex) === String(commitHex);
}

const SAS_LENGTH = 9; // 9 shapes × 30-shape alphabet = 30^9 ≈ 2^44 MITM resistance

/**
 * 9-shape short-authentication-string binding the two ephemeral pubkeys (~44
 * bits). Returned as 9 base-36 chars (0-t); each selects one of the 30 shapes
 * (15 bases × outline/filled) SasPatternGrid draws. Excludes the ciphertext so
 * both sides can compute and compare it before the seed is sent.
 */
export function computeSAS(sharedX, childEphPub, parentEphPub) {
  const transcript = Buffer.concat([
    deriveSasKey(sharedX),
    Buffer.from(childEphPub, 'hex'),
    Buffer.from(parentEphPub, 'hex'),
  ]);
  const digest = Buffer.from(sha256(transcript));
  // Reduce the 256-bit digest to 9 uniform 0-29 shape indices via divmod; the
  // bias from 30^9 not dividing 2^256 is ~2^-212, negligible. Each index is a
  // base-36 char (0-t) that SasPatternGrid maps back to a shape.
  let n = BigInt('0x' + digest.toString('hex'));
  let sas = '';
  for (let i = 0; i < SAS_LENGTH; i++) {
    sas += Number(n % 30n).toString(36);
    n /= 30n;
  }
  return sas;
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
