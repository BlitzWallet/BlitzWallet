export default function formatTokensNumber(amount, decimals) {
  try {
    const result = (amount / 10 ** decimals).toFixed(decimals);
    return decimals > 0 ? result.replace(/\.?0+$/, '') : result;
  } catch (error) {
    console.log('error formatting tokens number', error.message);
    return 0;
  }
}
