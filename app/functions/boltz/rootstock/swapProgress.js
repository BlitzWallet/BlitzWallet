import i18next from 'i18next';
import {
  bulkUpdateSparkTransactions,
  insertSparkTransactionPlaceholders,
} from '../../spark/transactions';
import {
  isRootstockSwapSuccessStatus,
  isRootstockSwapTerminalFailureStatus,
} from './swapStatus';

export function getRootstockSwapStatusLabel(status) {
  if (!status) return '';
  if (status) {
    return i18next.t(`settings.viewRoostockSwaps.${status}`);
  }

  return String(status)
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function getRootstockPlaceholderPaymentStatus(status) {
  if (isRootstockSwapSuccessStatus(status)) return 'completed';
  if (isRootstockSwapTerminalFailureStatus(status)) return 'failed';
  return 'pending';
}

export function buildRootstockSwapDetails({
  swapId,
  invoiceId,
  invoice,
  amountSat,
  feeSat,
  status = 'swap.created',
  createdTime = Date.now(),
  extraDetails = {},
}) {
  return {
    direction: 'INCOMING',
    isRootstockSwap: true,
    rootstockSwapId: swapId,
    rootstockSwapInvoiceId: invoiceId,
    rootstockSwapStatus: status,
    rootstockSwapStatusLabel: getRootstockSwapStatusLabel(status),
    rootstockSwapStatusUpdatedAt: Date.now(),
    amount: Number(amountSat) || 0,
    fee: Number(feeSat) || 0,
    time: createdTime,
    createdTime,
    description: i18next.t('transactionLabelText.roostockSwap'),
    address: invoice || '',
    ...extraDetails,
  };
}

export async function insertRootstockSwapPlaceholder({
  swapId,
  accountId,
  invoiceId,
  invoice,
  amountSat,
  feeSat,
  createdTime,
}) {
  if (!swapId || !accountId) return false;

  return insertSparkTransactionPlaceholders([
    {
      id: swapId,
      accountId,
      paymentStatus: 'pending',
      paymentType: 'lightning',
      details: buildRootstockSwapDetails({
        swapId,
        invoiceId,
        invoice,
        amountSat,
        feeSat,
        status: 'swap.created',
        createdTime,
      }),
    },
  ]);
}

export async function updateRootstockSwapPlaceholder({
  swapId,
  accountId,
  invoiceId,
  invoice,
  amountSat,
  feeSat,
  status,
  createdTime,
  extraDetails,
}) {
  if (!swapId || !accountId || !status) return false;

  return bulkUpdateSparkTransactions([
    {
      id: swapId,
      accountId,
      // Update-only: once the settled Lightning payment has replaced this
      // placeholder (its row renamed swapId -> sparkId), there is no placeholder
      // left to update. Without this, the bulk update would re-insert a duplicate
      // row, leaving both the placeholder and the confirmed payment in history.
      updateOnly: true,
      paymentStatus: getRootstockPlaceholderPaymentStatus(status),
      paymentType: 'lightning',
      details: buildRootstockSwapDetails({
        swapId,
        invoiceId,
        invoice,
        amountSat,
        feeSat,
        status,
        createdTime,
        extraDetails,
      }),
    },
  ]);
}
