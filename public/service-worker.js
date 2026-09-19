/* eslint-env serviceworker */
/**
 * Offline app shell for the installed PWA, with user-approved updates.
 *
 * This file is identical across deploys, so a deploy never makes the browser
 * install a new worker. Each deploy publishes /release.json instead, and the
 * page (app/functions/pwaRelease.web.js) downloads a release into
 * `blitz-app-<id>` and marks it active only when the user updates. Editing
 * this file still installs automatically once no Blitz window is open; that
 * never changes which release is active.
 *
 * Every window keeps the release it loaded with until it navigates, so an
 * update in one window never feeds another window files from a different
 * release. Old release caches are deleted once no window uses them.
 *
 * Browsers may evict this origin's storage. The next load then comes from the
 * network (the latest deploy) and becomes the active release, so no install is
 * guaranteed to stay on an old version forever.
 *
 * This URL (/service-worker.js) must never change or be removed. To retire the
 * worker, deploy a self-unregistering script at the same URL (see public/sw.js).
 */

const APP_CACHE_PREFIX = 'blitz-app-';
// Caches of the images-only worker the first app shell worker replaced.
const IMAGE_CACHE_PREFIX = 'blitz-pwa-images-';
const META_CACHE = 'blitz-meta';
const ACTIVE_KEY = '/__active-release';
const INSTALLING_KEY = '/__installing-release';
const CLIENTS_KEY = '/__client-releases';
const MANIFEST_KEY = '/__release-manifest';
const SHELL = '/';

async function matchesHash(response, expected) {
  if (!response.ok || response.redirected) return false;
  const bytes = await response.clone().arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return actual === expected;
}

async function readMeta(key) {
  const response = await (await caches.open(META_CACHE)).match(key);
  return response ? response.json() : null;
}

async function writeMeta(key, value) {
  const meta = await caches.open(META_CACHE);
  await meta.put(
    key,
    new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

// { clientId: releaseId }, loaded once per worker lifetime and written through.
let clientReleases = null;
async function getClientReleases() {
  if (!clientReleases) {
    clientReleases = readMeta(CLIENTS_KEY).then(map => map ?? {});
  }
  return clientReleases;
}

async function releaseForRequest(event) {
  const { request, clientId, resultingClientId } = event;
  const map = await getClientReleases();
  const isNavigation = request.mode === 'navigate';
  const startsClient =
    isNavigation ||
    request.destination === 'worker' ||
    request.destination === 'sharedworker';

  // A navigation loads the active release; anything else, including a worker
  // started by a page, stays on the release of the client that asked for it.
  const id = isNavigation
    ? (await readMeta(ACTIVE_KEY))?.id
    : map[clientId] ?? (await readMeta(ACTIVE_KEY))?.id;
  if (
    startsClient &&
    resultingClientId &&
    id &&
    map[resultingClientId] !== id
  ) {
    map[resultingClientId] = id;
    await writeMeta(CLIENTS_KEY, map);
  }
  return id;
}

// The active release can no longer produce a working page. Forget it (and the
// pin of the navigation that hit the failure) so the next load comes from the
// network and the page installs it as a fresh release. The broken cache stays:
// its intact files are reused by that install, and it is pruned once nothing
// points at it. Releases other windows are pinned to are left alone.
async function abandonRelease(event, id) {
  try {
    const active = await readMeta(ACTIVE_KEY);
    if (active?.id === id) {
      await (await caches.open(META_CACHE)).delete(ACTIVE_KEY);
    }
    const map = await getClientReleases();
    const pinned = event.resultingClientId;
    if (pinned && map[pinned] === id) {
      delete map[pinned];
      await writeMeta(CLIENTS_KEY, map);
    }
  } catch (error) {
    console.log('release cleanup failed', error);
  }
}

// A page whose script failed can't reload itself, and a standalone PWA has no
// address bar to do it with. Once per window: the retry loads from the network,
// and a second navigate would fight it.
const reloading = new Set();
async function reloadClient(clientId) {
  if (!clientId || reloading.has(clientId)) return;
  reloading.add(clientId);
  try {
    const client = await self.clients.get(clientId);
    await client?.navigate(client.url);
  } catch (error) {
    console.log('reload failed', error);
  }
}

async function respond(event, path) {
  let expected = null;
  let cache = null;
  let key = path;
  let id = null;
  try {
    id = await releaseForRequest(event);
    if (id && (await caches.has(APP_CACHE_PREFIX + id))) {
      cache = await caches.open(APP_CACHE_PREFIX + id);
      const cached =
        (await cache.match(path)) ??
        (event.request.mode === 'navigate'
          ? await cache.match(SHELL) // SPA routes and deep links
          : undefined);
      if (cached) return cached;
      const manifest = await cache.match(MANIFEST_KEY);
      if (manifest) {
        const files = await manifest.json();
        if (files[path]) expected = files[path];
        else if (event.request.mode === 'navigate') {
          key = SHELL;
          expected = files[SHELL];
        }
      }
    }
  } catch (error) {
    // Storage may be unavailable or evicted; keep network loading working.
    console.log('release cache unavailable', error);
  }
  if (expected) {
    let fromHost = null;
    try {
      const response = await fetch(key, { cache: 'no-store' });
      if (await matchesHash(response, expected)) {
        try {
          await cache.put(key, response.clone());
        } catch (error) {
          // Out of quota: the bytes are still this release's, so serve them.
          console.log('release file not stored', error);
        }
        return response;
      }
      fromHost = response;
    } catch (error) {
      console.log('release file unavailable', error);
    }
    // A newer deploy's file must never run in an older page.
    // Offline, or the host is down: keep the release, it may still repair.
    if (!fromHost?.ok) return Response.error();
    // The host has moved on, so this file is gone for good and every reload
    // would replay the same broken boot. Drop the release and load the page
    // from the network instead.
    await abandonRelease(event, id);
    if (event.request.mode === 'navigate') return fromHost;
    reloadClient(event.clientId);
    return Response.error();
  }
  return fetch(event.request);
}

// Forget closed clients, then delete release caches nobody can reach. A client
// still being navigated to may not be listed yet, so its id is passed in.
async function pruneReleases(newClientId) {
  const active = await readMeta(ACTIVE_KEY);
  // Nothing installed yet: an older worker's cache is still the page's source
  // of reusable files for the first install.
  if (!active) return;
  const map = await getClientReleases();
  const live = new Set(
    (
      await self.clients.matchAll({ includeUncontrolled: true, type: 'all' })
    ).map(client => client.id),
  );
  let changed = false;
  for (const clientId of Object.keys(map)) {
    if (!live.has(clientId) && clientId !== newClientId) {
      delete map[clientId];
      changed = true;
    }
  }
  if (changed) await writeMeta(CLIENTS_KEY, map);

  const keep = new Set([active.id, ...Object.values(map)]);
  const installing = await readMeta(INSTALLING_KEY);
  if (installing) keep.add(installing.id);
  const names = await caches.keys();
  await Promise.all(
    names
      .filter(
        name =>
          name.startsWith(APP_CACHE_PREFIX) &&
          !keep.has(name.slice(APP_CACHE_PREFIX.length)),
      )
      .map(name => caches.delete(name)),
  );
}

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => name.startsWith(IMAGE_CACHE_PREFIX))
          .map(name => caches.delete(name)),
      );
      await pruneReleases();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Release checks and update downloads must reach the network.
  if (
    url.pathname === '/release.json' ||
    url.searchParams.has('blitz-release')
  ) {
    return;
  }

  // Metro references node_modules; export:web moves those files to deps.
  const path = url.pathname.replace(
    /^\/assets\/node_modules\//,
    '/assets/deps/',
  );
  event.respondWith(respond(event, path));
  if (request.mode === 'navigate') {
    event.waitUntil(pruneReleases(event.resultingClientId).catch(() => {}));
  }
});
