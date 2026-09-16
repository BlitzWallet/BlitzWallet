/* eslint-env serviceworker */
/**
 * Kill switch for the legacy Vite web app's Workbox service worker.
 *
 * The legacy app registered a precaching worker at this exact URL (scope `/`)
 * that answers every navigation from its cached index.html. Without a valid
 * JavaScript file here, the browser's update check gets `_redirects`' HTML
 * fallback, rejects it, and keeps serving the legacy app forever.
 *
 * This worker removes the legacy caches, unregisters itself, and reloads open
 * tabs into the current app. It must NEVER touch localStorage or IndexedDB
 * (the legacy `walletKey` still has to be migrated).
 *
 * Keep this file permanently: dormant legacy installs can return at any time.
 */

// Workbox precache (`workbox-precache-v2-*`) and vite-plugin-pwa runtime
// caches only. The current app's `blitz-pwa-images-*` cache must survive.
const LEGACY_CACHE_PREFIXES = ['workbox-', 'vite-pwa'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter(name =>
              LEGACY_CACHE_PREFIXES.some(prefix => name.startsWith(prefix)),
            )
            .map(name => caches.delete(name)),
        );
      } catch (err) {
        // Leftover caches are inert once no worker intercepts fetches.
        console.log('legacy cache purge failed', err);
      }

      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(
        clients.map(client => client.navigate(client.url)),
      );
    })(),
  );
});
