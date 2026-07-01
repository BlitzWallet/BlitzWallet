// Distance helpers for the BTC Map list view.

const EARTH_RADIUS_M = 6371000;
const toRad = deg => (deg * Math.PI) / 180;

// Imperial regions that display miles by default.
const IMPERIAL_REGIONS = new Set(['US', 'GB', 'MM', 'LR']);

let cachedAutoUnit = null;
function resolveAutoUnit() {
  if (cachedAutoUnit) return cachedAutoUnit;
  let region = '';
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    region = locale.split('-')[1]?.toUpperCase() ?? '';
  } catch (_) {}
  cachedAutoUnit = IMPERIAL_REGIONS.has(region) ? 'mi' : 'km';
  return cachedAutoUnit;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function formatDistance(meters, unit = 'auto') {
  if (meters == null || !Number.isFinite(meters)) return '';
  const resolved = unit === 'auto' ? resolveAutoUnit() : unit;
  if (resolved === 'mi') {
    const miles = meters / 1609.344;
    return miles < 0.1
      ? `${Math.round(meters * 3.28084)} ft`
      : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  const km = meters / 1000;
  return km < 0.1
    ? `${Math.round(meters)} m`
    : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
