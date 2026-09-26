package com.blitzwallet.nwc

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

// State shared with the React Native app (app/functions/nwc/sharedStorage.js):
// the config snapshot, the existing expo-secure-store secrets and the two NWC
// ledgers the JS handler also uses. This code runs in the separate ":nwc"
// process, so the system SQLite here never shares a process with expo-sqlite's
// bundled copy (two SQLite libraries in one process break each other's locks).
object NwcShared {
  // expo-sqlite's defaultDatabaseDirectory; the JS side writes the config here too.
  fun directory(context: Context) = File(context.filesDir.canonicalFile, "SQLite")

  private const val KEYCHAIN_SERVICE = "38WX44YTA6.com.blitzwallet.SharedKeychain"

  // Reads an expo-secure-store 15 item (scheme "aes": AES-GCM with a
  // non-exportable Android Keystore key), same lookup as getItemImpl.
  fun secureStoreValue(context: Context, key: String): String? {
    val prefs = context.getSharedPreferences("SecureStore", Context.MODE_PRIVATE)
    val raw = prefs.getString("$KEYCHAIN_SERVICE-$key", null) ?: prefs.getString(key, null) ?: return null
    return try {
      val item = JSONObject(raw)
      if (item.optString("scheme") != "aes" || item.optBoolean("requireAuthentication")) return null
      val baseAlias = "AES/GCM/NoPadding:$KEYCHAIN_SERVICE"
      val alias = if (item.optBoolean("usesKeystoreSuffix")) "$baseAlias:keystoreUnauthenticated" else baseAlias
      val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry ?: return null
      val cipher = Cipher.getInstance("${KeyProperties.KEY_ALGORITHM_AES}/GCM/NoPadding")
      cipher.init(
        Cipher.DECRYPT_MODE,
        entry.secretKey,
        GCMParameterSpec(item.getInt("tlen"), Base64.decode(item.getString("iv"), Base64.DEFAULT)),
      )
      String(cipher.doFinal(Base64.decode(item.getString("ct"), Base64.DEFAULT)), Charsets.UTF_8)
    } catch (e: Exception) {
      null
    }
  }
}

data class NwcAccount(
  val publicKey: String,
  val privateKey: ByteArray,
  val clientPubkey: String,
  val permissions: Map<String, Boolean>,
  val budgetOption: String?,
  // null = unlimited
  val budgetLimitMsat: Long?,
  val lastRotated: Long?,
  val totalSent: Long,
)

class NwcConfig(
  val relayUrl: String,
  val breezApiKey: String,
  val accounts: Map<String, NwcAccount>,
  val strings: Map<String, String>,
  val mnemonic: String?,
) {
  companion object {
    // null when the app has not written a snapshot yet or secrets are unreadable.
    fun load(context: Context): NwcConfig? = try {
      val json = JSONObject(File(NwcShared.directory(context), "native_config.json").readText())
      val secrets = JSONObject(NwcShared.secureStoreValue(context, "NWC_SECURE_STORE_KEY") ?: return null)
      val accounts = mutableMapOf<String, NwcAccount>()
      val rawAccounts = json.optJSONObject("accounts") ?: JSONObject()
      for (publicKey in rawAccounts.keys()) {
        val raw = rawAccounts.getJSONObject(publicKey)
        val secret = secrets.optJSONObject(publicKey) ?: continue
        val privateKey = secret.optString("privateKey").hexToBytes() ?: continue
        val clientPubkey = raw.optString("clientPubkey").takeIf { it.isNotEmpty() && it != "null" }
          ?: secret.optString("secret").hexToBytes()?.let { runCatching { NwcCrypto.publicKey(it).toHex() }.getOrNull() }
          ?: continue
        val permissionsJson = raw.optJSONObject("permissions") ?: JSONObject()
        val budget = raw.optJSONObject("budgetRenewalSettings") ?: JSONObject()
        val amount = budget.opt("amount")
        accounts[publicKey] = NwcAccount(
          publicKey = publicKey,
          privateKey = privateKey,
          clientPubkey = clientPubkey,
          permissions = permissionsJson.keys().asSequence().associateWith { permissionsJson.optBoolean(it) },
          budgetOption = budget.optString("option").takeIf { it.isNotEmpty() && it != "null" },
          // Same coercion as JS `(amount || 0) * 1000`.
          budgetLimitMsat = if (amount == "Unlimited") null
          else (((amount as? Number)?.toDouble() ?: amount?.toString()?.toDoubleOrNull() ?: 0.0) * 1000).toLong(),
          lastRotated = raw.optLong("lastRotated").takeIf { raw.has("lastRotated") && !raw.isNull("lastRotated") },
          totalSent = raw.optLong("totalSent", 0),
        )
      }
      val stringsJson = json.optJSONObject("strings") ?: JSONObject()
      NwcConfig(
        relayUrl = json.optString("relayUrl", "wss://relay.getalbypro.com/blitz"),
        breezApiKey = json.optString("breezApiKey", ""),
        accounts = accounts,
        strings = stringsJson.keys().asSequence().associateWith { stringsJson.getString(it) },
        mnemonic = NwcShared.secureStoreValue(context, "NWC_SECURE_STORE_MNEMOINC"),
      )
    } catch (e: Exception) {
      null
    }
  }
}

private fun openShared(file: File): SQLiteDatabase {
  file.parentFile?.mkdirs()
  // Rollback journal like expo-sqlite uses for these files (Android would
  // otherwise default new connections to compatibility WAL).
  val params = SQLiteDatabase.OpenParams.Builder()
    .addOpenFlags(SQLiteDatabase.CREATE_IF_NECESSARY)
    .setJournalMode("DELETE")
    .build()
  return SQLiteDatabase.openDatabase(file, params).also {
    it.rawQuery("PRAGMA busy_timeout = 5000", null).use { cursor -> cursor.moveToFirst() }
  }
}

private fun <T> SQLiteDatabase.transaction(body: () -> T): T {
  beginTransactionNonExclusive()
  try {
    return body().also { setTransactionSuccessful() }
  } finally {
    endTransaction()
  }
}

// The JS event ledger (app/functions/nwc/eventLedger.js), same schema.
class NwcLedger(context: Context) : AutoCloseable {
  private val db = openShared(File(NwcShared.directory(context), "nwc_event_ledger.db")).apply {
    execSQL(
      """CREATE TABLE IF NOT EXISTS handled_events (
        event_id TEXT PRIMARY KEY NOT NULL, account_pubkey TEXT NOT NULL, method TEXT,
        created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'processing',
        attempts INTEGER NOT NULL DEFAULT 1, processed_at INTEGER NOT NULL)""",
    )
    execSQL(
      """CREATE TABLE IF NOT EXISTS nwc_ledger_state (
        account_pubkey TEXT PRIMARY KEY NOT NULL, budget_sent_msat INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL)""",
    )
    execSQL("CREATE INDEX IF NOT EXISTS idx_handled_events_account ON handled_events(account_pubkey)")
    execSQL(
      """CREATE TABLE IF NOT EXISTS nwc_handoff (
        event_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL)""",
    )
  }

  // Claim + keep the raw event so the JS handler can recover it if this process
  // dies. false = someone (native or JS) already owns the event.
  fun claim(eventId: String, account: String, createdAt: Long, payload: String): Boolean {
    val now = System.currentTimeMillis()
    return db.transaction {
      val row = db.insertWithOnConflict(
        "handled_events",
        null,
        ContentValues().apply {
          put("event_id", eventId)
          put("account_pubkey", account)
          put("created_at", createdAt)
          put("status", "processing")
          put("attempts", 1)
          put("processed_at", now)
        },
        SQLiteDatabase.CONFLICT_IGNORE,
      )
      if (row == -1L) return@transaction false
      db.execSQL(
        "INSERT OR REPLACE INTO nwc_handoff (event_id, payload, created_at) VALUES (?, ?, ?)",
        arrayOf<Any?>(eventId, payload, now),
      )
      true
    }
  }

  fun setMethod(eventId: String, method: String) = runCatching {
    db.execSQL("UPDATE handled_events SET method = ? WHERE event_id = ?", arrayOf(method, eventId))
  }

  // done/failed: finished here, drop the recovery copy.
  fun finish(eventId: String, status: String) = runCatching {
    db.transaction {
      db.execSQL(
        "UPDATE handled_events SET status = ?, processed_at = ? WHERE event_id = ?",
        arrayOf<Any?>(status, System.currentTimeMillis(), eventId),
      )
      db.execSQL("DELETE FROM nwc_handoff WHERE event_id = ?", arrayOf(eventId))
    }
  }

  // Give the event to the JS handler (it claims 'handoff' rows).
  fun handOff(eventId: String) = runCatching {
    db.execSQL(
      "UPDATE handled_events SET status = 'handoff', processed_at = ? WHERE event_id = ?",
      arrayOf<Any?>(System.currentTimeMillis(), eventId),
    )
  }

  // A send was started but its outcome is unknown: never hand it off, never
  // retry it. The pending OUTGOING marker answers any later attempt.
  fun abandon(eventId: String) = runCatching {
    db.execSQL("DELETE FROM nwc_handoff WHERE event_id = ?", arrayOf(eventId))
  }

  fun spendState(account: String): Pair<Long, Long>? =
    db.rawQuery(
      "SELECT budget_sent_msat, window_start FROM nwc_ledger_state WHERE account_pubkey = ?",
      arrayOf(account),
    ).use { if (it.moveToFirst()) it.getLong(0) to it.getLong(1) else null }

  // eventLedger.js reserveSpend, same SQL: the limit check and the increment are
  // one statement, so JS and this process can never both pass on a stale total.
  // Returns the window reserved in, or null when over `limitMsat` (null = unlimited).
  fun reserveSpend(
    account: String,
    amountMsat: Long,
    limitMsat: Long?,
    fallbackSentMsat: Long,
    fallbackWindowStart: Long,
    now: Long,
    isWindowCurrent: (Long) -> Boolean,
  ): Long? {
    db.execSQL(
      "INSERT OR IGNORE INTO nwc_ledger_state (account_pubkey, budget_sent_msat, window_start) VALUES (?, ?, ?)",
      arrayOf<Any?>(account, fallbackSentMsat, fallbackWindowStart),
    )
    var windowStart = spendState(account)!!.second
    if (!isWindowCurrent(windowStart)) {
      // Compare-and-swap: only one payer starts the new window.
      db.execSQL(
        "UPDATE nwc_ledger_state SET budget_sent_msat = 0, window_start = ? WHERE account_pubkey = ? AND window_start = ?",
        arrayOf<Any?>(now, account, windowStart),
      )
      windowStart = spendState(account)!!.second
    }
    val reserved = db.compileStatement(
      """UPDATE nwc_ledger_state SET budget_sent_msat = budget_sent_msat + ?
      WHERE account_pubkey = ? AND window_start = ? AND (? IS NULL OR budget_sent_msat + ? <= ?)""",
    ).use {
      it.bindLong(1, amountMsat)
      it.bindString(2, account)
      it.bindLong(3, windowStart)
      if (limitMsat == null) it.bindNull(4) else it.bindLong(4, limitMsat)
      it.bindLong(5, amountMsat)
      if (limitMsat == null) it.bindNull(6) else it.bindLong(6, limitMsat)
      it.executeUpdateDelete()
    }
    return if (reserved > 0) windowStart else null
  }

  // eventLedger.js adjustSpend: relative, so concurrent spend is never erased.
  fun adjustSpend(account: String, windowStart: Long, deltaMsat: Long) {
    db.execSQL(
      """UPDATE nwc_ledger_state SET budget_sent_msat = MAX(0, budget_sent_msat + ?)
      WHERE account_pubkey = ? AND window_start = ?""",
      arrayOf<Any?>(deltaMsat, account, windowStart),
    )
  }

  override fun close() = db.close()
}

// The JS invoice cache (app/functions/nwc/cachedNWCTxs.js), same schema.
class NwcInvoices(context: Context) : AutoCloseable {
  private val db = openShared(File(NwcShared.directory(context), "nwc_invoices.db")).apply {
    execSQL(
      """CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT, payment_hash TEXT NOT NULL UNIQUE,
        invoice TEXT NOT NULL UNIQUE, amount INTEGER, description TEXT, sparkID TEXT, type TEXT,
        status TEXT DEFAULT 'pending', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        expires_at INTEGER, settled_at INTEGER, metadata TEXT, fee INTEGER, preimage TEXT)""",
    )
    execSQL("CREATE INDEX IF NOT EXISTS idx_payment_hash ON invoices(payment_hash)")
    execSQL("CREATE INDEX IF NOT EXISTS idx_invoice ON invoices(invoice)")
    execSQL("CREATE INDEX IF NOT EXISTS idx_status ON invoices(status)")
    execSQL("CREATE INDEX IF NOT EXISTS idx_created_at ON invoices(created_at)")
  }

  fun lookup(invoice: String?, paymentHash: String?): Map<String, Any?>? {
    val (column, value) = if (invoice != null) "invoice" to invoice else "payment_hash" to (paymentHash ?: return null)
    return rows("SELECT * FROM invoices WHERE $column = ?", arrayOf(value)).firstOrNull()
  }

  private fun rows(sql: String, args: Array<String>): List<Map<String, Any?>> =
    db.rawQuery(sql, args).use { cursor ->
      buildList {
        while (cursor.moveToNext()) {
          add(
            (0 until cursor.columnCount).associate { i ->
              cursor.getColumnName(i) to when (cursor.getType(i)) {
                android.database.Cursor.FIELD_TYPE_INTEGER -> cursor.getLong(i)
                android.database.Cursor.FIELD_TYPE_FLOAT -> cursor.getDouble(i)
                android.database.Cursor.FIELD_TYPE_STRING -> cursor.getString(i)
                else -> null
              }
            },
          )
        }
      }
    }

  // As in cachedNWCTxs.js storeCreatedInvoice.
  fun store(
    paymentHash: String,
    invoice: String,
    amountSats: Long,
    description: String?,
    expiresAt: Long?,
    type: String,
  ) {
    val now = System.currentTimeMillis()
    val metadata = JSONObject().put("created_via", "nwc_create_invoice")
    db.execSQL(
      """INSERT INTO invoices (payment_hash, invoice, amount, description, created_at, updated_at,
        expires_at, settled_at, metadata, sparkID, type, fee, preimage)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, '', ?, 0, '')""",
      arrayOf<Any?>(paymentHash, invoice, amountSats, description, now, now, expiresAt, metadata.toString(), type),
    )
  }

  // Takes the right to pay `paymentHash`: a new pending OUTGOING marker, or a
  // failed one flipped back to pending. The JS handler pays from the main
  // process, so only the attempt whose statement changed the row may send.
  // Same SQL as cachedNWCTxs.js claimOutgoingPayment and NwcStorage.swift.
  fun claimPayment(paymentHash: String, invoice: String, amountSats: Long): Boolean {
    val now = System.currentTimeMillis()
    val inserted = db.compileStatement(
      """INSERT OR IGNORE INTO invoices (payment_hash, invoice, amount, description, created_at, updated_at,
        expires_at, settled_at, metadata, sparkID, type, status, fee, preimage)
      VALUES (?, ?, ?, '', ?, ?, NULL, NULL, ?, '', 'OUTGOING', 'pending', 0, '')""",
    ).use {
      it.bindString(1, paymentHash)
      it.bindString(2, invoice)
      it.bindLong(3, amountSats)
      it.bindLong(4, now)
      it.bindLong(5, now)
      it.bindString(6, """{"created_via":"nwc_create_invoice"}""")
      it.executeInsert() != -1L
    }
    if (inserted) return true
    return db.compileStatement(
      """UPDATE invoices SET status = 'pending', updated_at = ?, settled_at = NULL, preimage = ''
      WHERE payment_hash = ? AND type = 'OUTGOING' AND status = 'failed'""",
    ).use {
      it.bindLong(1, now)
      it.bindString(2, paymentHash)
      it.executeUpdateDelete() > 0
    }
  }

  fun updateStatus(paymentHash: String, status: String, preimage: String, feeSats: Long? = null) {
    val now = System.currentTimeMillis()
    db.execSQL(
      """UPDATE invoices SET status = ?, updated_at = ?, settled_at = ?, preimage = ?,
        fee = COALESCE(?, fee) WHERE payment_hash = ?""",
      arrayOf<Any?>(status, now, now, preimage, feeSats, paymentHash),
    )
  }

  override fun close() = db.close()
}
