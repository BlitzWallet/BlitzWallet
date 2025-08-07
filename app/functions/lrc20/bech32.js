import {bech32m} from 'bech32';

/**
 * Converts a raw token identifier (hex string) to bech32m format
 * @param {string} rawTokenId - Raw token identifier as hex string
 * @param {string} prefix - Bech32m prefix (e.g., 'btkn' for Bitcoin tokens)
 * @returns {string} Bech32m encoded token identifier
 */
export const convertToBech32m = (rawTokenId, prefix = 'btkn') => {
  try {
    const cleanHex = rawTokenId.replace(/^0x/, '');

    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }

    const words = bech32m.toWords(bytes);

    const encoded = bech32m.encode(prefix, words);

    return encoded;
  } catch (error) {
    throw new Error(`Failed to convert token identifier: ${error.message}`);
  }
};

/**
 * Converts a bech32m token identifier back to raw hex format
 * @param {string} bech32mTokenId - Bech32m encoded token identifier
 * @returns {string} Raw token identifier as hex string
 */
export const convertFromBech32m = bech32mTokenId => {
  try {
    const decoded = bech32m.decode(bech32mTokenId);

    const bytes = bech32m.fromWords(decoded.words);

    const hex = bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');

    return hex;
  } catch (error) {
    throw new Error(
      `Failed to decode bech32m token identifier: ${error.message}`,
    );
  }
};
