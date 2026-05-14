import { decode } from 'bolt11';

export function getLightningInvoiceAmountSats(invoice, amountSats) {
  const fallbackAmount = Number(amountSats);
  if (Number.isFinite(fallbackAmount) && fallbackAmount > 0) {
    return Math.round(fallbackAmount);
  }

  const decodedInvoice = decode(invoice);
  const invoiceAmount = Number(decodedInvoice?.satoshis);
  if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
    throw new Error('Lightning invoice amount is required for USD payments');
  }

  return Math.round(invoiceAmount);
}

export function normalizeOrchestraBackendError(result, fallbackMessage) {
  const rawError = result?.error || result;
  const message =
    rawError?.message ||
    (typeof rawError === 'string' ? rawError : null) ||
    fallbackMessage;

  return {
    message,
    code: rawError?.code,
    minimumSats: rawError?.minimumSats,
  };
}

export function mapOrchestraQuoteToLightningQuote(result, invoiceAmountSats) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid Orchestra quote response');
  }

  if (result.error) {
    const backendError = normalizeOrchestraBackendError(
      result,
      'Unable to create Lightning quote',
    );
    const error = new Error(backendError.message);
    error.code = backendError.code;
    error.minimumSats = backendError.minimumSats;
    throw error;
  }

  const tokenAmountRequired = Number(result.amountIn);
  const estimatedAmmFee = Number(result.quoteFees || 0);
  const expiresAt = Number(result.expiresAt);

  if (!result.quoteId) throw new Error('Missing Orchestra quote ID');
  if (!result.depositAddress) {
    throw new Error('Missing Orchestra deposit address');
  }
  if (!Number.isFinite(tokenAmountRequired) || tokenAmountRequired <= 0) {
    throw new Error('Invalid Orchestra quote amount');
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('Invalid Orchestra quote expiration');
  }

  return {
    invoiceAmountSats,
    estimatedLightningFee: 0,
    btcAmountRequired: invoiceAmountSats,
    tokenAmountRequired,
    estimatedAmmFee,
    executionPrice: null,
    priceImpact: null,
    poolId: result.quoteId,
    fee: estimatedAmmFee,
    quoteId: result.quoteId,
    depositAddress: result.depositAddress,
    expiresAt,
    estimatedOut: result.estimatedOut,
    orchestra: true,
  };
}

export function isUsableOrchestraQuote(quote) {
  return (
    !!quote?.orchestra &&
    !!quote?.quoteId &&
    !!quote?.depositAddress &&
    Number.isFinite(Number(quote?.tokenAmountRequired)) &&
    Number(quote.tokenAmountRequired) > 0 &&
    Number(quote?.expiresAt || 0) > Date.now()
  );
}

export function isOrchestraSwapFailed(tx) {
  let details;
  try {
    details = JSON.parse(tx.details);
  } catch {
    details = tx.details;
  }

  return (
    tx?.paymentStatus === 'completed' &&
    details?.isFlashnetStablecoin === true &&
    details?.runcount > 20
  );
}
