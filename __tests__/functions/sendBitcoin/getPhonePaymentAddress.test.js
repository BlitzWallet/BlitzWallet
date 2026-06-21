import getPhonePaymentAddress, {
  getPhonePaymentCandidates,
  isPhonePaymentNumber,
  getPhonePaymentCountry,
  canonicalizePhonePaymentAddress,
  PROVIDER_COUNTRY_CURRENCY,
} from '../../../app/functions/sendBitcoin/getPhonePaymentAddress';
import getLNURLDetails from '../../../app/functions/lnurl/getLNURLDetails';

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
    });
  });
});
