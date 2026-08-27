import { getAuth, getIdToken } from '@react-native-firebase/auth';

// The mobile→proxy base URL. Not secret: the proxy is a public HTTPS endpoint
// whose per-IP + per-uid rate limiters are the security control. Single source
// of truth for every proxy fetch (db/index.js and btcMapContext.js each used
// to duplicate this constant). A plain module constant (not app/constants) so
// lightweight consumers can load this module without pulling the
// constants→icons→assets graph.
export const BLITZ_PROXY_URL = 'https://proxy.blitz-wallet.com';

/**
 * fetch() against the Blitz proxy with the signed-in user's Firebase ID token
 * attached as a Bearer Authorization header — the proxy verifies the token and
 * applies its per-uid rate limits. `path` is appended to BLITZ_PROXY_URL
 * (leading slash included by the caller, e.g. '/btcmap/sync'); any other fetch
 * options (method, body, extra headers) pass through untouched. Rejects with
 * 'not_authenticated' when no user is signed in, and returns the raw Response
 * so each caller keeps its own status/json handling.
 */
export async function blitzProxyFetch(path, options = {}) {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('not_authenticated');
  const token = await getIdToken(currentUser);
  return fetch(`${BLITZ_PROXY_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
