const { createHash } = require('node:crypto');
const { webcrypto } = require('node:crypto');
/* global Response */

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

function makeRelease(
  id,
  files,
  { appVersion = '1.0.0', minAppVersion = '0.0.0' } = {},
) {
  return {
    id,
    appVersion,
    minAppVersion,
    files: Object.fromEntries(
      Object.entries(files).map(([key, body]) => [key, sha256(body)]),
    ),
  };
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

  beforeEach(() => {
    jest.resetModules();
    caches = createCaches();
    server = {};
    deployed = null;
    global.__DEV__ = false;
    global.caches = caches;
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
  });

  async function installActive(id, files, appVersion = '1.0.0') {
    const cache = await caches.open(`blitz-app-${id}`);
    for (const [key, body] of Object.entries(files)) {
      await cache.put(key, new Response(body));
    }
    await (
      await caches.open('blitz-meta')
    ).put(
      '/__active-release',
      new Response(JSON.stringify({ id, appVersion })),
    );
  }

  it('first visit installs the deployed release quietly, with no prompt', async () => {
    server = { '/': 'shell v1', '/app.js': 'app v1' };
    deployed = makeRelease('v1', server);

    expect(await pwa.checkForWebUpdate()).toBeNull();
    // The install runs in the background.
    for (let i = 0; i < 100; i++) {
      if (await readJson(caches, 'blitz-meta', '/__active-release')) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    expect(await readJson(caches, 'blitz-meta', '/__active-release')).toEqual({
      id: 'v1',
      appVersion: '1.0.0',
    });
    expect(pwa.getPendingWebUpdate()).toBeNull();
  });

  it('reports nothing when the installed release is deployed', async () => {
    server = { '/': 'shell v1' };
    deployed = makeRelease('v1', server);
    await installActive('v1', server);
    expect(await pwa.checkForWebUpdate()).toBeNull();
  });

  it('offers a newer deploy as optional unless the install is below minAppVersion', async () => {
    await installActive('v1', { '/': 'shell v1' }, '1.2.0');
    server = { '/': 'shell v2' };

    deployed = makeRelease('v2', server, {
      appVersion: '1.3.0',
      minAppVersion: '1.2.0',
    });
    expect(await pwa.checkForWebUpdate()).toMatchObject({
      version: '1.3.0',
      mandatory: false,
    });

    deployed = makeRelease('v2', server, {
      appVersion: '1.3.0',
      minAppVersion: '1.2.1',
    });
    expect(await pwa.checkForWebUpdate()).toMatchObject({ mandatory: true });
  });

  it('never blocks when the check fails offline', async () => {
    await installActive('v1', { '/': 'shell v1' }, '0.1.0');
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await pwa.checkForWebUpdate()).toBeNull();
  });

  it('downloads only changed files, verified, then activates', async () => {
    await installActive('v1', { '/': 'shell v1', '/same.wasm': 'wasm' });
    server = { '/': 'shell v2', '/same.wasm': 'wasm' };
    const progress = [];

    await pwa.installRelease(makeRelease('v2', server), value =>
      progress.push(value),
    );

    const downloads = global.fetch.mock.calls.map(([url]) => url);
    expect(downloads).toEqual(['/?blitz-release=v2']);
    expect(progress).toEqual([0.5, 1]);
    const v2 = caches.stores.get('blitz-app-v2');
    expect(await v2.get('/').clone().text()).toBe('shell v2');
    expect(await v2.get('/same.wasm').clone().text()).toBe('wasm');
    expect(await v2.get('/__release-manifest').clone().json()).toEqual(
      makeRelease('v2', server).files,
    );
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      'v2',
    );
    expect(
      await readJson(caches, 'blitz-meta', '/__installing-release'),
    ).toBeNull();
    // Old release stays for windows still on it; the worker prunes it later.
    expect(caches.stores.has('blitz-app-v1')).toBe(true);
  });

  it('a failed download leaves the installed release active and removes the partial cache', async () => {
    await installActive('v1', { '/': 'shell v1' });
    // The host has moved on to v3: the chunk is its SPA fallback.
    server = { '/': 'shell v2' };
    const release = makeRelease('v2', {
      '/': 'shell v2',
      '/chunk.js': 'chunk v2',
    });

    await expect(pwa.installRelease(release)).rejects.toThrow(
      "Not the release's file: /chunk.js",
    );
    expect((await readJson(caches, 'blitz-meta', '/__active-release')).id).toBe(
      'v1',
    );
    expect(caches.stores.has('blitz-app-v2')).toBe(false);
    expect(
      await readJson(caches, 'blitz-meta', '/__installing-release'),
    ).toBeNull();
  });

  it('compares x.y.z versions numerically', () => {
    expect(pwa.compareVersions('0.2.10', '0.2.9')).toBe(1);
    expect(pwa.compareVersions('1.0', '1.0.0')).toBe(0);
    expect(pwa.compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });
});
