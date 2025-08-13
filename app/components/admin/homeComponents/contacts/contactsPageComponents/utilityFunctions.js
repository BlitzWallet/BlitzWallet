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

export function createFormattedDate(time, currentTime) {
  const date = new Date(time);
  const currentDate = new Date(currentTime);

  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
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
      formattedTime = 'Yesterday';
    } else if (daysDiff <= 7) {
      formattedTime = daysOfWeek[date.getDay()];
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear() % 100;
      formattedTime = `${month}/${day}/${year}`;
    }
  }

  return formattedTime;
}

export function formatMessage(message) {
  return message?.message?.description || ' ';
}
