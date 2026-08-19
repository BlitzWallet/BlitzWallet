import { ensureSparkDatabaseReady } from './transactions';
import formatTokensNumber from '../lrc20/formatTokensBalance';
import { USDB_TOKEN_ID } from '../../constants';

const TABLE = 'account_balance_snapshots';

// Dollars held in the USDB token of a tokens object (0 when absent). Shared by
// the edit page's USD pager and the accounts-list balance preview so the two
// never drift.
export function getUsdTokenDollars(tokensObj) {
  const usdbToken = tokensObj?.[USDB_TOKEN_ID];
  if (usdbToken?.balance != null && usdbToken?.tokenMetadata?.decimals != null) {
    return (
      parseFloat(
        formatTokensNumber(
          usdbToken.balance,
          usdbToken.tokenMetadata.decimals,
        ),
      ) || 0
    );
  }
  return 0;
}

// Token maps coming from the native runtime can carry BigInt fields in their
// metadata (the merge only down-converts balance/maxSupply). JSON.stringify
// throws on BigInt, which would otherwise drop the entire snapshot row, so
// serialize BigInt as its decimal string.
const bigIntSafeReplacer = (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

export async function saveAccountBalanceSnapshot(identityPubKey, balance, tokensObj) {
  try {
    const db = await ensureSparkDatabaseReady();
    await db.runAsync(
      `INSERT OR REPLACE INTO ${TABLE} (identityPubKey, balance, tokens, updatedAt)
       VALUES (?, ?, ?, ?)`,
      [
        identityPubKey,
        balance,
        JSON.stringify(tokensObj ?? {}, bigIntSafeReplacer),
        Date.now(),
      ],
    );
  } catch (err) {
    console.log('Error saving account balance snapshot', err);
  }
}

export async function getAccountBalanceSnapshot(identityPubKey) {
  try {
    const db = await ensureSparkDatabaseReady();
    const row = await db.getFirstAsync(
      `SELECT balance, tokens FROM ${TABLE} WHERE identityPubKey = ?`,
      [identityPubKey],
    );
    if (!row) return null;
    return { balance: row.balance, tokens: JSON.parse(row.tokens) };
  } catch (err) {
    console.log('Error reading account balance snapshot', err);
    return null;
  }
}

export async function getAllAccountBalanceSnapshots() {
  try {
    const db = await ensureSparkDatabaseReady();
    const rows = await db.getAllAsync(
      `SELECT identityPubKey, balance, tokens, updatedAt FROM ${TABLE}
       ORDER BY updatedAt DESC`,
    );
    return rows.map(r => ({
      identityPubKey: r.identityPubKey,
      balance: r.balance,
      tokens: JSON.parse(r.tokens),
      updatedAt: r.updatedAt,
    }));
  } catch (err) {
    console.log('Error reading all account balance snapshots', err);
    return [];
  }
}

// Drops the cached per-account balance snapshot table. The table lives in the
// shared Spark database and is recreated by initializeSparkDatabase, so the
// wipe's re-init pass brings it back empty. Returns true/false.
export async function deleteAccountBalanceSnapshotsTable() {
  try {
    const db = await ensureSparkDatabaseReady();
    await db.execAsync(`DROP TABLE IF EXISTS ${TABLE}`);
    return true;
  } catch (err) {
    console.log('Error deleting account balance snapshots table', err);
    return false;
  }
}
