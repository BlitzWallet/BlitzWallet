import i18next from 'i18next';
import { uses24HourClock } from 'react-native-localize';

/**
 * The one place dates and times are formatted for display. Layout follows the
 * app language (i18next.language), never the phone's locale; the 12/24h clock
 * follows the phone setting; time zone is the device's.
 *
 *   formatDate(ts, style, now?)   ts: ms number or Date; falsy/invalid -> ''
 *
 *   date      Nov 3 | Nov 3, 2024   year only when not the current year
 *   monthDay  Nov 3                 never a year (chart axes, short labels)
 *   time      9:35 PM | 21:35       12/24h from the phone's clock setting
 *   dateTime  Nov 3 · 9:35 PM       date (as above) + time
 *   day       Today | Yesterday | date   list section titles
 *   month     November
 *   sortable  2025-11-03 21:35      locale independent (CSV export)
 */
const OPTIONS = {
  date: { month: 'short', day: 'numeric' },
  dateYear: { month: 'short', day: 'numeric', year: 'numeric' },
  time: { hour: 'numeric', minute: '2-digit' },
  // hourCycle, not hour12:false, which prints midnight as "24:05" in some engines.
  time12: { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' },
  time24: { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' },
  month: { month: 'long' },
};

// 12/24h is the phone's clock setting; the language only picks the layout.
// Unreadable setting -> plain 'time' (the language's own default).
function timeKey() {
  try {
    return uses24HourClock() ? 'time24' : 'time12';
  } catch (err) {
    return 'time';
  }
}

// Intl.DateTimeFormat is slow to build and this runs per list row.
const formatters = new Map();

function intl(key) {
  const locale = i18next.language || 'en';
  const id = `${locale}|${key}`;
  let formatter = formatters.get(id);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, OPTIONS[key]);
    } catch (err) {
      formatter = new Intl.DateTimeFormat('en', OPTIONS[key]);
    }
    formatters.set(id, formatter);
  }
  return formatter;
}

const pad = n => String(n).padStart(2, '0');

export default function formatDate(input, style = 'date', now = Date.now()) {
  if (!input) return '';
  const date = new Date(input);
  if (isNaN(date)) return '';

  const today = new Date(now);
  const smartDate = () =>
    intl(
      date.getFullYear() === today.getFullYear() ? 'date' : 'dateYear',
    ).format(date);

  switch (style) {
    case 'monthDay':
      return intl('date').format(date);
    case 'time':
      return intl(timeKey()).format(date);
    case 'month':
      return intl('month').format(date);
    case 'dateTime':
      return `${smartDate()} · ${intl(timeKey()).format(date)}`;
    case 'day': {
      // Calendar days, not 24h steps: a DST day is 23 or 25 hours long.
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (date.toDateString() === today.toDateString()) {
        return i18next.t('constants.today');
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return i18next.t('constants.yesterday');
      }
      return smartDate();
    }
    case 'sortable':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    default:
      return smartDate();
  }
}
