import { openDatabaseAsync } from 'expo-sqlite';
import { getNWCDatabaseDirectory, migrateNWCDatabase } from './sharedStorage';

// Database configuration
const DB_NAME = 'nwc_event_ledger.db';
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;
// A native handler (iOS NSE ~30 s, Android service) that has held a claim this
// long without finishing was killed; its raw event is still in nwc_handoff.
const NATIVE_LEASE_MS = 60 * 1000;

class EventLedger {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // Initialize database connection
  async initialize() {
    try {
      // Shared with the native NWC handlers — see sharedStorage.js.
      migrateNWCDatabase(DB_NAME);
      this.db = await openDatabaseAsync(
        DB_NAME,
        undefined,
        getNWCDatabaseDirectory(),
      );
      await this.db.execAsync('PRAGMA busy_timeout = 5000;');
      await this.createTables();
      this.isInitialized = true;
      console.log('NWC event ledger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize event ledger:', error);
      throw error;
    }
  }

  // Ensure database is initialized
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Create necessary tables
  async createTables() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS handled_events (
        event_id TEXT PRIMARY KEY NOT NULL,
        account_pubkey TEXT NOT NULL,
        method TEXT,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        attempts INTEGER NOT NULL DEFAULT 1,
        processed_at INTEGER NOT NULL
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS nwc_ledger_state (
        account_pubkey TEXT PRIMARY KEY NOT NULL,
        budget_sent_msat INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL
      );
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_handled_events_account ON handled_events(account_pubkey);
    `);

    // Raw events a native handler claimed. Native deletes its row once the
    // event is done/failed; rows left behind are handed to this JS handler.
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS nwc_handoff (
        event_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  // Wipes all wallet-local event/idempotency + budget ledger state. Mirrors
  // NWCInvoiceManager.resetDatabase(): DROP both tables, recreate them empty,
  // keep the cached handle + isInitialized (DROP + CREATE on the same live
  // connection is safe).
  async resetDatabase() {
    await this.ensureInitialized();

    try {
      await this.db.execAsync(`
        DROP TABLE IF EXISTS handled_events;
        DROP TABLE IF EXISTS nwc_ledger_state;
        DROP TABLE IF EXISTS nwc_handoff;
      `);
      await this.createTables();
      console.log('NWC event ledger reset completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to reset event ledger:', error);
      throw error;
    }
  }

  // Atomically claim an event id for processing.
  // Returns 'claimed' when this caller may process the event, or the terminal
  // status ('done' | 'failed') / 'busy' when it must be skipped.
  async claimEvent(eventId, accountPubkey, createdAt, now) {
    await this.ensureInitialized();

    try {
      const inserted = await this.db.runAsync(
        `INSERT OR IGNORE INTO handled_events
         (event_id, account_pubkey, created_at, status, attempts, processed_at)
         VALUES (?, ?, ?, 'processing', 1, ?)`,
        [eventId, accountPubkey, createdAt, now],
      );

      if (inserted.changes > 0) {
        return 'claimed';
      }

      const row = await this.db.getFirstAsync(
        'SELECT status, attempts, processed_at FROM handled_events WHERE event_id = ?',
        [eventId],
      );

      if (!row) return 'claimed';
      if (row.status === 'done' || row.status === 'failed') {
        return row.status;
      }

      // Handed off by a native handler: take it over atomically so a second
      // JS invocation (or the native side) cannot process it too.
      if (row.status === 'handoff') {
        const taken = await this.db.runAsync(
          `UPDATE handled_events SET status = 'processing', attempts = attempts + 1, processed_at = ?
           WHERE event_id = ? AND status = 'handoff'`,
          [now, eventId],
        );
        return taken.changes > 0 ? 'claimed' : 'busy';
      }

      // Reclaim only events stuck in 'processing' (e.g. crash mid-batch),
      // bounded by attempts to prevent infinite reprocessing.
      if (
        row.status === 'processing' &&
        now - row.processed_at > STALE_PROCESSING_MS &&
        row.attempts < MAX_ATTEMPTS
      ) {
        await this.db.runAsync(
          'UPDATE handled_events SET attempts = attempts + 1, processed_at = ? WHERE event_id = ?',
          [now, eventId],
        );
        return 'claimed';
      }

      return 'busy';
    } catch (error) {
      console.error('Failed to claim event:', eventId, error);
      throw error;
    }
  }

  async setMethod(eventId, method) {
    await this.ensureInitialized();

    try {
      await this.db.runAsync(
        'UPDATE handled_events SET method = ? WHERE event_id = ?',
        [method, eventId],
      );
    } catch (error) {
      console.error('Failed to update event method:', eventId, error);
    }
  }

  async markDone(eventId, now) {
    await this.ensureInitialized();

    try {
      await this.db.runAsync(
        "UPDATE handled_events SET status = 'done', processed_at = ? WHERE event_id = ?",
        [now, eventId],
      );
    } catch (error) {
      console.error('Failed to mark event done:', eventId, error);
    }
  }

  async markFailed(eventId, now) {
    await this.ensureInitialized();

    try {
      await this.db.runAsync(
        "UPDATE handled_events SET status = 'failed', processed_at = ? WHERE event_id = ?",
        [now, eventId],
      );
    } catch (error) {
      console.error('Failed to mark event failed:', eventId, error);
    }
  }

  // Events a native handler gave up on, plus claims it abandoned (process
  // killed past its lease). Abandoned claims are flipped to 'handoff' first so
  // claimEvent can take them. A pay_invoice that already started sending is
  // still safe: its pending OUTGOING marker blocks a second send.
  async getNativeHandoffs(now) {
    await this.ensureInitialized();

    try {
      await this.db.runAsync(
        `UPDATE handled_events SET status = 'handoff'
         WHERE status = 'processing' AND processed_at < ?
         AND event_id IN (SELECT event_id FROM nwc_handoff)`,
        [now - NATIVE_LEASE_MS],
      );
      return await this.db.getAllAsync(
        `SELECT h.event_id, h.payload, h.created_at FROM nwc_handoff h
         JOIN handled_events e ON e.event_id = h.event_id
         WHERE e.status = 'handoff'`,
      );
    } catch (error) {
      console.error('Failed to read native handoffs:', error);
      return [];
    }
  }

  // Drops handoff rows that were processed or are too old to ever be valid.
  async pruneNativeHandoffs(now, maxAgeMs) {
    await this.ensureInitialized();

    try {
      await this.db.runAsync(
        `DELETE FROM nwc_handoff
         WHERE created_at < ?
         OR event_id IN (SELECT event_id FROM handled_events WHERE status IN ('done', 'failed'))`,
        [now - maxAgeMs],
      );
    } catch (error) {
      console.error('Failed to prune native handoffs:', error);
    }
  }

  async getSpendState(accountPubkey) {
    await this.ensureInitialized();

    try {
      const row = await this.db.getFirstAsync(
        'SELECT budget_sent_msat, window_start FROM nwc_ledger_state WHERE account_pubkey = ?',
        [accountPubkey],
      );

      if (!row) return null;
      return {
        budgetSentMsat: row.budget_sent_msat,
        windowStart: row.window_start,
      };
    } catch (error) {
      console.error('Failed to read spend state:', accountPubkey, error);
      throw error;
    }
  }

  // Atomically reserves `amountMsat` of the account's budget. JS and the native
  // handlers (NwcStorage.kt / NwcStorage.swift, same SQL) pay concurrently from
  // separate processes, so the limit check and the increment are one statement:
  // two payers can never both pass on the same stale total. Returns the window
  // the reservation was made in (pass it to adjustSpend), or null when it would
  // exceed `limitMsat` (null limit = unlimited).
  async reserveSpend({
    accountPubkey,
    amountMsat,
    limitMsat,
    fallbackSentMsat,
    fallbackWindowStart,
    now,
    isWindowCurrent,
  }) {
    await this.ensureInitialized();

    await this.db.runAsync(
      `INSERT OR IGNORE INTO nwc_ledger_state (account_pubkey, budget_sent_msat, window_start)
       VALUES (?, ?, ?)`,
      [accountPubkey, fallbackSentMsat, fallbackWindowStart],
    );
    let { windowStart } = await this.getSpendState(accountPubkey);
    if (!isWindowCurrent(windowStart)) {
      // Compare-and-swap: only one payer starts the new window.
      await this.db.runAsync(
        `UPDATE nwc_ledger_state SET budget_sent_msat = 0, window_start = ?
         WHERE account_pubkey = ? AND window_start = ?`,
        [now, accountPubkey, windowStart],
      );
      ({ windowStart } = await this.getSpendState(accountPubkey));
    }
    const reserved = await this.db.runAsync(
      `UPDATE nwc_ledger_state SET budget_sent_msat = budget_sent_msat + ?
       WHERE account_pubkey = ? AND window_start = ?
       AND (? IS NULL OR budget_sent_msat + ? <= ?)`,
      [amountMsat, accountPubkey, windowStart, limitMsat, amountMsat, limitMsat],
    );
    return reserved.changes > 0 ? windowStart : null;
  }

  // Relative change to a reservation (release: -reserved, settle: actual -
  // reserved). Never writes an absolute total, so concurrent spend survives; a
  // window that has since rotated is left alone.
  async adjustSpend(accountPubkey, windowStart, deltaMsat) {
    await this.ensureInitialized();

    await this.db.runAsync(
      `UPDATE nwc_ledger_state SET budget_sent_msat = MAX(0, budget_sent_msat + ?)
       WHERE account_pubkey = ? AND window_start = ?`,
      [deltaMsat, accountPubkey, windowStart],
    );
  }
}

const eventLedger = new EventLedger();

export const nwcEventLedger = eventLedger;
export default eventLedger;
