import {
  getCachedSparkTransactions,
  getSingleTxDetails,
  getSparkBitcoinPaymentRequest,
  getSparkLightningPaymentStatus,
  getSparkLightningSendRequest,
  getSparkPaymentStatus,
  getSparkTransactions,
  querySparkHodlLightningPayments,
  sparkPaymentType,
} from '.';
import {
  LightningSendRequestStatus,
  SparkCoopExitRequestStatus,
} from '@buildonspark/spark-sdk/types';
import {
  IS_BITCOIN_REQUEST_ID,
  IS_SPARK_ID,
  IS_SPARK_REQUEST_ID,
} from '../../constants';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  bulkUpdateSparkTransactions,
  deleteSparkTransaction,
  deleteUnpaidSparkLightningTransaction,
  getAllPendingSparkPayments,
  getAllSparkTransactions,
  getAllSparkContactInvoices,
  getAllUnpaidSparkLightningInvoices,
  getAllUnpaidHoldInvoicesFromTxs,
} from './transactions';
import { transformTxToPaymentObject } from './transformTxToPayment';
import sha256Hash from '../hash';

const RESTORE_STATE_KEY = 'spark_tx_restore_state';
const MAX_BATCH_SIZE = 400;
const DEFAULT_BATCH_SIZE = 5;
const INCREMENTAL_SAVE_THRESHOLD = 200;

/**
 * Get the current restore state for an account
 */
async function getRestoreState(accountId, numSavedTxs) {
  try {
    const stateJson = await getLocalStorageItem(
      `${RESTORE_STATE_KEY}_${accountId}`,
    );

    if (!stateJson) {
      // We assume if a user has over 400 saved txs, they are fully restored
      return {
        isFullyRestored: numSavedTxs > 400 ? true : false,
        lastProcessedOffset: 0,
        lastProcessedTxId: null,
        restoredTxCount: 0,
      };
    }
    return JSON.parse(stateJson);
  } catch (error) {
    console.error('Error getting restore state:', error);
    return {
      isFullyRestored: false,
      lastProcessedOffset: 0,
      lastProcessedTxId: null,
      restoredTxCount: 0,
    };
  }
}

/**
 * Update the restore state for an account
 */
async function updateRestoreState(accountId, state) {
  try {
    await setLocalStorageItem(
      `${RESTORE_STATE_KEY}_${accountId}`,
      JSON.stringify(state),
    );
  } catch (error) {
    console.error('Error updating restore state:', error);
  }
}

/**
 * Mark restoration as complete for an account
 */
async function markRestoreComplete(accountId) {
  await updateRestoreState(accountId, {
    isFullyRestored: true,
    lastProcessedOffset: 0,
    lastProcessedTxId: null,
    restoredTxCount: 0,
    completedAt: Date.now(),
  });
}

const restoreSparkTxState = async (
  BATCH_SIZE,
  identityPubKey,
  isSendingPayment,
  mnemonic,
  accountId,
  sendWebViewRequest,
  onProgressSave = null,
) => {
  const restoredTxs = [];

  try {
    const [savedTxs, pendingTxs] = await Promise.all([
      getAllSparkTransactions({ accountId: identityPubKey, idsOnly: true }),
      getAllPendingSparkPayments(accountId),
    ]);

    const savedIds = new Set(savedTxs);

    const txsByType = {
      lightning: pendingTxs.filter(tx => tx.paymentType === 'lightning'),
      bitcoin: pendingTxs.filter(tx => tx.paymentType === 'bitcoin'),
    };
    const restoreState = await getRestoreState(accountId, savedIds.size);

    const isRestoring = !restoreState.isFullyRestored;
    let offset = isRestoring ? restoreState.lastProcessedOffset : 0;
    const localBatchSize = isRestoring ? MAX_BATCH_SIZE : BATCH_SIZE;

    console.log(
      `Restore mode: ${
        isRestoring ? 'ACTIVE' : 'NORMAL'
      }, batch size: ${localBatchSize}`,
    );

    const donationPubKey = process.env.BLITZ_SPARK_PUBLICKEY;

    const newTxsAtFront = [];
    if (isRestoring && offset > 0) {
      console.log('Checking for new transactions at the front...');
      try {
        const recentTxs = await getSparkTransactions(BATCH_SIZE, 0, mnemonic);
        const recentBatch = recentTxs.transfers || [];

        for (const tx of recentBatch) {
          if (savedIds.has(tx.id)) break;
          // Filter donations and active sends
          if (
            tx.transferDirection === 'OUTGOING' &&
            tx.receiverIdentityPublicKey === donationPubKey
          ) {
            continue;
          }
          if (tx.transferDirection === 'OUTGOING' && isSendingPayment) continue;

          const type = sparkPaymentType(tx);

          // Check against pending transactions
          if (type === 'bitcoin') {
            const duplicate = txsByType.bitcoin.find(item => {
              const details = JSON.parse(item.details);
              return (
                tx.transferDirection === details.direction &&
                tx.totalValue === details.amount &&
                details.time - new Date(tx.createdTime) < 1000 * 60 * 10
              );
            });
            if (duplicate) continue;
          } else if (type === 'lightning') {
            const duplicate = txsByType.lightning.find(item => {
              const details = JSON.parse(item.details);
              return (
                tx.transferDirection === details.direction &&
                details?.createdAt - new Date(tx.createdTime) < 1000 * 30
              );
            });
            if (duplicate) continue;
          }

          newTxsAtFront.push(tx);
        }

        if (newTxsAtFront.length > 0) {
          console.log(
            `Found ${newTxsAtFront.length} new transactions at the front`,
          );
          restoredTxs.push(...newTxsAtFront);
          // Add these new tx IDs to savedIds to avoid duplicates
          newTxsAtFront.forEach(tx => savedIds.add(tx.id));
        }
      } catch (error) {
        console.error('Error checking for new transactions:', error);
      }
    }

    let batchCounter = 0;
    let foundOverlap = false;

    while (true) {
      const txs = await getSparkTransactions(localBatchSize, offset, mnemonic);

      const batchTxs = txs.transfers || [];

      if (!batchTxs.length) {
        console.log('No more transactions found, ending restore.');
        await markRestoreComplete(accountId);
        break;
      }

      // Process batch and check for overlap simultaneously
      const newBatchTxs = [];
      for (const tx of batchTxs) {
        // Check for overlap first (most likely to break early)
        if (savedIds.has(tx.id)) {
          foundOverlap = true;
          console.log(
            'Found overlap with saved transactions, stopping restore.',
          );
          break;
        }

        // Filter out donation payments while processing
        if (
          tx.transferDirection === 'OUTGOING' &&
          tx.receiverIdentityPublicKey === donationPubKey
        ) {
          continue;
        }

        // This would cause a double transaction to be listed untill the pending items were clear
        if (tx.transferDirection === 'OUTGOING' && isSendingPayment) continue;

        const type = sparkPaymentType(tx);

        if (type === 'bitcoin') {
          const response = txsByType.bitcoin.find(item => {
            const details = JSON.parse(item.details);
            return (
              tx.transferDirection === details.direction &&
              tx.totalValue === details.amount &&
              details.time - new Date(tx.createdTime) < 1000 * 60 * 10
            );
          });

          if (response) continue;
        } else if (type === 'lightning') {
          const response = txsByType.lightning.find(item => {
            const details = JSON.parse(item.details);
            return (
              tx.transferDirection === details.direction &&
              details?.createdAt - new Date(tx.createdTime) < 1000 * 30
            );
          });

          if (response) continue;
        }

        newBatchTxs.push(tx);
      }

      // Add filtered transactions to result
      restoredTxs.push(...newBatchTxs);
      batchCounter++;

      if (isRestoring && restoredTxs.length >= INCREMENTAL_SAVE_THRESHOLD) {
        console.log(`Incremental save: ${restoredTxs.length} transactions`);

        await updateRestoreState(accountId, {
          isFullyRestored: false,
          lastProcessedOffset: offset + localBatchSize,
          lastProcessedTxId: newBatchTxs[newBatchTxs.length - 1]?.id || null,
          restoredTxCount: restoreState.restoredTxCount + restoredTxs.length,
        });

        if (onProgressSave) {
          await onProgressSave(restoredTxs.slice());
        }

        restoredTxs.length = 0;
      }

      if (foundOverlap) {
        await markRestoreComplete(accountId);
        break;
      }

      offset += localBatchSize;
    }

    console.log(`Total restored transactions: ${restoredTxs.length}`);

    return {
      txs: restoredTxs,
      isRestoreComplete: !isRestoring || foundOverlap,
    };
  } catch (error) {
    console.error('Error in spark restore history state:', error);
    return { txs: [], isRestoreComplete: false };
  }
};

// Helper function to split array into chunks
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Process a single chunk of transactions
async function processTransactionChunk(
  txChunk,
  sparkAddress,
  unpaidInvoices,
  identityPubKey,
  numberOfRestoredTxs,
  unpaidContactInvoices,
  mnemonic,
) {
  const chunkPaymentObjects = [];

  for (const tx of txChunk) {
    try {
      const paymentObject = await transformTxToPaymentObject(
        tx,
        sparkAddress,
        undefined,
        true,
        unpaidInvoices,
        identityPubKey,
        numberOfRestoredTxs,
        undefined,
        unpaidContactInvoices,
        mnemonic,
      );
      if (paymentObject) {
        chunkPaymentObjects.push(paymentObject);
      }
    } catch (err) {
      console.error('Error transforming tx:', tx.id, err);
    }
  }

  return chunkPaymentObjects;
}
let isRestoringState = false;
export async function fullRestoreSparkState({
  sparkAddress,
  batchSize = DEFAULT_BATCH_SIZE,
  chunkSize = 100,
  maxConcurrentChunks = 3, // Reduced for better responsiveness
  yieldInterval = 50, // Yield every N milliseconds
  onProgress = null, // Optional progress callback
  isSendingPayment,
  mnemonic,
  identityPubKey,
  sendWebViewRequest,
  isInitialRestore,
}) {
  try {
    if (isRestoringState) {
      console.log('already restoring state');
      return;
    }
    isRestoringState = true;
    console.log('running');

    const handleProgressSave = async txBatch => {
      if (!txBatch.length) return;

      const [unpaidInvoices, unpaidContactInvoices] = await Promise.all([
        getAllUnpaidSparkLightningInvoices(),
        getAllSparkContactInvoices(),
      ]);

      const paymentObjects = [];
      for (const tx of txBatch) {
        try {
          const paymentObject = await transformTxToPaymentObject(
            tx,
            sparkAddress,
            undefined,
            true,
            unpaidInvoices,
            identityPubKey,
            txBatch.length,
            undefined,
            unpaidContactInvoices,
            mnemonic,
          );
          if (paymentObject) {
            paymentObjects.push(paymentObject);
          }
        } catch (err) {
          console.error(
            'Error transforming tx during incremental save:',
            tx.id,
            err,
          );
        }
      }

      if (paymentObjects.length) {
        await bulkUpdateSparkTransactions(paymentObjects, 'incrementalRestore');
        console.log(
          `Incrementally saved ${paymentObjects.length} transactions`,
        );
      }
    };

    const restored = await restoreSparkTxState(
      batchSize,
      identityPubKey,
      isSendingPayment,
      mnemonic,
      identityPubKey,
      sendWebViewRequest,
      handleProgressSave,
    );
    if (!restored.txs.length) return;
    const [unpaidInvoices, unpaidContactInvoices] = await Promise.all([
      getAllUnpaidSparkLightningInvoices(),
      getAllSparkContactInvoices(),
    ]);
    const txChunks = chunkArray(restored.txs, chunkSize);

    console.log(
      `Processing ${restored.txs.length} transactions in ${txChunks.length} chunks`,
    );

    const allPaymentObjects = [];
    let processedChunks = 0;

    // Process chunks in smaller batches with yields
    for (let i = 0; i < txChunks.length; i += maxConcurrentChunks) {
      const batchChunks = txChunks.slice(i, i + maxConcurrentChunks);

      // Process this batch of chunks in parallel
      const chunkPromises = batchChunks.map(chunk =>
        processTransactionChunk(
          chunk,
          sparkAddress,
          unpaidInvoices,
          identityPubKey,
          restored.txs.length,
          unpaidContactInvoices,
          mnemonic,
        ),
      );

      try {
        const batchResults = await Promise.all(chunkPromises);
        allPaymentObjects.push(...batchResults.flat());
        processedChunks += batchChunks.length;

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            processed: processedChunks,
            total: txChunks.length,
            percentage: Math.round((processedChunks / txChunks.length) * 100),
          });
        }

        console.log(`Processed ${processedChunks}/${txChunks.length} chunks`);

        // Yield control back to main thread between batches
        if (i + maxConcurrentChunks < txChunks.length) {
          await new Promise(resolve => setTimeout(resolve, yieldInterval));
        }
      } catch (err) {
        console.error('Error processing chunk batch:', err);
      }
    }

    console.log(
      `Transformed ${allPaymentObjects.length}/${restored.txs.length} transactions`,
    );

    if (allPaymentObjects.length) {
      await bulkUpdateSparkTransactions(
        allPaymentObjects,
        `fullUpdate-waitBalance`,
      );
    }

    return allPaymentObjects.length;
  } catch (err) {
    console.log('full restore spark state error', err);
    return false;
  } finally {
    isRestoringState = false;
  }
}

let isUpdatingSparkTxStatus = false;
export const updateSparkTxStatus = async (
  mnemoninc,
  accountId,
  sendWebViewRequest,
) => {
  try {
    if (isUpdatingSparkTxStatus) {
      console.log('updateSparkTxStatus skipped: already running');
      return { shouldCheck: false };
    }
    isUpdatingSparkTxStatus = true;
    // Get all saved transactions
    console.log('running pending payments');
    const savedTxs = await getAllPendingSparkPayments(accountId);

    if (!savedTxs.length) return { updated: [], shouldCheck: true };
    const txsByType = {
      lightning: savedTxs.filter(tx => tx.paymentType === 'lightning'),
      bitcoin: savedTxs.filter(tx => tx.paymentType === 'bitcoin'),
      spark: savedTxs.filter(tx => tx.paymentType === 'spark'),
    };

    const [unpaidInvoices] = await Promise.all([
      txsByType.lightning.length
        ? getAllUnpaidSparkLightningInvoices()
        : Promise.resolve([]),
    ]);

    const unpaidInvoicesByAmount = new Map();
    unpaidInvoices.forEach(invoice => {
      const amount = invoice.amount;
      if (!unpaidInvoicesByAmount.has(amount)) {
        unpaidInvoicesByAmount.set(amount, []);
      }
      unpaidInvoicesByAmount.get(amount).push(invoice);
    });

    console.log('pending tx list', savedTxs);

    // Process different transaction types in parallel
    const [lightningUpdates, bitcoinUpdates, sparkUpdates] = await Promise.all([
      processLightningTransactions(
        txsByType.lightning,
        unpaidInvoicesByAmount,
        mnemoninc,
        accountId,
        sendWebViewRequest,
      ),
      processBitcoinTransactions(
        txsByType.bitcoin,
        mnemoninc,
        sendWebViewRequest,
        accountId,
      ),
      processSparkTransactions(txsByType.spark, mnemoninc, sendWebViewRequest),
    ]);

    const updatedTxs = [
      ...lightningUpdates,
      ...bitcoinUpdates,
      ...sparkUpdates.updatedTxs,
    ];

    if (!updatedTxs.length) return { updated: [], shouldCheck: false };

    await bulkUpdateSparkTransactions(
      updatedTxs,
      sparkUpdates.includesGift ? 'fullUpdate-waitBalance' : 'txStatusUpdate',
    );
    console.log(`Updated transactions:`, updatedTxs);
    return { updated: updatedTxs, shouldCheck: false };
  } catch (error) {
    console.error('Error in spark restore:', error);
    return { updated: [], shouldCheck: true };
  } finally {
    isUpdatingSparkTxStatus = false;
  }
};

async function processLightningTransactions(
  lightningTxs,
  unpaidInvoicesByAmount,
  mnemonic,
  accountId,
  sendWebViewRequest,
) {
  const CONCURRENCY_LIMIT = 5;
  const updatedTxs = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < lightningTxs.length; i += CONCURRENCY_LIMIT) {
    const batch = lightningTxs.slice(i, i + CONCURRENCY_LIMIT);

    const batchPromises = batch.map(tx =>
      processLightningTransaction(
        tx,
        unpaidInvoicesByAmount,
        mnemonic,
        sendWebViewRequest,
      ).catch(err => {
        console.error('Error processing lightning tx:', tx.sparkID, err);
        return null;
      }),
    );

    const results = await Promise.all(batchPromises);
    const validResults = results.filter(Boolean);
    updatedTxs.push(...validResults);
  }

  let newTxs = [];

  for (const result of updatedTxs) {
    if (!result.lookThroughTxHistory) {
      newTxs.push(result);
      continue;
    }

    const findTxResponse = await getSingleTxDetails(mnemonic, result.id);

    if (!findTxResponse) {
      // If no transaction is found just call it completed
      const details = JSON.parse(result.txStateUpdate.details);
      newTxs.push({
        tempId: result.txStateUpdate.sparkID,
        useTempId: true,
        ...result.txStateUpdate,
        details,
        paymentStatus: 'completed',
      });
      continue;
    }

    const bitcoinTransfer = findTxResponse;

    const paymentStatus = getSparkPaymentStatus(bitcoinTransfer.status);
    const expiryDate = new Date(bitcoinTransfer.expiryTime);

    // remove any stale invoices or failed payments
    if (
      (paymentStatus === 'pending' && expiryDate < Date.now()) ||
      (bitcoinTransfer.transferDirection === 'OUTGOING' &&
        bitcoinTransfer.status === 'TRANSFER_STATUS_SENDER_KEY_TWEAK_PENDING')
    ) {
      await deleteSparkTransaction(result.id);
      continue;
    }

    const transformedObject = await transformTxToPaymentObject(
      bitcoinTransfer,
      undefined,
      undefined,
      false,
      [],
      accountId,
      1,
      false,
      [],
      mnemonic,
    );

    newTxs.push(transformedObject);
  }

  return newTxs;
}

async function processLightningTransaction(
  txStateUpdate,
  unpaidInvoicesByAmount,
  mnemonic,
  sendWebViewRequest,
) {
  const details = JSON.parse(txStateUpdate.details);
  const possibleOptions = unpaidInvoicesByAmount.get(details.amount) || [];

  if (details.isHoldInvoice) {
    console.warn('Hold invoice do not check');
    return;
  }
  if (
    !IS_SPARK_REQUEST_ID.test(txStateUpdate.sparkID) &&
    !possibleOptions.length
  ) {
    console.log(txStateUpdate);
    // goes to be handled later by transform tx to payment
    return {
      id: txStateUpdate.sparkID,
      paymentStatus: '',
      paymentType: 'lightning',
      accountId: txStateUpdate.accountId,
      lookThroughTxHistory: true,
      txStateUpdate,
    };
  }

  if (!IS_SPARK_REQUEST_ID.test(txStateUpdate.sparkID)) {
    // Process invoice matching with retry logic
    const tx = await getSingleTxDetails(mnemonic, txStateUpdate.sparkID);

    if (!tx) return false;

    const userRequest = tx.userRequest;

    if (!userRequest?.id) return false;

    const savedInvoice = possibleOptions.find(
      item => item.sparkID === userRequest?.id,
    );

    const savedDetails = savedInvoice?.details
      ? JSON.parse(savedInvoice.details)
      : {};

    if (
      savedInvoice &&
      (!savedDetails.performSwaptoUSD ||
        (savedDetails.performSwaptoUSD && savedDetails.completedSwaptoUSD))
    ) {
      console.log(
        'Deleting lightning payment that was swapped to USD or a nomral LN payment that is now used',
      );
      deleteUnpaidSparkLightningTransaction(savedInvoice.sparkID);
    }

    if (savedDetails.performSwaptoUSD && !savedDetails.completedSwaptoUSD)
      return false;

    const isSendRequest = userRequest?.typename === 'LightningSendRequest';
    const invoice = userRequest
      ? isSendRequest
        ? userRequest?.encodedInvoice
        : userRequest.invoice?.encodedInvoice
      : '';
    const preimage = userRequest ? userRequest?.paymentPreimage || '' : '';

    return {
      useTempId: true,
      tempId: txStateUpdate.sparkID,
      id: tx.id ? tx.id : txStateUpdate.sparkID,
      paymentStatus: getSparkPaymentStatus(tx.status),
      paymentType: 'lightning',
      accountId: txStateUpdate.accountId,
      details: {
        ...savedDetails,
        description: savedInvoice?.description || '',
        address: invoice,
        preimage: preimage,
        shouldNavigate: savedInvoice?.shouldNavigate ?? 0,
        isLNURL: savedDetails?.isLNURL || false,
      },
    };
  }

  // Handle spark request IDs
  const sparkResponse =
    details.direction === 'INCOMING'
      ? await getSparkLightningPaymentStatus({
          lightningInvoiceId: txStateUpdate.sparkID,
          mnemonic,
        })
      : await getSparkLightningSendRequest(txStateUpdate.sparkID, mnemonic);

  const paymentStatus = getSparkPaymentStatus(sparkResponse.status);

  if (details.direction === 'OUTGOING' && paymentStatus === 'failed')
    return {
      ...txStateUpdate,
      id: txStateUpdate.sparkID,
      details: {
        ...details,
      },
      paymentStatus: 'failed',
    };

  if (!sparkResponse?.transfer) return null;

  // const fee =
  //   sparkResponse.fee.originalValue /
  //   (sparkResponse.fee.originalUnit === 'MILLISATOSHI' ? 1000 : 1);

  const preimage = sparkResponse.paymentPreimage || '';

  if (!preimage) return null;

  return {
    useTempId: true,
    tempId: txStateUpdate.sparkID,
    id: sparkResponse.transfer.sparkId,
    paymentStatus:
      paymentStatus === 'completed' || preimage ? 'completed' : paymentStatus,
    paymentType: 'lightning',
    accountId: txStateUpdate.accountId,
    details: {
      ...details,
      // fee: Math.round(fee),
      // totalFee: Math.round(fee) + (details.supportFee || 0),
      preimage: preimage,
    },
  };
}

async function processBitcoinTransactions(
  bitcoinTxs,
  mnemonic,
  sendWebViewRequest,
  accountId,
) {
  const lastRun = await getLocalStorageItem('lastRunBitcoinTxUpdate');

  const now = Date.now();
  const cooldownPeriod = 1000 * 60; // 60 seconds
  let shouldBlockSendCheck = null;

  if (lastRun && now - JSON.parse(lastRun) < cooldownPeriod) {
    console.log('Blocking bitcoin transaction processing');
    shouldBlockSendCheck = true;
    return [];
  } else {
    console.log('Updating bitcoin transaction processing last run time');
    shouldBlockSendCheck = false;
    await setLocalStorageItem('lastRunBitcoinTxUpdate', JSON.stringify(now));
  }
  const updatedTxs = [];

  for (const txStateUpdate of bitcoinTxs) {
    const details = JSON.parse(txStateUpdate.details);

    if (
      details.direction === 'INCOMING' ||
      !IS_BITCOIN_REQUEST_ID.test(txStateUpdate.sparkID)
    ) {
      if (!IS_SPARK_ID.test(txStateUpdate.sparkID)) {
        const allPayments = await getAllSparkTransactions({ accountId });
        const foundPayment = allPayments.find(payment => {
          if (payment.paymentType === 'bitcoin') {
            const details = JSON.parse(payment.details);
            if (
              details.onChainTxid === txStateUpdate.sparkID &&
              payment.sparkID !== txStateUpdate.sparkID
            )
              return true;
          }
        });
        if (foundPayment) {
          const newDetails = JSON.parse(foundPayment.details);
          const oldDetails = JSON.parse(txStateUpdate.details);

          if (
            sha256Hash(JSON.stringify(foundPayment)) ===
            sha256Hash(JSON.stringify(txStateUpdate))
          )
            continue;

          updatedTxs.push({
            useTempId: true,
            tempId: txStateUpdate.sparkID,
            id: foundPayment.sparkID,
            paymentStatus: foundPayment.paymentStatus,
            paymentType: 'bitcoin',
            accountId: foundPayment.accountId,
            details: {
              ...newDetails,
              address: oldDetails.address || '',
              description: oldDetails.description || '',
            },
          });
        }
        continue;
      }

      const transfer = await getSingleTxDetails(
        mnemonic,
        txStateUpdate.sparkID,
      );

      if (!transfer) continue;

      updatedTxs.push({
        id: txStateUpdate.sparkID,
        paymentStatus: getSparkPaymentStatus(transfer.status),
        paymentType: 'bitcoin',
        accountId: txStateUpdate.accountId,
      });
    } else {
      if (shouldBlockSendCheck) continue;
      const sparkResponse = await getSparkBitcoinPaymentRequest(
        txStateUpdate.sparkID,
        mnemonic,
      );

      if (!sparkResponse?.transfer) {
        if (
          sparkResponse?.coopExitTxid &&
          (!details.onChainTxid || !details.expiresAt)
        ) {
          updatedTxs.push({
            useTempId: true,
            tempId: txStateUpdate.sparkID,
            id: txStateUpdate.sparkID,
            paymentStatus: 'pending',
            paymentType: 'bitcoin',
            accountId: txStateUpdate.accountId,
            details: {
              ...details,
              onChainTxid: sparkResponse.coopExitTxid,
              expiresAt: sparkResponse.expiresAt || '',
            },
          });
        }

        if (
          sparkResponse.status === SparkCoopExitRequestStatus.EXPIRED ||
          sparkResponse.status === SparkCoopExitRequestStatus.FAILED
        ) {
          updatedTxs.push({
            id: txStateUpdate.sparkID,
            paymentStatus: 'failed',
            paymentType: 'bitcoin',
            accountId: txStateUpdate.accountId,
            details,
          });
        }
        continue;
      }

      updatedTxs.push({
        useTempId: true,
        tempId: txStateUpdate.sparkID,
        id: sparkResponse.transfer.sparkId,
        paymentStatus: 'completed', // getSparkPaymentStatus(sparkResponse.status)
        paymentType: 'bitcoin',
        accountId: txStateUpdate.accountId,
        details: {
          ...details,
          onChainTxid: sparkResponse.coopExitTxid,
        },
      });
    }
  }

  return updatedTxs;
}

async function processSparkTransactions(
  sparkTxs,
  mnemonic,
  sendWebViewRequest,
) {
  let includesGift = false;
  let updatedTxs = [];
  for (const txStateUpdate of sparkTxs) {
    const details = JSON.parse(txStateUpdate.details);
    if (IS_SPARK_ID.test(txStateUpdate.sparkID)) {
      const findTxResponse = await getSingleTxDetails(
        mnemonic,
        txStateUpdate.sparkID,
      );

      if (!findTxResponse) continue;

      if (details.isGift) {
        includesGift = true;
      }

      updatedTxs.push({
        id: txStateUpdate.sparkID,
        paymentStatus: getSparkPaymentStatus(findTxResponse.status),
        paymentType: 'spark',
        accountId: txStateUpdate.accountId,
      });
    } else {
      if (details.isGift) {
        // dont process lrc20 pending gift payments, will be handled by getLRC20Transactions function that loops every 10s
        continue;
      }
      updatedTxs.push({
        id: txStateUpdate.sparkID,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: txStateUpdate.accountId,
      });
    }
  }

  return { updatedTxs, includesGift };
}

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
