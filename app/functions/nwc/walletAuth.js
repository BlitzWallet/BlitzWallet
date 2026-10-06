// NWC-08 client-initiated connections ("nostr+walletauth"). The app generates
// its own key and sends only the public key, so no connection secret is ever
// created or copied. See https://github.com/nostr-wallet-connect/nwc/blob/master/08.md

// NIP-47 method -> Blitz connection permission. get_info is always granted.
const METHOD_PERMISSIONS = {
  make_invoice: 'receivePayments',
  pay_invoice: 'sendPayments',
  get_balance: 'getBalance',
  list_transactions: 'transactionHistory',
  lookup_invoice: 'lookupInvoice',
};

// Blitz budgets always renew; a one-off (`never`) cap can't be enforced, and
// the spec says to decline rather than silently drop a requested limit.
const RENEWAL_PERIODS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const NOSTR_FORM =
  /^nostr\+walletauth(?:\+[a-z0-9-]+)?:(?:\/\/)?([^?]*)\?(.*)$/i;
const HTTPS_FORM =
  /^https:\/\/(?:blitz-wallet\.com|blitzwalletapp\.com|blitzwallet\.app)\/nwc\/auth\/?\?(.*)$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const STATE = /^[0-9a-f]{32,128}$/;
const MAX_RELAYS = 3;
const LINK_EXPIRY_GRACE_MS = 60 * 1000; // phone and app clocks can disagree

const invalid = {
  didWork: false,
  error: 'settings.nwc.authRequest.errors.invalid',
};
const fail = reason => ({
  didWork: false,
  error: `settings.nwc.authRequest.errors.${reason}`,
});

export function isNWCAuthRequestURL(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  return NOSTR_FORM.test(trimmed) || HTTPS_FORM.test(trimmed);
}

const methodList = value => (value || '').split(/\s+/).filter(Boolean);

export function parseNWCAuthRequest(text) {
  if (!isNWCAuthRequestURL(text)) return invalid;
  const trimmed = text.trim();
  const nostr = trimmed.match(NOSTR_FORM);
  let params;
  try {
    params = new URLSearchParams(
      nostr ? nostr[2] : trimmed.match(HTTPS_FORM)[1],
    );
  } catch {
    return invalid;
  }

  const clientPubkey = (
    nostr ? nostr[1] : params.get('pubkey') || ''
  ).toLowerCase();
  const state = (params.get('state') || '').toLowerCase();
  const relays = [...new Set(params.getAll('relay'))];
  if (
    !HEX64.test(clientPubkey) ||
    !STATE.test(state) ||
    !relays.length ||
    relays.length > MAX_RELAYS ||
    !relays.every(r => /^wss:\/\/[^\s]+$/i.test(r))
  ) {
    return invalid;
  }

  // Blitz-specific (not NWC-08): the app stops listening for this pairing at
  // `link_expires_at`, so approving later would create a keyless connection.
  const linkExpiresAt = params.get('link_expires_at');
  if (linkExpiresAt !== null) {
    if (!/^\d+$/.test(linkExpiresAt)) return invalid;
    if (Number(linkExpiresAt) * 1000 + LINK_EXPIRY_GRACE_MS <= Date.now())
      return fail('expired');
  }

  // Spec: grant every required method or decline; never grant unrequested ones.
  const required = methodList(params.get('request_methods')).filter(
    m => m !== 'get_info',
  );
  if (required.some(m => !METHOD_PERMISSIONS[m]))
    return fail('unsupportedMethod');
  const permissions = {};
  for (const m of required) permissions[METHOD_PERMISSIONS[m]] = true;
  const optionalPermissions = [
    ...new Set(
      methodList(params.get('optional_request_methods'))
        .map(m => METHOD_PERMISSIONS[m])
        .filter(p => p && !permissions[p]),
    ),
  ];
  if (!Object.keys(permissions).length && !optionalPermissions.length)
    return invalid;

  // Spec: enforce the requested limit or decline. Rounded down to sats so the
  // enforced budget is never looser than requested.
  const maxAmount = params.get('max_amount');
  const renewal = params.get('renewal_period');
  let budget = null;
  if (maxAmount !== null || renewal !== null) {
    const msat = Number(maxAmount);
    const option = RENEWAL_PERIODS[(renewal || 'never').toLowerCase()];
    if (!/^\d+$/.test(maxAmount || '') || msat < 1000 || !option) {
      return fail('unsupportedBudget');
    }
    budget = { option, amount: Math.floor(msat / 1000) };
  }

  // Client-supplied and unverified: strip control/bidi characters and cap it.
  const name = (params.get('name') || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, 40);

  return {
    didWork: true,
    request: {
      clientPubkey,
      state,
      relays,
      name,
      permissions,
      optionalPermissions,
      budget,
    },
  };
}
