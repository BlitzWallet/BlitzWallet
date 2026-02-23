import { SparkReadonlyClient } from '@buildonspark/spark-sdk';
import { USDB_TOKEN_ID } from '../../constants';

let walletViewer;
export function initializeSparkWalletViewer() {
  if (walletViewer) return walletViewer;
  try {
    walletViewer = SparkReadonlyClient.createPublic({
      network: 'MAINNET',
    });

    return true;
  } catch (err) {
    console.log('error initializing wallet viewer', err);
    return false;
  }
}

export async function getTokensBalance(sparkAddress) {
  try {
    await initializeSparkWalletViewer();
    const balance = await walletViewer.getTokenBalance(sparkAddress);
    let currentTokensObj = {};
    for (const [tokensIdentifier, tokensData] of balance) {
      console.log(tokensIdentifier, tokensData);
      currentTokensObj[tokensIdentifier] = {
        ...tokensData,
        balance: tokensData.availableToSendBalance,
      };
    }
    return currentTokensObj[USDB_TOKEN_ID].balance;
  } catch (err) {
    console.log('error getting token transactions', err);
    return 0;
  }
}

export async function getTokenTransactions(sparkAddress) {
  try {
    await initializeSparkWalletViewer();
    return await walletViewer.getTokenTransactions({
      sparkAddresses: [sparkAddress],
      tokenIdentifiers: [USDB_TOKEN_ID],
    });
  } catch (err) {
    console.log('error getting token transactions', err);
    return false;
  }
}
