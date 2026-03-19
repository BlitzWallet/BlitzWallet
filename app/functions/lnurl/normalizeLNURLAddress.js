import { decodeLNURL } from './bench32Formmater';
import { formatLightningAddress } from './index';

export default function normalizeLNURLAddress(address) {
  if (!address) return null;
  if (address.toLowerCase().startsWith('lnurl')) {
    try {
      const decoded = decodeLNURL(address);
      if (decoded) return formatLightningAddress(decoded);
    } catch (_) {}
    return null;
  }
  return address;
}
