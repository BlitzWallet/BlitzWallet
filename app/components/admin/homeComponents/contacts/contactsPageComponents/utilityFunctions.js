import { formatLocalTimeNumeric } from '../../../../../functions/timeFormatter';

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
  return Math.floor(differenceMs / (1000 * 60 * 60 * 24));
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

  let formattedTime;

  if (isSameDay(date, currentDate)) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;
  } else {
    const daysDiff = getDaysDifference(currentDate, date);
    if (daysDiff === 1) {
      formattedTime = t('constants.yesterday');
    } else if (daysDiff >= 2 && daysDiff <= 6) {
      formattedTime = daysOfWeek[date.getDay()];
    } else {
      formattedTime = formatLocalTimeNumeric(date);
    }
  }

  return formattedTime;
}

export function formatMessage(message) {
  return message?.message?.description;
}
