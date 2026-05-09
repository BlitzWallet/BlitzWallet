import { ClusterManager } from './mapClustering';

const CACHE = new Map(); // key → {manager, createdAt, pointsHash}
const MAX_ENTRIES = 3;

function hashPoints(points) {
  let h = points.length;
  for (const p of points) h = (h * 31 + p.id) >>> 0;
  return h;
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
  const hash = hashPoints(points);
  const existing = CACHE.get(cacheKey);
  if (existing && existing.pointsHash === hash && existing.manager.isLoaded()) {
    return existing.manager;
  }

  const t0 = Date.now();
  const manager = new ClusterManager(options);
  manager.load(points);
  evictIfNeeded();
  CACHE.set(cacheKey, {
    manager,
    createdAt: Date.now(),
    pointsHash: hash,
  });

  const duration = Date.now() - t0;
  if (duration > 50) {
    console.warn(
      `[perf] cluster.build(${points.length} pts) ${duration}ms — cache miss "${cacheKey}"`,
    );
  }
  return manager;
}
