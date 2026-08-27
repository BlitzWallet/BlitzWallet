import { ClusterManager } from './mapClustering';

const CACHE = new Map(); // cacheKey → {manager, createdAt}
const MAX_ENTRIES = 3;

// Staleness is handled entirely by the caller: the cacheKey must embed the
// btcMapContext dataVersion so a sync write invalidates every entry (the
// screen re-runs buildClustersForViewport whenever dataVersion increments).

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
  const existing = CACHE.get(cacheKey);
  if (existing && existing.manager.isLoaded()) {
    return existing.manager;
  }

  const t0 = Date.now();
  const manager = new ClusterManager(options);
  manager.load(points);
  evictIfNeeded();
  CACHE.set(cacheKey, {
    manager,
    createdAt: Date.now(),
  });

  const duration = Date.now() - t0;
  if (duration > 50) {
    console.warn(
      `[perf] cluster.build(${points.length} pts) ${duration}ms — cache miss "${cacheKey}"`,
    );
  }
  return manager;
}
