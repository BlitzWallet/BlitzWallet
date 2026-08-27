import { USDB_TOKEN_ID } from '../../constants';
import { getSparkReadonlyClient } from './lazySpark';
import { selectSparkRuntime } from '.';
import {
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
} from '../../../context-store/webViewContext';

let walletViewer;
export async function initializeSparkWalletViewer(mnemonic) {
  try {
    const runtime = await selectSparkRuntime(
      undefined,
      false,
      undefined,
      false,
    );
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.initializeSparkWalletViewer,
        {
          mnemonic,
        },
      );
      return response;
    } else {
      if (walletViewer && !mnemonic) return true;
      if (!mnemonic) return false;

      const SparkReadonlyClient = await getSparkReadonlyClient();
      walletViewer = await SparkReadonlyClient.createWithMasterKey(
        {
          network: 'MAINNET',
        },
        mnemonic,
      );

      return true;
    }
  } catch (err) {
    console.log('error initializing wallet viewer', err);
    return false;
  }
}

// Drop the cached readonly client so an account switch / reset rebuilds it for
// the new mnemonic. Called from sparkContext.resetSparkState. Without this the
// module-global viewer persists across accounts (stale cross-account reads) and
// the missing export throws mid-reset.
export function disposeWalletViewer() {
  walletViewer = null;
}

export async function getTokensBalance(sparkAddress) {
  try {
    const runtime = await selectSparkRuntime(
      undefined,
      false,
      undefined,
      false,
    );
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getWalletViewerTokens,
        {
          sparkAddress,
          USDB_TOKEN_ID,
        },
      );
      return response;
    } else {
      const viewerReady = await initializeSparkWalletViewer();
      if (!viewerReady) return 0;

      const balance = await walletViewer.getTokenBalance(sparkAddress);
      let currentTokensObj = {};
      for (const [tokensIdentifier, tokensData] of balance) {
        currentTokensObj[tokensIdentifier] = {
          ...tokensData,
          balance: tokensData.availableToSendBalance,
        };
      }
      return currentTokensObj[USDB_TOKEN_ID]?.balance;
    }
  } catch (err) {
    console.log('error getting token transactions', err);
    return 0;
  }
}

export async function getBitcoinBalance(sparkAddress) {
  try {
    const runtime = await selectSparkRuntime(
      undefined,
      false,
      undefined,
      false,
    );
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getWalletViewerBitcoin,
        {
          sparkAddress,
        },
      );
      return response;
    } else {
      const viewerReady = await initializeSparkWalletViewer();
      if (!viewerReady) return 0;

      const balance = await walletViewer.getAvailableBalance(sparkAddress);
      return balance;
    }
  } catch (err) {
    console.log('error getting bitcoin balance', err);
    return 0;
  }
}

export async function getTokenTransactions(
  sparkAddress,
  { pageSize, cursor, direction } = {},
) {
  try {
    const runtime = await selectSparkRuntime(
      undefined,
      false,
      undefined,
      false,
    );
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getWalletViewerTokenTransactions,
        {
          sparkAddress,
          USDB_TOKEN_ID,
          pageSize,
          cursor,
          direction,
        },
      );
      return response;
    } else {
      const viewerReady = await initializeSparkWalletViewer();
      console.log(viewerReady, 'viewer ready');
      if (!viewerReady) return false;
      const response = await walletViewer.getTokenTransactions({
        sparkAddresses: [sparkAddress],
        tokenIdentifiers: [USDB_TOKEN_ID],
        pageSize,
        cursor,
        direction,
      });
      console.log(response, 'token transactions');
      return response;
    }
  } catch (err) {
    console.log('error getting token transactions', err);
    return false;
  }
}

export async function getBitcoinWithdrawls(
  sparkAddress,
  { limit, offset } = {},
) {
  try {
    const runtime = await selectSparkRuntime(
      undefined,
      false,
      undefined,
      false,
    );
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getWalletViewerBitcoinTransactions,
        {
          sparkAddress,
          limit,
          offset,
        },
      );
      return response;
    } else {
      const viewerReady = await initializeSparkWalletViewer();
      console.log('viewer ready', viewerReady);
      if (!viewerReady) return false;
      const response = await walletViewer.getTransfers({
        sparkAddress: sparkAddress,
        limit,
        offset,
      });
      console.log(response, 'bitcoin transfers');
      return response;
    }
  } catch (err) {
    console.log('error getting bitcoin withdrawls', err);
    return false;
  }
}
