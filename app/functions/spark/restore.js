import { querySparkHodlLightningPayments } from '.';
import { acquire } from './walletRuntime';
import {
  isStuckPendingLightning,
  markFullPassDone,
  getMigrationMarker,
  projectBreezPayments,
} from './paymentIngest';
import {
  bulkUpdateSparkTransactions,
  deleteUnpaidSparkLightningTransaction,
  getAllPendingSparkPayments,
  getAllUnpaidSparkLightningInvoices,
  getAllUnpaidHoldInvoicesFromTxs,
} from './transactions';
import fetchBackend from '../../../db/handleBackend';
import i18next from 'i18next';

const PAGE_SIZE = 100;
// Breather between pages so a big history doesn't flood the SDK and SQLite.
const PAGE_PAUSE_MS = 400;
const SYNC_TIMEOUT_MS = 60000;
// Newest payments inspected by the pending-status sweep (local Breez DB read).
const PENDING_SWEEP_WINDOW = 100;

let isRestoringState = false;
// Latest restore requested while one was running: run it once afterwards so a
// balance commit that lands mid-restore (e.g. a spend from another device)
// still gets a pass that can see its payment.
let queuedRestore = null;
export async function fullRestoreSparkState(options) {
  if (isRestoringState) {
    queuedRestore = options;
    return;
  }
  try {
    return await runFullRestoreSparkState(options);
  } finally {
    const next = queuedRestore;
    queuedRestore = null;
    if (next) setTimeout(() => fullRestoreSparkState(next), PAGE_PAUSE_MS * 5);
  }
}

// Connect-time diff between Breez history and the Blitz table. Breez imports
// history silently on its first sync after a restart (no events), so this
// paged listPayments pass is what makes that history visible. Newest first;
// once a complete pass has happened, a page with nothing to write ends the run.
// Returns the number of rows written (false on failure).
async function runFullRestoreSparkState({
  isSendingPayment,
  mnemonic,
  identityPubKey,
  isInitialRestore = true,
}) {
  isRestoringState = true;
  try {
    const handle = await acquire(mnemonic, { mode: 'client', borrow: true });
    // A timed-out sync still leaves the local Breez store readable.
    if (isInitialRestore) await handle.sync(SYNC_TIMEOUT_MS);

    const marker = await getMigrationMarker(identityPubKey);
    let lastWalk = marker.fullPassDone ? marker.fullWalk : null;
    let offset = 0;
    let written = 0;
    let reachedEnd = false;
    let newestTs = 0;
    let newerSeen = 0;
    for (;;) {
      const page = await handle.listPayments({ limit: PAGE_SIZE, offset });
      if (!page.length) {
        reachedEnd = true;
        break;
      }
      if (!offset) newestTs = page[0].timestamp;
      if (lastWalk) {
        newerSeen += page.filter(p => p.timestamp > lastWalk.newestTs).length;
      }
      const result = await projectBreezPayments(page, {
        accountId: identityPubKey,
        updateType: 'transactions',
        skipOutgoing: isSendingPayment,
      });
      written += result.written;
      offset += page.length;
      if (page.length < PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
      if (lastWalk && result.records.length === 0) {
        const surplus = await handle.listPayments({
          limit: 1,
          offset: lastWalk.count + newerSeen,
        });
        if (!surplus.length) {
          // Store size confirmed: record it so the next pass compares from here.
          await markFullPassDone(identityPubKey, {
            count: lastWalk.count + newerSeen,
            newestTs,
          });
          break;
        }
        lastWalk = null; // gap below: walk to the end
      }
      await new Promise(r => setTimeout(r, PAGE_PAUSE_MS));
    }
    if (reachedEnd) {
      await markFullPassDone(identityPubKey, { count: offset, newestTs });
    }
    return written;
  } catch (err) {
    console.log('full restore spark state error', err);
    return false;
  } finally {
    isRestoringState = false;
  }
}

function shouldRunOnThisTick(runcount, lastRunTimestamp) {
  if (runcount < 10) return true; // first 10 calls: let the 10s interval handle it naturally
  if (runcount > 22) return false; // after 21 calls, stop backoff and check every tick to avoid infinite backoff

  if (!lastRunTimestamp) return true;

  const backoffRun = runcount - 10; // 0-indexed backoff phase
  const backoffMs = Math.min(
    10_000 * Math.pow(2, backoffRun), // 10s, 20s, 40s, 80s...
    300_000, // cap at 5 minutes
  );

  return Date.now() - lastRunTimestamp >= backoffMs;
}

export async function checkFlashnetStablecoinStatusLogic(
  tx,
  contactsPrivateKey,
  publicKey,
) {
  try {
    const details =
      typeof tx.details === 'string' ? JSON.parse(tx.details) : tx.details;
    if (!details?.isFlashnetStablecoin || !details?.quoteId) return null;

    const runcount = details.runcount || 0;

    // Skip this tick if we haven't waited long enough
    if (!shouldRunOnThisTick(runcount, details.lastRunTimestamp)) return null;

    const statusResult = await fetchBackend(
      'checkFlashnetStablecoinStatus',
      {
        quoteId: details.quoteId,
        sourceSparkAddress: details.sourceSparkAddress,
        sparkTxHash: tx.sparkID,
      },
      contactsPrivateKey,
      publicKey,
    );

    if (!statusResult || statusResult.error)
      return {
        id: tx.sparkID,
        paymentStatus: details.runcount === 21 ? 'completed' : 'pending',
        paymentType: tx.paymentType,
        accountId: tx.accountId,
        details: {
          ...details,
          runcount: runcount + 1,
          lastRunTimestamp: Date.now(), // <-- persist when we last fetched
        },
      };

    const newStatus =
      statusResult.status === 'completed' || details.runcount === 21
        ? 'completed'
        : ['refunded', 'failed'].includes(statusResult.status)
        ? 'failed'
        : null;

    if (
      newStatus === 'failed' &&
      statusResult.refundTxHash &&
      statusResult.refundTxHash !== tx.sparkID
    ) {
      bulkUpdateSparkTransactions([
        {
          id: statusResult.refundTxHash,
          paymentStatus: 'completed',
          paymentType: 'unknown',
          accountId: tx.accountId,
          details: {
            description: i18next.t('constants.stablecoinRefundReceived'),
          },
        },
      ]).catch(err =>
        console.error('Error updating refund tx description:', err),
      );
    }

    if (!newStatus) return null;

    if (
      details.sarFundingTx &&
      newStatus === 'completed' &&
      statusResult.sparkTxHash &&
      statusResult.sparkTxHash !== tx.sparkID
    ) {
      bulkUpdateSparkTransactions([
        {
          id: statusResult.sparkTxHash,
          paymentStatus: 'completed',
          paymentType: 'unknown',
          accountId: tx.accountId,
          details: {
            description: i18next.t(
              'screens.inAccount.sendAndReplace.acceptingDescription',
            ),
            isSARIncoming: true,
          },
        },
      ]).catch(err =>
        console.error('Error updating SAR incoming tx description:', err),
      );
    }

    return {
      id: tx.sparkID,
      paymentStatus: newStatus,
      paymentType: tx.paymentType,
      accountId: tx.accountId,
      details: {
        ...details,
        runcount: runcount + 1,
        lastRunTimestamp: Date.now(), // <-- persist when we last fetched
      },
    };
  } catch {
    return null;
  }
}

let isUpdatingSparkTxStatus = false;
// Resolves pending rows against Breez: direct lookup by payment id, plus the
// newest payments (catches legacy rows keyed by SSP request ids / txids), all
// through the same projection as live events. Applies the 16-day rule to
// outgoing Lightning rows that never resolve.
export const updateSparkTxStatus = async (
  mnemoninc,
  accountId,
  forceRefresh = false,
  contactsPrivateKey = null,
  publicKey = null,
) => {
  try {
    if (isUpdatingSparkTxStatus) {
      console.log('updateSparkTxStatus skipped: already running');
      return { shouldCheck: false };
    }
    isUpdatingSparkTxStatus = true;
    const { didWork, response } = await getAllPendingSparkPayments(accountId);

    // sparkIDs the DB currently reports as pending, threaded back so callers can
    // detect a stale in-memory "pending" row after a lost SPARK_TX_UPDATE event.
    // undefined when the DB read itself failed: callers skip the drift backstop.
    const pendingIds = didWork ? response.map(tx => tx.sparkID) : undefined;

    if (!response.length)
      return {
        updated: [],
        shouldCheck: true,
        pendingIds: didWork ? response : undefined,
      };

    const rows = response.map(row => ({
      row,
      details: JSON.parse(row.details || '{}'),
    }));
    const flashnetUpdates = [];

    // Stablecoin sends via Flashnet orchestration have their own checker.
    if (contactsPrivateKey && publicKey) {
      for (const { row, details } of rows) {
        if (!details.isFlashnetStablecoin) continue;
        const update = await checkFlashnetStablecoinStatusLogic(
          row,
          contactsPrivateKey,
          publicKey,
        );
        if (update) flashnetUpdates.push(update);
      }
    }

    const handle = await acquire(mnemoninc, { mode: 'client', borrow: true });
    const candidates = new Map();
    for (const { row, details } of rows) {
      if (details.isFlashnetStablecoin || details.isHoldInvoice) continue;
      // Incoming placeholders are resolved by the payment event itself.
      if (row.paymentType === 'unknown' && !details.amount) continue;
      try {
        const payment = await handle.getPayment(
          details.breezPaymentId || row.sparkID,
        );
        if (payment) candidates.set(payment.id, payment);
      } catch (err) {
        console.log('pending payment lookup error', row.sparkID, err);
      }
    }
    try {
      for (const payment of await handle.listPayments({
        limit: PENDING_SWEEP_WINDOW,
      })) {
        candidates.set(payment.id, payment);
      }
    } catch (err) {
      console.log('pending sweep list error', err);
    }

    const projected = await projectBreezPayments([...candidates.values()], {
      accountId,
      updateType: 'txStatusUpdate',
    });
    // Still pending after the sweep: apply the wedged-Lightning-send rule.
    const resolved = new Set(projected.records.map(r => r.tempId || r.id));
    const stuck = rows
      .filter(
        ({ row, details }) =>
          !resolved.has(row.sparkID) &&
          isStuckPendingLightning(
            details.direction,
            row.paymentType,
            row.paymentStatus,
            details.time ?? details.createdAt,
          ),
      )
      .map(({ row, details }) => ({
        id: row.sparkID,
        tempId: row.sparkID,
        paymentStatus: 'failed',
        paymentType: row.paymentType,
        accountId: row.accountId,
        details,
      }));

    const direct = [...flashnetUpdates, ...stuck];
    if (direct.length)
      await bulkUpdateSparkTransactions(direct, 'txStatusUpdate');

    const updatedTxs = [...projected.records, ...direct];
    return { updated: updatedTxs, shouldCheck: false, pendingIds };
  } catch (error) {
    console.error('Error in spark restore:', error);
    return { updated: [], shouldCheck: true };
  } finally {
    isUpdatingSparkTxStatus = false;
  }
};

export const checkHodlInvoicePaymentStatuses = async (
  mnemonic,
  identityPubKey,
) => {
  try {
    const [unpaidInvoices, pendingHoldInvoices] = await Promise.all([
      getAllUnpaidSparkLightningInvoices(),
      getAllUnpaidHoldInvoicesFromTxs(),
    ]);

    if (!unpaidInvoices?.length && !pendingHoldInvoices?.length) return;

    const holdInvoices = unpaidInvoices
      .map(inv => ({
        ...inv,
        details:
          typeof inv.details === 'string'
            ? JSON.parse(inv.details)
            : inv.details,
      }))
      .filter(inv => inv.details?.isHoldInvoice === true);

    if (!holdInvoices.length && !pendingHoldInvoices.length) return;

    const paymentHashes = [...holdInvoices, ...pendingHoldInvoices]
      .map(inv => inv.details.paymentHash)
      .filter(Boolean);

    const queryResult = await querySparkHodlLightningPayments({
      paymentHashes,
      mnemonic,
    });
    console.log(queryResult, 'query result');
    if (!queryResult.didWork || !queryResult?.paidPreimages?.length) return;

    const txsToAdd = [];
    const txsToUpdate = [];
    const idsToDelete = [];

    const unpaidByHash = new Map(
      holdInvoices
        .filter(inv => inv.details?.paymentHash)
        .map(inv => [inv.details.paymentHash, inv]),
    );

    const pendingByHash = new Map(
      pendingHoldInvoices
        .filter(inv => inv.details?.paymentHash)
        .map(inv => [inv.details.paymentHash, inv]),
    );

    for (const preimageRequest of queryResult.paidPreimages) {
      console.log(preimageRequest, 'reimagme requset in array');
      const hashHex =
        typeof preimageRequest.paymentHash === 'string'
          ? preimageRequest.paymentHash
          : Buffer.from(preimageRequest.paymentHash).toString('hex');

      // Check both lists for a match
      const matchFromUnpaid = unpaidByHash.get(hashHex);
      const matchFromPending = pendingByHash.get(hashHex);

      // Handle unpaid invoice matches (existing logic)
      if (matchFromUnpaid) {
        if (!preimageRequest.transferId) continue;

        if (preimageRequest.status === 0) {
          txsToAdd.push({
            id: preimageRequest.transferId,
            paymentStatus: 'pending',
            paymentType: 'lightning',
            accountId: identityPubKey,
            details: {
              amount: matchFromUnpaid.amount || preimageRequest.satValue,
              fee: 0,
              time: preimageRequest.createdTime
                ? new Date(preimageRequest.createdTime).getTime()
                : Date.now(),
              direction: 'INCOMING',
              description: matchFromUnpaid.description,
              isHoldInvoice: true,
              encryptedPreimage: matchFromUnpaid.details.encryptedPreimage,
              paymentHash: matchFromUnpaid.details.paymentHash,
              dateAddedToDb: Date.now(),
            },
          });
        }

        if (preimageRequest.status === 0 || preimageRequest.status === 2) {
          idsToDelete.push(matchFromUnpaid.sparkID);
        }
      }

      // Handle pending hold invoice matches (new logic)
      if (matchFromPending) {
        if (preimageRequest.status === 1) {
          txsToUpdate.push({
            id: matchFromPending.sparkID,
            paymentStatus: 'completed',
            paymentType: matchFromPending.paymentType,
            accountId: identityPubKey,
            details: {
              ...matchFromPending.details,
            },
          });
        } else if (preimageRequest.status === 2) {
          txsToUpdate.push({
            id: matchFromPending.sparkID,
            paymentStatus: 'failed',
            paymentType: matchFromPending.paymentType,
            accountId: identityPubKey,
            details: {
              ...matchFromPending.details,
            },
          });
        }
      }
    }

    const allTxChanges = [...txsToAdd, ...txsToUpdate];

    if (allTxChanges.length > 0) {
      await bulkUpdateSparkTransactions(allTxChanges);
    }

    for (const sparkID of idsToDelete) {
      await deleteUnpaidSparkLightningTransaction(sparkID);
    }
  } catch (err) {
    console.error('Error checking hold invoice payment statuses:', err);
  }
};
