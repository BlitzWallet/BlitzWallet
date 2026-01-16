export default function truncateToTwoDecimals(value) {
  try {
    if (typeof value !== 'string') {
      value = value.toString();
    }

    const [int, dec = ''] = value.toString().split('.');

    return dec.length > 0
      ? `${int}.${dec.slice(0, 2).padEnd(2, '0')}`
      : `${int}.00`;
  } catch (error) {
    console.log('Error in truncateToTwoDecimals:', error);
    return '0.00';
  }
}
