import { USDB_TOKEN_ID } from '../../constants';
import { acquire, release, identityFor, peek } from './walletRuntime';
import {
  deriveSparkAddress,
  deriveSparkIdentityKey,
} from '../gift/deriveGiftWallet';

// Read-only views of OTHER wallets (savings, managed/child accounts). Breez has
// no read-only client, so each read opens the wallet in SERVER mode, syncs,
// reads and releases (TTL close, storage kept). Row shapes match the old
// SparkReadonlyClient so savingsContext / walletViewerTransactions are unchanged.

const VIEWER_TTL_MS = 30000;
const SYNC_MIN_INTERVAL_MS = 20000;
const DEFAULT_PAGE_SIZE = 50;

// sparkAddress -> mnemonic. Keyed by address so a second viewer never replaces
// the first (the old module-global singleton did).
const viewers = new Map();
let lastMnemonic = null;
const lastSync = new Map(); // identity -> { at, promise }

export async function initializeSparkWalletViewer(mnemonic) {
  try {
    if (!mnemonic) return !!lastMnemonic;
    const key = await deriveSparkIdentityKey(mnemonic, 1);
    const derived = deriveSparkAddress(key.publicKey);
    if (!derived.success) return false;
    viewers.set(derived.address.toLowerCase(), mnemonic);
    lastMnemonic = mnemonic;
    return true;
  } catch (err) {
    console.log('error initializing wallet viewer', err);
    return false;
  }
}

// Called from sparkContext.resetSparkState on account switch / reset. Open
// server handles close themselves via their release TTL.
export function disposeWalletViewer() {
  viewers.clear();
  lastMnemonic = null;
  lastSync.clear();
}

async function syncOnce(handle) {
  const prev = lastSync.get(handle.identity);
  if (prev && (prev.promise || Date.now() - prev.at < SYNC_MIN_INTERVAL_MS)) {
    return prev.promise;
  }
  const promise = handle.sync().finally(() => {
    lastSync.set(handle.identity, { at: Date.now() });
  });
  lastSync.set(handle.identity, { at: 0, promise });
  return promise;
}

async function withViewer(sparkAddress, fn) {
  const mnemonic =
    viewers.get(String(sparkAddress).toLowerCase()) || lastMnemonic;
  if (!mnemonic) throw new Error('Wallet viewer not initialized');

  // Already open as a client (the active account): read through it.
  const live = peek(await identityFor(mnemonic));
  if (live?.mode === 'client') return fn(live);

  const handle = await acquire(mnemonic, { mode: 'server' });
  try {
    await syncOnce(handle);
    return await fn(handle);
  } finally {
    release(handle, { ttlMs: VIEWER_TTL_MS });
  }
}

const bytesOfHex = hex => Buffer.from(hex, 'hex');
const bigintBytes = n => {
  let hex = BigInt(n).toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  return bytesOfHex(hex);
};
// Old transfer.type numbers (see walletViewerTransactions).
const TRANSFER_TYPE = { lightning: 0, withdraw: 1, deposit: 3 };

export async function getTokensBalance(sparkAddress) {
  try {
    return await withViewer(sparkAddress, async h => {
      const info = await h.getInfo();
      return Number(info.tokenBalances.get(USDB_TOKEN_ID)?.balance ?? 0);
    });
  } catch (err) {
    console.log('error getting token balance', err);
    return 0;
  }
}

export async function getBitcoinBalance(sparkAddress) {
  try {
    return await withViewer(sparkAddress, async h =>
      Number((await h.getInfo()).balanceSats),
    );
  } catch (err) {
    console.log('error getting bitcoin balance', err);
    return 0;
  }
}

// cursor is the stringified offset of the next page ('' = first page).
export async function getTokenTransactions(
  sparkAddress,
  { pageSize = DEFAULT_PAGE_SIZE, cursor } = {},
) {
  try {
    return await withViewer(sparkAddress, async h => {
      const offset = Number(cursor) || 0;
      const payments = await h.listPayments({
        assetFilter: { type: 'token', tokenIdentifier: USDB_TOKEN_ID },
        statusFilter: ['completed'],
        offset,
        limit: pageSize + 1,
      });
      const page = payments.slice(0, pageSize);
      const identity = bytesOfHex(h.identity);
      return {
        transactions: page.map(p => ({
          tokenTransactionHash: bytesOfHex(p.details?.txHash ?? ''),
          tokenTransaction: {
            clientCreatedTimestamp: new Date(p.timestamp * 1000),
            tokenOutputs: [
              {
                // Receives are owned by this wallet; the counterparty of a
                // send is unknown, so any other key marks it outgoing.
                ownerPublicKey:
                  p.paymentType === 'receive' ? identity : Buffer.alloc(33),
                tokenAmount: bigintBytes(p.amount),
              },
            ],
          },
        })),
        pageResponse: {
          hasNextPage: payments.length > pageSize,
          nextCursor: String(offset + page.length),
        },
      };
    });
  } catch (err) {
    console.log('error getting token transactions', err);
    return false;
  }
}

export async function getBitcoinWithdrawls(
  sparkAddress,
  { limit = DEFAULT_PAGE_SIZE, offset = 0 } = {},
) {
  try {
    return await withViewer(sparkAddress, async h => {
      const payments = await h.listPayments({
        assetFilter: { type: 'bitcoin' },
        statusFilter: ['completed'],
        offset,
        limit,
      });
      const identity = bytesOfHex(h.identity);
      return {
        transfers: payments.map(p => ({
          id: p.id,
          type: TRANSFER_TYPE[p.method] ?? 2,
          status: p.status,
          totalValue: Number(p.amount),
          createdTime: new Date(p.timestamp * 1000),
          senderIdentityPublicKey:
            p.paymentType === 'send' ? identity : Buffer.alloc(33),
        })),
        offset: offset + payments.length,
      };
    });
  } catch (err) {
    console.log('error getting bitcoin withdrawls', err);
    return false;
  }
}
