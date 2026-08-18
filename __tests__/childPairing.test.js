// Exercises the real pairing crypto in app/functions/accounts/childPairing.js.
// It only pulls in @noble/* (transpiled) and react-native-quick-crypto (mapped
// to node:crypto in jest.setup.js), so no native/context mocks are needed.
import {
  makeChildEphKey,
  makePairingCode,
  normalizePairingName,
  deriveSharedX,
  deriveSeedKey,
  computeSAS,
  encryptSeedPayload,
  decryptSeedPayload,
  makeKeyCommitment,
  verifyKeyCommitment,
  buildPairingQr,
  parsePairingQr,
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
});

describe('makePairingCode', () => {
  it('always returns 6 ASCII digits', () => {
    for (let i = 0; i < 500; i++) {
      expect(makePairingCode()).toMatch(/^[0-9]{6}$/);
    }
  });

  it('is roughly uniform across the digit alphabet (no modulo bias)', () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      for (const ch of makePairingCode()) counts[Number(ch)]++;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    // Each digit ~10% of positions; allow generous slack for sampling noise.
    for (const c of counts) {
      expect(c / total).toBeGreaterThan(0.08);
      expect(c / total).toBeLessThan(0.12);
    }
  });
});

describe('pairing QR payload', () => {
  const name = 'ParentName';
  const code = '482916';
  const pub = makeChildEphKey().pub;

  it('round-trips through buildPairingQr / parsePairingQr', () => {
    const qr = buildPairingQr({ name, code, parentEphPub: pub });
    expect(qr).toBeTruthy();
    // The name is carried normalized (it is the rendezvous id).
    expect(parsePairingQr(qr)).toEqual({
      name: 'parentname',
      code,
      parentEphPub: pub,
    });
  });

  it('rejects malformed / foreign / wrong-version payloads', () => {
    expect(parsePairingQr('')).toBeNull();
    expect(parsePairingQr(null)).toBeNull();
    expect(parsePairingQr(undefined)).toBeNull();
    expect(parsePairingQr('not json')).toBeNull();
    expect(parsePairingQr('{}')).toBeNull();
    expect(parsePairingQr('[1,2,3]')).toBeNull();
    expect(
      parsePairingQr(
        JSON.stringify({ t: 'other', v: 1, n: name, c: code, pk: pub }),
      ),
    ).toBeNull();
    expect(
      parsePairingQr(
        JSON.stringify({ t: 'childPair', v: 2, n: name, c: code, pk: pub }),
      ),
    ).toBeNull();
  });

  it('rejects payloads with invalid fields', () => {
    const base = { t: 'childPair', v: 1, n: name, c: code, pk: pub };
    // 5-digit code
    expect(
      parsePairingQr(JSON.stringify({ ...base, c: '12345' })),
    ).toBeNull();
    // empty name
    expect(parsePairingQr(JSON.stringify({ ...base, n: '' }))).toBeNull();
    // invalid-name chars
    expect(
      parsePairingQr(JSON.stringify({ ...base, n: 'has space' })),
    ).toBeNull();
    // bad pubkey (wrong length / non-hex)
    expect(parsePairingQr(JSON.stringify({ ...base, pk: 'xyz' }))).toBeNull();
    expect(
      parsePairingQr(JSON.stringify({ ...base, pk: '00' })),
    ).toBeNull();
    // A 64-char hex pubkey passes the QR format check even if it is not a
    // valid curve point — the deriveSharedX layer rejects those later.
    expect(
      parsePairingQr(JSON.stringify({ ...base, pk: '00'.repeat(32) })),
    ).toEqual({ name: 'parentname', code, parentEphPub: '00'.repeat(32) });
    // missing fields
    expect(
      parsePairingQr(JSON.stringify({ t: 'childPair', v: 1, n: name, c: code })),
    ).toBeNull();
  });

  it('buildPairingQr returns an empty string for invalid fields', () => {
    expect(buildPairingQr({ name: '', code, parentEphPub: pub })).toBe('');
    expect(buildPairingQr({ name, code: '123', parentEphPub: pub })).toBe('');
    expect(buildPairingQr({ name, code, parentEphPub: 'xyz' })).toBe('');
    expect(buildPairingQr({ name, code, parentEphPub: '' })).toBe('');
    expect(buildPairingQr({})).toBe('');
  });
});
