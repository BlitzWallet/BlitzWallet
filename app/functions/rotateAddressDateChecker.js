function isMoreThan7DaysPast(date) {
  // Get today's date and set time to midnight for accurate comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Set the time of the input date to midnight for accurate comparison
  const inputDate = new Date(date);
  inputDate.setHours(0, 0, 0, 0);

  // Calculate the difference in time between today and the input date
  const timeDifference = today - inputDate;

  // Convert the time difference from milliseconds to days
  const daysDifference = timeDifference / (1000 * 60 * 60 * 24);

  // Return true if the difference is greater than 7 days

  return Math.abs(daysDifference) > 7;
}

function getCurrentDateFormatted() {
  const today = new Date();

  const year = today.getFullYear();

  // getMonth() returns the month index (0 for January, 11 for December)
  const month = String(today.getMonth() + 1).padStart(2, '0');

  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isMoreThanADayOld(date) {
  // Get today's date and set time to midnight for accurate comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Set the time of the input date to midnight for accurate comparison
  const inputDate = new Date(date);
  inputDate.setHours(0, 0, 0, 0);

  // Calculate the difference in time between today and the input date
  const timeDifference = today - inputDate;

  // Convert the time difference from milliseconds to days
  const daysDifference = timeDifference / (1000 * 60 * 60 * 24);

  // Return true if the difference is greater than 1 days

  return Math.abs(daysDifference) > 1;
}
function isMoreThan21Days(date) {
  try {
    // Get today's date and set time to midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Set the time of the input date to midnight for accurate comparison
    const inputDate = new Date(date);
    inputDate.setHours(0, 0, 0, 0);

    // Calculate the difference in time between today and the input date
    const timeDifference = today - inputDate;

    // Convert the time difference from milliseconds to days
    const daysDifference = timeDifference / (1000 * 60 * 60 * 24);

    // Return true if the difference is greater than 7 days

    if (isNaN(daysDifference)) {
      return true;
    }

    return Math.abs(daysDifference) > 21;
  } catch (err) {
    return true;
  }
}
function isMoreThan40MinOld(date) {
  try {
    const oneHour = 60 * 40 * 1000; // 1 hour in ms
    const now = new Date().getTime(); // current time in ms
    const diff = now - new Date(date).getTime(); // diff in ms
    return diff > oneHour;
  } catch (err) {
    return true;
  }
}
function getDateXDaysAgo(numberAgo) {
  const date = new Date();
  date.setDate(date.getDate() - numberAgo);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, '0');

  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
function getTwoWeeksAgoDate() {
  const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000;
  const currentTimestamp = new Date().getTime(); // Get current timestamp
  const twoWeeksAgoSeconds = currentTimestamp - TWO_WEEKS_IN_MS; // Subtract 14 days in seconds

  // Create a new Timestamp for two weeks ago
  const twoWeeksAgoTimestamp = new Date(twoWeeksAgoSeconds).getTime();

  return twoWeeksAgoTimestamp;
}
const formatDateToDayMonthYearTime = timestamp => {
  const date = new Date(timestamp);
  const location = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  return new Intl.DateTimeFormat(location, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

const formatDateToDayMonthYear = timestamp => {
  const date = new Date(timestamp);
  const location = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  return new Intl.DateTimeFormat(location, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const isNewDaySince = lastDate => {
  const now = new Date();
  const last = new Date(lastDate);

  return now.toDateString() !== last.toDateString();
};

export {
  isMoreThan7DaysPast,
  getCurrentDateFormatted,
  isMoreThanADayOld,
  isMoreThan21Days,
  isMoreThan40MinOld,
  getDateXDaysAgo,
  getTwoWeeksAgoDate,
  formatDateToDayMonthYearTime,
  formatDateToDayMonthYear,
  isNewDaySince,
};
