import i18next from 'i18next';

export default function formatBalanceAmount(
  formattingAmount,
  useMillionDenomination,
  masterInfoObject,
) {
  try {
    if (!formattingAmount) {
      return '0';
    }

    const millionDemoniationSetting =
      useMillionDenomination !== undefined && useMillionDenomination;

    // Check if the input ends with a decimal point (for display purposes)
    const inputStr = String(formattingAmount);
    const hasTrailingDecimal = inputStr.trim().endsWith('.');

    const numericValue = parseFloat(inputStr.replace(/[^\d.-]/g, ''));

    if (isNaN(numericValue)) return '0';

    const useSpaces = masterInfoObject?.thousandsSeperator === 'space';

    // MILLION / BILLION
    if (millionDemoniationSetting && Math.abs(numericValue) >= 1_000_000) {
      // Check if it should be formatted as billions (1,000M+ becomes 1B+)
      const unit =
        Math.abs(numericValue) >= 1_000_000_000
          ? { div: 1_000_000_000, suffix: 'B' }
          : { div: 1_000_000, suffix: 'M' };

      let formatted = (numericValue / unit.div).toFixed(1);
      if (formatted.endsWith('.0')) formatted = formatted.slice(0, -2);

      const [intPart, decPart] = formatted.split('.');

      const grouped = useSpaces
        ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
        : new Intl.NumberFormat()
            .format(parseInt(intPart))
            .replace(/[^\d]/g, '');

      return decPart
        ? `${grouped}.${decPart}${unit.suffix}`
        : `${grouped}${unit.suffix}`;
    }

    // SPACE MODE
    if (useSpaces) {
      const [intRaw, decRaw] = String(inputStr).split('.');
      const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

      if (decRaw) {
        return `${grouped}.${decRaw.slice(0, 2)}`;
      } else if (hasTrailingDecimal) {
        return `${grouped}.`;
      } else {
        return grouped;
      }
    }

    // LOCAL FORMAT
    const formatted = new Intl.NumberFormat(i18next.language || 'en', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(inputStr);

    // If user is typing a decimal point, append it
    if (hasTrailingDecimal && !formatted.includes('.')) {
      return formatted + '.';
    }

    return formatted;
  } catch (err) {
    console.log('format balance amount error', err);
    return '0';
  }
}
