import { AsYouType } from 'libphonenumber-js';

// The three mobile-money providers we support. `isoCode`/`cc` must stay aligned
// with the providers in getPhonePaymentAddress.js (KE=bitcoin.co.ke,
// PH=zapremit.com, ZM=bitzed.xyz) so the E.164 string resolves downstream.
// `provider` is display-only. `example` is a valid national mobile number (no
// trunk prefix) used to render a country-correct placeholder.
export const MOBILE_MONEY_COUNTRIES = [
  {
    country: 'Kenya',
    isoCode: 'KE',
    cc: '+254',
    provider: 'M-Pesa',
    example: '712123456',
  },
  {
    country: 'Philippines',
    isoCode: 'PH',
    cc: '+63',
    provider: 'GCash',
    example: '9051234567',
  },
  {
    country: 'Zambia',
    isoCode: 'ZM',
    cc: '+260',
    provider: 'Airtel, MTN, or Zamtel',
    example: '955123456',
  },
  // POST-based provider (exchanger.mysatoshis.bi) — no LNURL address.
  {
    country: 'Burundi',
    isoCode: 'BI',
    cc: '+257',
    provider: 'Lumicash',
    example: '79561234',
  },
];

// Formats the national digits the way they appear after the country-code chip.
// AsYouType only groups these countries' numbers when given the country code, so
// we format the full international number and strip the leading code.
export const formatNationalDisplay = (country, digits) => {
  if (!country) return '';
  const full = new AsYouType().input(`${country.cc}${digits ?? ''}`);
  return full.startsWith(country.cc)
    ? full.slice(country.cc.length).trimStart()
    : full;
};
