import sha256Hash from '../hash';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  getCachedSparkTransactions,
  getSparkTokenTransactions,
} from '../spark';
import { bulkUpdateSparkTransactions } from '../spark/transactions';
import { convertToBech32m } from './bech32';
import tokenBufferAmountToDecimal from './bufferToDecimal';
import { getCachedTokens } from './cachedTokens';

export async function getLRC20Transactions({
  ownerPublicKeys,
  sparkAddress,
  isInitialRun,
  mnemonic,
  sendWebViewRequest,
}) {
  const [storedDate, savedTxs, cachedTokens] = await Promise.all([
    getLocalStorageItem('lastRunLRC20Tokens').then(
      data => JSON.parse(data) || 0,
    ),
    getCachedSparkTransactions(null, ownerPublicKeys[0]),
    getCachedTokens(),
  ]);

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
    sendWebViewRequest,
    lastSavedTransactionId,
  });

  if (!tokenTxs?.tokenTransactionsWithStatus) return;
  const hashedMnemoinc = sha256Hash(mnemonic);
  const tokenTransactions = tokenTxs.tokenTransactionsWithStatus;

  const savedIds = new Set(savedTxs?.map(tx => tx.sparkID) || []);

  let timeCutoff =
    storedDate && isInitialRun ? storedDate - 1000 * 60 * 60 * 24 : storedDate;

  let newTxs = [];

  for (const tokenTx of tokenTransactions) {
    const tokenOutput = tokenTx.tokenTransaction.tokenOutputs[0];
    const tokenIdentifier = tokenOutput?.tokenIdentifier;
    const tokenIdentifierHex = Buffer.from(
      Object.values(tokenIdentifier),
    ).toString('hex');
    if (!tokenIdentifier) continue;
    const tokenbech32m = convertToBech32m(tokenIdentifierHex);

    if (!cachedTokens[hashedMnemoinc]?.[tokenbech32m]) {
      console.log('NO TOKEN DATA FOUND');
      continue;
    }

    const tokenOutputs = tokenTx.tokenTransaction.tokenOutputs;

    const ownerPublicKey = Buffer.from(
      Object.values(tokenOutputs[0]?.ownerPublicKey),
    ).toString('hex');
    const amount = Number(
      tokenBufferAmountToDecimal(tokenOutputs[0]?.tokenAmount),
    );
    const didSend = ownerPublicKey !== ownerPublicKeys[0];
    console.log(
      Object.values(tokenTx.tokenTransactionHash),
      'token transaction hash',
    );
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

  await setLocalStorageItem(
    'lastRunLRC20Tokens',
    JSON.stringify(new Date().getTime()),
  );

  await bulkUpdateSparkTransactions(newTxs, 'fullUpdate');
}
