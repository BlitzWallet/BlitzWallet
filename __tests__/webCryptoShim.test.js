/**
 * Web crypto regression guards.
 *
 * jest.setup replaces `react-native-quick-crypto` with node:crypto, so nothing
 * in the suite exercises `web-shims/quick-crypto.js` — the module every crypto
 * call in the browser build actually lands on (metro.config.js WEB_STUBS maps
 * both `crypto` and `react-native-quick-crypto` to it when platform === 'web').
 * These tests require the shim by path so that mock cannot shadow it.
 */
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('node:crypto');
const shim = require('../web-shims/quick-crypto').default;

const AAD = Buffer.from('blitz.encryptedMnemonic.v3', 'utf8');

describe('entropy provider', () => {
  it('randomBytes draws from crypto.getRandomValues, never Math.random', () => {
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues');
    const realRandom = Math.random;
    Math.random = () => {
      throw new Error('Math.random called from a crypto path');
    };
    try {
      const out = shim.randomBytes(32);
      expect(out.length).toBe(32);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].length).toBe(32);
    } finally {
      Math.random = realRandom;
      spy.mockRestore();
    }
  });

  it('fails closed when the browser CSPRNG is unavailable', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { subtle: undefined },
    });
    try {
      expect(() => shim.randomBytes(32)).toThrow();
    } finally {
      Object.defineProperty(globalThis, 'crypto', saved);
    }
  });

  it('produces distinct 12-byte AES-GCM IVs (no nonce reuse)', () => {
    const ivs = new Set();
    for (let i = 0; i < 200; i++) {
      const iv = shim.randomBytes(12);
      expect(iv.length).toBe(12);
      ivs.add(iv.toString('hex'));
    }
    expect(ivs.size).toBe(200);
  });
});

describe('mobile <-> web byte parity', () => {
  it('sha256 and sha512 match Node', () => {
    expect(shim.createHash('sha256').update('abc').digest('hex')).toBe(
      nodeCrypto.createHash('sha256').update('abc').digest('hex'),
    );
    expect(shim.createHash('sha512').update('abc').digest('hex')).toBe(
      nodeCrypto.createHash('sha512').update('abc').digest('hex'),
    );
  });

  it('pbkdf2Sync sha512 matches Node (BIP39 seed derivation)', () => {
    expect(
      shim.pbkdf2Sync('mnemonic', 'salt', 2048, 64, 'sha512').toString('hex'),
    ).toBe(
      nodeCrypto.pbkdf2Sync('mnemonic', 'salt', 2048, 64, 'sha512').toString('hex'),
    );
  });

  it('AES-256-CBC round-trips both directions against Node', () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(16);
    const plain = Buffer.from('abandon abandon about legal winner', 'utf8');

    const c = shim.createCipheriv('aes-256-cbc', key, iv);
    const shimCt = Buffer.concat([c.update(plain), c.final()]);
    const d = nodeCrypto.createDecipheriv('aes-256-cbc', key, iv);
    expect(Buffer.concat([d.update(shimCt), d.final()])).toEqual(plain);

    const c2 = nodeCrypto.createCipheriv('aes-256-cbc', key, iv);
    const nodeCt = Buffer.concat([c2.update(plain), c2.final()]);
    const d2 = shim.createDecipheriv('aes-256-cbc', key, iv);
    expect(Buffer.concat([d2.update(nodeCt), d2.final()])).toEqual(plain);
  });

  it('AES-256-GCM + AAD round-trips both directions against Node', () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const plain = Buffer.from('gcm aad payload', 'utf8');

    const c = shim.createCipheriv('aes-256-gcm', key, iv);
    c.setAAD(AAD);
    const ct = Buffer.concat([c.update(plain), c.final()]);
    const tag = c.getAuthTag();
    expect(tag.length).toBe(16);

    const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    d.setAAD(AAD);
    expect(Buffer.concat([d.update(ct), d.final()])).toEqual(plain);

    const c2 = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
    c2.setAAD(AAD);
    const nodeCt = Buffer.concat([c2.update(plain), c2.final()]);
    const d2 = shim.createDecipheriv('aes-256-gcm', key, iv);
    d2.setAAD(AAD);
    d2.setAuthTag(c2.getAuthTag());
    expect(Buffer.concat([d2.update(nodeCt), d2.final()])).toEqual(plain);
  });
});

describe('fails closed', () => {
  const seal = () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const c = shim.createCipheriv('aes-256-gcm', key, iv);
    c.setAAD(AAD);
    const ct = Buffer.concat([c.update(Buffer.from('secret', 'utf8')), c.final()]);
    return { key, iv, ct, tag: c.getAuthTag() };
  };

  it('a tampered ciphertext throws instead of returning plaintext', () => {
    const { key, iv, ct, tag } = seal();
    const flipped = Buffer.from(ct);
    flipped[0] ^= 1;
    const d = shim.createDecipheriv('aes-256-gcm', key, iv);
    d.setAAD(AAD);
    d.setAuthTag(tag);
    expect(() => {
      d.update(flipped);
      d.final();
    }).toThrow();
  });

  it('a wrong AAD throws (envelope context binding is enforced)', () => {
    const { key, iv, ct, tag } = seal();
    const d = shim.createDecipheriv('aes-256-gcm', key, iv);
    d.setAAD(Buffer.from('blitz.custodyAccount.v1', 'utf8'));
    d.setAuthTag(tag);
    expect(() => {
      d.update(ct);
      d.final();
    }).toThrow();
  });

  it('rejects unsupported algorithms rather than silently degrading', () => {
    expect(() => shim.createHash('md5')).toThrow(/unsupported hash/);
    expect(() => shim.createHash('sha1')).toThrow(/unsupported hash/);
    expect(() =>
      shim.createCipheriv('aes-256-ctr', Buffer.alloc(32), Buffer.alloc(16)).final(),
    ).toThrow(/unsupported cipher/);
    expect(() => shim.pbkdf2Sync('p', 's', 1, 32, 'md5')).toThrow(
      /unsupported pbkdf2 digest/,
    );
  });
});

describe('the BIP39 entropy source the web bundle resolves to', () => {
  // Metro resolves `@noble/hashes/utils` for platform=web through the package
  // exports map to esm/utils.js. That file must keep using globalThis.crypto:
  // the sibling CJS build in this repo's node_modules has been hand-edited to
  // route through expo-crypto, which carries a __DEV__ Math.random fallback.
  it('esm/utils.js (the copy @scure/bip39 gets on web) uses globalThis.crypto', () => {
    // Read by path, not require.resolve: the package exports map has no
    // './esm/utils.js' subpath, but Metro reaches the file through './utils'.
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'node_modules/@noble/hashes/esm/utils.js'),
      'utf8',
    );
    expect(src).toContain('crypto.getRandomValues must be defined');
    expect(src).not.toContain('expo-crypto');
  });
});
