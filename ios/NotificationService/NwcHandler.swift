import BreezSdkSpark
import Foundation
import os

// Native port of app/functions/nwc/backgroundNofifications.js for the iOS
// Notification Service Extension. Same validation, authorization, budget and
// response rules; anything it cannot finish safely is handed to that JS
// handler through the shared ledger ('handoff' status + nwc_handoff row).
let nwcLog = Logger(subsystem: "com.blitzwallet.nwc", category: "native")

struct NwcOutcome {
  var isNwc = false
  var notifyMethod: String?
  var handedOff = false
  var strings: [String: String] = [:]
}

private let maxEventAgeSeconds: Int64 = 300
// 21M BTC. Bounds invoice amounts so reservation arithmetic cannot overflow.
private let maxInvoiceMsat: UInt64 = 2_100_000_000_000_000_000
private let maxEventsPerBatch = 25
private let maxTransactionLimit = 100
private let maxTransactionOffset = 10000
private let defaultInvoiceExpirySeconds = 60 * 60 * 12

private struct RawEvent {
  let json: [String: Any]
  let id: String
  let clientPubKey: String
  let createdAt: Int64
  let kind: Int
  let tags: [[String]]
  let content: String
  let sig: String
}

private func errorResponse(_ method: String, _ code: String, _ message: String) -> [String: Any] {
  ["result_type": method, "error": ["code": code, "message": message]]
}

private func restricted(_ method: String) -> [String: Any] {
  errorResponse(method, "RESTRICTED", "Requested service is not authorized")
}

final class NwcHandler: @unchecked Sendable {
  // No wallet work or payment starts after this; leaves the OS limit room to
  // publish and hand off.
  private let deadline: Date
  // Responses are still published until this; the OS kills the process soon after.
  private let hardDeadline: Date
  private let started = Date()
  private let lock = NSLock()
  private var current: (id: String, sending: Bool)?
  private var queued: [String] = []
  private var expired = false
  private var ledger: NwcLedger?
  private var wallet: NwcWallet?

  init(deadline: Date, hardDeadline: Date) {
    self.deadline = deadline
    self.hardDeadline = hardDeadline
  }

  private var remaining: TimeInterval { deadline.timeIntervalSinceNow }

  // Called from serviceExtensionTimeWillExpire: park every claimed event that
  // has not finished so the app can pick it up, except a payment that already
  // left (its outcome is unknown; it is never retried blindly).
  func expire() {
    lock.lock()
    defer { lock.unlock() }
    expired = true
    guard let ledger else { return }
    queued.forEach(ledger.handOff)
    queued = []
    guard let current else { return }
    if current.sending { ledger.abandon(current.id) } else { ledger.handOff(current.id) }
  }

  private func dequeue(_ id: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !expired else { return false }
    queued.removeAll { $0 == id }
    current = (id, false)
    return true
  }

  private func setCurrent(_ value: (id: String, sending: Bool)?) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !expired else { return false }
    current = value
    return true
  }

  func handle(_ userInfo: [AnyHashable: Any]) async -> NwcOutcome {
    var outcome = NwcOutcome()
    let rawEvents = Self.events(from: userInfo)
    guard !rawEvents.isEmpty else { return outcome }
    outcome.isNwc = true
    let events = rawEvents.prefix(maxEventsPerBatch).compactMap(Self.validate)
    guard !events.isEmpty else { return outcome }

    guard let directory = NwcShared.directory,
      (try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true))
        != nil,
      let ledger = try? NwcLedger(directory: directory)
    else {
      nwcLog.error("NWC native: shared storage unavailable")
      outcome.handedOff = true
      return outcome
    }
    self.ledger = ledger

    guard let config = NwcConfig.load(directory: directory) else {
      // No snapshot/secrets yet: the JS handler re-verifies everything itself.
      nwcLog.error("NWC native: config unavailable, handing off")
      for event in events {
        let account = event.tags.first { $0.first == "p" }?.dropFirst().first ?? ""
        if (try? ledger.claim(
          eventId: event.id, account: account, createdAt: event.createdAt,
          payload: Self.payload(event))) == true
        {
          ledger.handOff(event.id)
        }
      }
      outcome.handedOff = true
      return outcome
    }
    outcome.strings = config.strings
    let invoices = try? NwcInvoices(directory: directory)

    // Claim everything up front so an expiring extension can hand all of it off.
    var claimed: [(RawEvent, NwcAccount)] = []
    for event in events {
      let accountKey = event.tags.first { $0.first == "p" }?.dropFirst().first ?? ""
      guard let account = config.accounts[accountKey], account.clientPubkey == event.clientPubKey,
        Self.verifySignature(event)
      else {
        nwcLog.error("NWC native: rejected event \(event.id, privacy: .public)")
        continue
      }
      guard
        (try? ledger.claim(
          eventId: event.id, account: accountKey, createdAt: event.createdAt,
          payload: Self.payload(event))) == true
      else {
        nwcLog.log("NWC native: skipping already-handled event \(event.id, privacy: .public)")
        continue
      }
      claimed.append((event, account))
    }
    lock.withLock { queued = claimed.map { $0.0.id } }

    for (event, account) in claimed {
      await process(event, account, config, ledger, invoices, &outcome)
    }

    await wallet?.disconnect()
    nwcLog.log(
      "NWC native: done in \(Int(Date().timeIntervalSince(self.started) * 1000)) ms, handedOff=\(outcome.handedOff)"
    )
    return outcome
  }

  private func process(
    _ event: RawEvent, _ account: NwcAccount, _ config: NwcConfig, _ ledger: NwcLedger,
    _ invoices: NwcInvoices?, _ outcome: inout NwcOutcome
  ) async {
    guard dequeue(event.id) else { return }
    defer { _ = setCurrent(nil) }

    guard remaining > 0 else {
      ledger.handOff(event.id)
      outcome.handedOff = true
      return
    }

    let clientKey = [UInt8](hex: event.clientPubKey) ?? []
    var usesNip44 = true
    var plaintext = try? NwcCrypto.nip44Decrypt(
      event.content,
      conversationKey: NwcCrypto.conversationKey(secret: account.privateKey, publicKey: clientKey))
    if plaintext == nil {
      usesNip44 = false
      plaintext = try? NwcCrypto.nip04Decrypt(
        event.content, secret: account.privateKey, publicKey: clientKey)
    }
    guard let plaintext,
      let request = try? JSONSerialization.jsonObject(with: Data(plaintext.utf8)) as? [String: Any]
    else {
      nwcLog.error("NWC native: undecryptable event \(event.id, privacy: .public)")
      ledger.finish(event.id, status: "failed")
      return
    }
    let method = request["method"] as? String ?? ""
    let params = request["params"] as? [String: Any] ?? [:]
    ledger.setMethod(event.id, method)
    let methodStart = Date()

    do {
      let response = try await dispatch(method, params, event, account, config, ledger, invoices)
      await respond(response, to: event, account: account, nip44: usesNip44, relay: config.relayUrl)
      guard setCurrent(nil) else { return }
      ledger.finish(event.id, status: "done")
      if response["result"] != nil { outcome.notifyMethod = method }
      nwcLog.log(
        "NWC native: \(method, privacy: .public) handled in \(Int(Date().timeIntervalSince(methodStart) * 1000)) ms"
      )
    } catch {
      nwcLog.error(
        "NWC native: \(method, privacy: .public) not completed: \(String(describing: error), privacy: .public)"
      )
      let (sending, isExpired) = lock.withLock { (current?.sending ?? false, expired) }
      if isExpired { return }
      if sending { ledger.abandon(event.id) } else { ledger.handOff(event.id) }
      outcome.handedOff = true
    }
  }

  // MARK: Methods

  private func dispatch(
    _ method: String, _ params: [String: Any], _ event: RawEvent, _ account: NwcAccount,
    _ config: NwcConfig, _ ledger: NwcLedger, _ invoices: NwcInvoices?
  ) async throws -> [String: Any] {
    let allowed = account.permissions
    switch method {
    case "get_info":
      return [
        "result_type": "get_info",
        "result": [
          "alias": "N/A", "color": "N/A", "pubkey": "N/A", "network": "mainnet",
          "block_height": 1, "block_hash": "N/A", "methods": Self.supportedMethods(allowed),
          "notifications": Self.supportedNotifications(allowed),
        ],
      ]
    case "get_balance":
      guard allowed["getBalance"] == true else { return restricted(method) }
      let balance = try await connectedWallet(config).balanceSats()
      return ["result_type": method, "result": ["balance": Int64(balance) * 1000]]
    case "make_invoice":
      guard allowed["receivePayments"] == true else { return restricted(method) }
      return try await makeInvoice(params, account, config, try invoicesOrHandOff(invoices))
    case "lookup_invoice":
      guard allowed["lookupInvoice"] == true else { return restricted(method) }
      return try await lookupInvoice(params, config, try invoicesOrHandOff(invoices))
    case "pay_invoice":
      guard allowed["sendPayments"] == true else { return restricted(method) }
      return try await payInvoice(
        params, event, account, config, ledger, try invoicesOrHandOff(invoices))
    case "list_transactions":
      guard allowed["transactionHistory"] == true else { return restricted(method) }
      return try await listTransactions(params, config)
    default:
      return restricted(method)
    }
  }

  private func invoicesOrHandOff(_ invoices: NwcInvoices?) throws -> NwcInvoices {
    guard let invoices else { throw NwcError.handOff("invoice cache unavailable") }
    return invoices
  }

  private func connectedWallet(_ config: NwcConfig) async throws -> NwcWallet {
    if let wallet { return wallet }
    guard let mnemonic = config.mnemonic, !config.breezApiKey.isEmpty else {
      throw NwcError.handOff("wallet credentials unavailable")
    }
    let directory = NwcShared.directory!.appendingPathComponent("breez", isDirectory: true)
    let start = Date()
    let wallet = try await withTimeout(remaining) {
      try await NwcWallet.connect(
        mnemonic: mnemonic, apiKey: config.breezApiKey, storageDirectory: directory)
    }
    nwcLog.log("NWC native: wallet ready in \(Int(Date().timeIntervalSince(start) * 1000)) ms")
    self.wallet = wallet
    return wallet
  }

  private func makeInvoice(
    _ params: [String: Any], _ account: NwcAccount, _ config: NwcConfig, _ invoices: NwcInvoices
  ) async throws -> [String: Any] {
    let method = "make_invoice"
    guard let amountMsat = Self.integer(params["amount"]), amountMsat > 0 else {
      return errorResponse(method, "INTERNAL", "Invalid amount")
    }
    let amountSats = amountMsat / 1000
    guard amountSats > 0 else { return errorResponse(method, "INTERNAL", "Invalid amount") }
    let expiry = Self.integer(params["expiry"]).flatMap { $0 > 0 ? $0 : nil }
      ?? Int64(defaultInvoiceExpirySeconds)
    let description = params["description"] as? String

    let wallet = try await connectedWallet(config)
    let invoice: String
    let details: Bolt11InvoiceDetails
    do {
      invoice = try await withTimeout(remaining) {
        try await wallet.createInvoice(
          amountSats: UInt64(amountSats), description: description ?? "",
          expirySeconds: UInt32(min(expiry, Int64(UInt32.max))))
      }
      details = try await wallet.parseInvoice(invoice)
    } catch {
      return errorResponse(method, "INTERNAL", "Unable to create invoice")
    }
    do {
      try invoices.store(
        paymentHash: details.paymentHash, invoice: invoice, amountSats: amountSats,
        description: description, expiresAt: Int64(details.timestamp + details.expiry) * 1000,
        type: "INCOMING")
    } catch {
      nwcLog.error("NWC native: failed to store created invoice")
    }
    return ["result_type": method, "result": ["invoice": invoice]]
  }

  private func lookupInvoice(_ params: [String: Any], _ config: NwcConfig, _ invoices: NwcInvoices)
    async throws -> [String: Any]
  {
    let method = "lookup_invoice"
    let invoice = params["invoice"] as? String
    let paymentHash = params["payment_hash"] as? String
    guard invoice != nil || paymentHash != nil else {
      return errorResponse(
        method, "INTERNAL", "Either payment_hash or invoice must be provided")
    }
    guard var found = try invoices.lookup(invoice: invoice, paymentHash: paymentHash) else {
      return errorResponse(method, "NOT_FOUND", "Invoice not found")
    }
    if found["status"] as? String == "pending",
      let hash = found["payment_hash"] as? String,
      let payment = try await withTimeout(remaining, {
        try await self.connectedWallet(config).lightningPayment(paymentHash: hash)
      }),
      payment.status != .pending
    {
      let status = payment.status == .completed ? "completed" : "failed"
      let preimage = payment.lightning?.htlcDetails.preimage ?? ""
      try? invoices.updateStatus(paymentHash: hash, status: status, preimage: preimage)
      found["status"] = status
      found["preimage"] = preimage
      found["settled_at"] = NwcClock.nowMs
    }
    return ["result_type": method, "result": Self.nip47Transaction(found)]
  }

  private func payInvoice(
    _ params: [String: Any], _ event: RawEvent, _ account: NwcAccount, _ config: NwcConfig,
    _ ledger: NwcLedger, _ invoices: NwcInvoices
  ) async throws -> [String: Any] {
    let method = "pay_invoice"
    guard let invoice = params["invoice"] as? String else {
      return errorResponse(method, "INTERNAL", "Invalid invoice amount")
    }
    let wallet = try await connectedWallet(config)
    guard let details = try? await wallet.parseInvoice(invoice),
      let amountMsatRaw = details.amountMsat, amountMsatRaw > 0, amountMsatRaw <= maxInvoiceMsat
    else { return errorResponse(method, "INTERNAL", "Invalid invoice amount") }
    let amountMsat = Int64(amountMsatRaw)
    let paymentHash = details.paymentHash

    // Idempotency by payment_hash: a completed attempt returns its preimage, a
    // pending one is reconciled against the wallet and never re-sent blindly.
    let existing = try invoices.lookup(invoice: nil, paymentHash: paymentHash)
    if let existing, existing["type"] as? String == "OUTGOING",
      existing["status"] as? String != "failed"
    {
      if existing["status"] as? String == "completed" {
        return ["result_type": method, "result": ["preimage": existing["preimage"] as? String ?? ""]]
      }
      let payment = try await withTimeout(remaining) {
        try await wallet.lightningPayment(paymentHash: paymentHash)
      }
      if let payment, payment.status == .completed {
        let preimage = payment.lightning?.htlcDetails.preimage ?? ""
        try? invoices.updateStatus(paymentHash: paymentHash, status: "completed", preimage: preimage)
        return ["result_type": method, "result": ["preimage": preimage]]
      }
      guard let payment, payment.status == .failed else {
        return errorResponse(method, "INTERNAL", "Payment already in progress")
      }
      try? invoices.updateStatus(paymentHash: paymentHash, status: "failed", preimage: "")
    }

    let (prepared, feeSats) = try await withTimeout(remaining) {
      try await wallet.prepare(invoice: invoice)
    }
    let reservedMsat = amountMsat + Int64(feeSats) * 1000

    // Reserve the worst case (atomically against JS, see NwcLedger.reserveSpend)
    // and drop the pending marker BEFORE sending, so an interrupted run can
    // neither pay twice nor under-count the budget.
    guard remaining > 5 else { throw NwcError.handOff("no time left to pay") }
    let now = NwcClock.nowMs
    guard
      let windowStart = try ledger.reserveSpend(
        account.publicKey, amountMsat: reservedMsat, limitMsat: account.budgetLimitMsat,
        fallbackSentMsat: account.totalSent * 1000, fallbackWindowStart: account.lastRotated ?? now,
        now: now, isWindowCurrent: { Self.isWithinBudgetWindow(account.budgetOption, $0) })
    else {
      return errorResponse(method, "QUOTA_EXCEEDED", "The wallet has exceeded its spending quota.")
    }
    if existing == nil {
      try invoices.store(
        paymentHash: paymentHash, invoice: invoice, amountSats: amountMsat / 1000,
        description: "", expiresAt: nil, type: "OUTGOING")
    } else {
      try invoices.updateStatus(paymentHash: paymentHash, status: "pending", preimage: "")
    }
    guard setCurrent((event.id, true)) else { throw NwcError.handOff("expired") }

    var payment: Payment?
    var neverLeft = false
    do {
      payment = try await wallet.send(
        prepared, idempotencyKey: nwcIdempotencyKey(paymentHash: paymentHash),
        timeoutSeconds: UInt32(max(1, min(15, remaining - 4))))
    } catch {
      neverLeft = Self.isRejectedBeforeSend(error)
      payment = try? await wallet.lightningPayment(paymentHash: paymentHash)
    }

    // Unknown outcome (transport error, no local record): the SDK may still
    // complete the send on a later sync, so keep the reservation and the
    // pending marker. Fail closed on the budget.
    if payment == nil && !neverLeft {
      return errorResponse(method, "INTERNAL", "Payment status unknown")
    }
    guard let payment, payment.status != .failed else {
      // Never left (or definitively failed): release the reservation.
      try? ledger.adjustSpend(account.publicKey, windowStart: windowStart, deltaMsat: -reservedMsat)
      try? invoices.updateStatus(paymentHash: paymentHash, status: "failed", preimage: "")
      return errorResponse(method, "INTERNAL", "Unable to send payment")
    }

    let actualFeeMsat = payment.feeSats * 1000
    try? ledger.adjustSpend(
      account.publicKey, windowStart: windowStart,
      deltaMsat: amountMsat + actualFeeMsat - reservedMsat)
    let preimage = payment.lightning?.htlcDetails.preimage ?? ""
    let status = payment.status == .completed ? "completed" : "pending"
    try? invoices.updateStatus(
      paymentHash: paymentHash, status: status, preimage: preimage, feeSats: payment.feeSats)

    let createdAt = Int64(details.timestamp)
    await publishNotification(
      [
        "notification_type": "payment_sent",
        "notification": [
          "type": "outgoing", "state": status == "completed" ? "settled" : status,
          "invoice": invoice, "description": details.description ?? NSNull(),
          "description_hash": details.descriptionHash ?? NSNull(), "preimage": preimage,
          "payment_hash": paymentHash, "amount": amountMsat, "fees_paid": actualFeeMsat,
          "created_at": createdAt,
          "expires_at": createdAt + min(Int64(clamping: details.expiry), Int64.max - createdAt),
          "settled_at": NwcClock.nowSeconds, "metadata": [String: Any](),
        ],
      ], account: account, config: config, client: event.clientPubKey)

    return ["result_type": method, "result": ["preimage": preimage]]
  }

  private func listTransactions(_ params: [String: Any], _ config: NwcConfig) async throws
    -> [String: Any]
  {
    let method = "list_transactions"
    var limit = Self.integer(params["limit"]) ?? 20
    var offset = Self.integer(params["offset"]) ?? 0
    if limit <= 0 { limit = 20 }
    if offset < 0 { offset = 0 }
    limit = min(limit, Int64(maxTransactionLimit))
    if offset > Int64(maxTransactionOffset) {
      return ["result_type": method, "result": ["transactions": [Any]()]]
    }
    let from = Self.integer(params["from"]).map { UInt64(max(0, $0)) }
    let until = Self.integer(params["until"]).map { UInt64(max(0, $0)) }
    let type: PaymentType? =
      switch params["type"] as? String {
      case "incoming": .receive
      case "outgoing": .send
      default: nil
      }

    let wallet = try await connectedWallet(config)
    let pageSize = UInt32(limit * 2)
    var collected: [Payment] = []
    var page: UInt32 = 0
    while collected.count < Int(offset + limit) {
      let batch = try await withTimeout(remaining) {
        try await wallet.payments(
          offset: page, limit: pageSize, from: from, until: until, type: type)
      }
      // Spark-to-Spark and token transfers are not NWC transactions.
      collected += batch.filter { $0.method != .spark && $0.method != .token }
      if batch.count < Int(pageSize) { break }
      page += pageSize
    }

    let transactions: [[String: Any]] = collected.dropFirst(Int(offset)).prefix(Int(limit)).map {
      payment in
      let lightning = payment.lightning
      return [
        "type": payment.paymentType == .receive ? "incoming" : "outgoing",
        "state": payment.status == .completed
          ? "settled" : payment.status == .failed ? "failed" : "pending",
        "invoice": lightning?.invoice ?? NSNull(),
        "description": lightning?.description ?? NSNull(),
        "description_hash": NSNull(),
        "preimage": lightning?.htlcDetails.preimage ?? "",
        "payment_hash": lightning?.htlcDetails.paymentHash ?? "",
        "amount": payment.amountSats * 1000,
        "fees_paid": payment.feeSats * 1000,
        "created_at": Int64(payment.timestamp),
        "settled_at": payment.status == .completed ? Int64(payment.timestamp) : NSNull(),
        "metadata": [String: Any](),
      ]
    }
    return ["result_type": method, "result": ["transactions": transactions]]
  }

  // MARK: Responses

  private func respond(
    _ response: [String: Any], to event: RawEvent, account: NwcAccount, nip44: Bool, relay: String
  ) async {
    do {
      let json = String(decoding: try JSONSerialization.data(withJSONObject: response), as: UTF8.self)
      let client = [UInt8](hex: event.clientPubKey) ?? []
      let content =
        nip44
        ? try NwcCrypto.nip44Encrypt(
          json,
          conversationKey: NwcCrypto.conversationKey(secret: account.privateKey, publicKey: client))
        : try NwcCrypto.nip04Encrypt(json, secret: account.privateKey, publicKey: client)
      let signed = try Self.signedEvent(
        kind: 23195, tags: [["p", event.clientPubKey], ["e", event.id]], content: content,
        secret: account.privateKey)
      await publish(signed, relay: relay)
    } catch {
      nwcLog.error("NWC native: could not build response \(String(describing: error), privacy: .public)")
    }
  }

  private func publishNotification(
    _ payload: [String: Any], account: NwcAccount, config: NwcConfig, client: String
  ) async {
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
    let json = String(decoding: data, as: UTF8.self)
    let clientKey = [UInt8](hex: client) ?? []
    let tags = [["p", client]]
    if let legacy = try? NwcCrypto.nip04Encrypt(json, secret: account.privateKey, publicKey: clientKey),
      let event = try? Self.signedEvent(
        kind: 23196, tags: tags, content: legacy, secret: account.privateKey)
    {
      await publish(event, relay: config.relayUrl)
    }
    if let key = try? NwcCrypto.conversationKey(secret: account.privateKey, publicKey: clientKey),
      let content = try? NwcCrypto.nip44Encrypt(json, conversationKey: key),
      let event = try? Self.signedEvent(
        kind: 23197, tags: tags, content: content, secret: account.privateKey)
    {
      await publish(event, relay: config.relayUrl)
    }
  }

  private static func signedEvent(kind: Int, tags: [[String]], content: String, secret: [UInt8])
    throws -> [String: Any]
  {
    let pubkey = try NwcCrypto.publicKey(secret: secret).hex
    let createdAt = NwcClock.nowSeconds
    let id = NwcCrypto.eventId(
      pubkey: pubkey, createdAt: createdAt, kind: kind, tags: tags, content: content)
    return [
      "id": id.hex, "pubkey": pubkey, "created_at": createdAt, "kind": kind, "tags": tags,
      "content": content, "sig": try NwcCrypto.sign(id, secret: secret).hex,
    ]
  }

  // Same transport as app/functions/nwc/publishResponse.js. Retried while the
  // extension still has time; a lost response after a payment is recovered by
  // the client's retry hitting the payment_hash marker.
  private func publish(_ event: [String: Any], relay: String) async {
    var request = URLRequest(url: URL(string: "https://api.getalby.com/nwc/publish")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
      "relayUrl": relay, "event": event,
    ])
    for attempt in 1...2 {
      let timeout = min(6, hardDeadline.timeIntervalSinceNow)
      guard timeout > 1 else { break }
      request.timeoutInterval = timeout
      if let (_, response) = try? await URLSession.shared.data(for: request),
        let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status)
      {
        return
      }
      nwcLog.error("NWC native: publish attempt \(attempt) failed")
    }
  }

  // MARK: Helpers

  private static func events(from userInfo: [AnyHashable: Any]) -> [[String: Any]] {
    var body: Any? = userInfo["body"] ?? userInfo
    if let string = body as? String {
      body = try? JSONSerialization.jsonObject(with: Data(string.utf8))
    }
    return (body as? [String: Any])?["events"] as? [[String: Any]] ?? []
  }

  // Structure + freshness, as validateEventStructureAndFreshness in JS.
  private static func validate(_ json: [String: Any]) -> RawEvent? {
    guard let id = json["id"] as? String, json["pubkey"] is String,
      let clientPubKey = json["clientPubKey"] as? String,
      let createdAt = (json["created_at"] as? NSNumber)?.int64Value,
      let content = json["content"] as? String, let tags = json["tags"] as? [[String]],
      let sig = json["sig"] as? String, let kind = json["kind"] as? Int, kind == 23194
    else { return nil }
    let now = NwcClock.nowSeconds
    // Compared without subtracting: createdAt is unverified here, and
    // Int64.min - now would trap.
    guard createdAt >= now - maxEventAgeSeconds, createdAt <= now + maxEventAgeSeconds
    else { return nil }
    if let expiration = tags.first(where: { $0.first == "expiration" })?.dropFirst().first,
      let value = Int64(expiration), value <= now
    {
      return nil
    }
    return RawEvent(
      json: json, id: id, clientPubKey: clientPubKey, createdAt: createdAt, kind: kind,
      tags: tags, content: content, sig: sig)
  }

  // The backend forwards the client's event with `pubkey` set to the wallet;
  // the signer is clientPubKey (same substitution as the JS verifyEvent call).
  private static func verifySignature(_ event: RawEvent) -> Bool {
    let id = NwcCrypto.eventId(
      pubkey: event.clientPubKey, createdAt: event.createdAt, kind: event.kind, tags: event.tags,
      content: event.content)
    guard id.hex == event.id, let sig = [UInt8](hex: event.sig),
      let pubkey = [UInt8](hex: event.clientPubKey)
    else { return false }
    return NwcCrypto.verify(sig, message32: id, publicKey: pubkey)
  }

  private static func payload(_ event: RawEvent) -> String {
    (try? JSONSerialization.data(withJSONObject: event.json)).map {
      String(decoding: $0, as: UTF8.self)
    } ?? "{}"
  }

  private static func supportedMethods(_ permissions: [String: Bool]) -> [String] {
    var methods: [String] = []
    if permissions["receivePayments"] == true { methods.append("make_invoice") }
    if permissions["sendPayments"] == true { methods.append("pay_invoice") }
    if permissions["getBalance"] == true { methods.append("get_balance") }
    if permissions["transactionHistory"] == true { methods.append("list_transactions") }
    if permissions["lookupInvoice"] == true { methods.append("lookup_invoice") }
    methods.append("get_info")
    return methods
  }

  // getSupportedNotifications in app/functions/nwc/index.js.
  private static func supportedNotifications(_ permissions: [String: Bool]) -> [String] {
    var notifications: [String] = []
    if permissions["sendPayments"] == true { notifications.append("payment_sent") }
    return notifications
  }

  // isWithinNWCBalanceTimeFrame in app/functions/nwc/index.js.
  private static func isWithinBudgetWindow(_ option: String?, _ windowStart: Int64) -> Bool {
    let elapsed = NwcClock.nowMs - windowStart
    let day: Int64 = 24 * 60 * 60 * 1000
    switch option?.lowercased() {
    case "daily": return elapsed < day
    case "weekly": return elapsed < 7 * day
    case "monthly": return elapsed < 30 * day
    case "yearly": return elapsed < 365 * day
    default: return true
    }
  }

  // Errors the SDK raises before any funds can move.
  private static func isRejectedBeforeSend(_ error: Error) -> Bool {
    switch error as? SdkError {
    case .InsufficientFunds, .InvalidInput, .InvalidUuid: return true
    default: return false
    }
  }

  // Integers or numeric strings (clients send both); fractional values rejected.
  // Int64(exactly:) returns nil for out-of-range input; Int64(_:) would trap.
  private static func integer(_ value: Any?) -> Int64? {
    if let number = value as? NSNumber {
      return CFNumberIsFloatType(number) ? Int64(exactly: number.doubleValue) : number.int64Value
    }
    if let string = value as? String, let double = Double(string) {
      return Int64(exactly: double.rounded(.down))
    }
    return nil
  }

  // toNip47Transaction in backgroundNofifications.js.
  private static func nip47Transaction(_ row: [String: Any]) -> [String: Any] {
    func seconds(_ key: String) -> Any { (row[key] as? Int64).map { $0 / 1000 } ?? NSNull() }
    let status = row["status"] as? String ?? "pending"
    return [
      "type": (row["type"] as? String)?.lowercased() ?? NSNull(),
      "state": status == "completed" ? "settled" : status,
      "invoice": row["invoice"] as? String ?? "",
      "description": (row["description"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? NSNull(),
      "description_hash": NSNull(),
      "preimage": row["preimage"] as? String ?? "",
      "payment_hash": row["payment_hash"] as? String ?? "",
      "amount": (row["amount"] as? Int64 ?? 0) * 1000,
      "fees_paid": (row["fee"] as? Int64 ?? 0) * 1000,
      "created_at": seconds("created_at"),
      "expires_at": seconds("expires_at"),
      "settled_at": seconds("settled_at"),
      "metadata": [String: Any](),
    ]
  }
}

// Races an operation against the deadline without waiting for it to honour
// cancellation (a Breez call may not), so a hung call cannot pin the extension.
func withTimeout<T>(_ seconds: TimeInterval, _ operation: @escaping () async throws -> T)
  async throws -> T
{
  guard seconds > 0 else { throw NwcError.handOff("deadline passed") }
  let once = NwcOnce()
  return try await withCheckedThrowingContinuation { continuation in
    let work = Task {
      do {
        let value = try await operation()
        if once.claim() { continuation.resume(returning: value) }
      } catch {
        if once.claim() { continuation.resume(throwing: error) }
      }
    }
    Task {
      try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
      if once.claim() {
        work.cancel()
        continuation.resume(throwing: NwcError.handOff("timeout"))
      }
    }
  }
}

private final class NwcOnce: @unchecked Sendable {
  private let lock = NSLock()
  private var done = false

  func claim() -> Bool {
    lock.withLock {
      if done { return false }
      done = true
      return true
    }
  }
}
