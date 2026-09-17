/* eslint-env serviceworker */
/**
 * Offline app shell for the installed PWA. scripts/generate-service-worker.js
 * fills in every exported file with its SHA-256, so a cold start needs no
 * network for app code, like the native app whose code ships in the binary.
 *
 * This URL (/service-worker.js) must never change or be removed. To retire the
 * worker, deploy a self-unregistering script at the same URL (see public/sw.js).
 */

const CACHE_PREFIX = 'blitz-app-';
const CACHE_NAME = CACHE_PREFIX + '__CACHE_VERSION__';
// Caches of the images-only worker this one replaced.
const IMAGE_CACHE_PREFIX = 'blitz-pwa-images-';
const SHELL = '/';
// { requestPath: sha256 hex } for every exported file.
const PRECACHE = /* __PRECACHE_MANIFEST__ */ {};

async function sha256Hex(buffer) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

// Only byte-for-byte build files are cached. That rejects the host's SPA
// fallback for a missing file, files from a newer deploy, stale CDN copies,
// and redirects (a redirected response can't answer a navigation).
async function isBuildFile(path, response) {
  if (!response.ok || response.redirected) return false;
  const buffer = await response.clone().arrayBuffer();
  return (await sha256Hex(buffer)) === PRECACHE[path];
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // One file at a time keeps memory near two copies of the largest file.
      // The shell goes first: if the host serves different HTML, fail before
      // downloading the bundles.
      const paths = Object.keys(PRECACHE).filter(path => path !== SHELL);
      for (const path of [SHELL, ...paths]) {
        const response = await fetch(path, { cache: 'no-cache' });
        if (!(await isBuildFile(path, response))) {
          throw new Error(`Not the build's file: ${path}`);
        }
        await cache.put(path, response);
      }
    })(),
  );
});

// No skipWaiting: a new version takes over once no Blitz window is open, so
// running pages never switch code mid-session.
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            name =>
              name !== CACHE_NAME &&
              (name.startsWith(CACHE_PREFIX) ||
                name.startsWith(IMAGE_CACHE_PREFIX)),
          )
          .map(name => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Metro references node_modules; export:web moves those files to deps.
  const path = url.pathname.replace(
    /^\/assets\/node_modules\//,
    '/assets/deps/',
  );
  let key = null;
  if (Object.hasOwn(PRECACHE, path)) key = path;
  else if (request.mode === 'navigate') key = SHELL; // SPA routes and deep links
  if (!key) return;
  event.respondWith(respondFromCache(key));
});

async function respondFromCache(path) {
  // Storage may be unavailable or evicted; keep network loading working.
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  const cached = await cache?.match(path).catch(() => null);
  if (cached) return cached;
  const response = await fetch(path);
  if (cache && (await isBuildFile(path, response).catch(() => false))) {
    await cache.put(path, response.clone()).catch(() => {});
  }
  return response;
}
