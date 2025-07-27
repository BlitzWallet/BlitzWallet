import {bech32} from 'bech32';

/**
 * Encodes an HTTPS/Onion URL into a bech32-encoded LNURL
 * @param {string} url - The URL to encode
 * @returns {string} The bech32-encoded LNURL
 */
export function encodeLNURL(uniqueName) {
  try {
    const urlBytes = Buffer.from(
      `https://blitz-wallet.com/.well-known/lnurlp/${uniqueName}`,
      'utf8',
    );

    const words = bech32.toWords(urlBytes);

    const lnurl = bech32.encode('lnurl', words, 2000);

    return lnurl.toUpperCase();
  } catch (error) {
    return `${uniqueName}@blitz-wallet.com`;
  }
}
