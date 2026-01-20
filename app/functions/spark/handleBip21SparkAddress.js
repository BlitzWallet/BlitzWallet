import { decode, encode } from 'bip21';
import { crashlyticsLogReport } from '../crashlyticsLogs';
/**
 * Formats a Liquid 'spark' BIP21 payment URI from an address, amount, and optional message.
 *
 *  Encodes into a BIP21 URI string using the 'spark' protocol.
 * Also logs the process to Crashlytics for debugging purposes.
 *
 * @param {Object} params
 * @param {string} params.address - The destination Liquid address.
 * @param {number} params.amountSat - Amount in satoshis to include in the URI.
 * @param {string} [params.message] - Optional message or label to include.
 * @param {string} params.prefix - The prefix to the bip21 address.
 * @returns {string} A formatted BIP21 spark URI (e.g., spark:address?amount=...&message=...), or an empty string if an error occurs.
 */

export function formatBip21Address({
  address = '',
  amountSat,
  message,
  prefix = '',
}) {
  try {
    const formattedAmount = amountSat;
    crashlyticsLogReport('Formatting bip21 liquid address');
    let liquidBip21;
    if (message) {
      liquidBip21 = encode(
        address,
        {
          amount: formattedAmount,
          message: message,
          label: message,
        },
        prefix,
      );
    } else {
      liquidBip21 = encode(
        address,
        {
          amount: formattedAmount,
        },
        prefix,
      );
    }

    return liquidBip21;
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
/**
 * Decodes a Liquid 'spark' BIP21 payment URI into its parts.
 *
 * Logs the decoding action to Crashlytics.
 *
 * @param {string} address - The BIP21 spark URI to decode.
 * @returns {Object|string} Decoded object containing address, amount, and parameters, or an empty string if an error occurs.
 */

export function decodeBip21Address(address, prefix) {
  try {
    crashlyticsLogReport('decoding bip21 spark');

    return decode(address, prefix);
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
