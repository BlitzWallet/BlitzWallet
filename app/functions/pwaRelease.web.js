/* eslint-env browser */
// User-approved PWA updates. public/service-worker.js serves the release this
// module marks active; a deploy only publishes /release.json. See the worker's
// header comment for the full lifecycle.
import { getReleaseSigningPubkeyHex } from './pwaReleaseSigningKey';

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

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// The exact bytes covered by the offline Ed25519 signature. Keep in sync with
// scripts/generate-release.js and public/service-worker.js.
function canonicalReleaseString(release, sortedFiles) {
  return JSON.stringify({
    id: release.id,
    appVersion: release.appVersion,
    minAppVersion: release.minAppVersion,
    files: sortedFiles,
  });
}

let verifyKeyPromise = null;
function getVerifyKey() {
  if (!verifyKeyPromise) {
    verifyKeyPromise = (async () => {
      const raw = getReleaseSigningPubkeyHex();
      if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
        throw new Error('Missing release signing public key');
      }
      return crypto.subtle.importKey(
        'raw',
        hexToBytes(raw),
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
    })();
  }
  return verifyKeyPromise;
}

// W-07: release.json is untrusted host input. Only a release whose file list
// the offline key signed may be installed or activated; anything else (a
// poisoned pointer, a planted cache, a host-only push) is refused.
export async function verifyReleaseSignature(release) {
  try {
    if (
      !release ||
      !/^[0-9a-fA-F]{64}$/.test(release.id ?? '') ||
      !release.files ||
      typeof release.files !== 'object' ||
      typeof release.appVersion !== 'string' ||
      typeof release.minAppVersion !== 'string' ||
      !/^[0-9a-fA-F]{128}$/.test(release.signature ?? '')
    ) {
      return false;
    }
    const sorted = {};
    for (const key of Object.keys(release.files).sort()) {
      sorted[key] = release.files[key];
    }
    return await crypto.subtle.verify(
      'Ed25519',
      await getVerifyKey(),
      hexToBytes(release.signature),
      new TextEncoder().encode(canonicalReleaseString(release, sorted)),
    );
  } catch {
    return false;
  }
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
    const release = await response.json();
    // Fail closed: an unsigned or mis-signed release is indistinguishable
    // from a host-only push, so it is never offered or installed.
    if (!(await verifyReleaseSignature(release))) {
      console.log('PWA release signature invalid');
      return null;
    }
    return release;
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
  if (!(await verifyReleaseSignature(release))) {
    throw new Error('Invalid release signature');
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
      const existing = await target.match(path);
      if (existing && (await sha256Hex(existing)) === expected) {
        onProgress?.((index + 1) / paths.length);
        continue;
      }
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
    // The worker trusts these hashes only through the manifest signature
    // it re-verifies the signature and every file's hash before
    // serving, so a same-origin writer cannot persist poisoned bytes.
    await target.put(
      '/__release-manifest',
      jsonResponse({
        id: release.id,
        appVersion: release.appVersion,
        minAppVersion: release.minAppVersion,
        files: release.files,
        signature: release.signature,
      }),
    );
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
