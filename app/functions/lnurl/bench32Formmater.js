import {bech32} from 'bech32';

/**
 * Encodes an HTTPS/Onion URL into a bech32-encoded LNURL
 * @param {string} url - The URL to encode
 * @returns {string} The bech32-encoded LNURL
 */
export function encodeLNURL(uniqueName) {
  try {
    const urlBytes = Buffer.from(
      `https://blitzwalletapp.com/p/${uniqueName}`,
      'utf8',
    );

    const words = bech32.toWords(urlBytes);

    const lnurl = bech32.encode('lnurl', words, 2000);

    return lnurl.toUpperCase();
  } catch (error) {
    return `${uniqueName}@blitzwalletapp.com`;
  }
}

/**
 * Decodes an bech32-encoded LNURL into a HTTPS/Onion URL
 * @param {string} url - The bech32-encoded LNURL
 * @returns {string} The URL to encode
 */
export function decodeLNURL(lnurl) {
  try {
    const words = bech32.decode(lnurl.toLowerCase(), 2000).words;
    const bytes = bech32.fromWords(words);
    const decoder = new TextDecoder('utf-8', {fatal: true});
    const url = decoder.decode(Uint8Array.from(bytes));
    return url;
  } catch (error) {
    console.log(error, 'error decoding lnurl');
    return false;
  }
}
