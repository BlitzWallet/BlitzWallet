// Utility functions remain the same
export function createFormattedDate(time, currentTime) {
  const date = new Date(time);
  const currentDate = currentTime;
  const differenceMs = currentDate - date;
  const differenceDays = differenceMs / (1000 * 60 * 60 * 24);

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

  if (differenceDays < 1) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;
  } else if (differenceDays < 2) {
    formattedTime = 'Yesterday';
  } else if (differenceDays <= 7) {
    formattedTime = daysOfWeek[date.getDay()];
  } else {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear() % 100;
    formattedTime = `${month}/${day}/${year}`;
  }

  return formattedTime;
}

export function formatMessage(message) {
  return message?.message?.description || ' ';
}
