import { mapBreezPayment } from './paymentMapper';
import { isFlashnetTransfer } from './handleFlashnetTransferIds';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  bulkUpdateSparkTransactions,
  deleteSparkContactTransaction,
  deleteUnpaidSparkLightningTransaction,
  getAllPendingSparkPayments,
  getAllSparkContactInvoices,
  getAllSparkTransactions,
  getAllUnpaidSparkLightningInvoices,
  getBulkPaymentGroupTransferIds,
  getBulkSparkTransactions,
  updateSparkTransactionDetails,
} from './transactions';

// Breez payments are projected into the Blitz SPARK_TRANSACTIONS table (the
// only thing the UI renders). One path serves live events, the connect-time
// history diff and the pending-status sweep.

// An outgoing Lightning payment still pending this long is wedged: mark it
// failed so the user can retry.
const STUCK_PENDING_MS = 16 * 24 * 60 * 60 * 1000;
// Clock skew / in-flight slack when deciding what predates the migration.
const MARKER_SLACK_MS = 5 * 60 * 1000;
const LEGACY_WITHDRAW_WINDOW_MS = 10 * 60 * 1000;

export const isStuckPendingLightning = (
  direction,
  paymentType,
  paymentStatus,
  time,
) =>
  direction === 'OUTGOING' &&
  paymentType === 'lightning' &&
  paymentStatus === 'pending' &&
  Number(time) > 0 &&
  Date.now() - Number(time) > STUCK_PENDING_MS;

const parse = value => {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

// Per-identity migration marker. hadRows: the Blitz DB already had history
// when Breez was first connected (pre-migration rows must be reconciled, never
// re-imported); a fresh install imports everything. fullPassDone: the paged
// history diff has reached the end once, so later passes may stop early.
const markerKey = accountId => `breezMigrationV1:${accountId}`;
const markers = new Map();

export function getMigrationMarker(accountId) {
  if (!markers.has(accountId)) {
    markers.set(
      accountId,
      (async () => {
        const raw = await getLocalStorageItem(markerKey(accountId));
        let marker = raw ? parse(raw) : null;
        if (!marker?.startedAt) {
          const rows = await getAllSparkTransactions({ accountId, limit: 1 });
          marker = {
            startedAt: Date.now() - MARKER_SLACK_MS,
            hadRows: rows.length > 0,
            fullPassDone: false,
          };
          await setLocalStorageItem(
            markerKey(accountId),
            JSON.stringify(marker),
          );
        }
        return marker;
      })().catch(err => {
        markers.delete(accountId);
        throw err;
      }),
    );
  }
  return markers.get(accountId);
}

export async function markFullPassDone(accountId) {
  const marker = await getMigrationMarker(accountId);
  if (marker.fullPassDone) return;
  marker.fullPassDone = true;
  await setLocalStorageItem(markerKey(accountId), JSON.stringify(marker));
}

export function clearMigrationMarkerCache() {
  markers.clear();
}

// Annotation: what Blitz knows about a payment that Breez does not (unpaid
// invoice rows hold description / LNURL / swap flags; contact request rows hold
// the sender). Returns the annotation plus the cleanup to run once the row is
// written.
function createAnnotator(unpaidInvoices, contactInvoices) {
  const unpaid = unpaidInvoices.map(row => ({ row, d: parse(row.details) }));
  const after = new Map(); // payment id -> () => void
  const meta = new Map(); // payment id -> { isSwap, tempId }

  const getAnnotation = ({ id, txHash, invoice, paymentHash }) => {
    const ln = unpaid.find(
      ({ row, d }) =>
        (paymentHash &&
          (row.sparkID === paymentHash || d.paymentHash === paymentHash)) ||
        (invoice && d.address === invoice),
    );
    if (ln) {
      const {
        amount,
        fee,
        totalFee,
        supportFee,
        time,
        direction,
        createdAt,
        address,
        preimage,
        ...rest
      } = ln.d;
      const isSwap = !!rest.performSwaptoUSD;
      const isTempSwap = !!(rest.isLiquidSwap || rest.isRootstockSwap);
      meta.set(id, {
        isSwap,
        tempId: isTempSwap
          ? rest.isRootstockSwap
            ? rest.rootstockSwapId
            : ln.row.sparkID
          : null,
      });
      after.set(id, () => {
        if (isSwap) {
          updateSparkTransactionDetails(ln.row.sparkID, {
            performSwaptoUSD: true,
            finalSparkID: id,
          });
        } else {
          deleteUnpaidSparkLightningTransaction(ln.row.sparkID);
        }
      });
      return {
        ...rest,
        description: ln.row.description || rest.description || '',
        shouldNavigate: ln.row.shouldNavigate,
      };
    }
    const contact = contactInvoices.find(
      row => row.sparkID === id || (txHash && row.sparkID === txHash),
    );
    if (contact) {
      after.set(id, () => deleteSparkContactTransaction(contact.sparkID));
      return {
        sendingUUID: contact.sendersPubkey,
        description: contact.description || '',
      };
    }
    return {};
  };

  return { getAnnotation, after, meta };
}

// Pre-migration pending rows carry SSP request ids / L1 txids, not the
// transfer UUID Breez uses; match them on invoice / payment hash / txid.
function findLegacyPending(payment, pool) {
  const d = payment.details;
  const incoming = payment.paymentType === 'receive';
  const index = pool.findIndex(({ row, d: rd }) => {
    if (d?.type === 'lightning') {
      return (
        row.paymentType === 'lightning' &&
        ((d.invoice && rd.address === d.invoice) ||
          (rd.paymentHash && rd.paymentHash === d.htlcDetails?.paymentHash))
      );
    }
    if (row.paymentType !== 'bitcoin') return false;
    if (d?.type === 'withdraw') {
      if (rd.direction !== 'OUTGOING') return false;
      if (rd.onChainTxid) return rd.onChainTxid === d.txId;
      return (
        Number(rd.amount) === Number(payment.amount) &&
        Math.abs(Number(rd.time) - payment.timestamp * 1000) <
          LEGACY_WITHDRAW_WINDOW_MS
      );
    }
    if (d?.type === 'deposit' && incoming) {
      return (
        rd.onChainTxid === d.txId &&
        (rd.vout == null || Number(rd.vout) === Number(d.vout))
      );
    }
    return false;
  });
  return index < 0 ? null : pool.splice(index, 1)[0].row;
}

/**
 * Writes Breez payments into the Blitz table.
 * - existing pending row -> status reconcile (never rewrites amounts/fees)
 * - legacy pending row (SSP id / txid) -> renamed to the Breez id
 * - no row -> full insert, unless it predates the migration on a device that
 *   already had history (hidden swap legs, donations, bulk children)
 * @returns {{ written: number, records: object[] }}
 */
export async function projectBreezPayments(
  payments,
  { accountId, updateType = 'transactions', skipOutgoing = false } = {},
) {
  const list = (payments || []).filter(Boolean);
  if (!accountId || !list.length) return { written: 0, records: [] };

  const [marker, bulkIds, unpaid, contacts] = await Promise.all([
    getMigrationMarker(accountId),
    getBulkPaymentGroupTransferIds(accountId),
    getAllUnpaidSparkLightningInvoices(),
    getAllSparkContactInvoices(),
  ]);
  const annotator = createAnnotator(unpaid || [], contacts || []);
  const seenTokenHashes = new Map();

  const ctx = mode => ({
    accountId,
    mode,
    isHidden: id => isFlashnetTransfer(id) || bulkIds?.has?.(id),
    existingBySparkId: id => seenTokenHashes.get(id),
    getAnnotation: annotator.getAnnotation,
  });

  const fulls = [];
  for (const payment of list) {
    if (skipOutgoing && payment.paymentType === 'send') continue;
    const full = mapBreezPayment(payment, ctx('INSERT_FULL'));
    if (!full) continue;
    if (payment.method === 'token') {
      seenTokenHashes.set(full.sparkID, { breezPaymentId: payment.id });
    }
    fulls.push({ payment, full });
  }
  if (!fulls.length) return { written: 0, records: [] };

  const existing = await getBulkSparkTransactions(
    fulls.map(f => f.full.sparkID),
  );
  let pool = null;
  const loadPool = async () => {
    if (!pool) {
      const { response } = await getAllPendingSparkPayments(accountId);
      pool = response.map(row => ({ row, d: parse(row.details) }));
    }
    return pool;
  };

  const records = [];
  const writtenPaymentIds = [];
  for (const { payment, full } of fulls) {
    const row = existing.get?.(full.sparkID);
    const reconcile = () =>
      mapBreezPayment(payment, {
        ...ctx('RECONCILE'),
        getAnnotation: undefined,
      });

    if (row) {
      if (row.paymentStatus === 'pending' && full.paymentStatus !== 'pending') {
        records.push({
          ...reconcile(),
          id: full.sparkID,
          tempId: full.sparkID,
        });
      }
      continue;
    }

    const legacy = findLegacyPending(payment, await loadPool());
    if (legacy) {
      records.push({
        ...reconcile(),
        id: full.sparkID,
        useTempId: true,
        tempId: legacy.sparkID,
      });
      continue;
    }

    if (marker.hadRows && payment.timestamp * 1000 <= marker.startedAt)
      continue;

    const meta = annotator.meta.get(payment.id);
    const record = { ...full, id: full.sparkID };
    if (meta?.isSwap) record.paymentStatus = 'pending';
    else if (
      isStuckPendingLightning(
        record.details.direction,
        record.paymentType,
        record.paymentStatus,
        record.details.time,
      )
    ) {
      record.paymentStatus = 'failed';
    }
    if (meta?.tempId) {
      record.useTempId = true;
      record.tempId = meta.tempId;
    }
    records.push(record);
    writtenPaymentIds.push(payment.id);
  }

  if (!records.length) return { written: 0, records };
  const didWrite = await bulkUpdateSparkTransactions(records, updateType);
  if (didWrite) {
    for (const id of writtenPaymentIds) {
      try {
        annotator.after.get(id)?.();
      } catch (err) {
        console.log('payment annotation cleanup error', err);
      }
    }
  }
  return { written: didWrite ? records.length : 0, records };
}
