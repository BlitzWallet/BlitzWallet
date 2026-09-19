// Web shim for react-native-country-picker-modal.
// Metro maps both 'react-native-country-picker-modal' and
// 'react-native-country-picker-modal/lib/CountryService' to this file on web
// (see metro.config.js WEB_STUBS + prefix handler).
//
// The app only uses CountryCodeList and getCountryInfoAsync in
// app/components/admin/homeComponents/apps/onlineListings/onlineListingsFilterHalfModal.js:9-10
// but we implement the full CountryService surface so any future import keeps parity
// with the native package without pulling Fuse.js / node-emoji / native Modal code.
//
// Data is sourced from the package's own countries-emoji.json (125k) so currency +
// callingCode stay identical to native. The JSON is bundled via Metro's JSON
// transformer; we lazily require it to keep the web entry point synchronous.

import React from 'react';
import bundledCountries from '../node_modules/react-native-country-picker-modal/lib/assets/data/countries-emoji.json' with { type: 'json' };

let _countries = null;
function getCountriesData() {
  if (_countries) return _countries;
  // Static import above is the primary source — Metro bundles the JSON and
  // Node's ESM loader requires the `with {type:'json'}` attribute.
  if (bundledCountries) {
    _countries = bundledCountries.default ?? bundledCountries;
    return _countries;
  }
  // Fallback for edge cases where the static import was stripped.
  try {
    // eslint-disable-next-line global-require
    const req = typeof require !== 'undefined' ? require : null;
    if (req) {
      _countries = req(
        '../node_modules/react-native-country-picker-modal/lib/assets/data/countries-emoji.json',
      );
      if (_countries && _countries.default) _countries = _countries.default;
      if (_countries && Object.keys(_countries).length) return _countries;
    }
  } catch {}
  _countries = {};
  return _countries;
}

// Exact copy of lib/types.js CountryCodeList (250 codes) — order matters for
// the filter modal's Promise.all mapping and EU insertion logic.
export const CountryCodeList = [
  'AF',
  'AL',
  'DZ',
  'AS',
  'AD',
  'AO',
  'AI',
  'AQ',
  'AG',
  'AR',
  'AM',
  'AW',
  'AU',
  'AT',
  'AZ',
  'BS',
  'BH',
  'BD',
  'BB',
  'BY',
  'BE',
  'BZ',
  'BJ',
  'BM',
  'BT',
  'BO',
  'BA',
  'BW',
  'BV',
  'BR',
  'IO',
  'VG',
  'BN',
  'BG',
  'BF',
  'BI',
  'KH',
  'CM',
  'CA',
  'CV',
  'BQ',
  'KY',
  'CF',
  'TD',
  'CL',
  'CN',
  'CX',
  'CC',
  'CO',
  'KM',
  'CK',
  'CR',
  'HR',
  'CU',
  'CW',
  'CY',
  'CZ',
  'CD',
  'DK',
  'DJ',
  'DM',
  'DO',
  'EC',
  'EG',
  'SV',
  'GQ',
  'ER',
  'EE',
  'SZ',
  'ET',
  'FK',
  'FO',
  'FJ',
  'FI',
  'FR',
  'GF',
  'PF',
  'TF',
  'GA',
  'GM',
  'GE',
  'DE',
  'GH',
  'GI',
  'GR',
  'GL',
  'GD',
  'GP',
  'GU',
  'GT',
  'GG',
  'GN',
  'GW',
  'GY',
  'HT',
  'HM',
  'HN',
  'HU',
  'IS',
  'IN',
  'ID',
  'IR',
  'IQ',
  'IE',
  'IM',
  'IL',
  'IT',
  'CI',
  'JM',
  'JP',
  'JE',
  'JO',
  'KZ',
  'KE',
  'XK',
  'KW',
  'KG',
  'LA',
  'LV',
  'LB',
  'LS',
  'LR',
  'LY',
  'LI',
  'LT',
  'LU',
  'MO',
  'MK',
  'MG',
  'MW',
  'MY',
  'MV',
  'ML',
  'MT',
  'MH',
  'MQ',
  'MR',
  'MU',
  'YT',
  'MX',
  'FM',
  'MD',
  'MC',
  'MN',
  'ME',
  'MS',
  'MA',
  'MZ',
  'MM',
  'NA',
  'NR',
  'NP',
  'NL',
  'NC',
  'NZ',
  'NI',
  'NE',
  'NG',
  'NU',
  'NF',
  'KP',
  'MP',
  'NO',
  'OM',
  'PK',
  'PW',
  'PS',
  'PA',
  'PG',
  'PY',
  'PE',
  'PH',
  'PN',
  'PL',
  'PT',
  'PR',
  'QA',
  'CG',
  'RO',
  'RU',
  'RW',
  'RE',
  'BL',
  'SH',
  'KN',
  'LC',
  'MF',
  'PM',
  'VC',
  'WS',
  'SM',
  'SA',
  'SN',
  'RS',
  'SC',
  'SL',
  'SG',
  'SX',
  'SK',
  'SI',
  'SB',
  'SO',
  'ZA',
  'GS',
  'KR',
  'SS',
  'ES',
  'LK',
  'SD',
  'SR',
  'SJ',
  'SE',
  'CH',
  'SY',
  'ST',
  'TW',
  'TJ',
  'TZ',
  'TH',
  'TL',
  'TG',
  'TK',
  'TO',
  'TT',
  'TN',
  'TR',
  'TM',
  'TC',
  'TV',
  'UG',
  'UA',
  'AE',
  'GB',
  'US',
  'UM',
  'VI',
  'UY',
  'UZ',
  'VU',
  'VA',
  'VE',
  'VN',
  'WF',
  'EH',
  'YE',
  'ZM',
  'ZW',
  'KI',
  'HK',
  'AX',
];

export const RegionList = ['Africa', 'Americas', 'Antarctic', 'Asia', 'Europe', 'Oceania'];
export const SubregionList = [
  'Southern Asia',
  'Southern Europe',
  'Northern Africa',
  'Polynesia',
  'Middle Africa',
  'Caribbean',
  'South America',
  'Western Asia',
  'Australia and New Zealand',
  'Western Europe',
  'Eastern Europe',
  'Central America',
  'Western Africa',
  'North America',
  'Southern Africa',
  'Eastern Africa',
  'South-Eastern Asia',
  'Eastern Asia',
  'Northern Europe',
  'Melanesia',
  'Micronesia',
  'Central Asia',
  'Central Europe',
];
export const TranslationLanguageCodeList = [
  'common',
  'cym',
  'deu',
  'fra',
  'hrv',
  'ita',
  'jpn',
  'nld',
  'por',
  'rus',
  'spa',
  'svk',
  'fin',
  'zho',
  'isr',
];
export const FlagType = { FLAT: 'flat', EMOJI: 'emoji' };

export function isCountryCode(str) {
  return CountryCodeList.includes(str);
}

// --- CountryService parity ---
export async function loadDataAsync(dataType = FlagType.EMOJI) {
  // Flat flags are fetched from a remote URL in the real package; on web we
  // reuse the emoji data so no network request is needed and results stay
  // deterministic.
  return getCountriesData();
}

export async function getEmojiFlagAsync(countryCode = 'FR') {
  const countries = getCountriesData();
  return countries[countryCode]?.flag ?? '';
}

export async function getImageFlagAsync(countryCode = 'FR') {
  const countries = getCountriesData();
  return countries[countryCode]?.flag ?? '';
}

export async function getCountryNameAsync(countryCode = 'FR', translation = 'common') {
  const countries = getCountriesData();
  const entry = countries[countryCode];
  if (!entry) throw new Error(`Unknown country code: ${countryCode}`);
  return entry.name[translation] || entry.name.common;
}

export async function getCountryCallingCodeAsync(countryCode) {
  const countries = getCountriesData();
  const entry = countries[countryCode];
  if (!entry) throw new Error(`Unknown country code: ${countryCode}`);
  return entry.callingCode[0];
}

export async function getCountryCurrencyAsync(countryCode) {
  const countries = getCountriesData();
  const entry = countries[countryCode];
  if (!entry) throw new Error(`Unknown country code: ${countryCode}`);
  return entry.currency[0];
}

export async function getCountryInfoAsync({ countryCode, translation }) {
  const t = translation || 'common';
  // Single await for data, then synchronous lookups — equivalent to the
  // package's three-await implementation but without extra microtasks.
  const [countryName, currency, callingCode] = await Promise.all([
    getCountryNameAsync(countryCode, t),
    getCountryCurrencyAsync(countryCode),
    getCountryCallingCodeAsync(countryCode),
  ]);
  return { countryName, currency, callingCode };
}

// Minimal stubs for the rest of CountryService — not used in the app today but
// required so `import { getCountriesAsync } from '.../CountryService'` doesn't
// throw on web if added later.
export async function getCountriesAsync() {
  const countries = getCountriesData();
  return CountryCodeList.filter(code => !!countries[code]).map(cca2 => ({
    cca2,
    ...countries[cca2],
    name: countries[cca2].name.common,
  }));
}

export function search(filter = '', data = []) {
  if (!filter) return data;
  const q = filter.toLowerCase();
  return data.filter(
    c => c.name?.toLowerCase().includes(q) || c.cca2?.toLowerCase().includes(q),
  );
}

export function getLetters(countries) {
  return [...new Set(countries.map(c => c.name[0]?.toLocaleUpperCase()))].sort((a, b) =>
    a.localeCompare(b),
  );
}

// --- Default / component exports for `import CountryPicker from 'react-native-country-picker-modal'` ---
function CountryPickerStub() {
  return null;
}
export default CountryPickerStub;
export const CountryPicker = CountryPickerStub;
export const CountryModal = CountryPickerStub;
export const CountryList = CountryPickerStub;
export const CountryFilter = CountryPickerStub;
export const FlagButton = CountryPickerStub;
export const Flag = CountryPickerStub;
export const HeaderModal = CountryPickerStub;
export const CountryModalProvider = ({ children }) => children ?? null;
export const DARK_THEME = {};
export const DEFAULT_THEME = {};
export const getAllCountries = getCountriesAsync;
export const getCallingCode = getCountryCallingCodeAsync;
