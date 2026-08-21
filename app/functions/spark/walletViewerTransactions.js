import tokenBufferAmountToDecimal from '../lrc20/bufferToDecimal.js';

// Duplicated from app/constants/index.js on purpose: this module must stay
// node-runnable for the self-check at the bottom (constants pulls in
// react-native and cannot be imported under plain node).
const USDB_TOKEN_ID =
  'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87';

const TRANSFER_TYPES = {
  PREIMAGE_SWAP: 0,
  COOPERATIVE_EXIT: 1,
  TRANSFER: 2,
  UTXO_SWAP: 3,
  PRIMARY_SWAP_V3: 4,
  COUNTER_SWAP_V3: 5,
  SWAP: 30,
  COUNTER_SWAP: 40,
};

// Maps a Spark transfer type to the DB paymentType used by the homepage
// formatter. Never returns 'unknown' — the formatter skips those rows.
function mapTransferType(type) {
  if (type === TRANSFER_TYPES.PREIMAGE_SWAP) return 'lightning';
  if (
    type === TRANSFER_TYPES.COOPERATIVE_EXIT ||
    type === TRANSFER_TYPES.UTXO_SWAP
  )
    return 'bitcoin';
  return 'spark';
}

// Shapes a wallet-viewer BTC/LN/Spark transfer into a SPARK_TRANSACTIONS
// DB row so getFormattedHomepageTxsForSpark can render it (viewAllTx branch
// JSON.parses details). Mirrors the sender check in
// restorePaymentsFromSpark (savingsContext).
export function mapTransferToRow(transfer, identityPublicKeyHex) {
  const senderHex = Buffer.from(
    Object.values(transfer.senderIdentityPublicKey),
  ).toString('hex');
  return {
    sparkID: transfer.id,
    paymentStatus: 'completed',
    paymentType: mapTransferType(transfer.type),
    accountId: identityPublicKeyHex,
    details: JSON.stringify({
      time: new Date(transfer.createdTime).getTime(),
      direction: senderHex === identityPublicKeyHex ? 'OUTGOING' : 'INCOMING',
      amount: transfer.totalValue,
      description: transfer.description ?? '',
      status: transfer.status,
      isLRC20Payment: false,
    }),
  };
}

// Shapes a wallet-viewer USDB token transaction into a SPARK_TRANSACTIONS
// DB row. Owner check + micros mirror restorePaymentsFromSpark (savings).
export function mapTokenTxToRow(tokenTx, identityPublicKeyHex) {
  const tokenOutputs = tokenTx.tokenTransaction?.tokenOutputs;
  const ownerPublicKey = Buffer.from(
    Object.values(tokenOutputs?.[0]?.ownerPublicKey ?? []),
  ).toString('hex');
  const amountMicros = tokenOutputs?.[0]?.tokenAmount
    ? Number(tokenBufferAmountToDecimal(tokenOutputs[0].tokenAmount))
    : 0;
  const txHash = Buffer.from(
    Object.values(tokenTx.tokenTransactionHash),
  ).toString('hex');

  return {
    sparkID: txHash,
    paymentStatus: 'completed',
    paymentType: 'spark',
    accountId: identityPublicKeyHex,
    details: JSON.stringify({
      time: new Date(tokenTx.tokenTransaction.clientCreatedTimestamp).getTime(),
      direction:
        ownerPublicKey === identityPublicKeyHex ? 'INCOMING' : 'OUTGOING',
      amount: amountMicros,
      description: '',
      isLRC20Payment: true,
      LRC20Token: USDB_TOKEN_ID,
    }),
  };
}

// ── Self-check ──────────────────────────────────────────────────────────────
// Direction resolution for known/other sender & owner pubkeys.
// Run directly:  node app/functions/spark/walletViewerTransactions.js
if (
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  process.argv?.[1]?.endsWith('walletViewerTransactions.js')
) {
  const toBytes = hex => Buffer.from(hex, 'hex');
  const identityHex = '11'.repeat(33);
  const otherHex = '22'.repeat(33);
  const newDate = time => new Date(time);

  const transferBase = {
    id: 'transfer-id',
    totalValue: 5000,
    status: 5,
    type: TRANSFER_TYPES.TRANSFER,
  };

  const outgoing = mapTransferToRow(
    {
      ...transferBase,
      senderIdentityPublicKey: toBytes(identityHex),
      createdTime: newDate(1700000000000),
    },
    identityHex,
  );
  const incoming = mapTransferToRow(
    {
      ...transferBase,
      senderIdentityPublicKey: toBytes(otherHex),
      createdTime: newDate(1700000001000),
    },
    identityHex,
  );
  const lightning = mapTransferToRow(
    {
      ...transferBase,
      type: TRANSFER_TYPES.PREIMAGE_SWAP,
      senderIdentityPublicKey: toBytes(otherHex),
      createdTime: newDate(1700000002000),
    },
    identityHex,
  );
  const bitcoin = mapTransferToRow(
    {
      ...transferBase,
      type: TRANSFER_TYPES.UTXO_SWAP,
      senderIdentityPublicKey: toBytes(identityHex),
      createdTime: newDate(1700000003000),
    },
    identityHex,
  );

  const tokenBase = {
    tokenTransactionHash: toBytes('ab'.repeat(32)),
  };
  const incomingToken = mapTokenTxToRow(
    {
      ...tokenBase,
      tokenTransaction: {
        clientCreatedTimestamp: newDate(1700000004000),
        tokenOutputs: [
          {
            ownerPublicKey: toBytes(identityHex),
            tokenAmount: toBytes('4c4b40'), // 5_000_000 micros = 5 USDB
          },
        ],
      },
    },
    identityHex,
  );
  const outgoingToken = mapTokenTxToRow(
    {
      ...tokenBase,
      tokenTransaction: {
        clientCreatedTimestamp: newDate(1700000005000),
        tokenOutputs: [
          {
            ownerPublicKey: toBytes(otherHex),
            tokenAmount: toBytes('4c4b40'),
          },
        ],
      },
    },
    identityHex,
  );

  const get = (row, field) => JSON.parse(row.details)[field];

  console.assert(get(outgoing, 'direction') === 'OUTGOING', 'BTC outgoing');
  console.assert(get(incoming, 'direction') === 'INCOMING', 'BTC incoming');
  console.assert(outgoing.paymentType === 'spark', 'transfer type spark');
  console.assert(lightning.paymentType === 'lightning', 'preimage → lightning');
  console.assert(bitcoin.paymentType === 'bitcoin', 'utxo swap → bitcoin');
  console.assert(
    outgoing.paymentType !== 'unknown',
    'paymentType never unknown',
  );
  console.assert(get(outgoing, 'amount') === 5000, 'sats amount');
  console.assert(get(outgoing, 'time') === 1700000000000, 'transfer time');
  console.assert(
    get(incomingToken, 'direction') === 'INCOMING',
    'token incoming',
  );
  console.assert(
    get(outgoingToken, 'direction') === 'OUTGOING',
    'token outgoing',
  );
  console.assert(get(incomingToken, 'amount') === 5000000, 'micros amount');
  console.assert(
    get(incomingToken, 'isLRC20Payment') === true,
    'token is LRC20',
  );
  console.assert(
    get(incomingToken, 'LRC20Token') === USDB_TOKEN_ID,
    'token id is USDB',
  );
  console.log('walletViewerTransactions self-check passed');
}
