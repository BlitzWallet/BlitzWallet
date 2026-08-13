// Exercises the real pairing crypto in app/functions/accounts/childPairing.js.
// It only pulls in @noble/* (transpiled) and react-native-quick-crypto (mapped
// to node:crypto in jest.setup.js), so no native/context mocks are needed.
import {
  makeChildEphKey,
  makeSessionId,
  normalizePairingName,
  deriveSharedX,
  deriveSeedKey,
  computeSAS,
  encryptSeedPayload,
  decryptSeedPayload,
  makeKeyCommitment,
  verifyKeyCommitment,
} from '../app/functions/accounts/childPairing';

const SAS_RE = /^[0-9a-t]{9}$/; // 9 shape indices, one base-36 char each (0-29)

describe('child pairing crypto', () => {
  // Parent uses its wallet keypair; child a fresh ephemeral one. Same shape.
  const parent = makeChildEphKey();
  const child = makeChildEphKey();

  const parentSharedX = deriveSharedX(parent.priv, child.pub);
  const childSharedX = deriveSharedX(child.priv, parent.pub);

  it('both sides derive the same sharedX', () => {
    expect(parentSharedX.toString('hex')).toBe(childSharedX.toString('hex'));
    expect(parentSharedX.length).toBe(32);
  });

  it('both sides derive the same seed key', () => {
    expect(deriveSeedKey(parentSharedX).toString('hex')).toBe(
      deriveSeedKey(childSharedX).toString('hex'),
    );
  });

  it('both sides compute the same 9-shape SAS pattern', () => {
    const a = computeSAS(parentSharedX, child.pub, parent.pub);
    const b = computeSAS(childSharedX, child.pub, parent.pub);
    expect(a).toBe(b);
    expect(a).toMatch(SAS_RE);
  });

  it('GCM round-trips the seed payload', () => {
    const payload = { v: 1, mnemonic: 'abandon abandon about', childIndex: 3 };
    const enc = encryptSeedPayload(deriveSeedKey(parentSharedX), payload);
    const dec = decryptSeedPayload(deriveSeedKey(childSharedX), {
      iv: enc.iv,
      ct: enc.ct,
      tag: enc.tag,
    });
    expect(dec).toEqual(payload);
  });

  it('throws when the ciphertext is tampered', () => {
    const seedKey = deriveSeedKey(parentSharedX);
    const enc = encryptSeedPayload(seedKey, { mnemonic: 'secret words' });
    // Flip a byte of the base64 ciphertext.
    const badCt =
      enc.ct.slice(0, -2) + (enc.ct.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() =>
      decryptSeedPayload(seedKey, { iv: enc.iv, ct: badCt, tag: enc.tag }),
    ).toThrow();
  });

  it('SAS diverges when a MITM substitutes a peer pubkey', () => {
    const attacker = makeChildEphKey();
    // Child derives its shared secret against the attacker's key, not the parent.
    const childVsAttacker = deriveSharedX(child.priv, attacker.pub);
    const parentSAS = computeSAS(parentSharedX, child.pub, parent.pub);
    const childSAS = computeSAS(childVsAttacker, child.pub, attacker.pub);
    expect(childSAS).not.toBe(parentSAS);
  });

  it('key commitment round-trips and rejects a substituted key', () => {
    const commit = makeKeyCommitment(parent.pub);
    expect(commit).toMatch(/^[0-9a-f]{64}$/);
    expect(makeKeyCommitment(parent.pub)).toBe(commit); // deterministic
    expect(verifyKeyCommitment(commit, parent.pub)).toBe(true);
    // A MITM revealing a different pubkey than it committed to is caught.
    const attacker = makeChildEphKey();
    expect(verifyKeyCommitment(commit, attacker.pub)).toBe(false);
    expect(verifyKeyCommitment('', parent.pub)).toBe(false);
    expect(verifyKeyCommitment(commit, '')).toBe(false);
  });

  it('normalizePairingName trims, NFC-normalizes and lowercases', () => {
    expect(normalizePairingName('  Alice ')).toBe('alice');
    expect(normalizePairingName('BOB_1')).toBe('bob_1');
    // NFC: composed and decomposed forms collapse to the same id.
    expect(normalizePairingName('é')).toBe(normalizePairingName('é'));
  });

  it('normalizePairingName rejects empty and invalid names', () => {
    expect(normalizePairingName('')).toBe('');
    expect(normalizePairingName('   ')).toBe('');
    expect(normalizePairingName(null)).toBe('');
    expect(normalizePairingName('123')).toBe(''); // no letter
    expect(normalizePairingName('has space')).toBe('');
    expect(normalizePairingName('bad/slash')).toBe('');
  });

  it('makeSessionId is a fresh random hex nonce', () => {
    const a = makeSessionId();
    const b = makeSessionId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
