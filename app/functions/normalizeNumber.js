export function normalizeNumber(priceString) {
  if (typeof priceString !== 'string') return Number(priceString);

  let normalized = priceString.replace(/[\s']/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastPeriod = normalized.lastIndexOf('.');

  if (lastComma > lastPeriod) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  normalized = normalized.replace(/[٫⸱]/g, '.');

  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}
