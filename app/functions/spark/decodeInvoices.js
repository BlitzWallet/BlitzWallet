import {
  getIsNativeRuntime,
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
} from '../../../context-store/webViewContext';
import { getSparkAddressUtils } from './lazySpark';
import { validateWebViewResponse } from '.';

/**
 * Decode a Spark address / invoice into the flattened shape the send flow
 * consumes (see buildSparkInvoiceDecode).
 *
 * Runtime-split so the WebView path never evaluates @buildonspark/spark-sdk:
 * on WebView we dispatch to the in-page bundle (which already holds the SDK);
 * on native we lazy-load the SDK's canonical decoder (protobuf + bech32m +
 * secp256k1 validation). Both return the same flattened object.
 */
export async function decodeSparkInvoice(sparkAddress) {
  if (!getIsNativeRuntime()) {
    const response = await sendWebViewRequestGlobal(
      OPERATION_TYPES.decodeSparkInvoice,
      { sparkAddress },
    );
    return validateWebViewResponse(response, 'Not able to decode spark invoice');
  }

  const {
    decodeSparkAddress,
    getNetworkFromSparkAddress,
    encodeBech32mTokenIdentifier,
  } = await getSparkAddressUtils();

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
