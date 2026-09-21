/* eslint-env browser */
// User-approved PWA updates. public/service-worker.js serves the release this
// module marks active; a deploy only publishes /release.json. See the worker's
// header comment for the full lifecycle.

const APP_CACHE_PREFIX = 'blitz-app-';
const META_CACHE = 'blitz-meta';
const ACTIVE_KEY = '/__active-release';
const INSTALLING_KEY = '/__installing-release';
const CHECK_TIMEOUT_MS = 3000;

let pendingUpdate = null;

const jsonResponse = value =>
  new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
  });

async function sha256Hex(response) {
  const buffer = await response.clone().arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

// x.y.z; a missing part counts as 0.
export function compareVersions(a = '0', b = '0') {
  const left = String(a).split('.').map(Number);
  const right = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

async function fetchRelease() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch('/release.json', {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves { version, mandatory } when the deployed release differs from the
 * installed one, else null. Offline or failed checks resolve null, so the
 * installed release always opens: mandatory is enforced only online.
 */
export async function checkForWebUpdate() {
  if (__DEV__ || !('serviceWorker' in navigator) || !globalThis.caches) {
    return null;
  }
  try {
    const release = await fetchRelease();
    if (!release?.id) return null;
    const active = await (await caches.open(META_CACHE)).match(ACTIVE_KEY);
    if (!active) {
      // First install (new visitor, cleared storage, or the previous worker):
      // this page came from the network, so it already runs the latest deploy.
      // Cache it quietly once the worker is ready; no prompt, no reload.
      navigator.serviceWorker.ready
        .then(() => installRelease(release))
        .catch(error => console.log('PWA release install failed', error));
      return null;
    }
    const installed = await active.json();
    if (installed.id === release.id) return null;
    pendingUpdate = {
      release,
      version: release.appVersion,
      mandatory:
        compareVersions(installed.appVersion, release.minAppVersion) < 0,
    };
    return pendingUpdate;
  } catch (error) {
    console.log('PWA update check failed', error);
    return null;
  }
}

export function getPendingWebUpdate() {
  return pendingUpdate;
}

/**
 * Downloads every file of `release` into its own cache, verified by hash, and
 * only then marks it active. On failure the active release is untouched.
 */
export async function installRelease(release, onProgress) {
  // Every file must come from this origin ('//host' and '/\host' resolve away).
  if (
    Object.keys(release.files).some(
      path => new URL(path, location.origin).origin !== location.origin,
    )
  ) {
    throw new Error('Invalid release manifest');
  }
  const name = APP_CACHE_PREFIX + release.id;
  const meta = await caches.open(META_CACHE);
  // Keeps the worker from pruning this cache while it fills.
  await meta.put(INSTALLING_KEY, jsonResponse({ id: release.id }));
  try {
    const target = await caches.open(name);
    const others = (await caches.keys()).filter(
      other => other.startsWith(APP_CACHE_PREFIX) && other !== name,
    );
    const paths = Object.keys(release.files);
    for (const [index, path] of paths.entries()) {
      const expected = release.files[path];
      let response = null;
      // Unchanged files are reused from an installed release.
      for (const other of others) {
        const cached = await (await caches.open(other)).match(path);
        if (cached && (await sha256Hex(cached)) === expected) {
          response = cached;
          break;
        }
      }
      if (!response) {
        // The query keeps the worker out of the way and skips stale CDN copies.
        const fetched = await fetch(
          `${path}?blitz-release=${encodeURIComponent(release.id)}`,
          { cache: 'no-store' },
        );
        // Rejects the host's SPA fallback, redirects and newer deploys' files.
        if (
          !fetched.ok ||
          fetched.redirected ||
          (await sha256Hex(fetched)) !== expected
        ) {
          throw new Error(`Not the release's file: ${path}`);
        }
        response = fetched;
      }
      await target.put(path, response);
      onProgress?.((index + 1) / paths.length);
    }
    // The worker uses these hashes to verify a file if the browser evicts only
    // part of an installed cache after a newer release reaches the host.
    await target.put('/__release-manifest', jsonResponse(release.files));
    await meta.put(
      ACTIVE_KEY,
      jsonResponse({ id: release.id, appVersion: release.appVersion }),
    );
  } catch (error) {
    await caches.delete(name);
    throw error;
  } finally {
    await meta.delete(INSTALLING_KEY);
  }
}

export async function applyWebUpdate(onProgress) {
  await installRelease(pendingUpdate.release, onProgress);
  // The reload's navigation is served the new release.
  window.location.reload();
}
