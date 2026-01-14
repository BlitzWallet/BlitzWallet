export default function formatTokensNumber(amount, decimals) {
  try {
    if (amount == null || decimals == null) {
      return '0';
    }

    let numAmount = amount;
    if (typeof amount === 'bigint') {
      numAmount = Number(amount);
    }

    let numDecimals = decimals;
    if (typeof decimals === 'bigint') {
      numDecimals = Number(decimals);
    }

    if (isNaN(numAmount) || isNaN(numDecimals)) {
      return '0';
    }

    const result = (numAmount / 10 ** numDecimals).toFixed(numDecimals);
    return numDecimals > 0 ? result.replace(/\.?0+$/, '') : result;
  } catch (error) {
    console.log('error formatting tokens number', error.message, {
      amount,
      decimals,
      amountType: typeof amount,
      decimalsType: typeof decimals,
    });
    return '0';
  }
}
