import { Buffer } from 'buffer';
import { getSharedSecret } from '@noble/secp256k1';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'react-native-quick-crypto';

const sharedSecretCache = new Map();
const MAX_CACHE_SIZE = 20;

function getCacheKey(privkey, pubkey) {
  const hash = createHash('sha256');
  hash.update(privkey);
  hash.update(pubkey);
  return hash.digest('hex');
}

function getSharedSecretCached(privkey, pubkey) {
  const cacheKey = getCacheKey(privkey, pubkey);

  if (sharedSecretCache.has(cacheKey)) {
    const value = sharedSecretCache.get(cacheKey);
    sharedSecretCache.delete(cacheKey);
    sharedSecretCache.set(cacheKey, value);
    return value;
  }

  if (sharedSecretCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = sharedSecretCache.keys().next().value;
    const buffer = sharedSecretCache.get(oldestKey);
    if (buffer?.fill) buffer.fill(0);
    sharedSecretCache.delete(oldestKey);
  }

  const shardPoint = getSharedSecret(
    Buffer.from(privkey, 'hex'),
    Buffer.from('02' + pubkey, 'hex'),
    true,
  );
  const sharedX = shardPoint.slice(1, 33);

  sharedSecretCache.set(cacheKey, sharedX);
  return sharedX;
}

function encriptMessage(privkey, pubkey, text) {
  //   const encripted = await nostr.nip04.encrypt(privkey, pubkey, text);
  //   console.log(encripted);
  //   return new Promise(resolve => {
  //     resolve(encripted);
  //   });
  try {
    // return nip04.encrypt(priv, pubkey, content);

    // return;
    const sharedX = getSharedSecretCached(privkey, pubkey);

    const iv = randomBytes(16);

    const cipher = createCipheriv('aes-256-cbc', Buffer.from(sharedX), iv);

    let encriptMessage = cipher.update(text, 'utf8', 'base64');
    encriptMessage += cipher.final('base64');
    encriptMessage +=
      '?iv=' + btoa(String.fromCharCode.apply(null, new Uint8Array(iv.buffer)));
    return encriptMessage;
  } catch (err) {
    console.log(err, 'ENCRIPT ERROR');
  }
}
function decryptMessage(privkey, pubkey, encryptedText) {
  try {
    const sharedX = getSharedSecretCached(privkey, pubkey);

    // Extract IV from the encrypted message
    const ivStr = encryptedText.split('?iv=')[1];
    const iv = new Uint8Array(Buffer.from(atob(ivStr), 'binary'));

    // Remove IV from the encrypted message
    const encryptedData = encryptedText.split('?iv=')[0];

    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(sharedX), iv);

    let decryptedMessage = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedMessage += decipher.final('utf8');
    return decryptedMessage;
  } catch (err) {
    console.log(err, 'DECRYPT ERROR');
    return null;
  }
}

function clearSharedSecretCache() {
  for (const [key, buffer] of sharedSecretCache.entries()) {
    if (buffer?.fill) buffer.fill(0);
  }
  sharedSecretCache.clear();
}

export { encriptMessage, decryptMessage, clearSharedSecretCache };
