import { AppState } from 'react-native';
import { IS_SPARK_ID, USDB_TOKEN_ID } from '../../constants';
import { getSparkTokenTransactions } from '../spark';
import { getActiveSwapTransferIds, isSwapActive } from '../spark/flashnet';
import {
  bulkUpdateSparkTransactions,
  deleteSparkContactTransaction,
  getAllSparkContactInvoices,
  getLatestSavedLRC20TransactionId,
  getSparkTransactionBySparkId,
} from '../spark/transactions';
import { convertToBech32m } from './bech32';
import tokenBufferAmountToDecimal from './bufferToDecimal';

let isRunning = false;
export async function getLRC20Transactions({
  ownerPublicKeys,
  sparkAddress,
  isInitialRun,
  mnemonic,
}) {
  if (isRunning) return;
  if (AppState.currentState !== 'active') return;
  isRunning = true;
  try {
    const ownerPubKey = ownerPublicKeys[0];
    const lastSavedTransactionId = await getLatestSavedLRC20TransactionId(
      ownerPubKey,
    );

    const tokenTxs = await getSparkTokenTransactions({
      ownerPublicKeys,
      mnemonic,
      isInitialRun,
      lastSavedTransactionId,
    });

    if (!tokenTxs?.tokenTransactionsWithStatus) return;
    const tokenTransactions = tokenTxs.tokenTransactionsWithStatus;

    const newTxs = [];
    const isSwapInProgress = isSwapActive();
    const activeSwaps = getActiveSwapTransferIds();
    const unpaidContactInvoices = await getAllSparkContactInvoices();
    const savedTxCache = new Map();
    const getSavedLRC20Tx = async txHash => {
      if (!txHash) return null;
      if (savedTxCache.has(txHash)) return savedTxCache.get(txHash);

      const savedTx = await getSparkTransactionBySparkId(txHash, ownerPubKey);
      const savedLRC20Tx =
        savedTx?.paymentType === 'spark' && !IS_SPARK_ID.test(savedTx.sparkID)
          ? savedTx
          : null;

      savedTxCache.set(txHash, savedLRC20Tx);
      return savedLRC20Tx;
    };

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
      if (await getSavedLRC20Tx(txHash)) continue;

      const tokenOutputs = tokenTx.tokenTransaction.tokenOutputs;

      const ownerPublicKey = Buffer.from(
        Object.values(tokenOutputs[0]?.ownerPublicKey),
      ).toString('hex');
      const amount = Number(
        tokenBufferAmountToDecimal(tokenOutputs[0]?.tokenAmount),
      );
      const didSend = ownerPublicKey !== ownerPubKey;

      if (
        tokenbech32m === USDB_TOKEN_ID &&
        !didSend &&
        isSwapInProgress &&
        activeSwaps.has(txHash)
      ) {
        // if we have an incoming USD payment and there is a swap in progress and the tx id is the id of the swap in progress then block it so it does not interfeare with tx list
        console.log(
          `[LRC20] Blocking USDB transaction - ${txHash} swap in progress`,
        );
        continue;
      }

      const foundInvoice = unpaidContactInvoices?.find(
        savedTx => savedTx.sparkID === txHash,
      );

      if (foundInvoice?.sparkID) {
        deleteSparkContactTransaction(foundInvoice.sparkID);
      }

      const tx = {
        id: txHash,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: ownerPubKey,
        details: {
          sendingUUID: foundInvoice?.sendersPubkey,
          fee: 0,
          totalFee: didSend ? 10 : 0,
          supportFee: didSend ? 10 : 0,
          amount: amount,
          address: sparkAddress,
          time: new Date(
            tokenTx.tokenTransaction.clientCreatedTimestamp,
          ).getTime(),
          direction: didSend ? 'OUTGOING' : 'INCOMING',
          description: foundInvoice?.description || '',
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
export function markFlashnetTransfersAsFailed(
  transactions,
  timeWindowMs = 5000,
) {
  if (transactions.length < 2) return transactions;

  const flashnetIndices = new Set();

  // Group transactions by amount AND token for efficient lookup
  const byAmountAndToken = new Map();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const key = `${tx.details.amount}-${tx.details.LRC20Token}`;

    let group = byAmountAndToken.get(key);
    if (!group) {
      group = { incoming: [], outgoing: [] };
      byAmountAndToken.set(key, group);
    }
    // A row with an unparseable timestamp is left alone: every comparison
    // against NaN is false, so it would both escape detection itself and stall
    // the sorted sweep below for the rest of its group. Showing a swap leg is
    // the safe direction to fail; hiding a real payment is not.
    if (!Number.isFinite(tx.details.time)) continue;

    const entry = { time: tx.details.time, index: i };
    if (tx.details.direction === 'INCOMING') group.incoming.push(entry);
    else if (tx.details.direction === 'OUTGOING') group.outgoing.push(entry);
  }

  // A transaction is a flashnet transfer when an opposite-direction
  // counterpart with the same amount+token exists inside the time window.
  // With both sides sorted by time, a forward-only pointer answers that
  // existence check in amortized O(1) per transaction, keeping the whole
  // scan O(n log n) instead of comparing every pair (O(n²)).
  const findCounterpartMatches = (sideA, sideB) => {
    let j = 0;
    for (let i = 0; i < sideA.length; i++) {
      const time = sideA[i].time;
      while (j < sideB.length && sideB[j].time < time - timeWindowMs) j++;
      if (j < sideB.length && sideB[j].time <= time + timeWindowMs) {
        flashnetIndices.add(sideA[i].index);
      }
    }
  };

  // Check each amount+token group for flashnet patterns:
  // same amount, same token, opposite directions, within time window
  for (const { incoming, outgoing } of byAmountAndToken.values()) {
    if (!incoming.length || !outgoing.length) continue;
    incoming.sort((a, b) => a.time - b.time);
    outgoing.sort((a, b) => a.time - b.time);
    findCounterpartMatches(incoming, outgoing);
    findCounterpartMatches(outgoing, incoming);
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
