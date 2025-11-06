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

    const lastSavedTokenTx = (savedTxs || []).find(tx => {
      const parsed = JSON.parse(tx?.details);
      return parsed?.isLRC20Payment;
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
        console.log('Transaction already saved');
        continue;
      }

      const tx = {
        id: Buffer.from(Object.values(tokenTx.tokenTransactionHash)).toString(
          'hex',
        ),
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

    // using restore flag on initial run since we know the balance updated, otherwise we need to recheck the balance. On any new txs the fullUpdate reloads the wallet balance
    await bulkUpdateSparkTransactions(
      newTxs,
      isInitialRun ? 'restoreTxs' : 'fullUpdate',
    );
  } catch (err) {
    console.log('error running lrc20 tokens', err);
  } finally {
    isRunning = false;
  }
}
