import i18next from 'i18next';

/**
 * Returns the real UTC milliseconds of 12:00 PM America/Chicago on the
 * same calendar day (Chicago time) as referenceUtcMs.
 * DST-aware: handles CDT (UTC-5) and CST (UTC-6) automatically via the
 * IANA timezone database, so no hardcoded offsets are needed.
 */
export function getNoonChicagoUtcMs(referenceUtcMs) {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(referenceUtcMs));

  const year = parseInt(dateParts.find(p => p.type === 'year').value);
  const month = parseInt(dateParts.find(p => p.type === 'month').value) - 1;
  const day = parseInt(dateParts.find(p => p.type === 'day').value);

  const noonUtcProbe = Date.UTC(year, month, day, 12, 0, 0);

  const chicagoHourAtProbe = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(noonUtcProbe)),
  );

  return noonUtcProbe + (12 - chicagoHourAtProbe) * 60 * 60 * 1000;
}

export function formatLocalTimeShort(date) {
  try {
    return date.toLocaleDateString(i18next.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (err) {
    console.log('error formatting local time', err.message);
  }
}
export function formatLocalTimeNumeric(date) {
  try {
    return date.toLocaleDateString(i18next.language, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch (err) {
    console.log('error formatting local time', err.message);
  }
}
export function formatLocalTimeNumericMonthDay(date) {
  try {
    return date.toLocaleDateString(i18next.language, {
      month: 'numeric',
      day: 'numeric',
    });
  } catch (err) {
    console.log('error formatting local time', err.message);
  }
}
