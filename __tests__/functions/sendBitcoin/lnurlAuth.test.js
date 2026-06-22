import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex } from '@noble/hashes/utils';
import {
  deriveLinkingKey,
  lnurlAuth,
} from '../../../app/functions/lnurl/lnurlAuth';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveLinkingKey (LUD-04)', () => {
  test('derives a stable linking key for a domain', async () => {
    const node = await deriveLinkingKey(MNEMONIC, 'lnurl.example.com');
    // Regression vector: changing the derivation would break existing logins.
    expect(bytesToHex(secp256k1.getPublicKey(node.privateKey, true))).toBe(
      '02597a2a6f8fd40d89fde61e42147cdabc86aa927edc49baac05fb212af2a0c4f3',
    );
  });

  test('different domains yield different linking keys', async () => {
    const a = await deriveLinkingKey(MNEMONIC, 'site-a.com');
    const b = await deriveLinkingKey(MNEMONIC, 'site-b.com');
    expect(bytesToHex(a.privateKey)).not.toBe(bytesToHex(b.privateKey));
  });
});

describe('lnurlAuth (LUD-04)', () => {
  const k1 = 'e2af6254a8df433264fa23f67eb8188635d15ce883e8fc020989d5f82ae6f11e';

  afterEach(() => {
    global.fetch.mockRestore?.();
  });

  test('signs k1, preserves existing params, and verifies against the sent key', async () => {
    let calledUrl;
    global.fetch = jest.fn(async url => {
      calledUrl = new URL(url);
      return { json: async () => ({ status: 'OK' }) };
    });

    const result = await lnurlAuth({
      k1,
      callback: `https://lnurl.example.com/auth?tag=login&k1=${k1}&action=login`,
      mnemonic: MNEMONIC,
    });

    expect(result).toEqual({ status: 'OK' });

    // Existing query params are preserved.
    expect(calledUrl.searchParams.get('tag')).toBe('login');
    expect(calledUrl.searchParams.get('action')).toBe('login');
    expect(calledUrl.searchParams.get('k1')).toBe(k1);

    // sig must be a valid DER signature of the raw k1 under the sent key.
    const sig = calledUrl.searchParams.get('sig');
    const key = calledUrl.searchParams.get('key');
    expect(sig).toMatch(/^30/); // DER sequence
    const verified = secp256k1.verify(
      Uint8Array.from(Buffer.from(sig, 'hex')),
      Uint8Array.from(Buffer.from(k1, 'hex')),
      Uint8Array.from(Buffer.from(key, 'hex')),
      { prehash: false, format: 'der' },
    );
    expect(verified).toBe(true);
  });

  test('throws a flagged service rejection on ERROR status', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({ status: 'ERROR', reason: 'expired k1' }),
    }));

    await expect(
      lnurlAuth({
        k1,
        callback: `https://lnurl.example.com/auth?k1=${k1}`,
        mnemonic: MNEMONIC,
      }),
    ).rejects.toMatchObject({
      message: 'expired k1',
      isServiceRejection: true,
    });
  });

  test('rejects a malformed (non 32-byte hex) k1 without calling fetch', async () => {
    global.fetch = jest.fn();
    await expect(
      lnurlAuth({
        k1: 'not-hex',
        callback: 'https://lnurl.example.com/auth?k1=not-hex',
        mnemonic: MNEMONIC,
      }),
    ).rejects.toThrow('Invalid k1 challenge');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rejects non-HTTPS clearnet callbacks', async () => {
    global.fetch = jest.fn();
    await expect(
      lnurlAuth({
        k1,
        callback: `http://lnurl.example.com/auth?k1=${k1}`,
        mnemonic: MNEMONIC,
      }),
    ).rejects.toThrow('LNURL must use HTTPS');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
