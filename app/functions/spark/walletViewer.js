import { SparkReadonlyClient } from '@buildonspark/spark-sdk';
import { USDB_TOKEN_ID } from '../../constants';

let walletViewer;
export async function initializeSparkWalletViewer(mnemonic) {
  if (walletViewer) return walletViewer;
  if (!mnemonic) return false;

  try {
    walletViewer = await SparkReadonlyClient.createWithMasterKey(
      {
        network: 'MAINNET',
      },
      mnemonic,
    );

    return true;
  } catch (err) {
    console.log('error initializing wallet viewer', err);
    return false;
  }
}

export async function getTokensBalance(sparkAddress) {
  try {
    const viewerReady = await initializeSparkWalletViewer();
    if (!viewerReady) return 0;

    const balance = await walletViewer.getTokenBalance(sparkAddress);
    let currentTokensObj = {};
    for (const [tokensIdentifier, tokensData] of balance) {
      console.log(tokensIdentifier, tokensData);
      currentTokensObj[tokensIdentifier] = {
        ...tokensData,
        balance: tokensData.availableToSendBalance,
      };
    }
    return currentTokensObj[USDB_TOKEN_ID]?.balance;
  } catch (err) {
    console.log('error getting token transactions', err);
    return 0;
  }
}

export async function getBitcoinBalance(sparkAddress) {
  try {
    const viewerReady = await initializeSparkWalletViewer();
    if (!viewerReady) return 0;

    const balance = await walletViewer.getAvailableBalance(sparkAddress);
    return balance;
  } catch (err) {
    console.log('error getting bitcoin balance', err);
    return 0;
  }
}

export async function getTokenTransactions(sparkAddress) {
  try {
    const viewerReady = await initializeSparkWalletViewer();
    if (!viewerReady) return false;

    return await walletViewer.getTokenTransactions({
      sparkAddresses: [sparkAddress],
      tokenIdentifiers: [USDB_TOKEN_ID],
    });
  } catch (err) {
    console.log('error getting token transactions', err);
    return false;
  }
}

export async function getBitcoinWithdrawls(sparkAddress) {
  try {
    const viewerReady = await initializeSparkWalletViewer();
    if (!viewerReady) return false;

    return await walletViewer.getTransfers({
      sparkAddress: sparkAddress,
    });
  } catch (err) {
    console.log('error getting bitcoin withdrawls', err);
    return false;
  }
}
