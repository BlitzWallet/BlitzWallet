const WEEK_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_GROUPING = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const YEAR_IN_MILLS = 1000 * 60 * 60 * 24 * 365;
const MONTH_IN_MILLS = 1000 * 60 * 60 * 24 * 31;
const WEEK_IN_MILLS = 1000 * 60 * 60 * 24 * 7;
const DAY_IN_MILLS = 1000 * 60 * 60 * 24;

//   // Optionally, if you want to show something like the past few years dynamically:
//   const currentYear = new Date().getFullYear();
//   const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i); // e.g., [2025, 2024, 2023, 2022, 2021]

export {
  WEEK_OPTIONS,
  MONTH_GROUPING,
  YEAR_IN_MILLS,
  MONTH_IN_MILLS,
  DAY_IN_MILLS,
  WEEK_IN_MILLS,
};
