export default function formatBalanceAmount(
  formattingAmount,
  useMillionDenomination,
) {
  try {
    if (!formattingAmount) {
      return '0';
    }
    const millionDemoniationSetting =
      useMillionDenomination !== undefined && useMillionDenomination;

    const numericValue = parseFloat(
      String(formattingAmount).replace(/[^\d.-]/g, ''),
    );

    if (millionDemoniationSetting && Math.abs(numericValue) >= 1_000_000) {
      // Check if it should be formatted as billions (1,000M+ becomes 1B+)
      if (Math.abs(numericValue) >= 1_000_000_000) {
        const billions = numericValue / 1_000_000_000;
        let formatted = billions.toFixed(1);
        if (formatted.endsWith('.0')) {
          formatted = formatted.slice(0, -2);
        }
        const [intPart, decPart] = formatted.split('.');
        const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return decPart ? `${spacedInt}.${decPart}B` : `${spacedInt}B`;
      }

      // Otherwise format as millions
      const millions = numericValue / 1_000_000;
      let formatted = millions.toFixed(1);

      if (formatted.endsWith('.0')) {
        formatted = formatted.slice(0, -2);
      }

      const [intPart, decPart] = formatted.split('.');
      const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

      return decPart ? `${spacedInt}.${decPart}M` : `${spacedInt}M`;
    }

    let amount = String(formattingAmount);

    // Detect decimal separator: prioritize comma, then dot
    let decimalSeparator = amount.includes(',')
      ? ','
      : amount.includes('.')
      ? '.'
      : null;

    let [integerPart, decimalPart] = decimalSeparator
      ? amount.split(decimalSeparator)
      : [amount, null];

    // Format the integer part with a space as a thousands separator
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Rejoin with the decimal part if it exists

    const finalForm = decimalPart
      ? `${integerPart}${decimalSeparator}${decimalPart}`
      : decimalSeparator
      ? `${integerPart}${decimalSeparator}`
      : integerPart;

    return finalForm;
  } catch (err) {
    console.log('format balance amount error', err);
    return '0';
  }
}
