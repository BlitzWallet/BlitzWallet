import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
import {getSparkTokenTransactions} from '../spark';
import {bulkUpdateSparkTransactions} from '../spark/transactions';
import {convertToBech32m} from './bech32';
import tokenBufferAmountToDecimal from './bufferToDecimal';

export async function getLRC20Transactions({
  ownerPublicKeys,
  sparkAddress,
  isInitialRun,
}) {
  let timeCutoff =
    JSON.parse(await getLocalStorageItem('lastRunLRC20Tokens')) || 0;

  const tokenTxs = await getSparkTokenTransactions({ownerPublicKeys});

  let newTxs = [];

  for (const tokenTx of tokenTxs) {
    const tokenReceivedDate = new Date(
      tokenTx.tokenTransaction.clientCreatedTimestamp,
    );
    if (tokenReceivedDate < timeCutoff) continue;

    const tokenOutputs = tokenTx.tokenTransaction.tokenOutputs;

    const ownerPublicKey = Buffer.from(
      tokenOutputs[0]?.ownerPublicKey,
    ).toString('hex');
    const amount = Number(
      tokenBufferAmountToDecimal(tokenOutputs[0]?.tokenAmount),
    );
    const didSend = ownerPublicKey !== ownerPublicKeys[0];

    const tokenOutput = tokenTx.tokenTransaction.tokenOutputs[0];
    const tokenIdentifier = tokenOutput?.tokenIdentifier;

    const tokenIdentifierHex = Buffer.from(tokenIdentifier).toString('hex');

    if (!tokenIdentifier) continue;
    const tokenbech32m = convertToBech32m(tokenIdentifierHex);

    const tx = {
      id: Buffer.from(tokenTx.tokenTransactionHash).toString('hex'),
      paymentStatus: 'completed',
      paymentType: 'spark',
      accountId: ownerPublicKeys[0],
      details: {
        fee: 0,
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
