import i18next from 'i18next';

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
