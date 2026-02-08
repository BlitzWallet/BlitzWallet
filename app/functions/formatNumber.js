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

    // Extract the decimal portion to count digits
    const decimalMatch = inputStr.trim().match(/\.(\d+)$/);
    const decimalDigits = decimalMatch ? decimalMatch[1].length : 0;

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
    // Get the locale's decimal separator
    const localeDecimalSeparator = new Intl.NumberFormat(
      i18next.language || 'en',
    )
      .format(1.1)
      .charAt(1); // Gets the separator from "1.1" or "1,1"

    // Set minimumFractionDigits based on actual decimal digits typed
    // This preserves trailing zeros (e.g., .00 shows both zeros)
    const minFractionDigits = Math.min(decimalDigits, 2);

    const formatted = new Intl.NumberFormat(i18next.language || 'en', {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: 2,
    }).format(numericValue);

    // If user is typing a decimal point, append the locale-appropriate separator
    if (hasTrailingDecimal && !formatted.includes(localeDecimalSeparator)) {
      return formatted + localeDecimalSeparator;
    }

    return formatted;
  } catch (err) {
    console.log('format balance amount error', err);
    return '0';
  }
}
