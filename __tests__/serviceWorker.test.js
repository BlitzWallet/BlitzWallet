const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  createHash,
  generateKeyPairSync,
  verify,
  webcrypto,
} = require('node:crypto');
/* global Response */
const { generateRelease } = require('../scripts/generate-release');

const ORIGIN = 'https://wallet.example';
const publicDir = path.join(__dirname, '..', 'public');
const WORKER_SOURCE = fs.readFileSync(
  path.join(publicDir, 'service-worker.js'),
  'utf8',
);

// A miniature web export: one of each kind of file the real export contains,
// plus the files that must never be cached.
const EXPORT_FILES = {
  'index.html': '<html>shell</html>',
  '_expo/static/js/web/index-abc.js': 'main bundle',
  '_expo/static/js/web/translation-def.js': 'pt-BR chunk',
  '_expo/static/js/web/worker-123.js': 'sqlite worker',
  'assets/deps/expo-sqlite/web/wa-sqlite/wa-sqlite.789.wasm': 'wasm',
  'assets/deps/@react-navigation/elements/lib/module/assets/close-icon.aaa@2x.png':
    'nav icon',
  'pwa/icon-192.png': 'pwa icon',
  'manifest.json': '{"name":"Blitz"}',
  _headers: 'netlify headers',
  _redirects: 'netlify redirects',
  'metadata.json': '{}',
  'sw.js': 'legacy kill switch',
  'service-worker.js': WORKER_SOURCE,
};

function text(body) {
  return new Response(body);
}

// Cache Storage over plain Maps, shared across worker restarts.
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
    has: async name => stores.has(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      return wrap(stores.get(name));
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
}

describe('generateRelease', () => {
  let directory;
  const testSeed = generateKeyPairSync('ed25519')
    .privateKey.export({ format: 'der', type: 'pkcs8' })
    .subarray(-32);
  const signed = { signingSeed: testSeed, skipKeyChecks: true };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blitz-export-'));
    for (const [name, content] of Object.entries(EXPORT_FILES)) {
      const file = path.join(directory, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  const readRelease = () =>
    JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));

  it('lists every app file by request path, with versions from app.json', () => {
    generateRelease(
      directory,
      { version: '1.3.0', extra: { minWebAppVersion: '1.2.0' } },
      signed,
    );
    const { id, appVersion, minAppVersion, files } = readRelease();

    expect(Object.keys(files).sort()).toEqual([
      '/',
      '/_expo/static/js/web/index-abc.js',
      '/_expo/static/js/web/translation-def.js',
      '/_expo/static/js/web/worker-123.js',
      '/assets/deps/@react-navigation/elements/lib/module/assets/close-icon.aaa@2x.png',
      '/assets/deps/expo-sqlite/web/wa-sqlite/wa-sqlite.789.wasm',
      '/manifest.json',
      '/pwa/icon-192.png',
    ]);
    expect(files['/']).toMatch(/^[0-9a-f]{64}$/);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(appVersion).toBe('1.3.0');
    expect(minAppVersion).toBe('1.2.0');
  });

  it('never changes the worker, and changes the release id when a file changes', () => {
    const workerFile = path.join(directory, 'service-worker.js');
    generateRelease(directory, { version: '1.0.0' }, signed);
    const first = readRelease();
    generateRelease(directory, { version: '1.0.0' }, signed);
    expect(readRelease().id).toBe(first.id);

    fs.writeFileSync(
      path.join(directory, '_expo/static/js/web/translation-def.js'),
      'updated chunk',
    );
    generateRelease(directory, { version: '1.0.0' }, signed);
    expect(readRelease().id).not.toBe(first.id);
    expect(fs.readFileSync(workerFile, 'utf8')).toBe(WORKER_SOURCE);
  });

  it('fails without index.html', () => {
    fs.rmSync(path.join(directory, 'index.html'));
    expect(() =>
      generateRelease(directory, { version: '1.0.0' }, signed),
    ).toThrow('no index.html');
  });

  it('fails without a signing key instead of writing an unsigned release', () => {
    expect(() => generateRelease(directory, { version: '1.0.0' })).toThrow(
      'SPARK_WEBVIEW_SIGNING_PRIVATE_KEY is not set',
    );
    expect(fs.existsSync(path.join(directory, 'release.json'))).toBe(false);
  });

  it('fails when the signing key does not match the worker key', () => {
    expect(() =>
      generateRelease(directory, { version: '1.0.0' }, { signingSeed: testSeed }),
    ).toThrow('does not match RELEASE_SIGNING_PUBKEY');
  });

  it('signs the release when a signing key is configured', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const seed = privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .subarray(-32);
    // skipKeyChecks: under Jest the ambient public key is inlined into the
    // script by the dotenv transform, so no ephemeral key could satisfy the
    // pinned-pair checks (production runs never skip them).
    const release = generateRelease(
      directory,
      { version: '1.0.0' },
      { signingSeed: seed, skipKeyChecks: true },
    );
    expect(release.signature).toMatch(/^[0-9a-f]{128}$/);
    const { signature, ...unsigned } = release;
    const sorted = {};
    for (const key of Object.keys(release.files).sort()) {
      sorted[key] = release.files[key];
    }
    const canonical = JSON.stringify({
      id: release.id,
      appVersion: release.appVersion,
      minAppVersion: release.minAppVersion,
      files: sorted,
    });
    expect(
      verify(
        null,
        Buffer.from(canonical, 'utf8'),
        publicKey,
        Buffer.from(signature, 'hex'),
      ),
    ).toBe(true);
    expect(unsigned.signature).toBeUndefined();
  });
});

describe('release-pinned service worker', () => {
  // Test-only signing key. The worker source is patched to pin this key the
  // same way production pins SPARK_WEBVIEW_SIGNING_PUBKEY.
  let testPrivateKey;
  let workerSource;

  beforeAll(async () => {
    const keypair = await webcrypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify'],
    );
    testPrivateKey = keypair.privateKey;
    const pubHex = Buffer.from(
      await webcrypto.subtle.exportKey('raw', keypair.publicKey),
    ).toString('hex');
    workerSource = WORKER_SOURCE.replace(
      /RELEASE_SIGNING_PUBKEY\s*=\s*'[0-9a-fA-F]+'/,
      `RELEASE_SIGNING_PUBKEY = '${pubHex}'`,
    );
    expect(workerSource).not.toBe(WORKER_SOURCE);
    expect(workerSource).toContain(pubHex);
  });

  // A signed release for the given file bodies, with the id the worker's
  // id-binding check expects.
  async function makeSignedRelease(
    bodies,
    { appVersion = '1.0.0', minAppVersion = '0.0.0' } = {},
  ) {
    const unsorted = Object.fromEntries(
      Object.entries(bodies).map(([key, body]) => [
        key,
        createHash('sha256').update(body).digest('hex'),
      ]),
    );
    const files = {};
    for (const key of Object.keys(unsorted).sort()) files[key] = unsorted[key];
    const id = createHash('sha256').update(JSON.stringify(files)).digest('hex');
    const canonical = JSON.stringify({ id, appVersion, minAppVersion, files });
    const signature = Buffer.from(
      await webcrypto.subtle.sign(
        'Ed25519',
        testPrivateKey,
        new TextEncoder().encode(canonical),
      ),
    ).toString('hex');
    return {
      release: { id, appVersion, minAppVersion, files, signature },
      bodies,
    };
  }

  function startWorker({ caches = createCaches(), liveClients = [] } = {}) {
    const listeners = {};
    const fetch = jest.fn(async url => text(`network ${url.url ?? url}`));
    const windows = new Map();
    const window = id => {
      if (!windows.has(id)) {
        windows.set(id, {
          id,
          url: `${ORIGIN}/`,
          navigate: jest.fn(async () => {}),
        });
      }
      return windows.get(id);
    };
    const self = {
      location: { origin: ORIGIN },
      clients: {
        claim: jest.fn(async () => {}),
        matchAll: jest.fn(async () => liveClients.map(window)),
        get: jest.fn(async id =>
          liveClients.includes(id) ? window(id) : undefined,
        ),
      },
      addEventListener: (type, callback) => (listeners[type] = callback),
    };
    vm.runInNewContext(workerSource, {
      self,
      caches,
      fetch,
      URL,
      Response,
      TextEncoder,
      crypto: webcrypto,
      console: { log: () => {} },
    });
    const lifecycle = type => {
      let completion;
      listeners[type]({ waitUntil: promise => (completion = promise) });
      return completion;
    };
    const request = (
      url,
      {
        mode = 'no-cors',
        destination = '',
        clientId = '',
        resultingClientId = '',
        method = 'GET',
      } = {},
    ) => {
      let completion;
      const pending = [];
      const event = {
        request: { url: new URL(url, ORIGIN).href, method, mode, destination },
        clientId,
        resultingClientId,
        respondWith: jest.fn(promise => (completion = promise)),
        waitUntil: promise => pending.push(promise),
      };
      listeners.fetch(event);
      return {
        event,
        body: async () => {
          const response = await completion;
          await Promise.all(pending);
          return response.text();
        },
      };
    };
    return { caches, fetch, self, lifecycle, request, liveClients, window };
  }

  async function install(caches, release, bodies) {
    const cache = await caches.open(`blitz-app-${release.id}`);
    for (const [key, body] of Object.entries(bodies))
      await cache.put(key, text(body));
    await cache.put('/__release-manifest', text(JSON.stringify(release)));
  }

  async function activate(caches, release, appVersion = '1.0.0') {
    const meta = await caches.open('blitz-meta');
    await meta.put(
      '/__active-release',
      text(JSON.stringify({ id: release.id, appVersion })),
    );
  }

  const V1 = { '/': 'shell v1', '/app.js': 'app v1', '/lazy-v1.js': 'lazy v1' };
  const V2 = { '/': 'shell v2', '/app.js': 'app v2' };

  it('passes everything to the network before a release is installed', async () => {
    const worker = startWorker();
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe(`network ${ORIGIN}/`);
  });

  it('serves the active release offline, including SPA routes and node_modules paths', async () => {
    const { release } = await makeSignedRelease({
      ...V1,
      '/assets/deps/sqlite.wasm': 'wasm v1',
      '/pwa/icon-192.png': 'icon v1',
    });
    const caches = createCaches();
    await install(caches, release, {
      ...V1,
      '/assets/deps/sqlite.wasm': 'wasm v1',
      '/pwa/icon-192.png': 'icon v1',
    });
    await activate(caches, release);
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockRejectedValue(new Error('offline'));

    expect(
      await worker
        .request('/paylink/abc', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('shell v1');
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'app v1',
    );
    expect(
      await worker
        .request('/assets/node_modules/sqlite.wasm', { clientId: 'a' })
        .body(),
    ).toBe('wasm v1');
    expect(
      await worker.request('/pwa/icon-192.png?v=2', { clientId: 'a' }).body(),
    ).toBe('icon v1');
  });

  it('keeps serving the installed release after a new deploy', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    const worker = startWorker({ caches, liveClients: ['a'] });
    // The server now has v2; nothing was installed, so v1 stays.
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('shell v1');
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('rejects a newer deploy when an installed asset is missing from its cache', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).delete('/app.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockResolvedValue(text('app v2'));

    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'a' })
      .body();
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe('');
    expect(
      await (await caches.open(`blitz-app-${release.id}`)).match('/app.js'),
    ).toBeUndefined();
  });

  it('restores a missing installed asset only when the bytes match', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).delete('/app.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockResolvedValue(text('app v1'));

    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'a' })
      .body();
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'app v1',
    );
    expect(
      await (await caches.open(`blitz-app-${release.id}`)).match('/app.js'),
    ).toBeDefined();
  });

  const activeRelease = caches =>
    caches.open('blitz-meta').then(meta => meta.match('/__active-release'));

  it('drops a release the host can no longer repair, and reloads the page', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).delete('/lazy-v1.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    // Netlify answers a deleted build file with index.html.
    worker.fetch.mockImplementation(async () => text('shell v2'));

    expect(await worker.request('/lazy-v1.js', { clientId: 'a' }).body()).toBe(
      '',
    );
    expect(await activeRelease(caches)).toBeUndefined();
    expect(worker.window('a').navigate).toHaveBeenCalledWith(`${ORIGIN}/`);
    // The reload is no longer pinned to the broken release.
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'b' })
        .body(),
    ).toBe('shell v2');
  });

  it('reloads a page only once however many of its files are gone', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    const cache = await caches.open(`blitz-app-${release.id}`);
    await cache.delete('/app.js');
    await cache.delete('/lazy-v1.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('shell v2'));

    await worker.request('/app.js', { clientId: 'a' }).body();
    await worker.request('/lazy-v1.js', { clientId: 'a' }).body();
    expect(worker.window('a').navigate).toHaveBeenCalledTimes(1);
  });

  it("serves the host's shell when the installed one is gone for good", async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).delete('/');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('shell v2'));

    expect(
      await worker
        .request('/paylink/abc', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('shell v2');
    expect(await activeRelease(caches)).toBeUndefined();
    // That page's files come from the network too, never half of v1.
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'shell v2',
    );
  });

  it('keeps the release when the repair fails offline', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).delete('/lazy-v1.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockRejectedValue(new Error('offline'));

    expect(await worker.request('/lazy-v1.js', { clientId: 'a' }).body()).toBe(
      '',
    );
    expect(await activeRelease(caches)).toBeDefined();
    expect(worker.window('a').navigate).not.toHaveBeenCalled();
  });

  it('keeps the release when a repaired file cannot be stored', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).delete('/app.js');
    const open = caches.open;
    caches.open = async name => {
      const cache = await open(name);
      if (name !== `blitz-app-${release.id}`) return cache;
      return {
        ...cache,
        put: async () => {
          throw new Error('QuotaExceededError');
        },
      };
    };
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('app v1'));

    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'app v1',
    );
    expect(await activeRelease(caches)).toBeDefined();
  });

  it('never intercepts release checks, update downloads, writes or other origins', () => {
    const worker = startWorker();
    for (const [url, options] of [
      ['/release.json', {}],
      ['/app.js?blitz-release=v2', {}],
      ['/?blitz-release=v2', { mode: 'navigate' }],
      ['/app.js', { method: 'POST' }],
      ['https://firestore.googleapis.com/v1/projects/blitz', {}],
    ]) {
      expect(
        worker.request(url, options).event.respondWith,
      ).not.toHaveBeenCalled();
    }
  });

  it('keeps each window, and the workers it starts, on the release it loaded', async () => {
    const first = await makeSignedRelease({
      ...V1,
      '/worker.js': 'worker v1',
      '/db.wasm': 'wasm v1',
    });
    const second = await makeSignedRelease({
      ...V2,
      '/worker.js': 'worker v2',
      '/db.wasm': 'wasm v2',
    });
    const caches = createCaches();
    await install(caches, first.release, {
      ...V1,
      '/worker.js': 'worker v1',
      '/db.wasm': 'wasm v1',
    });
    await activate(caches, first.release);
    const worker = startWorker({ caches, liveClients: ['old', 'old-worker'] });
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'old' })
        .body(),
    ).toBe('shell v1');

    // Another window installs v2 and reloads.
    await install(caches, second.release, {
      ...V2,
      '/worker.js': 'worker v2',
      '/db.wasm': 'wasm v2',
    });
    await activate(caches, second.release);
    worker.liveClients.push('new');
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'new' })
        .body(),
    ).toBe('shell v2');
    expect(await worker.request('/app.js', { clientId: 'new' }).body()).toBe(
      'app v2',
    );

    // The old window keeps v1 for lazy chunks and for a worker it starts.
    expect(
      await worker.request('/lazy-v1.js', { clientId: 'old' }).body(),
    ).toBe('lazy v1');
    expect(
      await worker
        .request('/worker.js', {
          clientId: 'old',
          destination: 'worker',
          resultingClientId: 'old-worker',
        })
        .body(),
    ).toBe('worker v1');
    expect(
      await worker.request('/db.wasm', { clientId: 'old-worker' }).body(),
    ).toBe('wasm v1');
    expect(caches.stores.has(`blitz-app-${first.release.id}`)).toBe(true);
  });

  it('remembers window releases across a worker restart', async () => {
    const first = await makeSignedRelease(V1);
    const second = await makeSignedRelease(V2);
    const caches = createCaches();
    await install(caches, first.release, V1);
    await activate(caches, first.release);
    const firstWorker = startWorker({ caches, liveClients: ['old'] });
    await firstWorker
      .request('/', { mode: 'navigate', resultingClientId: 'old' })
      .body();
    await install(caches, second.release, V2);
    await activate(caches, second.release);

    const restarted = startWorker({ caches, liveClients: ['old'] });
    expect(await restarted.request('/app.js', { clientId: 'old' }).body()).toBe(
      'app v1',
    );
  });

  it('deletes an old release cache only once no window uses it', async () => {
    const first = await makeSignedRelease(V1);
    const second = await makeSignedRelease(V2);
    const caches = createCaches();
    await install(caches, first.release, V1);
    await activate(caches, first.release);
    const worker = startWorker({ caches, liveClients: ['old'] });
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'old' })
      .body();
    await install(caches, second.release, V2);
    await activate(caches, second.release);

    worker.liveClients.push('new');
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'new' })
      .body();
    expect(caches.stores.has(`blitz-app-${first.release.id}`)).toBe(true);

    worker.liveClients.splice(worker.liveClients.indexOf('old'), 1);
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'new-2' })
      .body();
    expect(caches.stores.has(`blitz-app-${first.release.id}`)).toBe(false);
    expect(caches.stores.has(`blitz-app-${second.release.id}`)).toBe(true);
  });

  it('never deletes a release that is still installing', async () => {
    const first = await makeSignedRelease(V1);
    const second = await makeSignedRelease({ '/': 'shell v2' });
    const caches = createCaches();
    await install(caches, first.release, V1);
    await activate(caches, first.release);
    await install(caches, second.release, { '/': 'shell v2' });
    const meta = await caches.open('blitz-meta');
    await meta.put(
      '/__installing-release',
      text(JSON.stringify({ id: second.release.id })),
    );

    const worker = startWorker({ caches, liveClients: [] });
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'a' })
      .body();
    expect(caches.stores.has(`blitz-app-${second.release.id}`)).toBe(true);
  });

  it('activation keeps the previous app shell cache until a release is installed', async () => {
    const caches = createCaches(
      new Map([
        ['blitz-app-oldworkerhash', new Map()],
        ['blitz-pwa-images-previous', new Map()],
        ['unrelated-cache', new Map()],
      ]),
    );
    const worker = startWorker({ caches });
    await worker.lifecycle('activate');

    expect([...caches.stores.keys()].sort()).toEqual([
      'blitz-app-oldworkerhash',
      'blitz-meta',
      'unrelated-cache',
    ]);
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });

  it('is served as uncached JavaScript, with release.json uncached too', () => {
    const headers = fs.readFileSync(path.join(publicDir, '_headers'), 'utf8');
    expect(headers).toMatch(
      /^\/service-worker\.js\n\s+Content-Type: application\/javascript[^\n]*\n\s+Cache-Control: no-cache/m,
    );
    expect(headers).toMatch(/^\/release\.json\n\s+Cache-Control: no-cache/m);
    expect(WORKER_SOURCE).not.toMatch(/skipWaiting\(/);
  });

  it('pins a release-signing public key in the byte-stable worker', () => {
    expect(WORKER_SOURCE).toMatch(
      /RELEASE_SIGNING_PUBKEY\s*=\s*'[0-9a-f]{64}'/,
    );
  });

  // W-07 regression tests: a transient same-origin writer poisons the cache or
  // the active pointer. The worker must refuse the bytes and fall back to the
  // network or a verified release, never run them.

  it('refuses a poisoned cached file and repairs it from the network', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    // Same-origin writer overwrites the bundle in place.
    await (await caches.open(`blitz-app-${release.id}`)).put(
      '/app.js',
      text('evil bundle'),
    );
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockResolvedValue(text('app v1'));

    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'app v1',
    );
    // The poisoned bytes were replaced with the verified ones.
    expect(
      await (
        await (await caches.open(`blitz-app-${release.id}`)).match('/app.js')
      )
        .clone()
        .text(),
    ).toBe('app v1');
    expect(await activeRelease(caches)).toBeDefined();
  });

  it('refuses a poisoned cached file while offline instead of running it', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    await (await caches.open(`blitz-app-${release.id}`)).put(
      '/app.js',
      text('evil bundle'),
    );
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockRejectedValue(new Error('offline'));

    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe('');
    // Intact files of the same release still serve offline; fail closed but
    // keep the release since it may still repair once online.
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'b' })
        .body(),
    ).toBe('shell v1');
    expect(await activeRelease(caches)).toBeDefined();
  });

  it('re-hashes a cached file poisoned after it was served this worker lifetime', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockRejectedValue(new Error('offline'));
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'app v1',
    );

    await (await caches.open(`blitz-app-${release.id}`)).put(
      '/app.js',
      text('evil bundle'),
    );
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe('');
  });

  it('refuses a poisoned active pointer and loads from the network', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    // Same-origin writer plants its own cache and flips the active pointer.
    const evil = await caches.open('blitz-app-evil');
    await evil.put('/__release-manifest', text(JSON.stringify({})));
    await evil.put('/', text('evil shell'));
    await (
      await caches.open('blitz-meta')
    ).put(
      '/__active-release',
      text(JSON.stringify({ id: 'evil', appVersion: '9.9.9' })),
    );
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('network shell'));

    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('network shell');
    // The poisoned pointer is abandoned, never served.
    expect(await activeRelease(caches)).toBeUndefined();
  });

  it('refuses a cache whose manifest signature was tampered with', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    const cache = await caches.open(`blitz-app-${release.id}`);
    const tampered = {
      ...release,
      files: { ...release.files, '/evil.js': 'ab'.repeat(32) },
    };
    await cache.put('/__release-manifest', text(JSON.stringify(tampered)));
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('network shell'));

    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('network shell');
    expect(await activeRelease(caches)).toBeUndefined();
  });

  it('rejects a legacy unsigned manifest instead of serving it', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    const cache = await caches.open(`blitz-app-${release.id}`);
    for (const [key, body] of Object.entries(V1)) {
      await cache.put(key, text(body));
    }
    // Pre-signature format: the manifest was just the files map.
    await cache.put(
      '/__release-manifest',
      text(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(V1).map(([key, body]) => [
              key,
              createHash('sha256').update(body).digest('hex'),
            ]),
          ),
        ),
      ),
    );
    await activate(caches, release);
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('network shell'));

    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('network shell');
    expect(await activeRelease(caches)).toBeUndefined();
  });

  it('never serves a planted per-route entry for an SPA route', async () => {
    const { release } = await makeSignedRelease(V1);
    const caches = createCaches();
    await install(caches, release, V1);
    await activate(caches, release);
    // Same-origin writer plants a route-specific entry.
    await (await caches.open(`blitz-app-${release.id}`)).put(
      '/paylink/abc',
      text('evil route'),
    );
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockRejectedValue(new Error('offline'));

    expect(
      await worker
        .request('/paylink/abc', { mode: 'navigate', resultingClientId: 'a' })
        .body(),
    ).toBe('shell v1');
  });
});
