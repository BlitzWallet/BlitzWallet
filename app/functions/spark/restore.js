import {
  findTransactionTxFromTxHistory,
  getSparkBitcoinPaymentRequest,
  getSparkLightningPaymentStatus,
  getSparkLightningSendRequest,
  getSparkTransactions,
} from '.';
import {IS_BITCOIN_REQUEST_ID, IS_SPARK_REQUEST_ID} from '../../constants';
import {
  bulkUpdateSparkTransactions,
  deleteUnpaidSparkLightningTransaction,
  getAllPendingSparkPayments,
  getAllUnpaidSparkLightningInvoices,
} from './transactions';
import {transformTxToPaymentObject} from './transformTxToPayment';

export const restoreSparkTxState = async (BATCH_SIZE, savedTxs) => {
  const restoredTxs = [];

  try {
    const savedIds = new Set(savedTxs?.map(tx => tx.sparkID) || []);

    let offset = 0;
    let localBatchSize = !savedIds.size ? 100 : BATCH_SIZE;
    const donationPubKey = process.env.BLITZ_SPARK_PUBLICKEY;

    while (true) {
      const txs = await getSparkTransactions(localBatchSize, offset);
      const batchTxs = txs.transfers || [];

      if (!batchTxs.length) {
        console.log('No more transactions found, ending restore.');
        break;
      }

      // Process batch and check for overlap simultaneously
      let foundOverlap = false;
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

        newBatchTxs.push(tx);
      }

      // Add filtered transactions to result
      restoredTxs.push(...newBatchTxs);

      if (foundOverlap) {
        break;
      }

      offset += localBatchSize;
    }

    console.log(`Total restored transactions: ${restoredTxs.length}`);
    console.log(`Unique saved IDs: ${savedIds.size}`);

    return {txs: restoredTxs};
  } catch (error) {
    console.error('Error in spark restore history state:', error);
    return {txs: []};
  }
};

export async function fullRestoreSparkState({
  sparkAddress,
  batchSize = 50,
  savedTxs,
}) {
  try {
    const restored = await restoreSparkTxState(batchSize, savedTxs);

    const newPaymentObjects = [];

    for (const tx of restored.txs) {
      try {
        const paymentObject = transformTxToPaymentObject(
          tx,
          sparkAddress,
          undefined,
          true,
        );
        if (paymentObject) {
          newPaymentObjects.push(paymentObject);
        }
      } catch (err) {
        console.error('Error transforming tx:', tx.id, err);
      }
    }

    console.log(
      `Transformed ${newPaymentObjects.length}/${restored.txs.length} transactions`,
    );

    if (newPaymentObjects.length) {
      // Update DB state of payments but dont hold up thread
      bulkUpdateSparkTransactions(newPaymentObjects);
    }

    return newPaymentObjects.length;
  } catch (err) {
    console.log('full restore spark state error', err);
    return false;
  }
}

export const findSignleTxFromHistory = async (txid, BATCH_SIZE) => {
  let restoredTx;
  try {
    // here we do not want to save any tx to be shown, we only want to flag that it came from restore and then when we get the actual notification of it we can block the navigation
    let start = 0;

    let foundOverlap = false;

    do {
      const txs = await getSparkTransactions(start + BATCH_SIZE, start);
      const batchTxs = txs.transfers || [];

      if (!batchTxs.length) {
        console.log('No more transactions found, ending restore.');
        break;
      }

      // Check for overlap with saved transactions
      const overlap = batchTxs.find(tx => tx.id === txid);

      if (overlap) {
        console.log('Found overlap with saved transactions, stopping restore.');
        foundOverlap = true;
        restoredTx = overlap;
      }

      start += BATCH_SIZE;
    } while (!foundOverlap);

    // Filter out any already-saved txs or dontation payments
    console.log(`Restored transaction`, restoredTx);

    return {tx: restoredTx};
  } catch (error) {
    console.error('Error in spark restore history state:', error);
    return {tx: null};
  }
};

export const updateSparkTxStatus = async () => {
  try {
    // Get all saved transactions
    console.log('running pending payments');
    const savedTxs = await getAllPendingSparkPayments();

    if (!savedTxs.length) return {updated: []};
    const txsByType = {
      lightning: savedTxs.filter(tx => tx.paymentType === 'lightning'),
      bitcoin: savedTxs.filter(tx => tx.paymentType === 'bitcoin'),
      spark: savedTxs.filter(tx => tx.paymentType === 'spark'),
    };

    const [unpaidInvoices, incomingTxs] = await Promise.all([
      txsByType.lightning.length
        ? getAllUnpaidSparkLightningInvoices()
        : Promise.resolve([]),
      txsByType.bitcoin.length
        ? getSparkTransactions(100, 0).then(data => data.transfers || [])
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

    const incomingTxsMap = new Map(incomingTxs.map(tx => [tx.id, tx]));

    console.log('pending tx list', savedTxs);

    // Process different transaction types in parallel
    const [lightningUpdates, bitcoinUpdates, sparkUpdates] = await Promise.all([
      processLightningTransactions(txsByType.lightning, unpaidInvoicesByAmount),
      processBitcoinTransactions(txsByType.bitcoin, incomingTxsMap),
      processSparkTransactions(txsByType.spark),
    ]);

    const updatedTxs = [
      ...lightningUpdates,
      ...bitcoinUpdates,
      ...sparkUpdates,
    ];

    if (!updatedTxs.length) return {updated: []};

    await bulkUpdateSparkTransactions(updatedTxs, 'restoreTxs');
    console.log(`Updated transactions:`, updatedTxs);
    return {updated: updatedTxs};
  } catch (error) {
    console.error('Error in spark restore:', error);
    return {updated: []};
  }
};

async function processLightningTransactions(
  lightningTxs,
  unpaidInvoicesByAmount,
) {
  const CONCURRENCY_LIMIT = 5;
  const updatedTxs = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < lightningTxs.length; i += CONCURRENCY_LIMIT) {
    const batch = lightningTxs.slice(i, i + CONCURRENCY_LIMIT);

    const batchPromises = batch.map(tx =>
      processLightningTransaction(tx, unpaidInvoicesByAmount).catch(err => {
        console.error('Error processing lightning tx:', tx.sparkID, err);
        return null;
      }),
    );

    const results = await Promise.all(batchPromises);
    const validResults = results.filter(Boolean);
    updatedTxs.push(...validResults);
  }

  return updatedTxs;
}

async function processLightningTransaction(
  txStateUpdate,
  unpaidInvoicesByAmount,
) {
  const details = JSON.parse(txStateUpdate.details);

  if (txStateUpdate.paymentType === 'lightning') {
    const possibleOptions = unpaidInvoicesByAmount.get(details.amount) || [];

    if (
      !IS_SPARK_REQUEST_ID.test(txStateUpdate.sparkID) &&
      !possibleOptions.length
    ) {
      return {
        id: txStateUpdate.sparkID,
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: txStateUpdate.accountId,
      };
    }

    if (!IS_SPARK_REQUEST_ID.test(txStateUpdate.sparkID)) {
      // Process invoice matching with retry logic
      const matchResult = await findMatchingInvoice(
        possibleOptions,
        txStateUpdate.sparkID,
      );

      if (matchResult.savedInvoice) {
        await deleteUnpaidSparkLightningTransaction(
          matchResult.savedInvoice.sparkID,
        );
      }

      const savedDetails = matchResult.savedInvoice?.details
        ? JSON.parse(matchResult.savedInvoice.details)
        : {};

      return {
        useTempId: true,
        tempId: txStateUpdate.sparkID,
        id: matchResult.matchedUnpaidInvoice
          ? matchResult.matchedUnpaidInvoice.transfer.sparkId
          : txStateUpdate.sparkID,
        paymentStatus: 'completed',
        paymentType: 'lightning',
        accountId: txStateUpdate.accountId,
        details: {
          ...savedDetails,
          address:
            matchResult.matchedUnpaidInvoice?.invoice?.encodedInvoice || '',
          preimage: matchResult.matchedUnpaidInvoice?.paymentPreimage || '',
          shouldNavigate: matchResult.savedInvoice?.shouldNavigate ?? 0,
          isLNULR: savedDetails?.isLNURL || false,
        },
      };
    }

    // Handle spark request IDs
    const sparkResponse =
      details.direction === 'INCOMING'
        ? await getSparkLightningPaymentStatus({
            lightningInvoiceId: txStateUpdate.sparkID,
          })
        : await getSparkLightningSendRequest(txStateUpdate.sparkID);

    if (!sparkResponse?.transfer) return null;

    return {
      useTempId: true,
      tempId: txStateUpdate.sparkID,
      id: sparkResponse.transfer.sparkId,
      paymentStatus: 'completed',
      paymentType: 'lightning',
      accountId: txStateUpdate.accountId,
      details: {
        ...details,
        preimage: sparkResponse.paymentPreimage || '',
      },
    };
  }

  return null;
}

async function findMatchingInvoice(possibleOptions, sparkID) {
  const BATCH_SIZE = 3;

  for (let i = 0; i < possibleOptions.length; i += BATCH_SIZE) {
    const batch = possibleOptions.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async invoice => {
      const paymentDetails = await getPaymentDetailsWithRetry(invoice.sparkID);
      if (paymentDetails?.transfer?.sparkId === sparkID) {
        return {invoice, paymentDetails};
      }
      return null;
    });

    const results = await Promise.all(batchPromises);
    const match = results.find(result => result !== null);

    if (match) {
      return {
        savedInvoice: match.invoice,
        matchedUnpaidInvoice: match.paymentDetails,
      };
    }
  }

  return {savedInvoice: null, matchedUnpaidInvoice: null};
}

async function getPaymentDetailsWithRetry(lightningInvoiceId, maxAttempts = 2) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await getSparkLightningPaymentStatus({lightningInvoiceId});
      if (result?.transfer !== undefined) {
        return result;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return null;
}

async function processBitcoinTransactions(bitcoinTxs, incomingTxsMap) {
  const updatedTxs = [];
  let transfersOffset = 1;
  let cachedTransfers = Array.from(incomingTxsMap.values());

  for (const txStateUpdate of bitcoinTxs) {
    const details = JSON.parse(txStateUpdate.details);

    if (
      details.direction === 'INCOMING' ||
      !IS_BITCOIN_REQUEST_ID.test(txStateUpdate.sparkID)
    ) {
      const findTxResponse = await findTransactionTxFromTxHistory(
        txStateUpdate.sparkID,
        transfersOffset,
        cachedTransfers,
      );

      if (!findTxResponse.didWork || !findTxResponse.bitcoinTransfer) continue;

      const {offset, foundTransfers, bitcoinTransfer} = findTxResponse;
      transfersOffset = offset;
      cachedTransfers = foundTransfers;

      if (!bitcoinTransfer) continue;

      updatedTxs.push({
        id: txStateUpdate.sparkID,
        paymentStatus: 'completed',
        paymentType: 'bitcoin',
        accountId: txStateUpdate.accountId,
      });
    } else {
      const sparkResponse = await getSparkBitcoinPaymentRequest(
        txStateUpdate.sparkID,
      );

      if (!sparkResponse?.transfer) {
        if (!details.onChainTxid && sparkResponse?.coopExitTxid) {
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
            },
          });
        }
        continue;
      }

      updatedTxs.push({
        useTempId: true,
        tempId: txStateUpdate.sparkID,
        id: sparkResponse.transfer.sparkId,
        paymentStatus: 'completed',
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

async function processSparkTransactions(sparkTxs) {
  return sparkTxs.map(txStateUpdate => ({
    id: txStateUpdate.sparkID,
    paymentStatus: 'completed',
    paymentType: 'spark',
    accountId: txStateUpdate.accountId,
  }));
}
