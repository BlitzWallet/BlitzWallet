import { IS_SPARK_ID } from '../../constants';
import {
  getCachedSparkTransactions,
  getSparkTokenTransactions,
} from '../spark';
import { bulkUpdateSparkTransactions } from '../spark/transactions';
import { convertToBech32m } from './bech32';
import tokenBufferAmountToDecimal from './bufferToDecimal';

let isRunning = false;
export async function getLRC20Transactions({
  ownerPublicKeys,
  sparkAddress,
  isInitialRun,
  mnemonic,
}) {
  try {
    if (isRunning) throw new Error('process is already running');
    isRunning = true;
    const savedTxs = await getCachedSparkTransactions(null, ownerPublicKeys[0]);

    // Find last saved completed token transaction
    let lastSavedTransactionId = null;
    if (savedTxs) {
      for (const tx of savedTxs) {
        if (
          tx.paymentType !== 'spark' ||
          IS_SPARK_ID.test(tx.sparkID) ||
          tx.paymentStatus !== 'completed'
        ) {
          continue;
        }

        try {
          const parsed = JSON.parse(tx.details || '{}');
          if (parsed?.isLRC20Payment) {
            lastSavedTransactionId = tx.sparkID;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    const tokenTxs = await getSparkTokenTransactions({
      ownerPublicKeys,
      mnemonic,
      isInitialRun,
      lastSavedTransactionId,
    });

    if (!tokenTxs?.tokenTransactionsWithStatus) return;
    const tokenTransactions = tokenTxs.tokenTransactionsWithStatus;

    // Build savedIds set - only include completed token txs and all non-token txs
    const savedIds = new Set();
    if (savedTxs) {
      for (const tx of savedTxs) {
        if (
          tx.paymentType !== 'spark' ||
          IS_SPARK_ID.test(tx.sparkID) ||
          tx.paymentStatus !== 'completed'
        ) {
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(tx.details || '{}');
        } catch {
          // Parse failed, treat as non-token tx and add to set
          savedIds.add(tx.sparkID);
          continue;
        }

        const isLRC20Token = parsed?.isLRC20Payment;

        // Add to set if: non-token tx
        if (!isLRC20Token) {
          savedIds.add(tx.sparkID);
        }
      }
    }

    const newTxs = [];
    const ownerPubKey = ownerPublicKeys[0];

    for (const tokenTx of tokenTransactions) {
      const tokenOutput = tokenTx.tokenTransaction.tokenOutputs[0];
      const tokenIdentifier = tokenOutput?.tokenIdentifier;

      if (!tokenIdentifier) continue;

      // Convert token identifier to hex
      const tokenIdentifierHex = Buffer.from(
        Object.values(tokenIdentifier),
      ).toString('hex');
      const tokenbech32m = convertToBech32m(tokenIdentifierHex);

      // Get transaction hash
      const txHash = Buffer.from(
        Object.values(tokenTx.tokenTransactionHash),
      ).toString('hex');

      // Skip if already saved
      if (savedIds.has(txHash)) continue;

      const tokenOutputs = tokenTx.tokenTransaction.tokenOutputs;

      const ownerPublicKey = Buffer.from(
        Object.values(tokenOutputs[0]?.ownerPublicKey),
      ).toString('hex');
      const amount = Number(
        tokenBufferAmountToDecimal(tokenOutputs[0]?.tokenAmount),
      );
      const didSend = ownerPublicKey !== ownerPubKey;

      const tx = {
        id: txHash,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: ownerPubKey,
        details: {
          fee: 0,
          totalFee: didSend ? 10 : 0,
          supportFee: didSend ? 10 : 0,
          amount: amount,
          address: sparkAddress,
          time: new Date(
            tokenTx.tokenTransaction.clientCreatedTimestamp,
          ).getTime(),
          direction: didSend ? 'OUTGOING' : 'INCOMING',
          description: '',
          isLRC20Payment: true,
          LRC20Token: tokenbech32m,
        },
      };

      newTxs.push(tx);
    }

    const processedTxs = markFlashnetTransfersAsFailed(newTxs);

    // using restore flag on initial run since we know the balance updated, otherwise we need to recheck the balance. On any new txs the fullUpdate reloads the wallet balance
    await bulkUpdateSparkTransactions(
      processedTxs,
      isInitialRun ? 'lrc20Payments' : 'fullUpdate-tokens',
    );
  } catch (err) {
    console.log('error running lrc20 tokens', err);
  } finally {
    isRunning = false;
  }
}

// We do not want to show failed flashnet swaps on homepage
function markFlashnetTransfersAsFailed(transactions, timeWindowMs = 5000) {
  if (transactions.length < 2) return transactions;

  const flashnetIndices = new Set();

  // Group transactions by amount AND token for efficient lookup
  const byAmountAndToken = new Map();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const key = `${tx.details.amount}-${tx.details.LRC20Token}`;

    if (!byAmountAndToken.has(key)) {
      byAmountAndToken.set(key, []);
    }
    byAmountAndToken.get(key).push({ tx, index: i });
  }

  // Check each amount+token group for flashnet patterns
  for (const group of byAmountAndToken.values()) {
    if (group.length < 2) continue;

    // Check all pairs in this amount+token group
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const tx1 = group[i].tx;
        const tx2 = group[j].tx;

        const timeDiff = Math.abs(tx1.details.time - tx2.details.time);
        if (timeDiff > timeWindowMs) continue;

        const oppositeDirs =
          (tx1.details.direction === 'INCOMING' &&
            tx2.details.direction === 'OUTGOING') ||
          (tx1.details.direction === 'OUTGOING' &&
            tx2.details.direction === 'INCOMING');

        // If same amount, same token, opposite directions, and within time window = flashnet
        if (oppositeDirs) {
          flashnetIndices.add(group[i].index);
          flashnetIndices.add(group[j].index);
        }
      }
    }
  }

  // Only create new array if we found flashnet transactions
  if (flashnetIndices.size === 0) return transactions;

  return transactions.map((tx, index) => {
    if (flashnetIndices.has(index)) {
      return {
        ...tx,
        paymentStatus: 'failed',
      };
    }
    return tx;
  });
}
