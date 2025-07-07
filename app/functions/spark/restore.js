import {
  getSparkBitcoinPaymentRequest,
  getSparkLightningPaymentStatus,
  getSparkLightningSendRequest,
  getSparkTransactions,
} from '.';
import {IS_SPARK_REQUEST_ID} from '../../constants';
import {
  bulkUpdateSparkTransactions,
  getAllPendingSparkPayments,
  getAllSparkTransactions,
} from './transactions';
import {transformTxToPaymentObject} from './transformTxToPayment';

export const restoreSparkTxState = async BATCH_SIZE => {
  let restoredTxs = [];
  try {
    // here we do not want to save any tx to be shown, we only want to flag that it came from restore and then when we get the actual notification of it we can block the navigation
    let start = 0;
    const savedTxs = await getAllSparkTransactions();
    const savedIds = savedTxs?.map(tx => tx.sparkID) || [];

    let foundOverlap = false;

    do {
      const txs = await getSparkTransactions(start + BATCH_SIZE, start);
      const batchTxs = txs.transfers || [];

      if (!batchTxs.length) {
        console.log('No more transactions found, ending restore.');
        break;
      }

      // Check for overlap with saved transactions
      const overlap = batchTxs.some(tx => savedIds.includes(tx.id));

      if (overlap) {
        console.log('Found overlap with saved transactions, stopping restore.');
        foundOverlap = true;
      }

      restoredTxs.push(...batchTxs);
      start += BATCH_SIZE;
    } while (!foundOverlap);

    // Filter out any already-saved txs or dontation payments
    const newTxs = restoredTxs.filter(
      tx =>
        !savedIds.includes(tx.id) &&
        !(
          tx.transferDirection === 'OUTGOING' &&
          tx.receiverIdentityPublicKey === process.env.BLITZ_SPARK_PUBLICKEY
        ),
    );

    console.log(`Total restored transactions: ${restoredTxs.length}`);
    console.log(`New transactions after filtering: ${newTxs.length}`);
    return {txs: newTxs};
  } catch (error) {
    console.error('Error in spark restore history state:', error);
    return {txs: []};
  }
};
export const updateSparkTxStatus = async () => {
  try {
    // Get all saved transactions
    const savedTxs = await getAllPendingSparkPayments();
    console.log(savedTxs);
    const incluedBitcoin = savedTxs.filter(
      tx => tx.paymentType !== 'lightning',
    );
    let incomingTxs = [];
    if (incluedBitcoin.length) {
      incomingTxs = await getSparkTransactions(100);
    }

    console.log('pending tx list', savedTxs);
    let updatedTxs = [];
    for (const txStateUpdate of savedTxs) {
      const details = JSON.parse(txStateUpdate.details);

      if (txStateUpdate.paymentType === 'lightning') {
        if (!IS_SPARK_REQUEST_ID.test(txStateUpdate.sparkID)) {
          const tx = {
            id: txStateUpdate.sparkID,
            paymentStatus: 'completed',
            paymentType: 'lightning',
            accountId: txStateUpdate.accountId,
          };
          updatedTxs.push(tx);
        }
        let sparkResponse;
        if (details.direction === 'INCOMING') {
          sparkResponse = await getSparkLightningPaymentStatus({
            lightningInvoiceId: txStateUpdate.sparkID,
          });
        } else {
          sparkResponse = await getSparkLightningSendRequest(
            txStateUpdate.sparkID,
          );
        }

        if (!sparkResponse?.transfer) continue;

        const tx = {
          useTempId: true,
          tempId: txStateUpdate.sparkID,
          id: sparkResponse
            ? sparkResponse.transfer.sparkId
            : txStateUpdate.sparkID,
          paymentStatus: 'completed',
          paymentType: 'lightning',
          accountId: txStateUpdate.accountId,
          details: {
            ...details,
            preimage: sparkResponse ? sparkResponse.paymentPreimage : '',
          },
        };
        updatedTxs.push(tx);
      } else if (txStateUpdate.paymentType === 'spark') {
        const sparkTransfer = incomingTxs.transfers.find(
          tx => tx.id === txStateUpdate.sparkID,
        );
        console.log(sparkTransfer, 'spark transfer in pending');
        if (!sparkTransfer) continue;
        const tx = {
          id: txStateUpdate.sparkID,
          paymentStatus: 'completed',
          paymentType: 'spark',
          accountId: txStateUpdate.accountId,
        };
        updatedTxs.push(tx);
      } else {
        if (details.direction === 'INCOMING') {
          const bitcoinTransfer = incomingTxs.transfers.find(
            tx => tx.id === txStateUpdate.sparkID,
          );
          console.log(bitcoinTransfer, 'bitocin transfer in pending');
          if (!bitcoinTransfer) continue;
          const tx = {
            id: txStateUpdate.sparkID,
            paymentStatus: 'completed',
            paymentType: 'bitcoin',
            accountId: txStateUpdate.accountId,
          };
          updatedTxs.push(tx);
        } else {
          const sparkResponse = await getSparkBitcoinPaymentRequest(
            txStateUpdate.sparkID,
          );

          if (!sparkResponse?.transfer) {
            if (!details.onChainTxid && sparkResponse.coopExitTxid) {
              const tx = {
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
              };
              updatedTxs.push(tx);
            }
            continue;
          }

          const tx = {
            useTempId: true,
            tempId: txStateUpdate.sparkID,
            id: sparkResponse
              ? sparkResponse.transfer.sparkId
              : txStateUpdate.sparkID,
            paymentStatus: 'completed',
            paymentType: 'bitcoin',
            accountId: txStateUpdate.accountId,
            details: {
              ...details,
              onChainTxid: sparkResponse.coopExitTxid,
            },
          };
          updatedTxs.push(tx);
        }
      }
    }

    if (!updatedTxs.length) return {updated: []};

    await bulkUpdateSparkTransactions(updatedTxs);

    console.log(`Updated transactions:`, updatedTxs);

    return {updated: updatedTxs};
  } catch (error) {
    console.error('Error in spark restore:', error);
    return {updated: []};
  }
};

export async function fullRestoreSparkState({sparkAddress}) {
  try {
    const restored = await restoreSparkTxState(50);

    const newPaymentObjects = [];

    for (const tx of restored.txs) {
      const paymentObject = await transformTxToPaymentObject(
        tx,
        sparkAddress,
        undefined,
        true,
      );
      if (paymentObject) {
        newPaymentObjects.push(paymentObject);
      }
    }

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
