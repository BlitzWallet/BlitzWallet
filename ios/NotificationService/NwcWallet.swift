import BreezSdkSpark
import Foundation

// Thin Breez Spark adapter for the NWC methods. Server mode: no background
// sync/claim/optimization tasks, the handler drives sync explicitly, so a short
// extension run stays cheap. Same seed + derivation as the JS Spark SDK
// (m/8797555'/1' on mainnet), so this is the user's existing NWC wallet.
final class NwcWallet {
  private let sdk: BreezSdk

  private init(sdk: BreezSdk) { self.sdk = sdk }

  static func connect(mnemonic: String, apiKey: String, storageDirectory: URL) async throws
    -> NwcWallet
  {
    var config = defaultServerConfig(network: .mainnet)
    config.apiKey = apiKey
    try FileManager.default.createDirectory(
      at: storageDirectory, withIntermediateDirectories: true)
    let sdk = try await BreezSdkSpark.connect(
      request: ConnectRequest(
        config: config, seed: .mnemonic(mnemonic: mnemonic, passphrase: nil),
        storageDir: storageDirectory.path))
    let wallet = NwcWallet(sdk: sdk)
    try await wallet.sync()
    return wallet
  }

  // Also claims incoming transfers, so a paid invoice shows up as completed.
  func sync() async throws { _ = try await sdk.syncWallet(request: SyncWalletRequest()) }

  func disconnect() async { try? await sdk.disconnect() }

  func balanceSats() async throws -> UInt64 {
    try await sdk.getInfo(request: GetInfoRequest(ensureSynced: false)).balanceSats
  }

  func parseInvoice(_ invoice: String) async throws -> Bolt11InvoiceDetails {
    guard case .bolt11Invoice(let details) = try await sdk.parse(input: invoice) else {
      throw NwcError.handOff("not a bolt11 invoice")
    }
    return details
  }

  func createInvoice(amountSats: UInt64, description: String, expirySeconds: UInt32) async throws
    -> String
  {
    try await sdk.receivePayment(
      request: ReceivePaymentRequest(
        paymentMethod: .bolt11Invoice(
          description: description, amountSats: amountSats, expirySecs: expirySeconds,
          paymentHash: nil, receiverIdentityPublicKey: nil))
    ).paymentRequest
  }

  func prepare(invoice: String) async throws -> (PrepareSendPaymentResponse, feeSats: UInt64) {
    let prepared = try await sdk.prepareSendPayment(
      request: PrepareSendPaymentRequest(paymentRequest: .input(input: invoice)))
    guard case .bolt11Invoice(_, _, let lightningFeeSats) = prepared.paymentMethod else {
      throw NwcError.handOff("unexpected payment method")
    }
    return (prepared, lightningFeeSats)
  }

  // No idempotency key: the payment_hash claim (NwcInvoices.claimPayment) allows
  // one send per attempt, and a key fixed per invoice made Breez return the old
  // failed payment on every retry.
  func send(_ prepared: PrepareSendPaymentResponse, timeoutSeconds: UInt32) async throws -> Payment {
    try await sdk.sendPayment(
      request: SendPaymentRequest(
        prepareResponse: prepared,
        options: .bolt11Invoice(preferSpark: false, completionTimeoutSecs: timeoutSeconds),
        idempotencyKey: nil)
    ).payment
  }

  func payments(offset: UInt32, limit: UInt32, from: UInt64?, until: UInt64?, type: PaymentType?)
    async throws -> [Payment]
  {
    try await sdk.listPayments(
      request: ListPaymentsRequest(
        typeFilter: type.map { [$0] }, fromTimestamp: from, toTimestamp: until, offset: offset,
        limit: limit)
    ).payments
  }

  // Most recent Lightning payment for a payment hash (either direction).
  func lightningPayment(paymentHash: String) async throws -> Payment? {
    try await sdk.listPayments(
      request: ListPaymentsRequest(
        paymentDetailsFilter: [.lightning(htlcStatus: nil)], limit: 100)
    ).payments.first { $0.lightning?.htlcDetails.paymentHash == paymentHash }
  }
}

struct NwcLightningDetails {
  let description: String?
  let invoice: String
  let htlcDetails: SparkHtlcDetails
}

extension Payment {
  var lightning: NwcLightningDetails? {
    guard case .lightning(let description, let invoice, _, let htlcDetails, _, _, _, _) = details
    else { return nil }
    return NwcLightningDetails(description: description, invoice: invoice, htlcDetails: htlcDetails)
  }

  var amountSats: Int64 { Int64(amount.description) ?? 0 }
  var feeSats: Int64 { Int64(fees.description) ?? 0 }
}
