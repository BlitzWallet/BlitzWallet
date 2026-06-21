// Use the mobile-aware metadata bundle: the default ("min") metadata is loose
// enough that a Kenyan mobile (07…) also validates as a Zambian/Philippine
// number, which produced spurious extra candidates (e.g. a KE number being
// labelled a GCash/PH number). The /mobile metadata's isValid() only accepts
// real mobile numbers, which these providers serve.
import { parsePhoneNumberWithError } from 'libphonenumber-js/mobile';
import getLNURLDetails from '../lnurl/getLNURLDetails';

// country -> bitcoin payment provider; formatNumber emits the provider's
// canonical format regardless of whether input was national or international.
const PHONE_PAYMENT_PROVIDERS = {
  KE: {
    domain: 'bitcoin.co.ke',
    formatNumber: parsed => parsed.number.slice(1),
  }, // 254...
  ZM: {
    domain: 'bitzed.xyz',
    formatNumber: parsed => `0${parsed.nationalNumber}`,
  }, // 0977...
  PH: {
    domain: 'zapremit.com',
    formatNumber: parsed => parsed.number.slice(1),
  },
};

// Local fiat currency for each supported phone-payment provider country. Used to
// default the send amount input to the payment location's currency.
export const PROVIDER_COUNTRY_CURRENCY = { KE: 'KES', ZM: 'ZMW', PH: 'PHP' };

// Given a provider lightning address (any form), returns the provider country
// (KE/ZM/PH) by matching its domain, or null for non-provider addresses.
export function getPhonePaymentCountry(address) {
  if (typeof address !== 'string') return null;
  const at = address.indexOf('@');
  if (at === -1) return null;
  const domain = address.slice(at + 1).toLowerCase();
  const match = Object.entries(PHONE_PAYMENT_PROVIDERS).find(
    ([, provider]) => provider.domain === domain,
  );
  return match ? match[0] : null;
}

// Returns the provider lightning addresses the input is valid for, in
// PHONE_PAYMENT_PROVIDERS order (KE before ZM). Accepts national or
// international input. A bare national number in the overlapping 075/076/077
// range is valid for both KE and ZM, so this can return more than one.
export function getPhonePaymentCandidates(input) {
  const stripped = (input || '').trim();
  if (!stripped) return [];

  // Try international form first, then national form per supported country.
  const normalized = stripped.startsWith('+') ? stripped : `+${stripped}`;
  const attempts = [
    [normalized, undefined],
    ...Object.keys(PHONE_PAYMENT_PROVIDERS).map(country => [stripped, country]),
  ];

  const seen = new Set();
  const candidates = [];
  for (const [value, defaultCountry] of attempts) {
    try {
      const parsed = parsePhoneNumberWithError(value, defaultCountry);
      const provider = PHONE_PAYMENT_PROVIDERS[parsed.country];
      if (provider && parsed.isValid() && !seen.has(parsed.country)) {
        seen.add(parsed.country);
        candidates.push(`${provider.formatNumber(parsed)}@${provider.domain}`);
      }
    } catch {}
  }
  return candidates;
}

// Sync gate for the preview UI: is this input a payable phone number?
export function isPhonePaymentNumber(input) {
  return getPhonePaymentCandidates(input).length > 0;
}

// Maps a phone-provider lightning address (national or international form) to its
// canonical provider form, e.g. 0717252303@bitcoin.co.ke -> 254717252303@bitcoin.co.ke.
// Returns null for non-phone addresses (regular lightning addresses, blitz, etc.).
export function canonicalizePhonePaymentAddress(address) {
  if (typeof address !== 'string') return null;
  const at = address.indexOf('@');
  if (at === -1) return null;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1).toLowerCase();

  const isProviderDomain = Object.values(PHONE_PAYMENT_PROVIDERS).some(
    p => p.domain === domain,
  );
  if (!isProviderDomain) return null;

  const candidates = getPhonePaymentCandidates(local);
  return candidates.find(c => c.endsWith(`@${domain}`)) || null;
}

// Resolves the input to a single lightning address. When the number is valid
// for multiple supported countries (overlapping 075/076/077 range), probe each
// candidate's LNURL endpoint in order (KE first) and use the first one that
// resolves to a valid pay request; otherwise fall back to the last candidate.
export default async function getPhonePaymentAddress(input) {
  const candidates = getPhonePaymentCandidates(input);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  for (let i = 0; i < candidates.length - 1; i++) {
    const details = await getLNURLDetails(candidates[i]);
    if (details && details.tag === 'payRequest') return candidates[i];
  }
  return candidates[candidates.length - 1];
}
