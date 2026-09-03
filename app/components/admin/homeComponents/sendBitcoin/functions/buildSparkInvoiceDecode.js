import { deriveSparkAddress } from '../../../../../functions/gift/deriveGiftWallet';

/**
 * Builds the `address` payload for a decoded Spark payment target.
 *
 * A bare `spark1...` / `sp1p...` string (or the address inside a `spark:` URI)
 * can be either a plain spark address OR a receiver-generated Spark invoice.
 * Invoices keep the historical send-to-derived-address behavior. Invoice
 * metadata is used only to prefill the editable amount and expected asset.
 *
 * @param {object} params
 * @param {object} params.decodeResponse - Output of decodeSparkInvoice
 * @param {string} [params.label]       - BIP21 label (spark: URI option)
 * @param {string} [params.message]     - BIP21 message (spark: URI option)
 * @param {string|number} [params.bip21Amount] - BIP21 amount in sats (spark: URI option)
 * @returns {object} The `address` object stored on the Spark parsedInvoice
 */
export default function buildSparkInvoiceDecode({
  decodeResponse,
  label,
  message,
  bip21Amount,
}) {
  const isTokenInvoice = decodeResponse?.paymentType === 'tokens';
  const expectedToken = isTokenInvoice
    ? decodeResponse?.tokenIdentifierBech32m ?? null
    : null;

  const sparkAddress = deriveSparkAddress(
    Buffer.from(decodeResponse.identityPublicKey, 'hex'),
  );

  return {
    address: sparkAddress.address,
    message: message ?? null,
    label: label ?? decodeResponse.memo ?? null,
    network: 'Spark',
    expectedReceive: decodeResponse?.paymentType ?? 'sats',
    expectedToken,
    amount: null,
    decodedAmount: null,
  };
}
