const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const {
  generateServiceWorker,
} = require('../scripts/generate-service-worker');

const ORIGIN = 'https://wallet.example';

// A miniature web export: one of each kind of file the real export contains,
// plus the files that must never be precached.
const EXPORT_FILES = {
  'index.html': '<html>shell</html>',
  '_expo/static/js/web/index-abc.js': 'main bundle',
  '_expo/static/js/web/translation-def.js': 'pt-BR chunk',
  '_expo/static/js/web/worker-123.js': 'sqlite worker',
  '_expo/static/css/maplibre-gl-456.css': 'map css',
  'assets/deps/expo-sqlite/web/wa-sqlite/wa-sqlite.789.wasm': 'wasm',
  'assets/deps/@react-navigation/elements/lib/module/assets/close-icon.aaa@2x.png':
    'nav icon',
  'assets/app/assets/fonts/Poppins-Regular.bbb.ttf': 'font',
  'pwa/icon-192.png': 'pwa icon',
  'manifest.json': '{"name":"Blitz"}',
  'favicon.ico': 'favicon',
  _headers: 'netlify headers',
  _redirects: 'netlify redirects',
  'metadata.json': '{}',
  'sw.js': 'legacy kill switch',
};

const PRECACHED_PATHS = [
  '/',
  '/_expo/static/css/maplibre-gl-456.css',
  '/_expo/static/js/web/index-abc.js',
  '/_expo/static/js/web/translation-def.js',
  '/_expo/static/js/web/worker-123.js',
  '/assets/app/assets/fonts/Poppins-Regular.bbb.ttf',
  '/assets/deps/@react-navigation/elements/lib/module/assets/close-icon.aaa@2x.png',
  '/assets/deps/expo-sqlite/web/wa-sqlite/wa-sqlite.789.wasm',
  '/favicon.ico',
  '/manifest.json',
  '/pwa/icon-192.png',
];

function response(body, { ok = true, redirected = false } = {}) {
  const bytes = Buffer.from(body);
  return {
    ok,
    redirected,
    content: bytes.toString(),
    clone: () => response(bytes, { ok, redirected }),
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  };
}

describe('offline app shell service worker', () => {
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

  // Netlify: the file at the path if one exists, else index.html with 200.
  function serveExport(url) {
    const { pathname } = new URL(url, ORIGIN);
    const file = path.join(directory, pathname === '/' ? 'index.html' : pathname);
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    return response(
      fs.readFileSync(exists ? file : path.join(directory, 'index.html')),
    );
  }

  function startWorker({
    stores = new Map(),
    fetchImpl = async url => serveExport(url),
  } = {}) {
    generateServiceWorker(directory);
    const listeners = {};
    const caches = {
      open: jest.fn(async name => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return {
          match: async key => entries.get(key),
          put: async (key, value) => {
            entries.set(key, value);
          },
        };
      }),
      keys: async () => [...stores.keys()],
      delete: jest.fn(async name => stores.delete(name)),
    };
    const fetch = jest.fn(fetchImpl);
    const self = {
      location: { origin: ORIGIN },
      clients: { claim: jest.fn(async () => {}) },
      skipWaiting: jest.fn(),
      addEventListener: (type, callback) => (listeners[type] = callback),
    };
    vm.runInNewContext(
      fs.readFileSync(path.join(directory, 'service-worker.js'), 'utf8'),
      { self, caches, fetch, crypto: webcrypto, URL },
    );
    const lifecycle = type => {
      let completion;
      listeners[type]({ waitUntil: promise => (completion = promise) });
      return completion;
    };
    const request = (url, { method = 'GET', mode = 'no-cors' } = {}) => {
      let completion;
      const event = {
        request: { url: new URL(url, ORIGIN).href, method, mode },
        respondWith: jest.fn(promise => (completion = promise)),
      };
      listeners.fetch(event);
      return { event, completion };
    };
    return { stores, caches, fetch, self, lifecycle, request };
  }

  it('precaches every exported app file, verified and one at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const worker = startWorker({
      fetchImpl: async url => {
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        await new Promise(resolve => setImmediate(resolve));
        inFlight--;
        return serveExport(url);
      },
    });

    await worker.lifecycle('install');

    expect(worker.fetch.mock.calls.map(([url]) => url).sort()).toEqual(
      PRECACHED_PATHS,
    );
    expect(
      worker.fetch.mock.calls.every(([, init]) => init?.cache === 'no-cache'),
    ).toBe(true);
    expect(worker.fetch.mock.calls[0][0]).toBe('/');
    expect(maxInFlight).toBe(1);
    const [cache] = worker.stores.values();
    expect([...cache.keys()].sort()).toEqual(PRECACHED_PATHS);
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('starts the whole app from cache with no network', async () => {
    const worker = startWorker();
    await worker.lifecycle('install');
    worker.fetch.mockClear();
    worker.fetch.mockRejectedValue(new Error('offline'));

    const shell = EXPORT_FILES['index.html'];
    for (const [url, mode, expected] of [
      ['/', 'navigate', shell],
      ['/paylink/abc123XYZ', 'navigate', shell],
      ['/manifest.json', 'navigate', EXPORT_FILES['manifest.json']],
      [
        '/_expo/static/js/web/translation-def.js',
        'no-cors',
        EXPORT_FILES['_expo/static/js/web/translation-def.js'],
      ],
      [
        '/_expo/static/js/web/worker-123.js',
        'same-origin',
        EXPORT_FILES['_expo/static/js/web/worker-123.js'],
      ],
      [
        '/assets/node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.789.wasm',
        'cors',
        EXPORT_FILES['assets/deps/expo-sqlite/web/wa-sqlite/wa-sqlite.789.wasm'],
      ],
      [
        '/assets/node_modules/@react-navigation/elements/lib/module/assets/close-icon.aaa@2x.png',
        'no-cors',
        EXPORT_FILES[
          'assets/deps/@react-navigation/elements/lib/module/assets/close-icon.aaa@2x.png'
        ],
      ],
      ['/pwa/icon-192.png?v=2', 'no-cors', EXPORT_FILES['pwa/icon-192.png']],
    ]) {
      const { completion } = worker.request(url, { mode });
      expect((await completion).content).toBe(expected);
    }
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('leaves remote, write and unlisted requests to the network', () => {
    const worker = startWorker();
    for (const [url, options] of [
      ['https://firestore.googleapis.com/v1/projects/blitz', {}],
      ['/_expo/static/js/web/index-abc.js', { method: 'POST' }],
      ['/api/balance', {}],
      ['/_expo/static/js/web/translation-old.js', {}],
    ]) {
      expect(worker.request(url, options).event.respondWith).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      'an SPA fallback for a missing chunk',
      url =>
        url.endsWith('translation-def.js')
          ? response(EXPORT_FILES['index.html'])
          : null,
    ],
    [
      "a newer deploy's index.html",
      url => (url === '/' ? response('<html>next deploy</html>') : null),
    ],
    [
      'a redirect',
      url =>
        url === '/'
          ? response(EXPORT_FILES['index.html'], { redirected: true })
          : null,
    ],
    [
      'an error status',
      url => (url === '/manifest.json' ? response('gone', { ok: false }) : null),
    ],
  ])('refuses to install %s', async (_, override) => {
    const worker = startWorker({
      fetchImpl: async url => override(url) ?? serveExport(url),
    });
    await expect(worker.lifecycle('install')).rejects.toThrow(
      "Not the build's file",
    );
  });

  it('checks the page shell before downloading anything else', async () => {
    const worker = startWorker({
      fetchImpl: async url =>
        url === '/' ? response('<html>next deploy</html>') : serveExport(url),
    });
    await expect(worker.lifecycle('install')).rejects.toThrow(
      "Not the build's file",
    );
    expect(worker.fetch.mock.calls.map(([url]) => url)).toEqual(['/']);
  });

  it('fails installation when a download fails', async () => {
    const worker = startWorker({
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    await expect(worker.lifecycle('install')).rejects.toThrow('offline');
  });

  it('keeps the version stable, and changes it when any file changes', () => {
    const workerFile = path.join(directory, 'service-worker.js');
    generateServiceWorker(directory);
    const original = fs.readFileSync(workerFile, 'utf8');
    generateServiceWorker(directory);
    expect(fs.readFileSync(workerFile, 'utf8')).toBe(original);
    fs.writeFileSync(
      path.join(directory, '_expo/static/js/web/translation-def.js'),
      'updated chunk',
    );
    generateServiceWorker(directory);
    expect(fs.readFileSync(workerFile, 'utf8')).not.toBe(original);
  });

  it('activation removes only replaced app and image caches', async () => {
    const stores = new Map([
      ['blitz-app-previous', new Map()],
      ['blitz-pwa-images-previous', new Map()],
      ['unrelated-cache', new Map()],
    ]);
    const worker = startWorker({ stores });
    await worker.lifecycle('install');
    const current = worker.caches.open.mock.calls[0][0];
    await worker.lifecycle('activate');

    expect(current).toMatch(/^blitz-app-[0-9a-f]{64}$/);
    expect([...stores.keys()].sort()).toEqual(
      [current, 'unrelated-cache'].sort(),
    );
    expect(worker.self.clients.claim).toHaveBeenCalled();
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('refills a cache miss only with verified bytes', async () => {
    const worker = startWorker();
    const chunk = '/_expo/static/js/web/translation-def.js';
    const chunkContent = EXPORT_FILES[chunk.slice(1)];

    // An SPA fallback is passed through but not stored.
    worker.fetch.mockImplementationOnce(async () =>
      response(EXPORT_FILES['index.html']),
    );
    expect((await worker.request(chunk).completion).content).toBe(
      EXPORT_FILES['index.html'],
    );
    // The real file is stored...
    expect((await worker.request(chunk).completion).content).toBe(chunkContent);
    // ...and served offline afterwards.
    worker.fetch.mockRejectedValue(new Error('offline'));
    expect((await worker.request(chunk).completion).content).toBe(chunkContent);
  });

  it('is served as uncached JavaScript', () => {
    const headers = fs.readFileSync(
      path.join(__dirname, '..', 'public', '_headers'),
      'utf8',
    );
    expect(headers).toMatch(
      /^\/service-worker\.js\n\s+Content-Type: application\/javascript[^\n]*\n\s+Cache-Control: no-cache/m,
    );
  });
});
