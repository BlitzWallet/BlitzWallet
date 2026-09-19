const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
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
    generateRelease(directory, {
      version: '1.3.0',
      extra: { minWebAppVersion: '1.2.0' },
    });
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
    generateRelease(directory, { version: '1.0.0' });
    const first = readRelease();
    generateRelease(directory, { version: '1.0.0' });
    expect(readRelease().id).toBe(first.id);

    fs.writeFileSync(
      path.join(directory, '_expo/static/js/web/translation-def.js'),
      'updated chunk',
    );
    generateRelease(directory, { version: '1.0.0' });
    expect(readRelease().id).not.toBe(first.id);
    expect(fs.readFileSync(workerFile, 'utf8')).toBe(WORKER_SOURCE);
  });

  it('fails without index.html', () => {
    fs.rmSync(path.join(directory, 'index.html'));
    expect(() => generateRelease(directory, { version: '1.0.0' })).toThrow(
      'no index.html',
    );
  });
});

describe('release-pinned service worker', () => {
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
    vm.runInNewContext(WORKER_SOURCE, {
      self,
      caches,
      fetch,
      URL,
      Response,
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

  async function install(caches, id, files) {
    const cache = await caches.open(`blitz-app-${id}`);
    for (const [key, body] of Object.entries(files))
      await cache.put(key, text(body));
    await cache.put(
      '/__release-manifest',
      text(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(files).map(([key, body]) => [
              key,
              createHash('sha256').update(body).digest('hex'),
            ]),
          ),
        ),
      ),
    );
  }

  async function activate(caches, id, appVersion = '1.0.0') {
    const meta = await caches.open('blitz-meta');
    await meta.put(
      '/__active-release',
      text(JSON.stringify({ id, appVersion })),
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
    const caches = createCaches();
    await install(caches, 'v1', {
      ...V1,
      '/assets/deps/sqlite.wasm': 'wasm v1',
      '/pwa/icon-192.png': 'icon v1',
    });
    await activate(caches, 'v1');
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
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
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
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await (await caches.open('blitz-app-v1')).delete('/app.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockResolvedValue(text('app v2'));

    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'a' })
      .body();
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe('');
    expect(
      await (await caches.open('blitz-app-v1')).match('/app.js'),
    ).toBeUndefined();
  });

  it('restores a missing installed asset only when the bytes match', async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await (await caches.open('blitz-app-v1')).delete('/app.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockResolvedValue(text('app v1'));

    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'a' })
      .body();
    expect(await worker.request('/app.js', { clientId: 'a' }).body()).toBe(
      'app v1',
    );
    expect(
      await (await caches.open('blitz-app-v1')).match('/app.js'),
    ).toBeDefined();
  });

  const activeRelease = caches =>
    caches.open('blitz-meta').then(meta => meta.match('/__active-release'));

  it('drops a release the host can no longer repair, and reloads the page', async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await (await caches.open('blitz-app-v1')).delete('/lazy-v1.js');
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
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    const cache = await caches.open('blitz-app-v1');
    await cache.delete('/app.js');
    await cache.delete('/lazy-v1.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockImplementation(async () => text('shell v2'));

    await worker.request('/app.js', { clientId: 'a' }).body();
    await worker.request('/lazy-v1.js', { clientId: 'a' }).body();
    expect(worker.window('a').navigate).toHaveBeenCalledTimes(1);
  });

  it("serves the host's shell when the installed one is gone for good", async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await (await caches.open('blitz-app-v1')).delete('/');
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
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await (await caches.open('blitz-app-v1')).delete('/lazy-v1.js');
    const worker = startWorker({ caches, liveClients: ['a'] });
    worker.fetch.mockRejectedValue(new Error('offline'));

    expect(await worker.request('/lazy-v1.js', { clientId: 'a' }).body()).toBe(
      '',
    );
    expect(await activeRelease(caches)).toBeDefined();
    expect(worker.window('a').navigate).not.toHaveBeenCalled();
  });

  it('keeps the release when a repaired file cannot be stored', async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await (await caches.open('blitz-app-v1')).delete('/app.js');
    const open = caches.open;
    caches.open = async name => {
      const cache = await open(name);
      if (name !== 'blitz-app-v1') return cache;
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
    const caches = createCaches();
    await install(caches, 'v1', {
      ...V1,
      '/worker.js': 'worker v1',
      '/db.wasm': 'wasm v1',
    });
    await activate(caches, 'v1');
    const worker = startWorker({ caches, liveClients: ['old', 'old-worker'] });
    expect(
      await worker
        .request('/', { mode: 'navigate', resultingClientId: 'old' })
        .body(),
    ).toBe('shell v1');

    // Another window installs v2 and reloads.
    await install(caches, 'v2', {
      ...V2,
      '/worker.js': 'worker v2',
      '/db.wasm': 'wasm v2',
    });
    await activate(caches, 'v2');
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
    expect(caches.stores.has('blitz-app-v1')).toBe(true);
  });

  it('remembers window releases across a worker restart', async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    const first = startWorker({ caches, liveClients: ['old'] });
    await first
      .request('/', { mode: 'navigate', resultingClientId: 'old' })
      .body();
    await install(caches, 'v2', V2);
    await activate(caches, 'v2');

    const restarted = startWorker({ caches, liveClients: ['old'] });
    expect(await restarted.request('/app.js', { clientId: 'old' }).body()).toBe(
      'app v1',
    );
  });

  it('deletes an old release cache only once no window uses it', async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    const worker = startWorker({ caches, liveClients: ['old'] });
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'old' })
      .body();
    await install(caches, 'v2', V2);
    await activate(caches, 'v2');

    worker.liveClients.push('new');
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'new' })
      .body();
    expect(caches.stores.has('blitz-app-v1')).toBe(true);

    worker.liveClients.splice(worker.liveClients.indexOf('old'), 1);
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'new-2' })
      .body();
    expect(caches.stores.has('blitz-app-v1')).toBe(false);
    expect(caches.stores.has('blitz-app-v2')).toBe(true);
  });

  it('never deletes a release that is still installing', async () => {
    const caches = createCaches();
    await install(caches, 'v1', V1);
    await activate(caches, 'v1');
    await install(caches, 'v2', { '/': 'shell v2' });
    const meta = await caches.open('blitz-meta');
    await meta.put('/__installing-release', text(JSON.stringify({ id: 'v2' })));

    const worker = startWorker({ caches, liveClients: [] });
    await worker
      .request('/', { mode: 'navigate', resultingClientId: 'a' })
      .body();
    expect(caches.stores.has('blitz-app-v2')).toBe(true);
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
});
