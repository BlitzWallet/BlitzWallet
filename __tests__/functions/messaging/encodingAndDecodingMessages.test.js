import crypto from 'node:crypto';
import { getPublicKey } from 'nostr-tools';
import { encriptMessage, decryptMessage } from '../../../app/functions/messaging/encodingAndDecodingMessages';

function getKeyPair() {
  const priv = crypto.randomBytes(32).toString('hex');
  return { priv, pub: getPublicKey(priv) };
}

describe('IV serialization fix', () => {
  const { priv, pub } = getKeyPair();

  test('round-trips and emits a 16-byte (24 char) base64 IV', () => {
    const msg = 'hello gift wallet 123';
    const encrypted = encriptMessage(priv, pub, msg);
    expect(encrypted).toBeDefined();
    const iv = encrypted.split('?iv=')[1];
    expect(iv).toHaveLength(24);
    expect(Buffer.from(iv, 'base64')).toHaveLength(16);
    expect(decryptMessage(priv, pub, encrypted)).toBe(msg);
  });

  test('new decode path accepts the old btoa-based IV format', () => {
    const quickCrypto = require('react-native-quick-crypto');
    const spy = jest.spyOn(quickCrypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
    try {
      const msg = 'deterministic iv message';
      const encrypted = encriptMessage(priv, pub, msg);
      const ivStr = encrypted.split('?iv=')[1];
      expect(ivStr).toBe('AAECAwQFBgcICQoLDA0ODw==');
      const oldFormatIv = new Uint8Array(Buffer.from(atob(ivStr), 'binary'));
      const newFormatIv = Buffer.from(ivStr, 'base64');
      expect(new Uint8Array(newFormatIv)).toEqual(oldFormatIv);
      expect(decryptMessage(priv, pub, encrypted)).toBe(msg);
    } finally {
      spy.mockRestore();
    }
  });

  test('works when the IV comes from a pooled allocator', () => {
    const quickCrypto = require('react-native-quick-crypto');
    const original = quickCrypto.randomBytes;
    const spy = jest.spyOn(quickCrypto, 'randomBytes').mockImplementation((size) => {
      const pooled = Buffer.allocUnsafe(size); // view into the 8KB Node pool
      crypto.randomFillSync(pooled);
      return pooled;
    });
    try {
      const msg = 'pooled iv message';
      const encrypted = encriptMessage(priv, pub, msg);
      const iv = encrypted.split('?iv=')[1];
      expect(iv).toHaveLength(24);
      expect(decryptMessage(priv, pub, encrypted)).toBe(msg);
    } finally {
      spy.mockRestore();
    }
    expect(quickCrypto.randomBytes).toBe(original);
  });
});
