import { openDatabaseAsync } from 'expo-sqlite';

// Database configuration
const DB_NAME = 'nwc_event_ledger.db';
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

class EventLedger {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // Initialize database connection
  async initialize() {
    try {
      this.db = await openDatabaseAsync(DB_NAME);
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

  // Persist the absolute spend total for the current budget window.
  async setSpendState(accountPubkey, budgetSentMsat, windowStart) {
    await this.ensureInitialized();

    try {
      await this.db.runAsync(
        `INSERT INTO nwc_ledger_state (account_pubkey, budget_sent_msat, window_start)
         VALUES (?, ?, ?)
         ON CONFLICT(account_pubkey) DO UPDATE SET
           budget_sent_msat = excluded.budget_sent_msat,
           window_start = excluded.window_start`,
        [accountPubkey, budgetSentMsat, windowStart],
      );
    } catch (error) {
      console.error('Failed to persist spend state:', accountPubkey, error);
      throw error;
    }
  }
}

const eventLedger = new EventLedger();

export const nwcEventLedger = eventLedger;
export default eventLedger;
