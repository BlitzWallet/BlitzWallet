import {
  decodeSparkAddress,
  encodeBech32mTokenIdentifier,
  getNetworkFromSparkAddress,
} from './sparkAddressCodec';

/**
 * Decode a Spark address / invoice into the flattened shape the send flow
 * consumes (see buildSparkInvoiceDecode).
 *
 * Pure offline decode via sparkAddressCodec (protobuf + bech32m + secp256k1
 * validation); no wallet is involved. Breez has no public decoder for this shape.
 */
export async function decodeSparkInvoice(sparkAddress) {
  const network = getNetworkFromSparkAddress(sparkAddress);
  const decoded = decodeSparkAddress(sparkAddress, network);
  const fields = decoded.sparkInvoiceFields;
  const payment = fields?.paymentType;
  const tokenIdentifier =
    payment?.type === 'tokens' ? payment.tokenIdentifier ?? null : null;

  return {
    network,
    identityPublicKey: decoded.identityPublicKey,
    version: fields?.version,
    invoiceId: fields?.id,
    paymentType: payment?.type || 'sats',
    tokenIdentifier,
    tokenIdentifierBech32m:
      tokenIdentifier != null
        ? encodeBech32mTokenIdentifier({
            tokenIdentifier: Buffer.from(tokenIdentifier, 'hex'),
            network,
          })
        : null,
    amount: payment?.amount != null ? payment.amount.toString() : null,
    memo: fields?.memo ?? null,
    senderPublicKey: fields?.senderPublicKey ?? null,
    expiryTime: fields?.expiryTime ?? null,
    signature: decoded.signature ?? null,
  };
}
