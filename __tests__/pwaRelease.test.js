const { createHash } = require('node:crypto');
const { webcrypto } = require('node:crypto');
/* global Response */

// The key module reads an inlined build-time key, so it is mocked to serve
// the test keypair instead (see app/functions/pwaReleaseSigningKey.js).
let mockTestPubHex = '';
jest.mock('../app/functions/pwaReleaseSigningKey', () => ({
  getReleaseSigningPubkeyHex: () => mockTestPubHex,
}));

const sha256 = body => createHash('sha256').update(body).digest('hex');

// Cache Storage over plain Maps.
function createCaches(stores = new Map()) {
  const wrap = entries => ({
    match: async key => entries.get(key)?.clone(),
    put: async (key, value) => {
      entries.set(key, value);
    },
    delete: async key => entries.delete(key),
  });
  return {
    stores,
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      return wrap(stores.get(name));
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
}

// Test-only Ed25519 keypair served through the mocked key module above.
let testPrivateKey;

async function makeRelease(
  bodies,
  { appVersion = '1.0.0', minAppVersion = '0.0.0', id: forcedId } = {},
) {
  const unsorted = Object.fromEntries(
    Object.entries(bodies).map(([key, body]) => [key, sha256(body)]),
  );
  const files = {};
  for (const key of Object.keys(unsorted).sort()) files[key] = unsorted[key];
  const id =
    forcedId ??
    createHash('sha256').update(JSON.stringify(files)).digest('hex');
  const canonical = JSON.stringify({ id, appVersion, minAppVersion, files });
  const signature = Buffer.from(
    await webcrypto.subtle.sign(
      'Ed25519',
      testPrivateKey,
      new TextEncoder().encode(canonical),
    ),
  ).toString('hex');
  return { id, appVersion, minAppVersion, files, signature };
}

async function readJson(caches, cacheName, key) {
  const response = await (await caches.open(cacheName)).match(key);
  return response ? response.json() : null;
}

describe('pwaRelease.web', () => {
  let caches;
  let server; // { path: body }, what the host serves now
  let deployed; // current /release.json
  let pwa;

  beforeAll(async () => {
    const keypair = await webcrypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify'],
    );
    testPrivateKey = keypair.privateKey;
    mockTestPubHex = Buffer.from(
      await webcrypto.subtle.exportKey('raw', keypair.publicKey),
    ).toString('hex');
  });

  beforeEach(() => {
    jest.resetModules();
    caches = createCaches();
    server = {};
    deployed = null;
    global.__DEV__ = false;
    global.caches = caches;
    global.location = { origin: 'https://app.example' };
    Object.defineProperty(global, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: { ready: Promise.resolve() } },
      configurable: true,
    });
    global.fetch = jest.fn(async url => {
      if (url === '/release.json')
        return new Response(JSON.stringify(deployed));
      const path = url.split('?')[0];
      // Netlify's SPA fallback for a file this deploy doesn't have.
      return new Response(path in server ? server[path] : server['/']);
    });
    pwa = require('../app/functions/pwaRelease.web.js');
  });

  afterEach(() => {
    global.__DEV__ = true;
    delete global.caches;
    delete global.location;
  });

  async function installActive(release, bodies) {
    const cache = await caches.open(`blitz-app-${release.id}`);
    for (const [key, body] of Object.entries(bodies)) {
      await cache.put(key, new Response(body));
    }
    await (
      await caches.open('blitz-meta')
    ).put(
      '/__active-release',
      new Response(
        JSON.stringify({ id: release.id, appVersion: release.appVersion }),
      ),
    );
  }

  it('first visit installs the deployed release quietly, with no prompt', async () => {
    server = { '/': 'shell v1', '/app.js': 'app v1' };
    deployed = await makeRelease(server);

    expect(await pwa.checkForWebUpdate()).toBeNull();
    // The install runs in the background.
    for (let i = 0; i < 100; i++) {
      if (await readJson(caches, 'blitz-meta', '/__active-release')) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    expect(await readJson(caches, 'blitz-meta', '/__active-release')).toEqual({
      id: deployed.id,
      appVersion: '1.0.0',
    });
    expect(pwa.getPendingWebUpdate()).toBeNull();
  });

  it('reports nothing when the installed release is deployed', async () => {
    server = { '/': 'shell v1' };
    deployed = await makeRelease(server);
    await installActive(deployed, server);
    expect(await pwa.checkForWebUpdate()).toBeNull();
  });

  it('offers a newer deploy as optional unless the install is below minAppVersion', async () => {
    const v1bodies = { '/': 'shell v1' };
    const v1 = await makeRelease(v1bodies, { appVersion: '1.2.0' });
    await installActive(v1, v1bodies);
    server = { '/': 'shell v2' };

    deployed = await makeRelease(server, {
      appVersion: '1.3.0',
      minAppVersion: '1.2.0',
    });
    expect(await pwa.checkForWebUpdate()).toMatchObject({
      version: '1.3.0',
      mandatory: false,
    });

    deployed = await makeRelease(server, {
      appVersion: '1.3.0',
      minAppVersion: '1.2.1',
    });
    expect(await pwa.checkForWebUpdate()).toMatchObject({ mandatory: true });
  });

  it('never blocks when the check fails offline', async () => {
    const bodies = { '/': 'shell v1' };
    const v1 = await makeRelease(bodies, { appVersion: '0.1.0' });
    await installActive(v1, bodies);
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await pwa.checkForWebUpdate()).toBeNull();
  });

  it('ignores a deployed release whose signature is missing or invalid', async () => {
    const bodies = { '/': 'shell v1' };
    const v1 = await makeRelease(bodies);
    await installActive(v1, bodies);
    server = { '/': 'shell v2' };
    const v2 = await makeRelease(server);

    // Unsigned.
    deployed = { ...v2 };
    delete deployed.signature;
    expect(await pwa.checkForWebUpdate()).toBeNull();
    expect(pwa.getPendingWebUpdate()).toBeNull();

    // Tampered file list after signing.
    deployed = { ...v2, files: { ...v2.files, '/evil.js': sha256('evil') } };
    expect(await pwa.checkForWebUpdate()).toBeNull();
    expect(pwa.getPendingWebUpdate()).toBeNull();

    // The installed release is untouched.
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      v1.id,
    );
  });

  it('downloads only changed files, verified, then activates', async () => {
    const v1bodies = { '/': 'shell v1', '/same.wasm': 'wasm' };
    const v1 = await makeRelease(v1bodies);
    await installActive(v1, v1bodies);
    server = { '/': 'shell v2', '/same.wasm': 'wasm' };
    const v2 = await makeRelease(server);
    const progress = [];

    await pwa.installRelease(v2, value => progress.push(value));

    const downloads = global.fetch.mock.calls.map(([url]) => url);
    expect(downloads).toEqual([`/?blitz-release=${v2.id}`]);
    expect(progress).toEqual([0.5, 1]);
    const v2cache = caches.stores.get(`blitz-app-${v2.id}`);
    expect(await v2cache.get('/').clone().text()).toBe('shell v2');
    expect(await v2cache.get('/same.wasm').clone().text()).toBe('wasm');
    // W-07: the worker trusts the manifest only through its signature.
    expect(await v2cache.get('/__release-manifest').clone().json()).toEqual({
      id: v2.id,
      appVersion: v2.appVersion,
      minAppVersion: v2.minAppVersion,
      files: v2.files,
      signature: v2.signature,
    });
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      v2.id,
    );
    expect(
      await readJson(caches, 'blitz-meta', '/__installing-release'),
    ).toBeNull();
    // Old release stays for windows still on it; the worker prunes it later.
    expect(caches.stores.has(`blitz-app-${v1.id}`)).toBe(true);
  });

  it('reuses verified files in the target cache during a repeated install', async () => {
    server = { '/': 'shell v1', '/app.js': 'app v1' };
    const release = await makeRelease(server);
    const target = await caches.open(`blitz-app-${release.id}`);
    await target.put('/', new Response('shell v1'));
    await target.put('/app.js', new Response('poisoned app'));

    await pwa.installRelease(release);

    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      `/app.js?blitz-release=${release.id}`,
    ]);
    expect(await (await target.match('/app.js')).text()).toBe('app v1');
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      release.id,
    );
  });

  it('a failed download leaves the installed release active and removes the partial cache', async () => {
    const v1bodies = { '/': 'shell v1' };
    const v1 = await makeRelease(v1bodies);
    await installActive(v1, v1bodies);
    // The host has moved on to v3: the chunk is its SPA fallback.
    server = { '/': 'shell v2' };
    const release = await makeRelease({
      '/': 'shell v2',
      '/chunk.js': 'chunk v2',
    });

    await expect(pwa.installRelease(release)).rejects.toThrow(
      "Not the release's file: /chunk.js",
    );
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      v1.id,
    );
    expect(caches.stores.has(`blitz-app-${release.id}`)).toBe(false);
    expect(
      await readJson(caches, 'blitz-meta', '/__installing-release'),
    ).toBeNull();
  });

  it('accepts a signed release whose id is not the hash of its sorted files', async () => {
    // generateRelease hashes files in export order ('/' is not first), so the
    // id is only a name; the signature is what binds it to the file list.
    const bodies = { '/': 'shell v1' };
    await installActive(await makeRelease(bodies), bodies);
    server = { '/': 'shell v2' };
    deployed = await makeRelease(server, {
      appVersion: '1.1.0',
      id: 'ab'.repeat(32),
    });
    expect(await pwa.checkForWebUpdate()).not.toBeNull();
  });

  it('refuses to install a release with a missing or forged signature', async () => {
    const v1bodies = { '/': 'shell v1' };
    const v1 = await makeRelease(v1bodies);
    await installActive(v1, v1bodies);
    server = { '/': 'shell v2' };
    const v2 = await makeRelease(server);

    const unsigned = { ...v2 };
    delete unsigned.signature;
    await expect(pwa.installRelease(unsigned)).rejects.toThrow(
      'Invalid release signature',
    );

    const forged = { ...v2, files: { ...v2.files, '/evil.js': sha256('evil') } };
    await expect(pwa.installRelease(forged)).rejects.toThrow(
      'Invalid release signature',
    );

    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      v1.id,
    );
    expect(caches.stores.has(`blitz-app-${v2.id}`)).toBe(false);
  });

  it('compares x.y.z versions numerically', () => {
    expect(pwa.compareVersions('0.2.10', '0.2.9')).toBe(1);
    expect(pwa.compareVersions('1.0', '1.0.0')).toBe(0);
    expect(pwa.compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });

  it('rejects manifest paths outside the app origin before any download', async () => {
    const bodies = { '/': 'shell v1' };
    const v1 = await makeRelease(bodies);
    await installActive(v1, bodies);
    for (const [index, evilPath] of [
      'https://evil.com/payload.js',
      '//evil.com/app.js',
      '/\\evil.com/app.js',
    ].entries()) {
      await expect(
        pwa.installRelease({
          id: `evil${index}`,
          appVersion: '9.9.9',
          minAppVersion: '0.0.0',
          files: { [evilPath]: sha256('evil payload') },
          signature: 'ab'.repeat(64),
        }),
      ).rejects.toThrow('Invalid release manifest');
    }
    expect(global.fetch).not.toHaveBeenCalled();
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      v1.id,
    );
  });
});
