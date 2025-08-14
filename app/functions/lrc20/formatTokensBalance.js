export default function formatTokensNumber(amount, decimals) {
  try {
    return (amount / 10 ** decimals).toFixed(decimals).replace(/\.?0+$/, '');
  } catch (error) {
    console.log('error formatting tokens number', error.message);
    return 0;
  }
}
