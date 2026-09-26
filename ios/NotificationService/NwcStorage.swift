import Foundation
import Security
import SQLite3

// State shared with the React Native app. The app writes all of it (see
// app/functions/nwc/sharedStorage.js); the extension only reads config and
// secrets, and reads/writes the two ledgers the JS handler also uses.
enum NwcShared {
  static let appGroup = "group.com.blitzwallet.application"
  // expo-secure-store items written with keychainService = this group.
  static let keychainGroup = "38WX44YTA6.com.blitzwallet.SharedKeychain"

  static var directory: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
      .appendingPathComponent("nwc", isDirectory: true)
  }

  // Same lookup order as expo-secure-store's getItemAsync (no-auth, legacy).
  static func secureStoreValue(_ key: String) -> String? {
    for service in ["\(keychainGroup):no-auth", keychainGroup] {
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: Data(key.utf8),
        kSecAttrAccessGroup as String: keychainGroup,
        kSecMatchLimit as String: kSecMatchLimitOne,
        kSecReturnData as String: true,
      ]
      var item: CFTypeRef?
      if SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
        let data = item as? Data
      {
        return String(data: data, encoding: .utf8)
      }
    }
    return nil
  }
}

struct NwcAccount {
  let publicKey: String
  let privateKey: [UInt8]
  let clientPubkey: String
  let permissions: [String: Bool]
  let budgetOption: String?
  // nil = unlimited
  let budgetLimitMsat: Int64?
  let lastRotated: Int64?
  let totalSent: Int64
}

struct NwcConfig {
  let relayUrl: String
  let breezApiKey: String
  let accounts: [String: NwcAccount]
  let strings: [String: String]
  let mnemonic: String?

  // nil when the app has not written a snapshot yet or secrets are unreadable
  // (e.g. before the first unlock after a reboot).
  static func load(directory: URL) -> NwcConfig? {
    guard
      let data = try? Data(contentsOf: directory.appendingPathComponent("native_config.json")),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let secretsJson = NwcShared.secureStoreValue("NWC_SECURE_STORE_KEY"),
      let secrets = try? JSONSerialization.jsonObject(with: Data(secretsJson.utf8))
        as? [String: [String: Any]]
    else { return nil }

    var accounts: [String: NwcAccount] = [:]
    for (publicKey, raw) in json["accounts"] as? [String: [String: Any]] ?? [:] {
      guard let privateKeyHex = secrets[publicKey]?["privateKey"] as? String,
        let privateKey = [UInt8](hex: privateKeyHex)
      else { continue }
      var clientPubkey = raw["clientPubkey"] as? String
      if clientPubkey == nil, let secret = secrets[publicKey]?["secret"] as? String,
        let secretBytes = [UInt8](hex: secret)
      {
        clientPubkey = (try? NwcCrypto.publicKey(secret: secretBytes))?.hex
      }
      guard let clientPubkey else { continue }
      let budget = raw["budgetRenewalSettings"] as? [String: Any] ?? [:]
      let amount = budget["amount"]
      accounts[publicKey] = NwcAccount(
        publicKey: publicKey,
        privateKey: privateKey,
        clientPubkey: clientPubkey,
        permissions: raw["permissions"] as? [String: Bool] ?? [:],
        budgetOption: budget["option"] as? String,
        // Same coercion as JS `(amount || 0) * 1000`.
        budgetLimitMsat: (amount as? String) == "Unlimited"
          ? nil
          : Int64(((amount as? NSNumber)?.doubleValue ?? Double(amount as? String ?? "") ?? 0) * 1000),
        lastRotated: (raw["lastRotated"] as? NSNumber)?.int64Value,
        totalSent: (raw["totalSent"] as? NSNumber)?.int64Value ?? 0)
    }

    return NwcConfig(
      relayUrl: json["relayUrl"] as? String ?? "wss://relay.getalbypro.com/blitz",
      breezApiKey: json["breezApiKey"] as? String ?? "",
      accounts: accounts,
      strings: json["strings"] as? [String: String] ?? [:],
      mnemonic: NwcShared.secureStoreValue("NWC_SECURE_STORE_MNEMOINC"))
  }
}

// Minimal SQLite access for the shared NWC databases. Rollback journal (the
// app never enables WAL on these) so no lock outlives a statement.
final class NwcDatabase {
  private var db: OpaquePointer?
  private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

  init(path: String) throws {
    guard
      sqlite3_open_v2(
        path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil)
        == SQLITE_OK
    else { throw NwcError.storage("open \(path)") }
    sqlite3_busy_timeout(db, 5000)
  }

  deinit { sqlite3_close(db) }

  func exec(_ sql: String) throws {
    guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else {
      throw NwcError.storage(String(cString: sqlite3_errmsg(db)))
    }
  }

  @discardableResult
  func run(_ sql: String, _ args: [Any?] = []) throws -> Int {
    let statement = try prepare(sql, args)
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw NwcError.storage(String(cString: sqlite3_errmsg(db)))
    }
    return Int(sqlite3_changes(db))
  }

  func rows(_ sql: String, _ args: [Any?] = []) throws -> [[String: Any]] {
    let statement = try prepare(sql, args)
    defer { sqlite3_finalize(statement) }
    var result: [[String: Any]] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      var row: [String: Any] = [:]
      for i in 0..<sqlite3_column_count(statement) {
        let name = String(cString: sqlite3_column_name(statement, i))
        switch sqlite3_column_type(statement, i) {
        case SQLITE_INTEGER: row[name] = sqlite3_column_int64(statement, i)
        case SQLITE_FLOAT: row[name] = sqlite3_column_double(statement, i)
        case SQLITE_TEXT: row[name] = String(cString: sqlite3_column_text(statement, i))
        default: break
        }
      }
      result.append(row)
    }
    return result
  }

  func transaction<T>(_ body: () throws -> T) throws -> T {
    try exec("BEGIN IMMEDIATE")
    do {
      let value = try body()
      try exec("COMMIT")
      return value
    } catch {
      try? exec("ROLLBACK")
      throw error
    }
  }

  private func prepare(_ sql: String, _ args: [Any?]) throws -> OpaquePointer? {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
      throw NwcError.storage(String(cString: sqlite3_errmsg(db)))
    }
    for (index, arg) in args.enumerated() {
      let position = Int32(index + 1)
      switch arg {
      case let value as String: sqlite3_bind_text(statement, position, value, -1, Self.transient)
      case let value as Int64: sqlite3_bind_int64(statement, position, value)
      case let value as Int: sqlite3_bind_int64(statement, position, Int64(value))
      default: sqlite3_bind_null(statement, position)
      }
    }
    return statement
  }
}

// The JS event ledger (app/functions/nwc/eventLedger.js), same schema.
final class NwcLedger {
  private let db: NwcDatabase

  init(directory: URL) throws {
    db = try NwcDatabase(path: directory.appendingPathComponent("nwc_event_ledger.db").path)
    try db.exec(
      """
      CREATE TABLE IF NOT EXISTS handled_events (
        event_id TEXT PRIMARY KEY NOT NULL, account_pubkey TEXT NOT NULL, method TEXT,
        created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'processing',
        attempts INTEGER NOT NULL DEFAULT 1, processed_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nwc_ledger_state (
        account_pubkey TEXT PRIMARY KEY NOT NULL, budget_sent_msat INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_handled_events_account ON handled_events(account_pubkey);
      CREATE TABLE IF NOT EXISTS nwc_handoff (
        event_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
      """)
  }

  // Claim + keep the raw event so the JS handler can recover it if this process
  // dies. false = someone (native or JS) already owns the event.
  func claim(eventId: String, account: String, createdAt: Int64, payload: String) throws -> Bool {
    let now = NwcClock.nowMs
    return try db.transaction {
      let inserted = try db.run(
        """
        INSERT OR IGNORE INTO handled_events
        (event_id, account_pubkey, created_at, status, attempts, processed_at)
        VALUES (?, ?, ?, 'processing', 1, ?)
        """, [eventId, account, createdAt, now])
      guard inserted > 0 else { return false }
      try db.run(
        "INSERT OR REPLACE INTO nwc_handoff (event_id, payload, created_at) VALUES (?, ?, ?)",
        [eventId, payload, now])
      return true
    }
  }

  func setMethod(_ eventId: String, _ method: String) {
    _ = try? db.run("UPDATE handled_events SET method = ? WHERE event_id = ?", [method, eventId])
  }

  // done/failed: finished here, drop the recovery copy.
  func finish(_ eventId: String, status: String) {
    _ = try? db.transaction {
      try db.run(
        "UPDATE handled_events SET status = ?, processed_at = ? WHERE event_id = ?",
        [status, NwcClock.nowMs, eventId])
      try db.run("DELETE FROM nwc_handoff WHERE event_id = ?", [eventId])
    }
  }

  // Give the event to the JS handler (it claims 'handoff' rows).
  func handOff(_ eventId: String) {
    _ = try? db.run(
      "UPDATE handled_events SET status = 'handoff', processed_at = ? WHERE event_id = ?",
      [NwcClock.nowMs, eventId])
  }

  // A send was started but its outcome is unknown: never hand it off, never
  // retry it. The pending OUTGOING marker answers any later attempt.
  func abandon(_ eventId: String) {
    _ = try? db.run("DELETE FROM nwc_handoff WHERE event_id = ?", [eventId])
  }

  func spendState(_ account: String) -> (budgetSentMsat: Int64, windowStart: Int64)? {
    guard
      let row = try? db.rows(
        "SELECT budget_sent_msat, window_start FROM nwc_ledger_state WHERE account_pubkey = ?",
        [account]
      ).first,
      let sent = row["budget_sent_msat"] as? Int64, let start = row["window_start"] as? Int64
    else { return nil }
    return (sent, start)
  }

  // eventLedger.js reserveSpend, same SQL: the limit check and the increment are
  // one statement, so JS and this extension can never both pass on a stale
  // total. Returns the window reserved in, or nil when over `limitMsat` (nil =
  // unlimited).
  func reserveSpend(
    _ account: String, amountMsat: Int64, limitMsat: Int64?, fallbackSentMsat: Int64,
    fallbackWindowStart: Int64, now: Int64, isWindowCurrent: (Int64) -> Bool
  ) throws -> Int64? {
    try db.run(
      """
      INSERT OR IGNORE INTO nwc_ledger_state (account_pubkey, budget_sent_msat, window_start)
      VALUES (?, ?, ?)
      """, [account, fallbackSentMsat, fallbackWindowStart])
    guard var windowStart = spendState(account)?.windowStart else {
      throw NwcError.storage("spend state missing")
    }
    if !isWindowCurrent(windowStart) {
      // Compare-and-swap: only one payer starts the new window.
      try db.run(
        """
        UPDATE nwc_ledger_state SET budget_sent_msat = 0, window_start = ?
        WHERE account_pubkey = ? AND window_start = ?
        """, [now, account, windowStart])
      guard let current = spendState(account)?.windowStart else {
        throw NwcError.storage("spend state missing")
      }
      windowStart = current
    }
    let reserved = try db.run(
      """
      UPDATE nwc_ledger_state SET budget_sent_msat = budget_sent_msat + ?
      WHERE account_pubkey = ? AND window_start = ? AND (? IS NULL OR budget_sent_msat + ? <= ?)
      """, [amountMsat, account, windowStart, limitMsat, amountMsat, limitMsat])
    return reserved > 0 ? windowStart : nil
  }

  // eventLedger.js adjustSpend: relative, so concurrent spend is never erased.
  func adjustSpend(_ account: String, windowStart: Int64, deltaMsat: Int64) throws {
    try db.run(
      """
      UPDATE nwc_ledger_state SET budget_sent_msat = MAX(0, budget_sent_msat + ?)
      WHERE account_pubkey = ? AND window_start = ?
      """, [deltaMsat, account, windowStart])
  }
}

// The JS invoice cache (app/functions/nwc/cachedNWCTxs.js), same schema.
final class NwcInvoices {
  private let db: NwcDatabase

  init(directory: URL) throws {
    db = try NwcDatabase(path: directory.appendingPathComponent("nwc_invoices.db").path)
    try db.exec(
      """
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT, payment_hash TEXT NOT NULL UNIQUE,
        invoice TEXT NOT NULL UNIQUE, amount INTEGER, description TEXT, sparkID TEXT, type TEXT,
        status TEXT DEFAULT 'pending', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        expires_at INTEGER, settled_at INTEGER, metadata TEXT, fee INTEGER, preimage TEXT);
      CREATE INDEX IF NOT EXISTS idx_payment_hash ON invoices(payment_hash);
      CREATE INDEX IF NOT EXISTS idx_invoice ON invoices(invoice);
      CREATE INDEX IF NOT EXISTS idx_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON invoices(created_at);
      """)
  }

  func lookup(invoice: String?, paymentHash: String?) throws -> [String: Any]? {
    if let invoice {
      return try db.rows("SELECT * FROM invoices WHERE invoice = ?", [invoice]).first
    }
    return try db.rows("SELECT * FROM invoices WHERE payment_hash = ?", [paymentHash]).first
  }

  // As in cachedNWCTxs.js storeCreatedInvoice.
  func store(
    paymentHash: String, invoice: String, amountSats: Int64, description: String?,
    expiresAt: Int64?, type: String
  ) throws {
    let now = NwcClock.nowMs
    let metadata: [String: Any] = ["created_via": "nwc_create_invoice"]
    try db.run(
      """
      INSERT INTO invoices (payment_hash, invoice, amount, description, created_at, updated_at,
        expires_at, settled_at, metadata, sparkID, type, fee, preimage)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, '', ?, 0, '')
      """,
      [
        paymentHash, invoice, amountSats, description, now, now, expiresAt,
        String(decoding: try JSONSerialization.data(withJSONObject: metadata), as: UTF8.self), type,
      ])
  }

  func updateStatus(paymentHash: String, status: String, preimage: String, feeSats: Int64? = nil)
    throws
  {
    let now = NwcClock.nowMs
    try db.run(
      """
      UPDATE invoices SET status = ?, updated_at = ?, settled_at = ?, preimage = ?,
        fee = COALESCE(?, fee) WHERE payment_hash = ?
      """, [status, now, now, preimage, feeSats, paymentHash])
  }
}

enum NwcClock {
  static var nowMs: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
  static var nowSeconds: Int64 { Int64(Date().timeIntervalSince1970) }
}

enum NwcError: Error {
  case storage(String)
  case handOff(String)
}
