package com.blitzwallet.nwc

import android.content.Context
import android.os.SystemClock
import android.util.Log
import breez_sdk_spark.Payment
import breez_sdk_spark.PaymentMethod
import breez_sdk_spark.PaymentStatus
import breez_sdk_spark.PaymentType
import breez_sdk_spark.SdkException
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject

// Native port of app/functions/nwc/backgroundNofifications.js (Android side of
// ios/NotificationService/NwcHandler.swift). Same validation, authorization,
// budget and response rules; anything it cannot finish safely is handed to that
// JS handler through the shared ledger ('handoff' status + nwc_handoff row).
const val NWC_TAG = "BlitzNwcNative"

class NwcHandOff(reason: String) : Exception(reason)

data class NwcOutcome(
  var notifyMethod: String? = null,
  var handedOff: Boolean = false,
  var strings: Map<String, String> = emptyMap(),
)

private const val MAX_EVENT_AGE_SECONDS = 300L
// 21M BTC. Bounds invoice amounts so reservation arithmetic cannot overflow.
private const val MAX_INVOICE_MSAT = 2_100_000_000_000_000_000L
private const val MAX_EVENTS_PER_BATCH = 25
private const val MAX_TRANSACTION_LIMIT = 100L
private const val MAX_TRANSACTION_OFFSET = 10000L
private const val DEFAULT_INVOICE_EXPIRY_SECONDS = 60L * 60 * 12

private class RawEvent(
  val json: JSONObject,
  val id: String,
  val clientPubKey: String,
  val createdAt: Long,
  val kind: Int,
  val tags: List<List<String>>,
  val content: String,
  val sig: String,
) {
  val accountKey get() = tags.firstOrNull { it.firstOrNull() == "p" }?.getOrNull(1) ?: ""
}

private fun errorResponse(method: String, code: String, message: String) =
  JSONObject().put("result_type", method).put("error", JSONObject().put("code", code).put("message", message))

private fun restricted(method: String) = errorResponse(method, "RESTRICTED", "Requested service is not authorized")

private fun nowSeconds() = System.currentTimeMillis() / 1000

// deadlineMs: no wallet work or payment starts after this (elapsedRealtime).
// hardDeadlineMs: responses are still published until this. Both stay well
// under the JS lease (eventLedger.js NATIVE_LEASE_MS = 60 s), so JS never takes
// over an event this process is still working on.
class NwcHandler(
  private val context: Context,
  private val deadlineMs: Long,
  private val hardDeadlineMs: Long,
) {
  private var wallet: NwcWallet? = null
  private var sending = false
  private val remainingMs get() = deadlineMs - SystemClock.elapsedRealtime()

  suspend fun handle(body: String?): NwcOutcome = withContext(Dispatchers.IO) {
    val outcome = NwcOutcome()
    val started = SystemClock.elapsedRealtime()
    val events = parseEvents(body).take(MAX_EVENTS_PER_BATCH).mapNotNull(::validate)
    if (events.isEmpty()) return@withContext outcome

    val ledger = try {
      NwcLedger(context)
    } catch (e: Exception) {
      Log.e(NWC_TAG, "shared storage unavailable", e)
      outcome.handedOff = true
      return@withContext outcome
    }
    ledger.use {
      val config = NwcConfig.load(context)
      if (config == null) {
        // No snapshot/secrets yet: the JS handler re-verifies everything itself.
        Log.w(NWC_TAG, "config unavailable, handing off")
        for (event in events) {
          if (runCatching { ledger.claim(event.id, event.accountKey, event.createdAt, event.json.toString()) }.getOrDefault(false)) {
            ledger.handOff(event.id)
          }
        }
        outcome.handedOff = true
        return@withContext outcome
      }
      outcome.strings = config.strings

      val claimed = mutableListOf<Pair<RawEvent, NwcAccount>>()
      val invoices = try {
        for (event in events) {
          val account = config.accounts[event.accountKey]
          if (account == null || account.clientPubkey != event.clientPubKey || !verifySignature(event)) {
            Log.w(NWC_TAG, "rejected event ${event.id}")
            continue
          }
          val isNew = try {
            ledger.claim(event.id, event.accountKey, event.createdAt, event.json.toString())
          } catch (e: Exception) {
            // Not a duplicate: nothing was recorded, so the JS handler (started
            // with the original push) claims and runs this event instead.
            Log.e(NWC_TAG, "could not claim event ${event.id}", e)
            outcome.handedOff = true
            continue
          }
          if (!isNew) {
            Log.i(NWC_TAG, "skipping already-handled event ${event.id}")
            continue
          }
          claimed += event to account
        }
        NwcInvoices(context)
      } catch (e: Throwable) {
        // Nothing has run yet (e.g. a native library failed to load): hand every
        // claimed event to the JS handler instead of leaving it 'processing'.
        Log.e(NWC_TAG, "native setup failed, handing off", e)
        claimed.forEach { ledger.handOff(it.first.id) }
        outcome.handedOff = true
        return@withContext outcome
      }

      invoices.use {
        for ((event, account) in claimed) process(event, account, config, ledger, invoices, outcome)
      }
      wallet?.disconnect()
      Log.i(NWC_TAG, "done in ${SystemClock.elapsedRealtime() - started} ms, handedOff=${outcome.handedOff}")
    }
    outcome
  }

  private suspend fun process(
    event: RawEvent,
    account: NwcAccount,
    config: NwcConfig,
    ledger: NwcLedger,
    invoices: NwcInvoices,
    outcome: NwcOutcome,
  ) {
    sending = false
    if (remainingMs <= 0) {
      ledger.handOff(event.id)
      outcome.handedOff = true
      return
    }
    val clientKey = event.clientPubKey.hexToBytes() ?: ByteArray(0)
    var usesNip44 = true
    val plaintext = runCatching {
      NwcCrypto.nip44Decrypt(event.content, NwcCrypto.conversationKey(account.privateKey, clientKey))
    }.getOrNull() ?: run {
      usesNip44 = false
      runCatching { NwcCrypto.nip04Decrypt(event.content, account.privateKey, clientKey) }.getOrNull()
    }
    val request = plaintext?.let { runCatching { JSONObject(it) }.getOrNull() }
    if (request == null) {
      Log.w(NWC_TAG, "undecryptable event ${event.id}")
      ledger.finish(event.id, "failed")
      return
    }
    val method = request.optString("method")
    val params = request.optJSONObject("params") ?: JSONObject()
    ledger.setMethod(event.id, method)
    val methodStart = SystemClock.elapsedRealtime()

    try {
      val response = dispatch(method, params, event, account, config, ledger, invoices)
      respond(response, event, account, usesNip44, config.relayUrl)
      ledger.finish(event.id, "done")
      if (response.has("result")) outcome.notifyMethod = method
      Log.i(NWC_TAG, "$method handled in ${SystemClock.elapsedRealtime() - methodStart} ms")
    } catch (e: Throwable) {
      // Throwable: a Breez/secp256k1 library that fails to load throws an Error,
      // which must still hand the event off rather than crash the process.
      Log.w(NWC_TAG, "$method not completed: $e")
      if (sending) ledger.abandon(event.id) else ledger.handOff(event.id)
      outcome.handedOff = true
    }
  }

  // MARK: methods

  private suspend fun dispatch(
    method: String,
    params: JSONObject,
    event: RawEvent,
    account: NwcAccount,
    config: NwcConfig,
    ledger: NwcLedger,
    invoices: NwcInvoices,
  ): JSONObject {
    val allowed = account.permissions
    return when (method) {
      "get_info" -> JSONObject().put("result_type", "get_info").put(
        "result",
        JSONObject()
          .put("alias", "N/A").put("color", "N/A").put("pubkey", "N/A").put("network", "mainnet")
          .put("block_height", 1).put("block_hash", "N/A")
          .put("methods", JSONArray(supportedMethods(allowed)))
          .put("notifications", JSONArray(supportedNotifications(allowed))),
      )
      "get_balance" -> if (allowed["getBalance"] != true) restricted(method) else
        JSONObject().put("result_type", method)
          .put("result", JSONObject().put("balance", timed { connectedWallet(config).balanceSats() } * 1000))
      "make_invoice" -> if (allowed["receivePayments"] != true) restricted(method) else makeInvoice(params, account, config, invoices)
      "lookup_invoice" -> if (allowed["lookupInvoice"] != true) restricted(method) else lookupInvoice(params, config, invoices)
      "pay_invoice" -> if (allowed["sendPayments"] != true) restricted(method) else
        payInvoice(params, event, account, config, ledger, invoices)
      "list_transactions" -> if (allowed["transactionHistory"] != true) restricted(method) else listTransactions(params, config)
      else -> restricted(method)
    }
  }

  // Bounded by the deadline; a timeout hands the event off.
  private suspend fun <T> timed(block: suspend () -> T): T {
    if (remainingMs <= 0) throw NwcHandOff("deadline passed")
    return try {
      withTimeout(remainingMs) { block() }
    } catch (e: TimeoutCancellationException) {
      throw NwcHandOff("timeout")
    }
  }

  private suspend fun connectedWallet(config: NwcConfig): NwcWallet {
    wallet?.let { return it }
    val mnemonic = config.mnemonic
    if (mnemonic.isNullOrEmpty() || config.breezApiKey.isEmpty()) throw NwcHandOff("wallet credentials unavailable")
    val start = SystemClock.elapsedRealtime()
    return timed {
      NwcWallet.connect(mnemonic, config.breezApiKey, File(NwcShared.directory(context), "breez"))
    }.also {
      Log.i(NWC_TAG, "wallet ready in ${SystemClock.elapsedRealtime() - start} ms")
      wallet = it
    }
  }

  private suspend fun makeInvoice(params: JSONObject, account: NwcAccount, config: NwcConfig, invoices: NwcInvoices): JSONObject {
    val method = "make_invoice"
    val amountMsat = integer(params.opt("amount"))
    if (amountMsat == null || amountMsat <= 0 || amountMsat / 1000 <= 0) return errorResponse(method, "INTERNAL", "Invalid amount")
    val amountSats = amountMsat / 1000
    val expiry = integer(params.opt("expiry"))?.takeIf { it > 0 } ?: DEFAULT_INVOICE_EXPIRY_SECONDS
    val description = params.optString("description").takeIf { params.has("description") && !params.isNull("description") }

    val wallet = connectedWallet(config)
    val (invoice, details) = try {
      val invoice = timed { wallet.createInvoice(amountSats, description ?: "", min(expiry, UInt.MAX_VALUE.toLong())) }
      invoice to wallet.parseInvoice(invoice)
    } catch (e: NwcHandOff) {
      throw e
    } catch (e: Exception) {
      return errorResponse(method, "INTERNAL", "Unable to create invoice")
    }
    runCatching {
      invoices.store(
        details.paymentHash, invoice, amountSats, description,
        (details.timestamp + details.expiry).toLong() * 1000, "INCOMING",
      )
    }.onFailure { Log.w(NWC_TAG, "failed to store created invoice", it) }
    return JSONObject().put("result_type", method).put("result", JSONObject().put("invoice", invoice))
  }

  private suspend fun lookupInvoice(params: JSONObject, config: NwcConfig, invoices: NwcInvoices): JSONObject {
    val method = "lookup_invoice"
    val invoice = params.optString("invoice").takeIf { it.isNotEmpty() }
    val paymentHash = params.optString("payment_hash").takeIf { it.isNotEmpty() }
    if (invoice == null && paymentHash == null) {
      return errorResponse(method, "INTERNAL", "Either payment_hash or invoice must be provided")
    }
    val found = invoices.lookup(invoice, paymentHash)?.toMutableMap()
      ?: return errorResponse(method, "NOT_FOUND", "Invoice not found")
    val hash = found["payment_hash"] as? String
    if (found["status"] == "pending" && hash != null) {
      val payment = timed { connectedWallet(config).lightningPayment(hash) }
      if (payment != null && payment.status != PaymentStatus.PENDING) {
        val status = if (payment.status == PaymentStatus.COMPLETED) "completed" else "failed"
        val preimage = payment.lightning?.htlcDetails?.preimage ?: ""
        runCatching { invoices.updateStatus(hash, status, preimage) }
        found["status"] = status
        found["preimage"] = preimage
        found["settled_at"] = System.currentTimeMillis()
      }
    }
    return JSONObject().put("result_type", method).put("result", nip47Transaction(found))
  }

  private suspend fun payInvoice(
    params: JSONObject,
    event: RawEvent,
    account: NwcAccount,
    config: NwcConfig,
    ledger: NwcLedger,
    invoices: NwcInvoices,
  ): JSONObject {
    val method = "pay_invoice"
    val invoice = params.optString("invoice").takeIf { it.isNotEmpty() }
      ?: return errorResponse(method, "INTERNAL", "Invalid invoice amount")
    val wallet = connectedWallet(config)
    val details = runCatching { timed { wallet.parseInvoice(invoice) } }.getOrNull()
    val amountMsat = details?.amountMsat?.toLong() ?: 0
    if (details == null || amountMsat <= 0 || amountMsat > MAX_INVOICE_MSAT) return errorResponse(method, "INTERNAL", "Invalid invoice amount")
    val paymentHash = details.paymentHash

    // Idempotency by payment_hash: a completed attempt returns its preimage, a
    // pending one is reconciled against the wallet and never re-sent blindly.
    val existing = invoices.lookup(null, paymentHash)
    if (existing != null && existing["type"] == "OUTGOING" && existing["status"] != "failed") {
      if (existing["status"] == "completed") {
        return JSONObject().put("result_type", method)
          .put("result", JSONObject().put("preimage", existing["preimage"] as? String ?: ""))
      }
      val payment = timed { wallet.lightningPayment(paymentHash) }
      if (payment?.status == PaymentStatus.COMPLETED) {
        val preimage = payment.lightning?.htlcDetails?.preimage ?: ""
        runCatching { invoices.updateStatus(paymentHash, "completed", preimage) }
        return JSONObject().put("result_type", method).put("result", JSONObject().put("preimage", preimage))
      }
      if (payment?.status != PaymentStatus.FAILED) return errorResponse(method, "INTERNAL", "Payment already in progress")
      runCatching { invoices.updateStatus(paymentHash, "failed", "") }
    }

    val (prepared, feeSats) = timed { wallet.prepare(invoice) }
    val reservedMsat = amountMsat + feeSats * 1000

    // Reserve the worst case (atomically against JS, see NwcLedger.reserveSpend)
    // and drop the pending marker BEFORE sending, so an interrupted run can
    // neither pay twice nor under-count the budget.
    if (remainingMs < 5_000) throw NwcHandOff("no time left to pay")
    val now = System.currentTimeMillis()
    val windowStart = ledger.reserveSpend(
      account.publicKey, reservedMsat, account.budgetLimitMsat, account.totalSent * 1000,
      account.lastRotated ?: now, now,
    ) { isWithinBudgetWindow(account.budgetOption, it) }
      ?: return errorResponse(method, "QUOTA_EXCEEDED", "The wallet has exceeded its spending quota.")
    // The lookup above only filters. The JS handler pays from the main process,
    // so a marker can appear after it; only the attempt that takes the
    // payment_hash here may send.
    val claimed = try {
      invoices.claimPayment(paymentHash, invoice, amountMsat / 1000)
    } catch (e: Exception) {
      runCatching { ledger.adjustSpend(account.publicKey, windowStart, -reservedMsat) }
      throw e
    }
    if (!claimed) {
      runCatching { ledger.adjustSpend(account.publicKey, windowStart, -reservedMsat) }
      return errorResponse(method, "INTERNAL", "Payment already in progress")
    }
    sending = true

    var neverLeft = false
    val payment: Payment? = try {
      wallet.send(prepared, max(1, min(15, (remainingMs / 1000 - 4).toInt())))
    } catch (e: Exception) {
      neverLeft = isRejectedBeforeSend(e)
      runCatching { wallet.lightningPayment(paymentHash) }.getOrNull()
    }

    // Unknown outcome (transport error, no local record): the SDK may still
    // complete the send on a later sync, so keep the reservation and the
    // pending marker. Fail closed on the budget.
    if (payment == null && !neverLeft) return errorResponse(method, "INTERNAL", "Payment status unknown")
    if (payment == null || payment.status == PaymentStatus.FAILED) {
      // Never left (or definitively failed): release the reservation.
      runCatching { ledger.adjustSpend(account.publicKey, windowStart, -reservedMsat) }
      runCatching { invoices.updateStatus(paymentHash, "failed", "") }
      return errorResponse(method, "INTERNAL", "Unable to send payment")
    }

    val actualFeeMsat = payment.feeSats * 1000
    runCatching { ledger.adjustSpend(account.publicKey, windowStart, amountMsat + actualFeeMsat - reservedMsat) }
    val preimage = payment.lightning?.htlcDetails?.preimage ?: ""
    val status = if (payment.status == PaymentStatus.COMPLETED) "completed" else "pending"
    runCatching { invoices.updateStatus(paymentHash, status, preimage, payment.feeSats) }

    val createdAt = details.timestamp.toLong()
    publishNotification(
      JSONObject().put("notification_type", "payment_sent").put(
        "notification",
        JSONObject()
          .put("type", "outgoing").put("state", if (status == "completed") "settled" else status)
          .put("invoice", invoice).put("description", details.description ?: JSONObject.NULL)
          .put("description_hash", details.descriptionHash ?: JSONObject.NULL).put("preimage", preimage)
          .put("payment_hash", paymentHash).put("amount", amountMsat).put("fees_paid", actualFeeMsat)
          .put("created_at", createdAt).put("expires_at", createdAt + details.expiry.toLong())
          .put("settled_at", nowSeconds()).put("metadata", JSONObject()),
      ),
      account,
      config,
      event.clientPubKey,
    )
    return JSONObject().put("result_type", method).put("result", JSONObject().put("preimage", preimage))
  }

  private suspend fun listTransactions(params: JSONObject, config: NwcConfig): JSONObject {
    val method = "list_transactions"
    var limit = integer(params.opt("limit")) ?: 20
    var offset = integer(params.opt("offset")) ?: 0
    if (limit <= 0) limit = 20
    if (offset < 0) offset = 0
    limit = min(limit, MAX_TRANSACTION_LIMIT)
    if (offset > MAX_TRANSACTION_OFFSET) {
      return JSONObject().put("result_type", method).put("result", JSONObject().put("transactions", JSONArray()))
    }
    val from = integer(params.opt("from"))?.let { max(0, it) }
    val until = integer(params.opt("until"))?.let { max(0, it) }
    val type = when (params.optString("type")) {
      "incoming" -> PaymentType.RECEIVE
      "outgoing" -> PaymentType.SEND
      else -> null
    }

    val wallet = connectedWallet(config)
    val pageSize = (limit * 2).toInt()
    val collected = mutableListOf<Payment>()
    var page = 0
    while (collected.size < offset + limit) {
      val batch = timed { wallet.payments(page, pageSize, from, until, type) }
      // Spark-to-Spark and token transfers are not NWC transactions.
      collected += batch.filter { it.method != PaymentMethod.SPARK && it.method != PaymentMethod.TOKEN }
      if (batch.size < pageSize) break
      page += pageSize
    }

    val transactions = JSONArray()
    collected.drop(offset.toInt()).take(limit.toInt()).forEach { payment ->
      val lightning = payment.lightning
      transactions.put(
        JSONObject()
          .put("type", if (payment.paymentType == PaymentType.RECEIVE) "incoming" else "outgoing")
          .put("state", when (payment.status) {
            PaymentStatus.COMPLETED -> "settled"
            PaymentStatus.FAILED -> "failed"
            else -> "pending"
          })
          .put("invoice", lightning?.invoice ?: JSONObject.NULL)
          .put("description", lightning?.description ?: JSONObject.NULL)
          .put("description_hash", JSONObject.NULL)
          .put("preimage", lightning?.htlcDetails?.preimage ?: "")
          .put("payment_hash", lightning?.htlcDetails?.paymentHash ?: "")
          .put("amount", payment.amountSats * 1000)
          .put("fees_paid", payment.feeSats * 1000)
          .put("created_at", payment.timestamp.toLong())
          .put("settled_at", if (payment.status == PaymentStatus.COMPLETED) payment.timestamp.toLong() else JSONObject.NULL)
          .put("metadata", JSONObject()),
      )
    }
    return JSONObject().put("result_type", method).put("result", JSONObject().put("transactions", transactions))
  }

  // MARK: responses

  private fun respond(response: JSONObject, event: RawEvent, account: NwcAccount, nip44: Boolean, relay: String) {
    try {
      val client = event.clientPubKey.hexToBytes() ?: ByteArray(0)
      val content = if (nip44) {
        NwcCrypto.nip44Encrypt(response.toString(), NwcCrypto.conversationKey(account.privateKey, client))
      } else {
        NwcCrypto.nip04Encrypt(response.toString(), account.privateKey, client)
      }
      publish(signedEvent(23195, listOf(listOf("p", event.clientPubKey), listOf("e", event.id)), content, account.privateKey), relay)
    } catch (e: Exception) {
      Log.e(NWC_TAG, "could not build response", e)
    }
  }

  private fun publishNotification(payload: JSONObject, account: NwcAccount, config: NwcConfig, client: String) {
    val clientKey = client.hexToBytes() ?: return
    val tags = listOf(listOf("p", client))
    runCatching {
      val legacy = NwcCrypto.nip04Encrypt(payload.toString(), account.privateKey, clientKey)
      publish(signedEvent(23196, tags, legacy, account.privateKey), config.relayUrl)
    }
    runCatching {
      val key = NwcCrypto.conversationKey(account.privateKey, clientKey)
      publish(signedEvent(23197, tags, NwcCrypto.nip44Encrypt(payload.toString(), key), account.privateKey), config.relayUrl)
    }
  }

  private fun signedEvent(kind: Int, tags: List<List<String>>, content: String, secret: ByteArray): JSONObject {
    val pubkey = NwcCrypto.publicKey(secret).toHex()
    val createdAt = nowSeconds()
    val id = NwcCrypto.eventId(pubkey, createdAt, kind, tags, content)
    return JSONObject()
      .put("id", id.toHex()).put("pubkey", pubkey).put("created_at", createdAt).put("kind", kind)
      .put("tags", JSONArray(tags.map { JSONArray(it) })).put("content", content)
      .put("sig", NwcCrypto.sign(id, secret).toHex())
  }

  // Same transport as app/functions/nwc/publishResponse.js. Retried while there
  // is time; a lost response after a payment is recovered by the client's
  // retry hitting the payment_hash marker.
  private fun publish(event: JSONObject, relay: String) {
    val body = JSONObject().put("relayUrl", relay).put("event", event).toString().toByteArray()
    repeat(2) { attempt ->
      val timeout = min(6_000L, hardDeadlineMs - SystemClock.elapsedRealtime())
      if (timeout < 1_000) return
      try {
        val connection = URL("https://api.getalby.com/nwc/publish").openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = timeout.toInt()
        connection.readTimeout = timeout.toInt()
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(body) }
        val status = connection.responseCode
        connection.disconnect()
        if (status in 200..299) return
      } catch (e: Exception) {
        Log.w(NWC_TAG, "publish attempt ${attempt + 1} failed: $e")
      }
    }
  }

  // MARK: helpers

  private fun parseEvents(body: String?): List<JSONObject> {
    if (body.isNullOrEmpty()) return emptyList()
    val events = runCatching { JSONObject(body).optJSONArray("events") }.getOrNull() ?: return emptyList()
    return (0 until events.length()).mapNotNull { events.optJSONObject(it) }
  }

  // Structure + freshness, as validateEventStructureAndFreshness in JS.
  private fun validate(json: JSONObject): RawEvent? {
    val id = json.opt("id") as? String ?: return null
    if (json.opt("pubkey") !is String) return null
    val clientPubKey = json.opt("clientPubKey") as? String ?: return null
    val createdAt = (json.opt("created_at") as? Number)?.toLong() ?: return null
    val content = json.opt("content") as? String ?: return null
    val sig = json.opt("sig") as? String ?: return null
    val kind = (json.opt("kind") as? Number)?.toInt() ?: return null
    val tagsJson = json.opt("tags") as? JSONArray ?: return null
    val tags = (0 until tagsJson.length()).map { i ->
      val tag = tagsJson.optJSONArray(i) ?: return null
      (0 until tag.length()).map { tag.opt(it) as? String ?: return null }
    }
    if (kind != 23194) return null
    val now = nowSeconds()
    if (abs(createdAt - now) > MAX_EVENT_AGE_SECONDS) return null
    val expiration = tags.firstOrNull { it.firstOrNull() == "expiration" }?.getOrNull(1)?.toLongOrNull()
    if (expiration != null && expiration <= now) return null
    return RawEvent(json, id, clientPubKey, createdAt, kind, tags, content, sig)
  }

  // The backend forwards the client's event with `pubkey` set to the wallet;
  // the signer is clientPubKey (same substitution as the JS verifyEvent call).
  private fun verifySignature(event: RawEvent): Boolean {
    val id = NwcCrypto.eventId(event.clientPubKey, event.createdAt, event.kind, event.tags, event.content)
    val sig = event.sig.hexToBytes() ?: return false
    val pubkey = event.clientPubKey.hexToBytes() ?: return false
    return id.toHex() == event.id && NwcCrypto.verify(sig, id, pubkey)
  }

  private fun supportedMethods(permissions: Map<String, Boolean>) = buildList {
    if (permissions["receivePayments"] == true) add("make_invoice")
    if (permissions["sendPayments"] == true) add("pay_invoice")
    if (permissions["getBalance"] == true) add("get_balance")
    if (permissions["transactionHistory"] == true) add("list_transactions")
    if (permissions["lookupInvoice"] == true) add("lookup_invoice")
    add("get_info")
  }

  // getSupportedNotifications in app/functions/nwc/index.js.
  private fun supportedNotifications(permissions: Map<String, Boolean>) = buildList {
    if (permissions["sendPayments"] == true) add("payment_sent")
  }

  // isWithinNWCBalanceTimeFrame in app/functions/nwc/index.js.
  private fun isWithinBudgetWindow(option: String?, windowStart: Long): Boolean {
    val elapsed = System.currentTimeMillis() - windowStart
    val day = 24L * 60 * 60 * 1000
    return when (option?.lowercase()) {
      "daily" -> elapsed < day
      "weekly" -> elapsed < 7 * day
      "monthly" -> elapsed < 30 * day
      "yearly" -> elapsed < 365 * day
      else -> true
    }
  }

  // Errors the SDK raises before any funds can move.
  private fun isRejectedBeforeSend(e: Exception): Boolean =
    e is SdkException.InsufficientFunds || e is SdkException.InvalidInput || e is SdkException.InvalidUuid

  // Integers or numeric strings (clients send both); fractional numbers rejected.
  private fun integer(value: Any?): Long? = when (value) {
    is Int, is Long -> (value as Number).toLong()
    is Number -> value.toDouble().takeIf { it == Math.floor(it) && it.isFinite() }?.toLong()
    is String -> value.toDoubleOrNull()?.takeIf { it.isFinite() }?.let { Math.floor(it).toLong() }
    else -> null
  }

  // toNip47Transaction in backgroundNofifications.js.
  private fun nip47Transaction(row: Map<String, Any?>): JSONObject {
    fun seconds(key: String): Any = (row[key] as? Long)?.div(1000) ?: JSONObject.NULL
    val status = row["status"] as? String ?: "pending"
    return JSONObject()
      .put("type", (row["type"] as? String)?.lowercase() ?: JSONObject.NULL)
      .put("state", if (status == "completed") "settled" else status)
      .put("invoice", row["invoice"] as? String ?: "")
      .put("description", (row["description"] as? String)?.takeIf { it.isNotEmpty() } ?: JSONObject.NULL)
      .put("description_hash", JSONObject.NULL)
      .put("preimage", row["preimage"] as? String ?: "")
      .put("payment_hash", row["payment_hash"] as? String ?: "")
      .put("amount", ((row["amount"] as? Long) ?: 0) * 1000)
      .put("fees_paid", ((row["fee"] as? Long) ?: 0) * 1000)
      .put("created_at", seconds("created_at"))
      .put("expires_at", seconds("expires_at"))
      .put("settled_at", seconds("settled_at"))
      .put("metadata", JSONObject())
  }
}
