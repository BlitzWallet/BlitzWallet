// Single allow-list for attacker-influenced URLs before they are opened
// (online-listing websites, LNURL LUD-09 successAction URLs). Only https is
// allowed through; javascript:/data:/app-deeplink schemes normalize to '' so
// callers can treat the empty string as "do not open".
const ALLOWED_SCHEMES = new Set(['https:']);

export function getNormalizedWebsiteUrl(website) {
  if (!website || typeof website !== 'string') return '';
  const trimmed = website.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return ALLOWED_SCHEMES.has(url.protocol) ? trimmed : '';
  } catch {
    return `https://${trimmed}`;
  }
}
