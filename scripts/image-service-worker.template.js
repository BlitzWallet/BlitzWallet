/* eslint-env serviceworker */
// Filled by generate-image-service-worker.js after the final web asset rename.
const CACHE_PREFIX = 'blitz-pwa-images-';
const CACHE_NAME = CACHE_PREFIX + '__IMAGE_CACHE_VERSION__';
const IMAGE_URLS = new Set(/* __IMAGE_URLS__ */);

function isImage(response) {
  return (
    response.ok &&
    (response.headers.get('content-type') || '').startsWith('image/')
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        [...IMAGE_URLS].map(async url => {
          const response = await fetch(url, { cache: 'reload' });
          // A host's SPA fallback can return HTTP 200 HTML for missing assets.
          if (!isImage(response)) throw new Error(`Cannot cache image: ${url}`);
          await cache.put(url, response);
        }),
      );
    })(),
  );
});

// Let updates wait for existing tabs to close before retiring their cache.
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin)
    return;

  // Metro references node_modules; export:web moves those files to deps.
  const assetUrl = url.pathname.replace(
    /^\/assets\/node_modules\//,
    '/assets/deps/',
  );
  if (!IMAGE_URLS.has(assetUrl)) return;

  event.respondWith(
    (async () => {
      // Storage may be unavailable or evicted; keep network loading functional.
      const cache = await caches.open(CACHE_NAME).catch(() => null);
      const cached = await cache?.match(assetUrl).catch(() => null);
      if (cached) return cached;
      const response = await fetch(assetUrl);
      if (cache && isImage(response)) {
        await cache.put(assetUrl, response.clone()).catch(() => {});
      }
      return response;
    })(),
  );
});
