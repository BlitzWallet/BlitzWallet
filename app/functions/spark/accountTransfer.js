import { sparkPaymenWrapper } from './payments';
import { USDB_TOKEN_ID } from '../../constants';
import {
  getSparkAddress,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} from './index';
import { bulkUpdateSparkTransactions } from './transactions';

// Fee for an account-to-account spark transfer. Uses the support address purely
// as a placeholder to price a spark send (mirrors accountPaymentPage).
export async function getAccountTransferFee({
  amountSats,
  mnemonic,
  sendWebViewRequest,
}) {
  const feeResponse = await sparkPaymenWrapper({
    getFee: true,
    address: process.env.BLITZ_SPARK_SUPPORT_ADDRESSS,
    paymentType: 'spark',
    memo: 'Accounts Swap',
    amountSats,
    mnemonic,
    sendWebViewRequest,
  });

  if (!feeResponse?.didWork) return { didWork: false };
  return {
    didWork: true,
    fee: feeResponse.supportFee + feeResponse.fee,
  };
}

// Moves `amountSats` from one custody/child account to another over spark, then
// mirrors the transfer as an INCOMING tx on the receiving account. `t` supplies
// localized error/memo strings. Throws on any failure so callers can surface it.
// For asset==='USD', `amountSats`/`fromBalance` are USDB micro-units (1e6 = $1)
// and `fee` is 0 — every existing validator holds unchanged.
export async function executeAccountTransfer({
  fromAccount,
  toAccount,
  amountSats,
  fee,
  memo,
  fromBalance,
  masterInfoObject,
  getAccountMnemonic,
  sendWebViewRequest,
  t,
  asset = 'BTC',
}) {
  // This function signs the send and fabricates the ledger entry. These early
  // checks only validate the caller-supplied inputs (NaN/undefined would make a
  // balance check silently pass, since NaN > x is false);
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.invalidAmountError'),
    );
  }

  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.invalidFeeError'),
    );
  }

  if (!Number.isFinite(fromBalance) || fromBalance < 0) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.invalidBalanceError'),
    );
  }

  if (!fromAccount?.uuid || !toAccount?.uuid) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.noAccountInformation'),
    );
  }

  if (fromAccount.uuid === toAccount.uuid) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.sameAccountError'),
    );
  }

  if (amountSats + fee > fromBalance) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.balanceError'),
    );
  }

  const [fromMnemonic, toMnemonic] = await Promise.all([
    getAccountMnemonic(fromAccount),
    getAccountMnemonic(toAccount),
  ]);

  // Ensure the spending wallet is initialized. A prefilled `from` never passes
  // through the account picker, and the runtime can't spend from an uninited
  // wallet. Idempotent, so it's a no-op when already synced.
  await initializeSparkWallet(fromMnemonic, false, { maxRetries: 4 });

  const toSparkAddress = await getSparkAddress(toMnemonic);
  if (!toSparkAddress.didWork) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.noSendAddressError'),
    );
  }

  const [accountIdentifyPubKey, toAccountIdentityPubKey] = await Promise.all([
    getSparkIdentityPubKey(fromMnemonic),
    getSparkIdentityPubKey(toMnemonic),
  ]);

  if (!accountIdentifyPubKey || !toAccountIdentityPubKey) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.noAccountInformation'),
    );
  }

  // The uuid check above misses two accounts that share a wallet (e.g. an
  // imported account whose mnemonic duplicates a derived one). Sending to your
  // own spark address would make the INCOMING mirror collide with the OUTGOING
  // entry on the same `${id}_${accountId}` dedupe key.
  if (accountIdentifyPubKey === toAccountIdentityPubKey) {
    throw new Error(
      t('settings.accountComponents.accountPaymentPage.sameAccountError'),
    );
  }

  // Default transfer descriptions name the counterparty: the sender's ledger
  // shows "Sent to {to}" and the receiving account's mirror shows
  // "Received from {from}". A caller-supplied memo wins on both sides.
  const fromDescription =
    memo ||
    t('settings.accountComponents.transferModal.transferComplete', {
      name: toAccount?.name || '',
    });
  const toDescription =
    memo ||
    t('settings.accountComponents.transferModal.receivedFrom', {
      name: fromAccount?.name || '',
    });

  const sendingResponse = await sparkPaymenWrapper({
    address: toSparkAddress.response,
    paymentType: 'spark',
    amountSats,
    masterInfoObject,
    fee,
    memo: fromDescription,
    userBalance: fromBalance,
    sparkInformation: {
      identityPubKey: accountIdentifyPubKey,
    },
    mnemonic: fromMnemonic,
    sendWebViewRequest,
    ...(asset === 'USD' ? { seletctedToken: USDB_TOKEN_ID } : {}),
  });

  if (!sendingResponse.didWork) {
    throw new Error(t('errormessages.paymentError'));
  }

  bulkUpdateSparkTransactions([
    {
      ...sendingResponse.response,
      accountId: toAccountIdentityPubKey,
      details: {
        ...sendingResponse.response.details,
        direction: 'INCOMING',
        fee: 0,
        description: toDescription,
      },
    },
  ]).catch(err => console.log('error saving account transfer', err));

  return { didWork: true, response: sendingResponse.response };
}
