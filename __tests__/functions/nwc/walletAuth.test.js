// NWC-08 (client-initiated connection) request parsing.
//
// Ways this can fail, each covered below:
//  - a non-pairing link (payment, contact, NWC connection string) is treated as one
//  - a malformed client pubkey or a weak/missing `state` is accepted (spoofable pairing)
//  - a non-wss or missing relay is accepted (the wallet would publish anywhere)
//  - a required method Blitz can't grant is silently dropped (spec: grant all or decline)
//  - a method the client did not request gets granted (spec: MUST NOT)
//  - `max_amount` is accepted with a renewal period Blitz can't enforce (spec: enforce or decline)
//  - `max_amount` rounds up when converted to sats (budget looser than requested)
//  - a hostile app name (control chars, very long) reaches the approval screen
//  - the https app-link form and the nostr+walletauth forms disagree
//  - an expired `link_expires_at` is approved (the app no longer holds the key)

import {
  isNWCAuthRequestURL,
  parseNWCAuthRequest,
} from '../../../app/functions/nwc/walletAuth';

const PK = 'b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4';
const STATE = '9f2c4a00112233445566778899aabbcc';
const RELAY = 'wss://relay.getalbypro.com/blitz';
const base = (extra = '') =>
  `nostr+walletauth://${PK}?relay=${encodeURIComponent(
    RELAY,
  )}&state=${STATE}&request_methods=get_balance%20make_invoice${extra}`;

describe('isNWCAuthRequestURL', () => {
  test.each([
    base(),
    base().replace('nostr+walletauth://', 'NOSTR+WALLETAUTH:'),
    base().replace('nostr+walletauth', 'nostr+walletauth+blitz'),
    `https://blitzwallet.app/nwc/auth?pubkey=${PK}&state=${STATE}`,
    `https://blitz-wallet.com/nwc/auth?pubkey=${PK}`,
  ])('recognizes %s', url => expect(isNWCAuthRequestURL(url)).toBe(true));

  test.each([
    'lightning:lnbc1...',
    `nostr+walletconnect://${PK}?relay=x&secret=y`,
    'https://blitzwallet.app/u/blake',
    'https://evil.example/nwc/auth?pubkey=x',
    'https://blitzwallet.app.evil.example/nwc/auth',
    '',
    null,
  ])('ignores %s', url => expect(isNWCAuthRequestURL(url)).toBe(false));
});

describe('parseNWCAuthRequest', () => {
  test('parses a full request', () => {
    const r = parseNWCAuthRequest(
      base(
        '%20get_info&optional_request_methods=pay_invoice%20lookup_invoice&name=Telegram%20Bot&max_amount=100000000&renewal_period=daily',
      ),
    );
    expect(r.didWork).toBe(true);
    expect(r.request).toEqual({
      clientPubkey: PK,
      state: STATE,
      relays: [RELAY],
      name: 'Telegram Bot',
      permissions: { getBalance: true, receivePayments: true },
      optionalPermissions: ['sendPayments', 'lookupInvoice'],
      budget: { option: 'Daily', amount: 100000 },
    });
  });

  test('https app-link form matches the nostr form', () => {
    const https = `https://blitzwallet.app/nwc/auth?pubkey=${PK}&relay=${encodeURIComponent(
      RELAY,
    )}&state=${STATE}&request_methods=get_balance%20make_invoice`;
    expect(parseNWCAuthRequest(https)).toEqual(parseNWCAuthRequest(base()));
  });

  test('normalizes uppercase hex', () => {
    const r = parseNWCAuthRequest(
      base().replace(PK, PK.toUpperCase()).replace(STATE, STATE.toUpperCase()),
    );
    expect(r.request.clientPubkey).toBe(PK);
    expect(r.request.state).toBe(STATE);
  });

  test.each([
    ['bad pubkey', base().replace(PK, 'abc')],
    ['missing state', base().replace(`&state=${STATE}`, '')],
    ['short state (<128 bits)', base().replace(STATE, 'abcd1234')],
    ['non-hex state', base().replace(STATE, 'z'.repeat(32))],
    ['missing relay', base().replace(/relay=[^&]+&/, '')],
    [
      'non-wss relay',
      base().replace(encodeURIComponent(RELAY), 'ws%3A%2F%2F10.0.0.1'),
    ],
    [
      'too many relays',
      base(
        '&relay=wss://a.example&relay=wss://b.example&relay=wss://c.example',
      ),
    ],
    ['not a pairing link', 'lightning:lnbc1'],
  ])('rejects %s as invalid', (_, url) => {
    expect(parseNWCAuthRequest(url)).toEqual({
      didWork: false,
      error: 'settings.nwc.authRequest.errors.invalid',
    });
  });

  test('declines a required method Blitz cannot grant', () => {
    expect(parseNWCAuthRequest(base('%20pay_keysend'))).toEqual({
      didWork: false,
      error: 'settings.nwc.authRequest.errors.unsupportedMethod',
    });
  });

  test('drops unsupported optional methods instead of declining', () => {
    const r = parseNWCAuthRequest(
      base('&optional_request_methods=pay_keysend%20pay_invoice'),
    );
    expect(r.request.optionalPermissions).toEqual(['sendPayments']);
  });

  test('declines a request that asks for nothing grantable', () => {
    const url = base().replace(
      'request_methods=get_balance%20make_invoice',
      'request_methods=get_info',
    );
    expect(parseNWCAuthRequest(url).error).toBe(
      'settings.nwc.authRequest.errors.invalid',
    );
  });

  test('never grants a method that was not requested', () => {
    const r = parseNWCAuthRequest(base());
    expect(r.request.permissions).toEqual({
      getBalance: true,
      receivePayments: true,
    });
    expect(r.request.optionalPermissions).toEqual([]);
  });

  test.each([
    ['never', '&max_amount=5000&renewal_period=never'],
    ['implicit never', '&max_amount=5000'],
    ['unknown period', '&max_amount=5000&renewal_period=hourly'],
    ['period without amount', '&renewal_period=daily'],
    ['zero amount', '&max_amount=0&renewal_period=daily'],
    ['sub-sat amount', '&max_amount=999&renewal_period=daily'],
    ['non-integer amount', '&max_amount=12.5&renewal_period=daily'],
  ])('declines budgets Blitz cannot enforce: %s', (_, extra) => {
    expect(parseNWCAuthRequest(base(extra)).error).toBe(
      'settings.nwc.authRequest.errors.unsupportedBudget',
    );
  });

  test('rounds max_amount down to whole sats', () => {
    const r = parseNWCAuthRequest(
      base('&max_amount=1999&renewal_period=weekly'),
    );
    expect(r.request.budget).toEqual({ option: 'Weekly', amount: 1 });
  });

  test('no budget requested means no budget', () => {
    expect(parseNWCAuthRequest(base()).request.budget).toBeNull();
  });

  test('sanitizes the app name', () => {
    const r = parseNWCAuthRequest(
      base(
        `&name=${encodeURIComponent('Bad\u202e\u0000Name' + 'x'.repeat(80))}`,
      ),
    );
    expect(r.request.name).toBe('BadName' + 'x'.repeat(33));
    expect(parseNWCAuthRequest(base()).request.name).toBe('');
  });

  describe('link_expires_at', () => {
    const at = offsetMs =>
      `&link_expires_at=${Math.floor((Date.now() + offsetMs) / 1000)}`;

    test('accepts a link that has not expired', () => {
      expect(parseNWCAuthRequest(base(at(10 * 60 * 1000))).didWork).toBe(true);
    });

    test('allows a little clock skew', () => {
      expect(parseNWCAuthRequest(base(at(-30 * 1000))).didWork).toBe(true);
    });

    test('declines an expired link', () => {
      expect(parseNWCAuthRequest(base(at(-5 * 60 * 1000)))).toEqual({
        didWork: false,
        error: 'settings.nwc.authRequest.errors.expired',
      });
    });

    test('rejects a malformed value', () => {
      expect(parseNWCAuthRequest(base('&link_expires_at=soon')).didWork).toBe(
        false,
      );
    });
  });
});
