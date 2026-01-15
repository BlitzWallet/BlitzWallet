import { IS_SPARK_ID, USDB_TOKEN_ID } from '../../constants';
import {
  getCachedSparkTransactions,
  getSparkTokenTransactions,
} from '../spark';
import { getActiveSwapTransferIds, isSwapActive } from '../spark/flashnet';
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

    const lastSavedTokenTx = (savedTxs || []).find(tx => {
      const parsed = JSON.parse(tx?.details);
      return (
        parsed?.isLRC20Payment &&
        tx.paymentType === 'spark' &&
        !IS_SPARK_ID.test(tx.sparkID)
      );
    });

    const lastSavedTransactionId = lastSavedTokenTx
      ? lastSavedTokenTx.sparkID || lastSavedTokenTx.id || null
      : null;

    const tokenTxs = await getSparkTokenTransactions({
      ownerPublicKeys,
      mnemonic,
      isInitialRun,
      lastSavedTransactionId,
    });

    if (!tokenTxs?.tokenTransactionsWithStatus) return;
    const tokenTransactions = tokenTxs.tokenTransactionsWithStatus;

    const savedIds = new Set(savedTxs?.map(tx => tx.sparkID) || []);

    let newTxs = [];
    const isSwapInProgress = isSwapActive();
    const activeSwaps = getActiveSwapTransferIds();

    for (const tokenTx of tokenTransactions) {
      const tokenOutput = tokenTx.tokenTransaction.tokenOutputs[0];
      const tokenIdentifier = tokenOutput?.tokenIdentifier;
      const tokenIdentifierHex = Buffer.from(
        Object.values(tokenIdentifier),
      ).toString('hex');
      if (!tokenIdentifier) continue;
      const tokenbech32m = convertToBech32m(tokenIdentifierHex);

      const tokenOutputs = tokenTx.tokenTransaction.tokenOutputs;

      const ownerPublicKey = Buffer.from(
        Object.values(tokenOutputs[0]?.ownerPublicKey),
      ).toString('hex');
      const amount = Number(
        tokenBufferAmountToDecimal(tokenOutputs[0]?.tokenAmount),
      );
      const didSend = ownerPublicKey !== ownerPublicKeys[0];

      if (
        savedIds.has(
          Buffer.from(Object.values(tokenTx.tokenTransactionHash)).toString(
            'hex',
          ),
        )
      ) {
        continue;
      }

      const txId = Buffer.from(
        Object.values(tokenTx.tokenTransactionHash),
      ).toString('hex');

      if (
        tokenbech32m === USDB_TOKEN_ID &&
        !didSend &&
        isSwapInProgress &&
        activeSwaps.has(txId)
      ) {
        // if we have an incoming USD payment and there is a swap in progress and the tx id is the id of the swap in progress then block it so it does not interfeare with tx list
        console.log(
          `[LRC20] Blocking USDB transaction - ${txId} swap in progress`,
        );
        continue;
      }

      const tx = {
        id: txId,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: ownerPublicKeys[0],
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

    newTxs = markFlashnetTransfersAsFailed(newTxs);

    // using restore flag on initial run since we know the balance updated, otherwise we need to recheck the balance. On any new txs the fullUpdate reloads the wallet balance
    await bulkUpdateSparkTransactions(
      newTxs,
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
  const flashnetIndices = new Set();

  // Group transactions by amount AND token
  const byAmountAndToken = {};
  transactions.forEach((tx, index) => {
    const amount = tx.details.amount;
    const token = tx.details.LRC20Token;
    const key = `${amount}-${token}`;

    if (!byAmountAndToken[key]) {
      byAmountAndToken[key] = [];
    }
    byAmountAndToken[key].push({ tx, index });
  });

  // Check each amount+token group for flashnet patterns
  Object.values(byAmountAndToken).forEach(group => {
    if (group.length < 2) return;

    // Check all pairs in this amount+token group
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const tx1 = group[i].tx;
        const tx2 = group[j].tx;

        const timeDiff = Math.abs(tx1.details.time - tx2.details.time);
        const oppositeDirs =
          (tx1.details.direction === 'INCOMING' &&
            tx2.details.direction === 'OUTGOING') ||
          (tx1.details.direction === 'OUTGOING' &&
            tx2.details.direction === 'INCOMING');

        // If same amount, same token, opposite directions, and within time window = flashnet
        if (oppositeDirs && timeDiff <= timeWindowMs) {
          flashnetIndices.add(group[i].index);
          flashnetIndices.add(group[j].index);
        }
      }
    }
  });

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
