const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  generateImageServiceWorker,
} = require('../scripts/generate-image-service-worker');

describe('exported image service worker', () => {
  let directory;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blitz-images-'));
    for (const [name, content] of Object.entries({
      'assets/placeholder.hash.png': 'placeholder',
      'assets/deps/icon.hash.svg': 'icon',
      'pwa/icon-192.png': 'pwa icon',
      'index.html': '<html></html>',
      'bundle.js': 'javascript',
    })) {
      const file = path.join(directory, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  function startWorker({ stores = new Map(), fetchFailure = false } = {}) {
    generateImageServiceWorker(directory);
    const listeners = {};
    const origin = 'https://wallet.example';
    const response = (contentType = 'image/png') => ({
      ok: true,
      headers: { get: () => contentType },
      clone() {
        return this;
      },
    });
    const fetch = jest.fn(async () => {
      if (fetchFailure) throw new Error('offline');
      return response();
    });
    const caches = {
      open: jest.fn(async name => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return {
          match: async url => entries.get(url),
          put: async (url, value) => entries.set(url, value),
        };
      }),
      keys: async () => [...stores.keys()],
      delete: jest.fn(async name => stores.delete(name)),
    };
    const self = {
      location: { origin },
      clients: { claim: jest.fn(async () => {}) },
      addEventListener: (type, callback) => (listeners[type] = callback),
    };
    vm.runInNewContext(
      fs.readFileSync(path.join(directory, 'image-service-worker.js'), 'utf8'),
      { self, caches, fetch, URL, Set, Promise },
    );
    const lifecycle = type => {
      let completion;
      listeners[type]({ waitUntil: promise => (completion = promise) });
      return completion;
    };
    const request = (url, method = 'GET') => {
      let completion;
      const event = {
        request: { url: new URL(url, origin).href, method },
        respondWith: jest.fn(promise => (completion = promise)),
        waitUntil: jest.fn(),
      };
      listeners.fetch(event);
      return { event, completion };
    };
    return { stores, fetch, caches, self, lifecycle, request, response };
  }

  it('precaches every exported image before any page requests it', async () => {
    const worker = startWorker();
    await worker.lifecycle('install');
    expect(worker.fetch.mock.calls.map(([url]) => url).sort()).toEqual([
      '/assets/deps/icon.hash.svg',
      '/assets/placeholder.hash.png',
      '/pwa/icon-192.png',
    ]);
    worker.fetch.mockRejectedValue(new Error('offline'));
    for (const url of [
      '/assets/placeholder.hash.png',
      '/assets/node_modules/icon.hash.svg',
      '/pwa/icon-192.png?v=2',
    ]) {
      const { completion } = worker.request(url);
      expect(await completion).toBeDefined();
    }
    expect(worker.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not intercept pages, scripts, APIs, remote images, or writes', () => {
    const worker = startWorker();
    for (const url of [
      '/',
      '/bundle.js',
      '/api/balance',
      '/assets/unknown.png',
      'https://other.example/assets/placeholder.hash.png',
    ]) {
      expect(worker.request(url).event.respondWith).not.toHaveBeenCalled();
    }
    expect(
      worker.request('/assets/placeholder.hash.png', 'POST').event.respondWith,
    ).not.toHaveBeenCalled();
  });

  it('keeps the version stable, but changes it when image contents change', () => {
    generateImageServiceWorker(directory);
    const file = path.join(directory, 'image-service-worker.js');
    const original = fs.readFileSync(file, 'utf8');
    generateImageServiceWorker(directory);
    expect(fs.readFileSync(file, 'utf8')).toBe(original);
    fs.writeFileSync(path.join(directory, 'pwa/icon-192.png'), 'updated icon');
    generateImageServiceWorker(directory);
    expect(fs.readFileSync(file, 'utf8')).not.toBe(original);
  });

  it('removes only obsolete image caches on activation', async () => {
    const stores = new Map([['unrelated-cache', new Map()]]);
    const oldWorker = startWorker({ stores });
    await oldWorker.lifecycle('install');
    const oldCache = oldWorker.caches.open.mock.calls[0][0];
    fs.writeFileSync(path.join(directory, 'pwa/icon-192.png'), 'updated icon');
    const worker = startWorker({ stores });
    await worker.lifecycle('install');
    await worker.lifecycle('activate');
    expect(worker.caches.delete).toHaveBeenCalledWith(oldCache);
    expect(stores.has('unrelated-cache')).toBe(true);
    expect(stores.size).toBe(2);
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });

  it('rejects installation if an image cannot be downloaded', async () => {
    const worker = startWorker({ fetchFailure: true });
    await expect(worker.lifecycle('install')).rejects.toThrow('offline');
  });

  it('rejects HTML fallbacks masquerading as image responses', async () => {
    const worker = startWorker();
    worker.fetch.mockResolvedValue(worker.response('text/html'));
    await expect(worker.lifecycle('install')).rejects.toThrow();
  });

  it('refills an evicted cache from the network', async () => {
    const worker = startWorker();
    const { completion } = worker.request('/assets/placeholder.hash.png');
    expect(await completion).toBeDefined();
    expect(worker.fetch).toHaveBeenCalledTimes(1);
    await worker.request('/assets/placeholder.hash.png').completion;
    expect(worker.fetch).toHaveBeenCalledTimes(1);
  });
});
