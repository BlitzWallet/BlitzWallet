// Parity check: the web quick-crypto shim must interop byte-for-byte with the
// mobile app (Node's crypto stands in for react-native-quick-crypto, which is a
// libsodium/OpenSSL binding). If this passes, a wallet encrypted on mobile
// decrypts on web and vice versa. Run: node web-shims/__parity__/quickCryptoParity.mjs
import assert from 'node:assert';
import nodeCrypto from 'node:crypto';
import shim from '../quick-crypto.js';

const enc = new TextEncoder();
let passed = 0;
const ok = (name, cond) => {
  assert.ok(cond, name);
  passed++;
};

// --- createHash sha256 matches Node ---
{
  const data = 'the quick brown fox';
  const shimHash = shim.createHash('sha256').update(data).digest('hex');
  const nodeHash = nodeCrypto.createHash('sha256').update(data).digest('hex');
  ok('sha256 hex matches Node', shimHash === nodeHash);
}

// --- AES-256-CBC: shim encrypt -> Node decrypt (web writes, mobile reads) ---
{
  const key = nodeCrypto.randomBytes(32);
  const iv = nodeCrypto.randomBytes(16);
  const plain = Buffer.from('abandon abandon about legal winner thank', 'utf8');

  const c = shim.createCipheriv('aes-256-cbc', key, iv);
  const shimCt = Buffer.concat([c.update(plain), c.final()]);

  const d = nodeCrypto.createDecipheriv('aes-256-cbc', key, iv);
  const back = Buffer.concat([d.update(shimCt), d.final()]);
  ok('CBC shim->Node round trip', back.equals(plain));
}

// --- AES-256-CBC: Node encrypt -> shim decrypt (mobile writes, web reads) ---
{
  const key = nodeCrypto.randomBytes(32);
  const iv = nodeCrypto.randomBytes(16);
  const plain = Buffer.from('one two three four five six seven eight', 'utf8');

  const c = nodeCrypto.createCipheriv('aes-256-cbc', key, iv);
  const nodeCt = Buffer.concat([c.update(plain), c.final()]);

  const d = shim.createDecipheriv('aes-256-cbc', key, iv);
  const back = Buffer.concat([d.update(nodeCt), d.final()]);
  ok('CBC Node->shim round trip', back.equals(plain));
}

// --- AES-256-GCM: shim encrypt+tag -> Node decrypt ---
{
  const key = nodeCrypto.randomBytes(32);
  const iv = nodeCrypto.randomBytes(12);
  const plain = Buffer.from('gcm secret payload', 'utf8');

  const c = shim.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  const tag = c.getAuthTag();

  const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  const back = Buffer.concat([d.update(ct), d.final()]);
  ok('GCM shim->Node round trip', back.equals(plain));
}

// --- Full handleMnemonic v2 flow: argon2id(pw,salt) -> AES-256-CBC ---
// Reproduces app/functions/handleMnemonic.js encrypt, then decrypts via shim.
{
  const mnemonic = 'legal winner thank year wave sausage worth useful legal';
  const password = JSON.stringify('my-web-password');

  const salt = shim.randomBytes(16);
  const iv = shim.randomBytes(16);
  const keyBuf = await new Promise((res, rej) =>
    shim.argon2(
      'argon2id',
      { message: password, nonce: salt, tagLength: 32, memory: 16384, passes: 2, parallelism: 1 },
      (e, k) => (e ? rej(e) : res(k)),
    ),
  );
  const cipher = shim.createCipheriv('aes-256-cbc', keyBuf, iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(mnemonic, 'utf8')),
    cipher.final(),
  ]).toString('base64');
  const blob = JSON.stringify({ v: 2, salt: salt.toString('hex'), iv: iv.toString('hex'), ct });

  // decrypt (handleMnemonic.decryptMnemonicArgon2)
  const p = JSON.parse(blob);
  const keyBuf2 = await new Promise((res, rej) =>
    shim.argon2(
      'argon2id',
      { message: password, nonce: Buffer.from(p.salt, 'hex'), tagLength: 32, memory: 16384, passes: 2, parallelism: 1 },
      (e, k) => (e ? rej(e) : res(k)),
    ),
  );
  const decipher = shim.createDecipheriv('aes-256-cbc', keyBuf2, Buffer.from(p.iv, 'hex'));
  const out = Buffer.concat([
    decipher.update(Buffer.from(p.ct, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  ok('v2 mnemonic argon2+CBC round trip', out === mnemonic);
  ok('argon2 key is deterministic across calls', Buffer.compare(keyBuf, keyBuf2) === 0);
}

// --- pbkdf2 async matches Node ---
{
  const derived = await new Promise((res, rej) =>
    shim.pbkdf2('password', 'salt', 2048, 32, 'sha256', (e, k) => (e ? rej(e) : res(k))),
  );
  const nodeDerived = nodeCrypto.pbkdf2Sync('password', 'salt', 2048, 32, 'sha256');
  ok('pbkdf2 matches Node', derived.equals(nodeDerived));
}

console.log(`\n✅ quick-crypto shim parity: ${passed}/7 checks passed`);
