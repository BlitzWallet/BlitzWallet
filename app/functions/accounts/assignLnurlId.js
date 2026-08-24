// Deterministic per-account LNURL id: the shortest lowercase prefix of the
// account's Spark identity pubkey (min 4 hex chars) that isn't already taken in
// the user's registry and isn't a reserved currency suffix. Grows on collision,
// falls back to the full pubkey. The id doubles as the address suffix:
//   {username}-{id}@blitzwalletapp.com
const RESERVED_SUFFIXES = ['d60fbd', 'e40605'];

export function assignLnurlId(pubkey, existingMap = {}) {
  const lower = String(pubkey).toLowerCase();
  for (let len = 4; len <= lower.length; len++) {
    const candidate = lower.slice(0, len);
    if (RESERVED_SUFFIXES.includes(candidate)) continue;
    if (candidate in existingMap) continue;
    return candidate;
  }
  return lower;
}
