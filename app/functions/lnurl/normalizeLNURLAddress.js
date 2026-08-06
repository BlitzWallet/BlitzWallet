import { decodeLNURL } from './bench32Formmater';
import { formatLightningAddress, BLITZ_DOMAINS } from './index';

function isTrustedProviderUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/\.$/, '');
    return urlObj.protocol === 'https:' && BLITZ_DOMAINS.includes(hostname);
  } catch (_) {
    return false;
  }
}

export default function normalizeLNURLAddress(address) {
  if (!address) return null;
  if (address.toLowerCase().startsWith('lnurl')) {
    try {
      const decoded = decodeLNURL(address);
      if (decoded && isTrustedProviderUrl(decoded)) {
        return formatLightningAddress(decoded);
      }
    } catch (_) {}
    return null;
  }
  return address;
}
