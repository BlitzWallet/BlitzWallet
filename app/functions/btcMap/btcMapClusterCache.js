import { ClusterManager } from './mapClustering';

const CACHE = new Map(); // key → {manager, createdAt, pointsKey}
const MAX_ENTRIES = 3;

// Exact, collision-free fingerprint of a point set. A 32-bit rolling hash of
// (length, id-sequence) collides for ids differing by 2^32, silently serving a
// stale ClusterManager; and aux-provider ids are TEXT, which coerced to NaN and
// disabled the cache. Comparing the id/coordinate sequence as a string is
// unambiguous for both numeric and string ids and catches moves within a bucket.
function pointsKey(points) {
  return JSON.stringify(
    points.map(p => [p.source || 'btcmap', p.id, p.lat, p.lon]),
  );
}

function evictIfNeeded() {
  if (CACHE.size <= MAX_ENTRIES) return;
  let oldestKey = null;
  let oldest = Infinity;
  for (const [key, entry] of CACHE.entries()) {
    if (entry.createdAt < oldest) {
      oldest = entry.createdAt;
      oldestKey = key;
    }
  }
  if (oldestKey) CACHE.delete(oldestKey);
}

export function clearBTCMapClusterCache() {
  CACHE.clear();
}

export function getOrBuildBTCMapClusterManager(cacheKey, points, options) {
  const key = pointsKey(points);
  const existing = CACHE.get(cacheKey);
  if (existing && existing.pointsKey === key && existing.manager.isLoaded()) {
    return existing.manager;
  }

  const t0 = Date.now();
  const manager = new ClusterManager(options);
  manager.load(points);
  evictIfNeeded();
  CACHE.set(cacheKey, {
    manager,
    createdAt: Date.now(),
    pointsKey: key,
  });

  const duration = Date.now() - t0;
  if (duration > 50) {
    console.warn(
      `[perf] cluster.build(${points.length} pts) ${duration}ms — cache miss "${cacheKey}"`,
    );
  }
  return manager;
}
