import getPhonePaymentAddress, {
  getPhonePaymentCandidates,
  isPhonePaymentNumber,
  getPhonePaymentCountry,
  canonicalizePhonePaymentAddress,
  getPhonePostProvider,
  getPhonePaymentDisplay,
  fetchPhonePaymentInvoice,
  PROVIDER_COUNTRY_CURRENCY,
} from '../../../app/functions/sendBitcoin/getPhonePaymentAddress';
import getLNURLDetails from '../../../app/functions/lnurl/getLNURLDetails';
import { decode } from '../../../app/functions/decodeBolt11';

// getPhonePaymentAddress() probes the LNURL endpoint to disambiguate numbers
// that are valid in more than one supported country. Mock it so the suite is
// deterministic and never hits the network.
jest.mock('../../../app/functions/lnurl/getLNURLDetails', () => jest.fn());

const KE = '254717252303@bitcoin.co.ke';
const KE_OVERLAP = '254751234567@bitcoin.co.ke';
const ZM_OVERLAP = '0751234567@bitzed.xyz';

beforeEach(() => {
  getLNURLDetails.mockReset();
});

describe('getPhonePaymentCandidates', () => {
  it('maps a Kenyan national mobile number to only the Kenyan provider', () => {
    // Regression: a leading-07 Kenyan mobile must not also validate as a
    // Zambian/Philippine number under loose metadata.
    expect(getPhonePaymentCandidates('0717252303')).toEqual([KE]);
  });

  it('maps the international (+254) form to the Kenyan provider', () => {
    expect(getPhonePaymentCandidates('+254717252303')).toEqual([KE]);
  });

  it('maps the bare-country-code (254) form to the Kenyan provider', () => {
    expect(getPhonePaymentCandidates('254717252303')).toEqual([KE]);
  });

  it('maps a Zambian national mobile number to only the Zambian provider', () => {
    expect(getPhonePaymentCandidates('0977123456')).toEqual([
      '0977123456@bitzed.xyz',
    ]);
  });

  it('maps a Philippine national mobile number to only the GCash provider', () => {
    expect(getPhonePaymentCandidates('09171234567')).toEqual([
      '639171234567@zapremit.com',
    ]);
  });

  it('returns both KE and ZM (KE first) for an overlapping 075 number', () => {
    expect(getPhonePaymentCandidates('0751234567')).toEqual([
      KE_OVERLAP,
      ZM_OVERLAP,
    ]);
  });

  it('returns both KE and ZM (KE first) for an overlapping 077 number', () => {
    expect(getPhonePaymentCandidates('0771234567')).toEqual([
      '254771234567@bitcoin.co.ke',
      '0771234567@bitzed.xyz',
    ]);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(getPhonePaymentCandidates('  0717252303  ')).toEqual([KE]);
  });

  it('returns [] for an empty string', () => {
    expect(getPhonePaymentCandidates('')).toEqual([]);
  });

  it('returns [] for whitespace only', () => {
    expect(getPhonePaymentCandidates('   ')).toEqual([]);
  });

  it('returns [] for null/undefined', () => {
    expect(getPhonePaymentCandidates(null)).toEqual([]);
    expect(getPhonePaymentCandidates(undefined)).toEqual([]);
  });

  it('returns [] for non-numeric text', () => {
    expect(getPhonePaymentCandidates('hello world')).toEqual([]);
  });

  it('rejects a lightning-address input (contains @)', () => {
    expect(getPhonePaymentCandidates('254717252303@attacker.example')).toEqual(
      [],
    );
    expect(getPhonePaymentCandidates('254717252303@bitcoin.co.ke')).toEqual([]);
    expect(getPhonePaymentCandidates('0977123456@bitzed.xyz')).toEqual([]);
  });

  it('returns [] for a valid number from an unsupported country', () => {
    // Valid US number, but the US is not a phone-payment provider.
    expect(getPhonePaymentCandidates('+12025550123')).toEqual([]);
  });
});

describe('isPhonePaymentNumber', () => {
  it('is true for KE/ZM/PH numbers', () => {
    expect(isPhonePaymentNumber('0717252303')).toBe(true);
    expect(isPhonePaymentNumber('0977123456')).toBe(true);
    expect(isPhonePaymentNumber('09171234567')).toBe(true);
  });

  it('is false for empty, garbage and unsupported numbers', () => {
    expect(isPhonePaymentNumber('')).toBe(false);
    expect(isPhonePaymentNumber('hello')).toBe(false);
    expect(isPhonePaymentNumber('+12025550123')).toBe(false);
  });

  it('is false for a lightning address (contains @)', () => {
    expect(isPhonePaymentNumber('254717252303@attacker.example')).toBe(false);
    expect(isPhonePaymentNumber('254717252303@bitcoin.co.ke')).toBe(false);
  });
});

describe('getPhonePaymentCountry', () => {
  it('maps each provider domain to its country', () => {
    expect(getPhonePaymentCountry('254717252303@bitcoin.co.ke')).toBe('KE');
    expect(getPhonePaymentCountry('0977123456@bitzed.xyz')).toBe('ZM');
    expect(getPhonePaymentCountry('639171234567@zapremit.com')).toBe('PH');
  });

  it('matches the domain case-insensitively', () => {
    expect(getPhonePaymentCountry('254717252303@BITCOIN.CO.KE')).toBe('KE');
  });

  it('returns null for a non-provider domain', () => {
    expect(getPhonePaymentCountry('user@example.com')).toBe(null);
  });

  it('returns null for an address without an @', () => {
    expect(getPhonePaymentCountry('nodomain')).toBe(null);
  });

  it('returns null for non-string input', () => {
    expect(getPhonePaymentCountry(null)).toBe(null);
    expect(getPhonePaymentCountry(12345)).toBe(null);
  });
});

describe('getPhonePaymentCountry of candidates (gcash labelling regression)', () => {
  it('does NOT classify a Kenyan number as a Philippine (GCash) number', () => {
    // This mirrors the halfModalSendOptions `isGcashNumber` derivation.
    const isGcash = getPhonePaymentCandidates('0717252303').some(
      c => getPhonePaymentCountry(c) === 'PH',
    );
    expect(isGcash).toBe(false);
  });

  it('classifies a real Philippine number as a GCash number', () => {
    const isGcash = getPhonePaymentCandidates('09171234567').some(
      c => getPhonePaymentCountry(c) === 'PH',
    );
    expect(isGcash).toBe(true);
  });
});

describe('canonicalizePhonePaymentAddress', () => {
  it('canonicalizes a national Kenyan address to international form', () => {
    expect(canonicalizePhonePaymentAddress('0717252303@bitcoin.co.ke')).toBe(
      KE,
    );
  });

  it('is idempotent on an already-canonical address', () => {
    expect(canonicalizePhonePaymentAddress(KE)).toBe(KE);
  });

  it('keeps a Zambian address in its national provider form', () => {
    expect(canonicalizePhonePaymentAddress('0977123456@bitzed.xyz')).toBe(
      '0977123456@bitzed.xyz',
    );
  });

  it('selects the candidate matching the address domain for overlapping numbers', () => {
    // 0751234567 is valid for both KE and ZM; the bitzed.xyz domain must pin it
    // to the Zambian candidate rather than the first (Kenyan) candidate.
    expect(canonicalizePhonePaymentAddress(ZM_OVERLAP)).toBe(ZM_OVERLAP);
  });

  it('matches the provider domain case-insensitively', () => {
    expect(canonicalizePhonePaymentAddress('0717252303@BITCOIN.CO.KE')).toBe(
      KE,
    );
  });

  it('returns null for a non-provider lightning address', () => {
    expect(canonicalizePhonePaymentAddress('user@example.com')).toBe(null);
  });

  it('returns null for an address without an @', () => {
    expect(canonicalizePhonePaymentAddress('someblitzname')).toBe(null);
  });

  it('returns null for non-string input', () => {
    expect(canonicalizePhonePaymentAddress(null)).toBe(null);
  });
});

describe('getPhonePaymentAddress (default, async resolution)', () => {
  it('returns the only candidate without probing LNURL', async () => {
    const result = await getPhonePaymentAddress('0717252303');
    expect(result).toBe(KE);
    expect(getLNURLDetails).not.toHaveBeenCalled();
  });

  it('returns null when there are no candidates', async () => {
    const result = await getPhonePaymentAddress('hello');
    expect(result).toBe(null);
    expect(getLNURLDetails).not.toHaveBeenCalled();
  });

  it('returns the first candidate whose LNURL resolves to a payRequest', async () => {
    getLNURLDetails.mockResolvedValueOnce({ tag: 'payRequest' });
    const result = await getPhonePaymentAddress('0751234567');
    expect(result).toBe(KE_OVERLAP);
    expect(getLNURLDetails).toHaveBeenCalledWith(KE_OVERLAP);
  });

  it('falls back to the last candidate when an earlier probe fails', async () => {
    getLNURLDetails.mockResolvedValueOnce(false);
    const result = await getPhonePaymentAddress('0751234567');
    expect(result).toBe(ZM_OVERLAP);
  });

  it('falls back to the last candidate when a probe is not a payRequest', async () => {
    getLNURLDetails.mockResolvedValueOnce({ tag: 'withdrawRequest' });
    const result = await getPhonePaymentAddress('0751234567');
    expect(result).toBe(ZM_OVERLAP);
  });
});

describe('PROVIDER_COUNTRY_CURRENCY', () => {
  it('maps each provider country to its local fiat currency', () => {
    expect(PROVIDER_COUNTRY_CURRENCY).toEqual({
      KE: 'KES',
      ZM: 'ZMW',
      PH: 'PHP',
      BI: 'BIF',
    });
  });
});

describe('getPhonePostProvider (Burundi POST provider)', () => {
  it('resolves a Burundi number in international form', () => {
    expect(getPhonePostProvider('+25779561234')).toMatchObject({
      country: 'BI',
      domain: 'exchanger.mysatoshis.bi',
      invoiceURL: 'https://exchanger.mysatoshis.bi/api/sell-sats',
      minSendableSats: 200,
      phone: '25779561234',
    });
  });

  it('resolves the bare-country-code (257) form', () => {
    expect(getPhonePostProvider('25779561234')?.country).toBe('BI');
  });

  it('resolves the national form', () => {
    expect(getPhonePostProvider('79561234')?.country).toBe('BI');
  });

  it('trims surrounding whitespace', () => {
    expect(getPhonePostProvider('  +25779561234  ')?.country).toBe('BI');
  });

  it('returns null for LNURL-provider (KE/ZM/PH) numbers', () => {
    expect(getPhonePostProvider('+254717252303')).toBe(null);
    expect(getPhonePostProvider('0977123456')).toBe(null);
    expect(getPhonePostProvider('09171234567')).toBe(null);
  });

  it('returns null for empty, garbage and unsupported numbers', () => {
    expect(getPhonePostProvider('')).toBe(null);
    expect(getPhonePostProvider('hello')).toBe(null);
    expect(getPhonePostProvider(null)).toBe(null);
    expect(getPhonePostProvider('+12025550123')).toBe(null);
  });

  it('rejects a lightning-address input (contains @)', () => {
    expect(getPhonePostProvider('25779561234@attacker.example')).toBe(null);
  });

  it('does not produce LNURL candidates for a Burundi number', () => {
    // POST providers must stay out of the LNURL candidate system.
    expect(getPhonePaymentCandidates('+25779561234')).toEqual([]);
  });
});

describe('getPhonePaymentCountry (POST provider domain)', () => {
  it('maps the Burundi POST domain to its country', () => {
    expect(getPhonePaymentCountry('25779561234@exchanger.mysatoshis.bi')).toBe(
      'BI',
    );
  });
});

describe('fetchPhonePaymentInvoice', () => {
  // Real BOLT11 invoice for 2,000,000 msat (2,000 sats), from the BOLT11 spec
  // example. Used as a valid test vector that decodes correctly.
  const INVOICE_2000_SATS =
    'lnbc20u1pvjluezhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfppqw508d6qejxtdg4y5r3zarvary0c5xw7kxqrrsssp5m6kmam774klwlh4dhmhaatd7al02m0h0m6kmam774klwlh4dhmhs9qypqqqcqpf3cwux5979a8j28d4ydwahx00saa68wq3az7v9jdgzkghtxnkf3z5t7q5suyq2dl9tqwsap8j0wptc82cpyvey9gf6zyylzrm60qtcqsq7egtsq';

  const args = {
    invoiceURL: 'https://exchanger.mysatoshis.bi/api/sell-sats',
    phone: '25779561234',
    amountSats: 2000,
  };

  afterEach(() => {
    delete global.fetch;
  });

  it('POSTs amountSats/phone and returns the invoice as pr', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        invoice: INVOICE_2000_SATS,
        orderId: 'order-1',
      }),
    });

    const result = await fetchPhonePaymentInvoice(args);
    expect(result).toEqual({ pr: INVOICE_2000_SATS, orderId: 'order-1' });

    expect(global.fetch).toHaveBeenCalledWith(
      args.invoiceURL,
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ amountSats: 2000, phone: 25779561234 });
  });

  it('throws on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchPhonePaymentInvoice(args)).rejects.toThrow();
  });

  it('throws when the body is unsuccessful', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });
    await expect(fetchPhonePaymentInvoice(args)).rejects.toThrow();
  });

  it('throws when the invoice is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await expect(fetchPhonePaymentInvoice(args)).rejects.toThrow();
  });

  it('throws when the invoice amount differs from the requested amount', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, invoice: INVOICE_2000_SATS }),
    });

    // Request 1,000 sats, but provider mints 2,000 sats.
    await expect(
      fetchPhonePaymentInvoice({ ...args, amountSats: 1000 }),
    ).rejects.toThrow('Invoice amount does not match requested amount');

    // Sanity-check that the fixture decodes to 2,000,000 msat.
    const decoded = decode(INVOICE_2000_SATS);
    expect(Number(decoded.millisatoshis)).toBe(2000000);
  });
});

describe('getPhonePaymentDisplay', () => {
  it('returns iso code + international-formatted number for a KE provider address', () => {
    expect(getPhonePaymentDisplay(KE)).toEqual({
      isoCode: 'KE',
      formatted: '+254 717 252303',
    });
  });

  it('formats a ZM address whose local part is national (0977…)', () => {
    const res = getPhonePaymentDisplay('0977123456@bitzed.xyz');
    expect(res.isoCode).toBe('ZM');
    expect(res.formatted.startsWith('+260')).toBe(true);
  });

  it('handles a POST-provider (Burundi) address', () => {
    expect(getPhonePaymentDisplay('25779561234@exchanger.mysatoshis.bi').isoCode).toBe('BI');
  });

  it('returns null for a non-phone lightning address', () => {
    expect(getPhonePaymentDisplay('satoshi@walletofsatoshi.com')).toBeNull();
  });

  it('returns null for non-string / malformed input', () => {
    expect(getPhonePaymentDisplay(undefined)).toBeNull();
    expect(getPhonePaymentDisplay('no-at-sign')).toBeNull();
  });
});
