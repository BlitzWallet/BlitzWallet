/* eslint-env jest */
// Web passkey unlock (app/functions/passkeyMnemonic.js), end to end through
// the real secureStore.js over an in-memory expo-secure-store, with a fake
// navigator.credentials whose PRF output is HMAC-SHA256(per-credential
// secret, salt) — deterministic per (credential, salt) like a real
// authenticator.

// This feature only runs in the browser, so test it on the browser's crypto:
// jest.setup maps react-native-quick-crypto to node:crypto, but the web build
// ships web-shims/quick-crypto.js (metro.config.js WEB_STUBS). Only Argon2 is
// swapped for a fast stand-in; just the password-wallet fixtures use it.
jest.mock('react-native-quick-crypto', () => {
  const shim = jest.requireActual('../../web-shims/quick-crypto');
  const nodeCrypto = require('node:crypto');
  const argon2 = (_variant, opts, cb) =>
    cb(null, nodeCrypto.pbkdf2Sync(opts.message, opts.nonce, 1, 32, 'sha256'));
  return { ...shim, argon2, default: { ...shim.default, argon2 } };
});

const mockStore = new Map();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  setItemAsync: jest.fn(async (key, value) => {
    mockStore.set(key, value);
  }),
  getItemAsync: jest.fn(async key =>
    mockStore.has(key) ? mockStore.get(key) : null,
  ),
  deleteItemAsync: jest.fn(async key => {
    mockStore.delete(key);
  }),
}));

jest.mock('../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(async () => null),
  removeAllLocalData: jest.fn(async () => true),
  setLocalStorageItem: jest.fn(async () => true),
  removeLocalStorageItem: jest.fn(async () => true),
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

jest.mock('../../app/constants', () => ({
  BIOMETRIC_KEY: 'biometricEncryptionKey',
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  LOGIN_SECURITY_MODE_TYPE_KEY: 'LOGIN_SECURITY_MODE_TYPE',
  NWC_SECURE_STORE_KEY: 'NWC_SECURE_STORE_KEY',
  NWC_SECURE_STORE_MNEMOINC: 'NWC_SECURE_STORE_MNEMOINC',
}));

const nodeCrypto = require('node:crypto');
const { getItemAsync, setItemAsync } = require('expo-secure-store');
const {
  storeData,
  wipeStaleWalletKeychain,
} = require('../../app/functions/secureStore');
const {
  isEncryptedMnemonicFormat,
  isPasskeyMnemonicFormat,
  isV3MnemonicFormat,
  PIN_MARKER,
  storeMnemonicWithPinSecurity,
} = require('../../app/functions/handleMnemonic');
const {
  createPasskey,
  decryptMnemonicWithPasskey,
  forgetPasskey,
  getStoredPasskeyInfo,
  isPasskeySupported,
  storeMnemonicWithPasskey,
} = require('../../app/functions/passkeyMnemonic');

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const toBase64Url = bytes =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .split('=')[0];
const toArrayBuffer = bytes => Uint8Array.from(bytes).buffer;

// Fake WebAuthn client + authenticator. Knobs:
//   prfEnabledAtCreate  what create() reports as prf.enabled (undefined = the
//                       browser omits the prf result entirely)
//   prfAtGet            false = get() succeeds but returns no PRF result
//   failNextGet         the next get() throws NotAllowedError (user cancel /
//                       Microsoft Password Manager's failure look the same)
function installAuthenticator({
  prfEnabledAtCreate = true,
  omitPrfAtCreate = false,
  prfAtGet = true,
} = {}) {
  const secrets = new Map(); // credentialId (base64url) -> 32-byte secret
  const auth = {
    secrets,
    failNextGet: false,
    lastCreate: null,
    lastGet: null,
    create: jest.fn(async ({ publicKey }) => {
      auth.lastCreate = publicKey;
      const rawId = nodeCrypto.randomBytes(16);
      secrets.set(toBase64Url(rawId), nodeCrypto.randomBytes(32));
      return {
        id: toBase64Url(rawId),
        rawId: toArrayBuffer(rawId),
        getClientExtensionResults: () =>
          omitPrfAtCreate ? {} : { prf: { enabled: prfEnabledAtCreate } },
      };
    }),
    get: jest.fn(async ({ publicKey }) => {
      auth.lastGet = publicKey;
      if (auth.failNextGet) {
        auth.failNextGet = false;
        throw Object.assign(new Error('The operation was cancelled'), {
          name: 'NotAllowedError',
        });
      }
      const id = toBase64Url(publicKey.allowCredentials[0].id);
      const secret = secrets.get(id);
      if (!secret) {
        throw Object.assign(new Error('No passkey available'), {
          name: 'NotAllowedError',
        });
      }
      const first = nodeCrypto
        .createHmac('sha256', secret)
        .update(Buffer.from(publicKey.extensions.prf.eval.first))
        .digest();
      return {
        getClientExtensionResults: () =>
          prfAtGet ? { prf: { results: { first: toArrayBuffer(first) } } } : {},
      };
    }),
  };
  Object.defineProperty(global.navigator, 'credentials', {
    configurable: true,
    value: { create: auth.create, get: auth.get },
  });
  global.PublicKeyCredential = {
    getClientCapabilities: jest.fn(async () => ({ 'extension:prf': true })),
    signalUnknownCredential: jest.fn(async () => {}),
  };
  global.location = { hostname: 'blitzwallet.app' };
  return auth;
}

// Creates a passkey and stores the seed under it; returns the fake + id.
async function setUpPasskeyWallet(options) {
  const auth = installAuthenticator(options);
  const created = await createPasskey();
  expect(created.status).toBe('ok');
  expect(await storeMnemonicWithPasskey(MNEMONIC, created.credentialId)).toBe(
    'ok',
  );
  return { auth, credentialId: created.credentialId };
}

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete global.PublicKeyCredential;
  delete global.location;
  jest.restoreAllMocks();
});

describe('store -> decrypt', () => {
  test('round-trips the seed through a passkey envelope', async () => {
    const { credentialId } = await setUpPasskeyWallet();

    const envelope = mockStore.get('encryptedMnemonic');
    const parsed = JSON.parse(envelope);
    expect(parsed).toMatchObject({
      v: 3,
      alg: 'aes-256-gcm',
      kdf: 'webauthn-prf',
      credentialId,
    });
    expect(parsed.salt).toMatch(/^[0-9a-f]{64}$/); // 32-byte PRF salt
    expect(Buffer.from(parsed.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(parsed.tag, 'base64')).toHaveLength(16);
    expect(typeof parsed.createdAt).toBe('number');
    expect(mockStore.get('pinHash')).toBe(PIN_MARKER);

    expect(isPasskeyMnemonicFormat(envelope)).toBe(true);
    expect(isEncryptedMnemonicFormat(envelope)).toBe(true);
    expect(isV3MnemonicFormat(envelope)).toBe(false);

    expect(await decryptMnemonicWithPasskey()).toBe(MNEMONIC);
  });

  test('ceremony options: no rp id, required UV + resident key, 32-byte PRF salt', async () => {
    const { auth, credentialId } = await setUpPasskeyWallet();

    // rp.id / rpId are never set, so the passkey binds to the serving
    // hostname (the same origin as the IndexedDB holding the envelope).
    expect(auth.lastCreate.rp).toEqual({ name: 'Blitz Wallet' });
    expect(auth.lastCreate.user.id).toHaveLength(16);
    expect(auth.lastCreate.authenticatorSelection).toEqual({
      residentKey: 'required',
      userVerification: 'required',
    });
    expect(auth.lastCreate.pubKeyCredParams.map(p => p.alg)).toEqual([
      -7, -257,
    ]);
    expect(auth.lastCreate.extensions).toEqual({ prf: {} });

    expect(auth.lastGet).not.toHaveProperty('rpId');
    expect(auth.lastGet.userVerification).toBe('required');
    expect(toBase64Url(auth.lastGet.allowCredentials[0].id)).toBe(credentialId);
    expect(auth.lastGet.extensions.prf.eval.first).toHaveLength(32);
  });

  test('getStoredPasskeyInfo reads credentialId + createdAt from the envelope', async () => {
    const { credentialId } = await setUpPasskeyWallet();
    const { createdAt } = JSON.parse(mockStore.get('encryptedMnemonic'));

    expect(await getStoredPasskeyInfo()).toEqual({ credentialId, createdAt });
  });

  test('getStoredPasskeyInfo is null for a password wallet', async () => {
    installAuthenticator();
    expect(await storeMnemonicWithPinSecurity(MNEMONIC, 'hunter22')).toBe(true);

    expect(await getStoredPasskeyInfo()).toBeNull();
  });
});

describe('fails closed', () => {
  test('wrong PRF output -> false, never garbage', async () => {
    const { auth, credentialId } = await setUpPasskeyWallet();
    auth.secrets.set(credentialId, nodeCrypto.randomBytes(32));

    expect(await decryptMnemonicWithPasskey()).toBe(false);
  });

  test.each(['salt', 'iv', 'tag', 'ct'])(
    'altered %s -> false, envelope untouched',
    async field => {
      await setUpPasskeyWallet();
      const parsed = JSON.parse(mockStore.get('encryptedMnemonic'));
      parsed[field] =
        field === 'salt'
          ? nodeCrypto.randomBytes(32).toString('hex')
          : nodeCrypto.randomBytes(field === 'iv' ? 12 : 16).toString('base64');
      const tampered = JSON.stringify(parsed);
      mockStore.set('encryptedMnemonic', tampered);

      expect(await decryptMnemonicWithPasskey()).toBe(false);
      expect(mockStore.get('encryptedMnemonic')).toBe(tampered);
    },
  );

  test('unknown credentialId surfaces as the browser NotAllowedError -> null', async () => {
    await setUpPasskeyWallet();
    const parsed = JSON.parse(mockStore.get('encryptedMnemonic'));
    parsed.credentialId = toBase64Url(nodeCrypto.randomBytes(16));
    mockStore.set('encryptedMnemonic', JSON.stringify(parsed));

    expect(await decryptMnemonicWithPasskey()).toBeNull();
  });

  test('invalid seed is rejected before prompting or replacing storage', async () => {
    const { auth, credentialId } = await setUpPasskeyWallet();
    const before = new Map(mockStore);
    auth.get.mockClear();
    expect(await storeMnemonicWithPasskey('not a seed', credentialId)).toBe(
      'failed',
    );
    expect(auth.get).not.toHaveBeenCalled();
    expect(mockStore).toEqual(before);
  });

  test('authenticated ciphertext containing an invalid mnemonic is rejected', async () => {
    const { auth, credentialId } = await setUpPasskeyWallet();
    const env = JSON.parse(mockStore.get('encryptedMnemonic'));
    const prf = nodeCrypto
      .createHmac('sha256', auth.secrets.get(credentialId))
      .update(Buffer.from(env.salt, 'hex'))
      .digest();
    const key = nodeCrypto.hkdfSync(
      'sha256',
      prf,
      Buffer.alloc(0),
      Buffer.from('blitz.encryptedMnemonic.passkey.v1'),
      32,
    );
    const cipher = nodeCrypto.createCipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(env.iv, 'base64'),
    );
    cipher.setAAD(Buffer.from('blitz.encryptedMnemonic.v3'));
    env.ct = Buffer.concat([
      cipher.update('not a seed'),
      cipher.final(),
    ]).toString('base64');
    env.tag = cipher.getAuthTag().toString('base64');
    mockStore.set('encryptedMnemonic', JSON.stringify(env));
    expect(await decryptMnemonicWithPasskey()).toBe(false);
  });

  test('getStoredPasskeyInfo distinguishes unreadable storage from password mode', async () => {
    await setUpPasskeyWallet();
    getItemAsync.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    await expect(getStoredPasskeyInfo()).rejects.toThrow();
  });

  test('a password wallet -> false without opening a passkey prompt', async () => {
    const auth = installAuthenticator();
    await storeMnemonicWithPinSecurity(MNEMONIC, 'hunter22');

    expect(await decryptMnemonicWithPasskey()).toBe(false);
    expect(auth.get).not.toHaveBeenCalled();
  });

  test('storage read failure -> null (retry is safe)', async () => {
    await setUpPasskeyWallet();
    getItemAsync.mockRejectedValueOnce(new Error('IndexedDB unavailable'));

    expect(await decryptMnemonicWithPasskey()).toBeNull();
  });
});

describe('unsupported providers', () => {
  test('create() reporting prf.enabled:false -> unsupported, passkey dropped, nothing written', async () => {
    const auth = installAuthenticator({ prfEnabledAtCreate: false });

    expect(await createPasskey()).toEqual({ status: 'unsupported' });

    const [created] = await Promise.all(
      auth.create.mock.results.map(r => r.value),
    );
    expect(
      global.PublicKeyCredential.signalUnknownCredential,
    ).toHaveBeenCalledWith({
      rpId: 'blitzwallet.app',
      credentialId: toBase64Url(new Uint8Array(created.rawId)),
    });
    expect(mockStore.size).toBe(0);
  });

  test('create() that omits the prf result still proceeds (Samsung Pass style)', async () => {
    installAuthenticator({ omitPrfAtCreate: true });
    const created = await createPasskey();

    expect(created.status).toBe('ok');
    expect(await storeMnemonicWithPasskey(MNEMONIC, created.credentialId)).toBe(
      'ok',
    );
  });

  test('confirm get() without a PRF result -> unsupported, nothing written', async () => {
    installAuthenticator({ prfAtGet: false });
    const { credentialId } = await createPasskey();

    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe(
      'unsupported',
    );
    expect(mockStore.size).toBe(0);
  });
});

describe('prompts that fail or are cancelled', () => {
  test('create() cancelled -> cancelled', async () => {
    const auth = installAuthenticator();
    auth.create.mockRejectedValueOnce(
      Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }),
    );

    expect(await createPasskey()).toEqual({ status: 'cancelled' });
  });

  test('create() failing for any other reason -> unsupported', async () => {
    const auth = installAuthenticator();
    auth.create.mockRejectedValueOnce(
      Object.assign(new Error('no algorithm'), { name: 'NotSupportedError' }),
    );

    expect(await createPasskey()).toEqual({ status: 'unsupported' });
  });

  test('confirm get() throws -> confirm-failed, nothing written; retry on the same credential works', async () => {
    const auth = installAuthenticator();
    const { credentialId } = await createPasskey();
    auth.failNextGet = true;

    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe(
      'confirm-failed',
    );
    expect(mockStore.size).toBe(0);

    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe('ok');
    expect(auth.create).toHaveBeenCalledTimes(1); // never a second passkey
    expect(await decryptMnemonicWithPasskey()).toBe(MNEMONIC);
  });

  test('login cancel -> null, storage untouched', async () => {
    const { auth } = await setUpPasskeyWallet();
    const before = new Map(mockStore);
    auth.failNextGet = true;

    expect(await decryptMnemonicWithPasskey()).toBeNull();
    expect(mockStore).toEqual(before);
  });
});

describe('writes', () => {
  test('ciphertext is written before PIN_MARKER', async () => {
    await setUpPasskeyWallet();

    const keys = setItemAsync.mock.calls.map(([key]) => key);
    expect(keys).toEqual(['encryptedMnemonic', 'pinHash']);
  });

  test('a ciphertext read-back mismatch -> failed, marker never written', async () => {
    installAuthenticator();
    const { credentialId } = await createPasskey();
    getItemAsync.mockResolvedValueOnce('SOMETHING ELSE');

    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe(
      'failed',
    );
    expect(mockStore.has('pinHash')).toBe(false);
  });

  test('a marker read-back mismatch -> failed', async () => {
    installAuthenticator();
    const { credentialId } = await createPasskey();
    getItemAsync
      .mockImplementationOnce(async key => mockStore.get(key)) // ciphertext ok
      .mockResolvedValueOnce('not-the-marker');

    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe(
      'failed',
    );
  });

  test('a mode switch overwrites the password envelope in one write', async () => {
    installAuthenticator();
    await storeMnemonicWithPinSecurity(MNEMONIC, 'hunter22');
    const { credentialId } = await createPasskey();
    setItemAsync.mockClear();

    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe('ok');
    expect(
      setItemAsync.mock.calls.filter(([key]) => key === 'encryptedMnemonic'),
    ).toHaveLength(1);
    expect(await decryptMnemonicWithPasskey()).toBe(MNEMONIC);
  });
});

test('wipe survival: the onboarding keychain wipe keeps the passkey envelope', async () => {
  // The core reason for storing the passkey envelope in encryptedMnemonic
  // (design D4): wipeStaleWalletKeychain keeps encryptedMnemonic + pinHash.
  await setUpPasskeyWallet();
  await storeData('biometricEncryptionKey', 'stale previous-wallet key');

  expect(await wipeStaleWalletKeychain()).toBe(true);

  expect(mockStore.has('biometricEncryptionKey')).toBe(false);
  expect(await decryptMnemonicWithPasskey()).toBe(MNEMONIC);
});

describe('isPasskeySupported', () => {
  test('true only when getClientCapabilities reports extension:prf', async () => {
    installAuthenticator();
    expect(await isPasskeySupported()).toBe(true);

    global.PublicKeyCredential.getClientCapabilities.mockResolvedValueOnce({
      'extension:prf': false,
    });
    expect(await isPasskeySupported()).toBe(false);
  });

  test('false without getClientCapabilities or WebAuthn at all', async () => {
    global.PublicKeyCredential = {};
    expect(await isPasskeySupported()).toBe(false);

    delete global.PublicKeyCredential;
    expect(await isPasskeySupported()).toBe(false);
  });
});

describe('forgetPasskey', () => {
  test('signals the credential as unknown for this hostname', async () => {
    installAuthenticator();
    await forgetPasskey('Y3JlZA');

    expect(
      global.PublicKeyCredential.signalUnknownCredential,
    ).toHaveBeenCalledWith({
      rpId: 'blitzwallet.app',
      credentialId: 'Y3JlZA',
    });
  });

  test('never throws: no Signal API, no WebAuthn, or a rejecting signal', async () => {
    installAuthenticator();
    global.PublicKeyCredential.signalUnknownCredential.mockRejectedValueOnce(
      new Error('boom'),
    );
    await expect(forgetPasskey('Y3JlZA')).resolves.toBeUndefined();

    global.PublicKeyCredential = {};
    await expect(forgetPasskey('Y3JlZA')).resolves.toBeUndefined();

    delete global.PublicKeyCredential;
    await expect(forgetPasskey('Y3JlZA')).resolves.toBeUndefined();
  });
});

test('confirmation after midnight keeps the credential creation date', async () => {
  installAuthenticator();
  const createdAt = new Date('2026-09-10T12:00:00Z').getTime();
  jest.spyOn(Date, 'now').mockReturnValue(createdAt);
  const { credentialId } = await createPasskey();
  Date.now.mockReturnValue(createdAt + 86400000);
  expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe('ok');
  expect((await getStoredPasskeyInfo()).createdAt).toBe(createdAt);
});

test.each(['encryptedMnemonic', 'pinHash'])(
  'a failed %s write never reports success',
  async failedKey => {
    const auth = installAuthenticator();
    const { credentialId } = await createPasskey();
    setItemAsync.mockImplementationOnce(async (key, value) => {
      if (key === failedKey) throw new Error('write failed');
      mockStore.set(key, value);
    });
    if (failedKey === 'pinHash')
      setItemAsync.mockRejectedValueOnce(new Error('write failed'));
    expect(await storeMnemonicWithPasskey(MNEMONIC, credentialId)).toBe(
      'failed',
    );
    expect(auth.get).toHaveBeenCalledTimes(1);
    expect(
      global.PublicKeyCredential.signalUnknownCredential,
    ).not.toHaveBeenCalled();
  },
);
