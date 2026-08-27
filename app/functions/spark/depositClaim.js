import i18n from 'i18next';
import {
  claimnSparkStaticDepositAddress,
  getSingleTxDetails,
  getSparkPaymentStatus,
  getSparkStaticBitcoinL1AddressQuote,
  getUtxosForDepositAddress,
  getUtxosForIdentity,
} from './index';
import {
  bulkUpdateSparkTransactions,
  getBitcoinTransactionByOnChainTxid,
  getSparkTransactionBySparkId,
} from './transactions';
import getBitcoinTransactionAmount from './getTxidFromChain';

const wait = ms => new Promise(res => setTimeout(res, ms));

const UTXO_PAGE_SIZE = 100;
const MAX_UTXO_PAGES = 10;

/**
 * Fetches every unclaimed UTXO for a deposit address, following the SDK's
 * default pagination (100 per page). Without paging, a wallet with more than
 * 100 unclaimed deposits on one address would never see the older UTXOs and
 * could never claim them.
 */
export const fetchAllDepositUtxos = async (
  depositAddress,
  mnemonic,
  excludeClaimed,
) => {
  const utxos = [];
  let offset = 0;

  while (offset < MAX_UTXO_PAGES * UTXO_PAGE_SIZE) {
    const result = await getUtxosForDepositAddress({
      depositAddress,
      mnemonic,
      limit: UTXO_PAGE_SIZE,
      offset,
      excludeClaimed,
    });

    if (!result?.didWork) {
      // Same contract as the single-page call: a failed address lookup skips
      // claiming this run (the next run retries).
      return { didWork: false, error: result?.error, utxos };
    }

    const page = result.utxos || [];
    utxos.push(...page);
    if (page.length < UTXO_PAGE_SIZE) break;
    offset += UTXO_PAGE_SIZE;
  }

  return { didWork: true, utxos };
};

/**
 * Identity-scoped variant of {@link fetchAllDepositUtxos}: pages every deposit
 * UTXO owned by the identity across ALL of its static deposit addresses in one
 * cursor-paginated sweep (each UTXO carries its own `address`). This is the
 * detection path breez/spark-sdk uses; unlike the per-address query it does not
 * depend on `queryStaticDepositAddresses` returning the funded address, so a
 * deposit to a non-enumerated address is still found and claimed.
 */
export const fetchAllIdentityDepositUtxos = async (
  mnemonic,
  excludeClaimed,
) => {
  const utxos = [];
  let cursor = '';

  for (let page = 0; page < MAX_UTXO_PAGES; page++) {
    const result = await getUtxosForIdentity({
      mnemonic,
      pageSize: UTXO_PAGE_SIZE,
      cursor,
      excludeClaimed,
      includePending: true,
    });

    if (!result?.didWork) {
      return { didWork: false, error: result?.error, utxos };
    }

    utxos.push(...(result.utxos || []));

    const next = result.pageResponse?.nextCursor;
    if (!result.pageResponse?.hasNextPage || !next) break;
    cursor = next;
  }

  return { didWork: true, utxos };
};

/**
 * Inserts (or re-inserts, idempotently — keyed by the on-chain txid) the
 * pending transaction row that makes an on-chain deposit visible to the user
 * while it awaits claiming. A later successful claim renames this row to the
 * Spark transfer id, so the amount here should come from the quote when
 * available and the explorer data otherwise.
 */
export const addPendingTransaction = async (
  quote,
  address,
  identityPubKey,
  vout = null,
) => {
  const pendingTx = {
    id: quote.transactionId,
    paymentStatus: 'pending',
    paymentType: 'bitcoin',
    accountId: identityPubKey,
    details: {
      fee: 0,
      amount: quote.creditAmountSats,
      address: address,
      time: new Date().getTime(),
      direction: 'INCOMING',
      description: i18n.t('contexts.spark.depositLabel'),
      onChainTxid: quote.transactionId,
      vout: vout !== null && vout !== undefined ? Number(vout) : null,
      isRestore: true, // This is a restore payment
    },
  };
  await bulkUpdateSparkTransactions([pendingTx], 'transactions');
  return pendingTx;
};

/**
 * Looks for pending deposit id inside of spark transsactions database.
 * When vout is provided, verifies the stored row's vout matches (txid-only
 * sparkID is ambiguous for multi-output same-txid deposits). Legacy rows
 * without a vout field are treated as matching any vout for backward compat.
 */
const getSavedTxByTxid = async (txid, identityPubKey, vout = null) => {
  if (!txid) return null;
  if (!identityPubKey) return null;
  try {
    const savedTx = await getSparkTransactionBySparkId(txid, identityPubKey);
    if (!savedTx) return null;
    const details = JSON.parse(savedTx.details ?? 'null');
    if (
      vout !== null &&
      vout !== undefined &&
      details &&
      details.vout !== null &&
      details.vout !== undefined
    ) {
      if (Number(details.vout) !== Number(vout)) return null;
    }
    return { ...savedTx, details };
  } catch (err) {
    console.log('error gettting spark tx by id', err);
    return null;
  }
};

/**
 * On-chain-txid–scoped existence check: finds any bitcoin row whose
 * details.onChainTxid matches `txid` (and, when provided, vout), regardless
 * of its current sparkID. After a successful claim the original row is
 * renamed from txid → transferId, so a naïve sparkID-only lookup misses it
 * and the re-swept UTXO (<60s window before excludeClaimed takes effect)
 * would insert a ghost pending row under the old txid that never settles.
 * Matching on (txid, vout) prevents cross-vout collisions for multi-output
 * same-txid deposits to one identity.
 */
const getExistingByOnChainTxid = async (txid, identityPubKey, vout = null) => {
  if (!txid) return null;
  if (!identityPubKey) return null;
  try {
    const row = await getBitcoinTransactionByOnChainTxid(
      txid,
      identityPubKey,
      vout,
    );
    if (!row) return null;
    return { ...row, details: JSON.parse(row.details ?? 'null') };
  } catch (err) {
    console.log('error getting spark tx by onChainTxid', err);
    return null;
  }
};

/**
 * Claims a single unclaimed on-chain deposit UTXO into Spark credit and
 * persists the resulting transaction row.
 *
 * Fail-closed guarantees:
 *  - Never claims with a quote bound to a different output (outputIndex
 *    mismatch): the SSP signature would not verify and the claim could be
 *    rejected (or, if the server is lenient, mis-credit a different output).
 *  - Never writes 'completed' until the Spark transfer is actually completed.
 *    A freshly created claim transfer is typically still
 *    TRANSFER_STATUS_SENDER_INITIATED; marking it completed before the swap
 *    settles lets a later failure slip past updateSparkTxStatus (which only
 *    revisits pending rows).
 *  - `persisted` is false when the row could not be written (after one
 *    bounded retry), so the caller keeps the transfer:claimed event path
 *    enabled instead of dropping the only remaining writer for that row.
 *
 * @returns {Promise<{
 *   didClaim: boolean,
 *   transferId?: string,
 *   quote?: object,
 *   bitcoinTransfer?: object,
 *   updatedTx?: object,
 *   persisted?: boolean,
 *   pendingTx?: object,
 *   error?: string,
 * }>}
 */
export const claimDepositUtxo = async ({
  txid,
  vout,
  address,
  mnemonic,
  identityPubKey,
  isConfirmed,
}) => {
  const savedTx = await getSavedTxByTxid(txid, identityPubKey, vout);
  // Ghost-row guard: after a successful claim the row is renamed txid → transferId,
  // so a sparkID-only lookup misses it while excludeClaimed is still lagging (<60s).
  // Checking onChainTxid catches the renamed row and prevents re-inserting a
  // pending ghost under the old txid. Matching on (txid, vout) avoids
  // cross-vout collisions for multi-output same-txid deposits.
  const onChainExisting = !savedTx
    ? await getExistingByOnChainTxid(txid, identityPubKey, vout)
    : null;
  const hasAlreadySaved = !!savedTx || !!onChainExisting;
  const effectiveExisting = savedTx ?? onChainExisting;
  const savedTxDetails = effectiveExisting?.details;

  const insertPendingIfNeeded = async quote => {
    if (hasAlreadySaved) return null;
    // Re-check onChainTxid scope right before writing to close the
    // <60s re-sweep race where the row was renamed between the initial
    // hasAlreadySaved check and this insert.
    const raced = await getExistingByOnChainTxid(txid, identityPubKey, vout);
    if (raced) return null;

    if (!quote.creditAmountSats) {
      const txAmount = await getBitcoinTransactionAmount(
        quote.transactionId,
        address,
        vout,
      );
      if (!txAmount.didWork) return null;
      quote.creditAmountSats = txAmount.value;
    }
    const pendingTx = await addPendingTransaction(
      quote,
      address,
      identityPubKey,
      vout,
    );
    return pendingTx;
  };

  if (!isConfirmed) {
    if (hasAlreadySaved)
      return {
        didClaim: false,
        error: 'Does not have enough on-chain confirmations',
      };
    await insertPendingIfNeeded({
      transactionId: txid,
      creditAmountSats: null,
    });
    return {
      didClaim: false,
      error:
        'Does not have enough on-chain confirmations, but saved pending transfer',
    };
  }

  const quoteResult = await getSparkStaticBitcoinL1AddressQuote(
    txid,
    vout,
    mnemonic,
  );
  const quote = quoteResult?.quote;
  if (!quoteResult?.didWork || !quote) {
    // Surface the deposit even when quoting fails, but only with a real
    // amount from the explorer data (never a fabricated 0-sats row).
    const pendingTx = await insertPendingIfNeeded({
      transactionId: txid,
      creditAmountSats: null,
    });
    return {
      didClaim: false,
      error: quoteResult?.error || 'Quote unavailable',
      pendingTx,
    };
  }

  if (
    Number.isInteger(quote.outputIndex) &&
    Number(quote.outputIndex) !== Number(vout)
  ) {
    // Surface the deposit with the real explorer amount when available — the
    // quote is bound to a different output, so its credit amount is wrong.
    const pendingTx = await insertPendingIfNeeded({
      transactionId: txid,
      creditAmountSats: null,
    });
    return {
      didClaim: false,
      error: `Quote outputIndex ${quote.outputIndex} does not match claimed UTXO vout ${vout}`,
      pendingTx,
    };
  }

  const claimResult = await claimnSparkStaticDepositAddress({
    transactionId: quote.transactionId,
    creditAmountSats: quote.creditAmountSats,
    sspSignature: quote.signature,
    outputIndex: vout,
    mnemonic,
    depositAddress: address,
  });

  const claimTx = claimResult?.response;
  if (!claimResult?.didWork || !claimTx?.transferId) {
    const pendingTx = await insertPendingIfNeeded(quote);
    return {
      didClaim: false,
      error: claimResult?.error || 'Claim failed',
      pendingTx,
    };
  }

  const transferId = claimTx.transferId;

  // Surface the deposit immediately so the row exists for the rename below.
  const pendingTx = await insertPendingIfNeeded(quote);

  // Give the coordinator a beat to index the transfer before looking it up.
  await wait(2000);

  const bitcoinTransfer = await getSingleTxDetails(mnemonic, transferId);

  let updatedTx;
  if (!bitcoinTransfer) {
    // Claim succeeded but the transfer has not settled yet (or the SDK lookup
    // failed). Keep it pending keyed by the new transferId; a later
    // updateSparkTxStatus run finalizes it. bitcoinTransfer is undefined here,
    // so it must NOT be dereferenced below.
    updatedTx = {
      useTempId: true,
      id: transferId,
      tempId: quote.transactionId,
      paymentStatus: 'pending',
      paymentType: 'bitcoin',
      accountId: identityPubKey,
      details: {
        vout: Number(vout),
        onChainTxid: txid,
        address,
        amount: quote.creditAmountSats,
      },
    };
  } else {
    let fee = 0;
    if (savedTxDetails) {
      fee = Math.abs(savedTxDetails?.amount - bitcoinTransfer.totalValue);
    } else {
      const txAmount = await getBitcoinTransactionAmount(
        quote.transactionId,
        address,
        vout,
      );
      if (txAmount.didWork) {
        fee = Math.abs(txAmount?.value - bitcoinTransfer.totalValue);
      }
    }

    updatedTx = {
      useTempId: true,
      tempId: quote.transactionId,
      id: bitcoinTransfer.id,
      paymentStatus: getSparkPaymentStatus(bitcoinTransfer.status),
      paymentType: 'bitcoin',
      accountId: identityPubKey,
      details: {
        amount: bitcoinTransfer.totalValue,
        fee: fee,
        totalFee: fee,
        supportFee: 0,
        dateAddedToDb: Date.now(),
        address,
        onChainTxid: txid,
        vout: Number(vout),
      },
    };
  }

  let persisted = await bulkUpdateSparkTransactions(
    [updatedTx],
    'fullUpdate-waitBalance',
  );
  if (!persisted) {
    // Transient SQLite failure — one bounded retry before giving up. On
    // failure the caller keeps the transfer event path enabled.
    await wait(500);
    persisted = await bulkUpdateSparkTransactions(
      [updatedTx],
      'fullUpdate-waitBalance',
    );
  }

  return {
    didClaim: true,
    transferId,
    quote,
    bitcoinTransfer,
    updatedTx,
    persisted,
    pendingTx,
  };
};
