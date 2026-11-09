/**
 * Ways formatDate can fail (written before the implementation):
 *  1. Falsy / invalid input throws or prints "Invalid Date" / 1970.
 *  2. Follows the phone locale instead of i18next.language.
 *  3. Formatter cache keeps serving the old language after a language switch.
 *  4. Year shown for the current year, or missing for another year (Dec 31 / Jan 1).
 *  5. "Yesterday" wrong on a DST day (23h day) when computed as midnight - 24h.
 *  6. "Today"/"Yesterday" wrong at 23:59 / 00:00 boundaries.
 *  7. Unknown language tag makes Intl throw.
 *  8. Clock style ignores the app language (de must be 24h, en 12h).
 *  9. 'sortable' depends on locale (breaks CSV export ordering).
 * 10. Clock ignores the phone's 12/24h setting (en + 24h phone must be 24h).
 * 11. Cache serves a stale clock after the phone setting flips.
 * 12. uses24HourClock throws -> time must still format (language default).
 */
process.env.TZ = 'America/Chicago';

let mockLanguage = 'en';
jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    get language() {
      return mockLanguage;
    },
    t: key => key,
  },
}));

let mockClock24 = false;
jest.mock('react-native-localize', () => ({
  uses24HourClock: () => {
    if (mockClock24 === 'throw') throw new Error('native');
    return mockClock24;
  },
}));

const formatDate = require('../../app/functions/formatDate').default;

// Intl may use a narrow no-break space before AM/PM; compare with plain spaces.
const f = (...args) => formatDate(...args).replace(/\s/g, ' ');
const NOW = new Date(2025, 10, 8, 12, 0).getTime(); // Nov 8 2025 noon

beforeEach(() => {
  mockLanguage = 'en';
  mockClock24 = false;
});

test('1. invalid input -> empty string', () => {
  [null, undefined, 0, '', NaN, new Date('x')].forEach(v =>
    expect(formatDate(v, 'date', NOW)).toBe(''),
  );
});

test('2/3. follows app language and survives a switch', () => {
  const ts = new Date(2025, 10, 3, 21, 35).getTime();
  expect(f(ts, 'time', NOW)).toBe('9:35 PM');
  mockLanguage = 'de-DE';
  expect(f(ts, 'month', NOW)).toBe('November');
  mockLanguage = 'ru';
  expect(f(ts, 'month', NOW)).toBe('ноябрь');
});

test('4. year only when not the current year', () => {
  expect(f(new Date(2025, 10, 3), 'date', NOW)).toBe('Nov 3');
  expect(f(new Date(2024, 11, 31), 'date', NOW)).toBe('Dec 31, 2024');
  const jan2 = new Date(2026, 0, 2, 9).getTime();
  expect(f(new Date(2025, 11, 31, 9), 'date', jan2)).toBe('Dec 31, 2025');
  expect(f(new Date(2024, 11, 31), 'monthDay', NOW)).toBe('Dec 31');
});

test('5. yesterday is correct on a DST day', () => {
  // Mar 9 2025 is the 23-hour spring-forward day in America/Chicago.
  const now = new Date(2025, 2, 10, 0, 30).getTime();
  expect(formatDate(new Date(2025, 2, 9, 0, 30), 'day', now)).toBe(
    'constants.yesterday',
  );
});

test('6. today / yesterday boundaries', () => {
  expect(formatDate(new Date(2025, 10, 8, 0, 0), 'day', NOW)).toBe(
    'constants.today',
  );
  expect(formatDate(new Date(2025, 10, 7, 23, 59), 'day', NOW)).toBe(
    'constants.yesterday',
  );
  expect(f(new Date(2025, 10, 6, 23, 59), 'day', NOW)).toBe('Nov 6');
});

test('7. unknown language tag falls back instead of throwing', () => {
  mockLanguage = 'not_a_locale!!';
  expect(f(new Date(2025, 10, 3), 'date', NOW)).toBe('Nov 3');
});

test('10/11. clock follows the phone setting, not the language', () => {
  const ts = new Date(2025, 10, 3, 21, 35).getTime();
  mockClock24 = true;
  expect(f(ts, 'time', NOW)).toBe('21:35'); // en, 24h phone
  expect(f(new Date(2025, 10, 3, 0, 5), 'time', NOW)).toBe('00:05'); // not 24:05
  mockClock24 = false;
  expect(f(ts, 'time', NOW)).toBe('9:35 PM'); // flips live
  mockLanguage = 'de-DE';
  expect(f(ts, 'time', NOW)).toMatch(/^9:35 PM$/i); // de, 12h phone
  mockClock24 = true;
  expect(f(ts, 'time', NOW)).toBe('21:35');
});

test('12. unreadable phone setting falls back to the language default', () => {
  mockClock24 = 'throw';
  const ts = new Date(2025, 10, 3, 21, 35).getTime();
  expect(f(ts, 'time', NOW)).toBe('9:35 PM');
  mockLanguage = 'de-DE';
  expect(f(ts, 'time', NOW)).toBe('21:35');
});

test('dateTime joins date and time', () => {
  expect(f(new Date(2025, 10, 3, 21, 35), 'dateTime', NOW)).toBe(
    'Nov 3 · 9:35 PM',
  );
});

test('9. sortable is locale independent', () => {
  const ts = new Date(2025, 10, 3, 21, 5).getTime();
  mockLanguage = 'ru';
  expect(formatDate(ts, 'sortable', NOW)).toBe('2025-11-03 21:05');
});
