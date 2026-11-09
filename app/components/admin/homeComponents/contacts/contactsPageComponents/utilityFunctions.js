import formatDate from '../../../../../functions/formatDate';

// Utility functions
function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getDaysDifference(laterDate, earlierDate) {
  const later = new Date(
    laterDate.getFullYear(),
    laterDate.getMonth(),
    laterDate.getDate(),
  );
  const earlier = new Date(
    earlierDate.getFullYear(),
    earlierDate.getMonth(),
    earlierDate.getDate(),
  );

  const differenceMs = later - earlier;
  // Both sides are local midnights, so a DST day is 23h/25h: round, not floor.
  return Math.round(differenceMs / (1000 * 60 * 60 * 24));
}

export function createFormattedDate(time, currentTime, t) {
  const date = new Date(time);
  const currentDate = new Date(currentTime);

  const daysOfWeek = [
    t('weekdays.Sun'),
    t('weekdays.Mon'),
    t('weekdays.Tue'),
    t('weekdays.Wed'),
    t('weekdays.Thu'),
    t('weekdays.Fri'),
    t('weekdays.Sat'),
  ];

  const hoursAgo = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60);

  let formattedTime;
  if (isSameDay(date, currentDate) && hoursAgo >= 12 && date.getHours() < 5) {
    formattedTime = t('constants.yesterday');
  } else if (isSameDay(date, currentDate)) {
    formattedTime = formatDate(date, 'time');
  } else {
    const daysDiff = getDaysDifference(currentDate, date);
    if (daysDiff === 1) {
      formattedTime = t('constants.yesterday');
    } else if (daysDiff >= 2 && daysDiff <= 6) {
      formattedTime = daysOfWeek[date.getDay()];
    } else {
      formattedTime = formatDate(date, 'date');
    }
  }

  return formattedTime;
}

export function formatMessage(message) {
  return message?.message?.description;
}
