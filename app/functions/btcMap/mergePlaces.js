// Collapse places that the same physical merchant appears as across sources
// (BTC Map + the aux directories). Ported from Buho_go's places.js mergePlaces.
//
// Runs in-memory on a viewport result set (small), so an O(n) Map pass is cheap.
// Earlier sources win conflicts; the winner backfills any fields it is missing
// from lower-priority duplicates so a shared pin keeps the richest record.

const SOURCE_PRIORITY = ['btcmap', 'bitcoinjungle', 'moneybadger'];
const SOURCE_RANK = Object.fromEntries(SOURCE_PRIORITY.map((s, i) => [s, i]));

// Round to 4 decimals (~11m) so coordinates that differ slightly between
// sources still collide, combined with a normalized name token.
function dedupeKey(p) {
  const lat = Math.round(p.lat * 10000) / 10000;
  const lon = Math.round(p.lon * 10000) / 10000;
  const name = (p.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  return `${lat},${lon}|${name}`;
}

const BACKFILL_FIELDS = ['name', 'icon', 'category'];

function rankOf(source) {
  const r = SOURCE_RANK[source];
  return r === undefined ? SOURCE_PRIORITY.length : r;
}

export function dedupeMerge(rows) {
  const map = new Map();
  for (const p of rows) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const key = dedupeKey(p);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...p });
      continue;
    }
    if (rankOf(p.source) < rankOf(existing.source)) {
      const winner = { ...p };
      for (const f of BACKFILL_FIELDS) {
        if (!winner[f] && existing[f]) winner[f] = existing[f];
      }
      map.set(key, winner);
    } else {
      for (const f of BACKFILL_FIELDS) {
        if (!existing[f] && p[f]) existing[f] = p[f];
      }
    }
  }
  return [...map.values()];
}
