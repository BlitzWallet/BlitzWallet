import i18next from 'i18next';
import { breezLiquidPaymentWrapper } from '../breezLiquid';
import { sparkReceivePaymentWrapper } from './payments';
import {
  bulkUpdateSparkTransactions,
  deleteUnpaidSparkLightningTransaction,
  getActiveLiquidSwapInvoice,
  getSparkTransactionBySparkId,
  hasPaidSparkLightningInvoice,
  insertSparkTransactionPlaceholders,
  updateSparkTransactionDetails,
} from './transactions';

// How long a generated Liquid->Spark swap invoice stays reusable. The payment
// happens almost immediately, so this only needs to cover an app restart that
// happens mid-swap; we track it explicitly to avoid SDK timestamp-unit guessing.
const LIQUID_SWAP_INVOICE_EXPIRY_SECONDS = 60 * 60;
const LIQUID_SWAP_MAX_QUOTE_ATTEMPTS = 8;
const LIQUID_SWAP_LOCKUP_TX_FEE_SATS = 34;
const LIQUID_SWAP_CLAIM_TX_FEE_SATS = 19;
const LIQUID_SWAP_SERVICE_FEE_RATE = 0.001;
const LIQUID_SWAP_PARTNER_FEE_RATE = 0.01;
const LIQUID_SWAP_ROUNDING_BUFFER_SATS = 2;
const LIQUID_SWAP_RETRY_PERCENT_STEP = 0.1;
const LIQUID_SWAP_RETRY_FEE_MULTIPLIER = 2;
const LIQUID_SWAP_UNKNOWN_UPPER_BOUND_SATS = Number.MAX_SAFE_INTEGER;

// In-memory reentrancy guard. Liquid balance updates can fire several times in
// quick succession (sync + payment events); without this they would each kick
// off a concurrent swap and race over the same funds.
let isRunningLiquidSwap = false;

function normalizeSats(value) {
  return Math.max(Math.ceil(Number(value) || 0), 0);
}

function getPercentageFeeSat(amountSat, feeRate) {
  return Math.ceil(Math.max(Number(amountSat) || 0, 0) * feeRate);
}

function getModeledBaseSwapFeeSat(amountSat) {
  return (
    LIQUID_SWAP_LOCKUP_TX_FEE_SATS +
    LIQUID_SWAP_CLAIM_TX_FEE_SATS +
    getPercentageFeeSat(amountSat, LIQUID_SWAP_SERVICE_FEE_RATE)
  );
}

function getPartnerFeeSat(amountSat) {
  return getPercentageFeeSat(amountSat, LIQUID_SWAP_PARTNER_FEE_RATE);
}

function getEstimatedSwapFeeSat(amountSat) {
  return getModeledBaseSwapFeeSat(amountSat) + getPartnerFeeSat(amountSat);
}

function getTrustedOrEstimatedFeeSat(amountSat, trustedFeeSat) {
  if (trustedFeeSat === undefined || trustedFeeSat === null) {
    return getEstimatedSwapFeeSat(amountSat);
  }

  return normalizeSats(trustedFeeSat);
}

function getTotalRequiredSat(amountSat, trustedFeeSat) {
  return (
    amountSat +
    getTrustedOrEstimatedFeeSat(amountSat, trustedFeeSat) +
    LIQUID_SWAP_ROUNDING_BUFFER_SATS
  );
}

function invoiceFitsSpendable({ amountSat, feeSat, spendableSat }) {
  return amountSat > 0 && getTotalRequiredSat(amountSat, feeSat) < spendableSat;
}

function getInvoiceAmountForFee(spendableSat, feeSat) {
  let low = 1;
  let high = Math.max(Math.floor(Number(spendableSat) || 0) - 1, 0);
  let bestAmountSat = 0;

  while (low <= high) {
    const amountSat = Math.floor((low + high) / 2);

    if (
      invoiceFitsSpendable({
        amountSat,
        feeSat,
        spendableSat,
      })
    ) {
      bestAmountSat = amountSat;
      low = amountSat + 1;
    } else {
      high = amountSat - 1;
    }
  }

  return bestAmountSat;
}

function getNextAmountAfterQuoteFailure({ amountSat, spendableSat }) {
  const feeAwareTargetSat = getInvoiceAmountForFee(spendableSat);
  if (feeAwareTargetSat > 0 && feeAwareTargetSat < amountSat) {
    return feeAwareTargetSat;
  }

  const percentStepSat = Math.ceil(amountSat * LIQUID_SWAP_RETRY_PERCENT_STEP);
  const feeStepSat =
    getEstimatedSwapFeeSat(amountSat) * LIQUID_SWAP_RETRY_FEE_MULTIPLIER;
  const reductionSat = Math.max(1, Math.min(percentStepSat, feeStepSat));

  return Math.floor(amountSat - reductionSat);
}

function getSwapError(error, fallback) {
  return error?.message || error || fallback;
}

async function cleanupUnusedSwapInvoice(invoiceId) {
  if (!invoiceId) return;
  try {
    await deleteUnpaidSparkLightningTransaction(invoiceId);
  } catch (err) {
    console.log('liquidToSparkSwap invoice cleanup error', err);
  }
}

async function createSparkSwapInvoice({
  amountSat,
  mnemonic,
  sendWebViewRequest,
}) {
  const invoiceResponse = await sparkReceivePaymentWrapper({
    paymentType: 'lightning',
    amountSats: amountSat,
    memo: i18next.t('swapMessages.liquid'),
    mnemoinc: mnemonic,
    sendWebViewRequest,
    shouldNavigate: false,
    includeSparkAddress: false,
    expirySeconds: LIQUID_SWAP_INVOICE_EXPIRY_SECONDS,
    extraDetails: {
      isLiquidSwapCandidate: true,
      swapAmountSat: amountSat,
      swapExpiresAt: Date.now() + LIQUID_SWAP_INVOICE_EXPIRY_SECONDS * 1000,
    },
  });
  if (!invoiceResponse.didWork) throw new Error(invoiceResponse.error);
  return {
    placeholderId: invoiceResponse.data.id,
    bolt11: invoiceResponse.invoice,
    amountSat,
  };
}

async function quoteLiquidLightningFee(bolt11) {
  const feeResponse = await breezLiquidPaymentWrapper({
    paymentType: 'lightning',
    invoice: bolt11,
    getFee: true,
  });
  if (!feeResponse.didWork) {
    throw new Error(
      getSwapError(feeResponse.error, 'Unable to estimate Liquid swap fee'),
    );
  }
  return Math.ceil(Number(feeResponse.fee) || 0);
}

async function getReusableSwapInvoice(spendableSat) {
  const existingInvoice = await getActiveLiquidSwapInvoice();
  const bolt11 = existingInvoice?.details?.swapInvoice;
  const amountSat = Math.floor(
    Number(existingInvoice?.details?.swapAmountSat || existingInvoice?.amount),
  );

  if (!existingInvoice) return null;
  if (!bolt11 || !amountSat) {
    await cleanupUnusedSwapInvoice(existingInvoice.sparkID);
    return null;
  }

  try {
    const feeSat = await quoteLiquidLightningFee(bolt11);
    if (
      invoiceFitsSpendable({
        amountSat,
        feeSat,
        spendableSat,
      })
    ) {
      return {
        placeholderId: existingInvoice.sparkID,
        bolt11,
        amountSat,
        feeSat,
      };
    }
  } catch (err) {
    console.log('liquidToSparkSwap reusable invoice fee quote error', err);
  }

  await cleanupUnusedSwapInvoice(existingInvoice.sparkID);
  return null;
}

async function createQuotedSwapInvoice({
  spendableSat,
  mnemonic,
  sendWebViewRequest,
}) {
  const triedAmounts = new Set();
  let nextAmountSat = getInvoiceAmountForFee(spendableSat);
  let upperBoundSat = LIQUID_SWAP_UNKNOWN_UPPER_BOUND_SATS;
  let lastError;

  for (
    let attempt = 0;
    attempt < LIQUID_SWAP_MAX_QUOTE_ATTEMPTS;
    attempt += 1
  ) {
    if (nextAmountSat <= 0) break;
    if (triedAmounts.has(nextAmountSat)) nextAmountSat -= 1;
    triedAmounts.add(nextAmountSat);

    const invoice = await createSparkSwapInvoice({
      amountSat: nextAmountSat,
      mnemonic,
      sendWebViewRequest,
    });

    let feeSat;
    try {
      feeSat = await quoteLiquidLightningFee(invoice.bolt11);
    } catch (err) {
      lastError = err;
      await cleanupUnusedSwapInvoice(invoice.placeholderId);
      upperBoundSat = Math.min(upperBoundSat, nextAmountSat - 1);
      nextAmountSat = getNextAmountAfterQuoteFailure({
        amountSat: nextAmountSat,
        spendableSat,
      });
      nextAmountSat = Math.min(nextAmountSat, upperBoundSat);
      continue;
    }

    const targetAmountSat = Math.min(
      getInvoiceAmountForFee(spendableSat, feeSat),
      upperBoundSat,
    );
    if (targetAmountSat <= 0) {
      await cleanupUnusedSwapInvoice(invoice.placeholderId);
      throw new Error('Insufficient Liquid balance to cover swap fees');
    }

    if (
      nextAmountSat !== targetAmountSat &&
      !triedAmounts.has(targetAmountSat)
    ) {
      await cleanupUnusedSwapInvoice(invoice.placeholderId);
      nextAmountSat = targetAmountSat;
      continue;
    }

    if (
      invoiceFitsSpendable({
        amountSat: nextAmountSat,
        feeSat,
        spendableSat,
      })
    ) {
      return { ...invoice, feeSat };
    }

    await cleanupUnusedSwapInvoice(invoice.placeholderId);
    nextAmountSat = Math.min(targetAmountSat, nextAmountSat - 1);
  }

  throw new Error(
    getSwapError(lastError, 'Unable to create a payable Liquid swap invoice'),
  );
}

async function persistSwapInvoiceDetails({
  placeholderId,
  bolt11,
  amountSat,
  feeSat,
}) {
  await updateSparkTransactionDetails(placeholderId, {
    isLiquidSwap: true,
    isLiquidSwapCandidate: false,
    swapInvoice: bolt11,
    swapAmountSat: amountSat,
    swapFeeSat: feeSat,
    fee: feeSat,
    swapExpiresAt: Date.now() + LIQUID_SWAP_INVOICE_EXPIRY_SECONDS * 1000,
  });
}

// Sweeps spendable Liquid funds into Spark by paying a locally
// generated fixed-amount Spark lightning invoice. Because we mint the invoice
// ourselves we know its id up front, so we insert a pending placeholder
// transaction immediately (visible in history) and the existing Spark
// reconciliation updates that same row when the payment settles.
export default async function liquidToSparkSwap({
  mnemonic,
  sparkInformation,
  spendableSat,
  sendWebViewRequest,
}) {
  if (isRunningLiquidSwap) {
    return { didWork: false, error: 'Liquid swap already in progress' };
  }
  isRunningLiquidSwap = true;

  const accountId = sparkInformation?.identityPubKey;
  let placeholderId;
  let swapInvoice;
  try {
    if (!accountId) throw new Error('Spark wallet not connected');
    const normalizedSpendableSat = Math.floor(Number(spendableSat) || 0);
    if (normalizedSpendableSat <= 1) {
      throw new Error('Insufficient Liquid balance to cover swap fees');
    }

    swapInvoice =
      (await getReusableSwapInvoice(normalizedSpendableSat)) ||
      (await createQuotedSwapInvoice({
        spendableSat: normalizedSpendableSat,
        mnemonic,
        sendWebViewRequest,
      }));

    placeholderId = swapInvoice.placeholderId;
    await persistSwapInvoiceDetails(swapInvoice);

    const pendingSwapTx = {
      id: placeholderId,
      accountId,
      paymentStatus: 'pending',
      paymentType: 'lightning',
      details: {
        direction: 'INCOMING',
        isLiquidSwap: true,
        amount: swapInvoice.amountSat,
        fee: swapInvoice.feeSat,
        time: Date.now(),
        createdTime: Date.now(),
        description: i18next.t('swapMessages.liquid'),
      },
    };

    // Show the pending swap in history right away once the swap starts.
    await insertSparkTransactionPlaceholders([pendingSwapTx]);

    const paymentResponse = await breezLiquidPaymentWrapper({
      paymentType: 'lightning',
      invoice: swapInvoice.bolt11,
    });

    if (!paymentResponse.didWork) {
      throw new Error(
        getSwapError(paymentResponse.error, 'Liquid swap payment failed'),
      );
    }

    return { didWork: true };
  } catch (err) {
    console.log('liquidToSparkSwap error', err);
    // Don't leave the placeholder pending forever. If the payment actually went
    // through despite a failed response, a later settled payment will remap
    // onto this id and flip it back to completed.
    if (placeholderId && accountId) {
      const savedTransaction = await getSparkTransactionBySparkId(
        placeholderId,
        accountId,
      );

      if (savedTransaction.paymentStatus !== 'completed') {
        try {
          await bulkUpdateSparkTransactions([
            {
              id: placeholderId,
              accountId,
              paymentStatus: 'failed',
              paymentType: 'lightning',
              details: { isLiquidSwap: true },
            },
          ]);
        } catch (cleanupErr) {
          console.log(
            'liquidToSparkSwap placeholder cleanup error',
            cleanupErr,
          );
        }
      }
    }
    return { didWork: false, error: err.message };
  } finally {
    isRunningLiquidSwap = false;
  }
}
