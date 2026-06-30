import { ensureSparkDatabaseReady } from './transactions';

const TABLE = 'account_balance_snapshots';

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
