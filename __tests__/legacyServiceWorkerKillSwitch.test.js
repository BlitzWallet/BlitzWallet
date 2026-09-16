const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');

describe('legacy service worker kill switch (public/sw.js)', () => {
  function startWorker(cacheNames) {
    const listeners = {};
    const stores = new Set(cacheNames);
    const client = { url: 'https://wallet.example/', navigate: jest.fn() };
    const self = {
      skipWaiting: jest.fn(),
      registration: { unregister: jest.fn(async () => true) },
      clients: { matchAll: jest.fn(async () => [client]) },
      addEventListener: (type, callback) => (listeners[type] = callback),
    };
    const caches = {
      keys: async () => [...stores],
      delete: jest.fn(async name => stores.delete(name)),
    };
    // No localStorage/indexedDB in the sandbox: touching them would throw.
    vm.runInNewContext(
      fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8'),
      { self, caches, console, Promise },
    );
    const lifecycle = type => {
      let completion;
      listeners[type]({ waitUntil: promise => (completion = promise) });
      return completion;
    };
    return { self, stores, client, listeners, lifecycle };
  }

  it('replaces the legacy worker, purges only legacy caches, unregisters and reloads tabs', async () => {
    const { self, stores, client, listeners, lifecycle } = startWorker([
      'workbox-precache-v2-https://wallet.example/',
      'vite-pwa-runtime',
      'blitz-pwa-images-abc',
    ]);

    lifecycle('install');
    expect(self.skipWaiting).toHaveBeenCalled();

    await lifecycle('activate');
    expect([...stores]).toEqual(['blitz-pwa-images-abc']);
    expect(self.registration.unregister).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(client.url);
    // No fetch handler: nothing may be answered from a cache during teardown.
    expect(listeners.fetch).toBeUndefined();
  });

  it('is served as uncached JavaScript', () => {
    const headers = fs.readFileSync(path.join(publicDir, '_headers'), 'utf8');
    expect(headers).toMatch(
      /^\/sw\.js\n\s+Content-Type: application\/javascript[^\n]*\n\s+Cache-Control: no-cache/m,
    );
  });
});
