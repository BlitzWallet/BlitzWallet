import {openDatabaseAsync} from 'expo-sqlite';

// Database configuration
const DB_NAME = 'nwc_invoices.db';
const DB_VERSION = 1;

class InvoiceDatabase {
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
      console.log('Invoice database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Create necessary tables
  async createTables() {
    const createInvoicesTable = `
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_hash TEXT NOT NULL UNIQUE,
        invoice TEXT NOT NULL UNIQUE,
        amount INTEGER,
        description TEXT,
        sparkID TEXT,
        type TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER,
        settled_at INTEGER,
        metadata TEXT,
        fee INTEGER,
        preimage TEXT
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_payment_hash ON invoices(payment_hash);
      CREATE INDEX IF NOT EXISTS idx_invoice ON invoices(invoice);
      CREATE INDEX IF NOT EXISTS idx_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON invoices(created_at);
    `;

    try {
      await this.db.execAsync(createInvoicesTable);
      await this.db.execAsync(createIndexes);
      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Failed to create tables:', error);
      throw error;
    }
  }

  // Ensure database is initialized
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Store a new invoice
  async storeInvoice(invoiceData) {
    await this.ensureInitialized();

    const {
      payment_hash,
      invoice,
      amount = null,
      description = null,
      expires_at = null,
      settled_at = null,
      metadata = null,
      sparkID = null,
      type = null,
      fee,
      preimage,
    } = invoiceData;

    const now = Date.now();

    try {
      const result = await this.db.runAsync(
        `INSERT INTO invoices 
         (payment_hash, invoice, amount, description, created_at, updated_at, expires_at, settled_at,  metadata, sparkID, type, fee, preimage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment_hash,
          invoice,
          amount,
          description,
          now,
          now,
          expires_at,
          settled_at,
          metadata ? JSON.stringify(metadata) : null,
          sparkID,
          type,
          fee,
          preimage,
        ],
      );

      console.log('Invoice stored with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Failed to store invoice:', error);
      throw error;
    }
  }

  // Lookup invoice by invoice string
  async lookupInvoiceByInvoiceString(invoiceString) {
    await this.ensureInitialized();

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM invoices WHERE invoice = ?',
        [invoiceString],
      );

      if (result && result.metadata) {
        try {
          result.metadata = JSON.parse(result.metadata);
        } catch (e) {
          console.warn('Failed to parse metadata for invoice:', invoiceString);
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to lookup invoice by invoice string:', error);
      throw error;
    }
  }

  // Lookup invoice by payment hash
  async lookupInvoiceByPaymentHash(paymentHash) {
    await this.ensureInitialized();

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM invoices WHERE payment_hash = ?',
        [paymentHash],
      );

      if (result && result.metadata) {
        try {
          result.metadata = JSON.parse(result.metadata);
        } catch (e) {
          console.warn(
            'Failed to parse metadata for payment hash:',
            paymentHash,
          );
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to lookup invoice by payment hash:', error);
      throw error;
    }
  }

  // Update invoice status
  async updateInvoiceStatus(
    paymentHash,
    status,
    settledAt = null,
    preimage = '',
  ) {
    await this.ensureInitialized();

    const now = Date.now();

    try {
      const result = await this.db.runAsync(
        `UPDATE invoices 
         SET status = ?, updated_at = ?, settled_at = ?, preimage = ?
         WHERE payment_hash = ?`,
        [status, now, settledAt, preimage, paymentHash],
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update invoice status:', error);
      throw error;
    }
  }

  // Get all invoices with optional filtering
  async getInvoices(filters = {}) {
    await this.ensureInitialized();

    let query = 'SELECT * FROM invoices';
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    try {
      const results = await this.db.getAllAsync(query, params);

      return results.map(result => {
        if (result.metadata) {
          try {
            result.metadata = JSON.parse(result.metadata);
          } catch (e) {
            console.warn('Failed to parse metadata for invoice ID:', result.id);
          }
        }
        return result;
      });
    } catch (error) {
      console.error('Failed to get invoices:', error);
      throw error;
    }
  }

  // Delete old expired invoices
  async cleanupExpiredInvoices() {
    await this.ensureInitialized();

    const now = Date.now();

    try {
      const result = await this.db.runAsync(
        'DELETE FROM invoices WHERE expires_at IS NOT NULL AND expires_at < ? AND status = ?',
        [now, 'pending'],
      );

      console.log('Cleaned up expired invoices:', result.changes);
      return result.changes;
    } catch (error) {
      console.error('Failed to cleanup expired invoices:', error);
      throw error;
    }
  }

  async dropInvoicesTable() {
    await this.ensureInitialized();

    try {
      await this.db.runAsync('DROP TABLE IF EXISTS invoices');
      console.log('Invoices table dropped successfully');
      return true;
    } catch (error) {
      console.error('Failed to drop invoices table:', error);
      throw error;
    }
  }

  async resetDatabase() {
    await this.ensureInitialized();

    try {
      // Drop the table
      await this.db.runAsync('DROP TABLE IF EXISTS invoices');
      console.log('Dropped invoices table');

      // Recreate the table
      await this.createTables();
      console.log('Database reset completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  // Close database connection
  async close() {
    if (this.db) {
      await this.db.closeAsync();
      this.isInitialized = false;
      console.log('Database connection closed');
    }
  }
}

const invoiceDB = new InvoiceDatabase();
// Utility functions for NWC integration
export const NWCInvoiceManager = {
  // Initialize the database
  async initialize() {
    return await invoiceDB.initialize();
  },

  // Store invoice from create_invoice response
  async storeCreatedInvoice(createInvoiceResponse) {
    const {
      payment_hash,
      invoice,
      amount,
      description,
      created_at,
      settled_at,
      expires_at,
      sparkID,
      type,
      fee = 0,
      preimage = '',
    } = createInvoiceResponse;

    return await invoiceDB.storeInvoice({
      payment_hash,
      invoice,
      amount,
      description,
      created_at: created_at ? new Date(created_at).getTime() : null,
      settled_at: settled_at ? new Date(settled_at).getTime() : null,
      expires_at: expires_at ? new Date(expires_at).getTime() : null,
      metadata: {created_via: 'nwc_create_invoice'},
      sparkID,
      type,
      fee,
      preimage,
    });
  },

  // Handle lookup_invoice request
  async handleLookupInvoice(request) {
    const {payment_hash, invoice} = request;

    if (!payment_hash && !invoice) {
      throw new Error('Either payment_hash or invoice must be provided');
    }

    let result = null;

    if (invoice) {
      result = await invoiceDB.lookupInvoiceByInvoiceString(invoice);
    } else if (payment_hash) {
      result = await invoiceDB.lookupInvoiceByPaymentHash(payment_hash);
    }

    if (!result) {
      return null; // Invoice not found
    }

    // Return in NWC format
    return {
      type: result.type,
      invoice: result.invoice,
      description: result.description,
      preimage: result.preimage,
      payment_hash: result.payment_hash,
      amount: result.amount,
      fees_paid: result.fee,
      created_at: result.created_at,
      expires_at: result.expires_at,
      settled_at: result.settled_at,
      status: result.status,
      sparkID: result.sparkID,
    };
  },

  // Update invoice when payment is received
  async markInvoiceAsNotPending(paymentHash, status, preimgae) {
    return await invoiceDB.updateInvoiceStatus(
      paymentHash,
      status,
      Date.now(),
      preimgae,
    );
  },

  async dropTable() {
    return await invoiceDB.dropInvoicesTable();
  },

  async resetDatabase() {
    return await invoiceDB.resetDatabase();
  },

  // Get database instance for direct access
  getDatabase() {
    return invoiceDB;
  },
};

export default NWCInvoiceManager;
