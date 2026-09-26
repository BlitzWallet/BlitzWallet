package com.blitzwallet.nwc

import breez_sdk_spark.BreezSdk
import breez_sdk_spark.Bolt11InvoiceDetails
import breez_sdk_spark.ConnectRequest
import breez_sdk_spark.GetInfoRequest
import breez_sdk_spark.InputType
import breez_sdk_spark.ListPaymentsRequest
import breez_sdk_spark.Network
import breez_sdk_spark.Payment
import breez_sdk_spark.PaymentDetails
import breez_sdk_spark.PaymentDetailsFilter
import breez_sdk_spark.PaymentRequest
import breez_sdk_spark.PaymentType
import breez_sdk_spark.PrepareSendPaymentRequest
import breez_sdk_spark.PrepareSendPaymentResponse
import breez_sdk_spark.ReceivePaymentMethod
import breez_sdk_spark.ReceivePaymentRequest
import breez_sdk_spark.Seed
import breez_sdk_spark.SendPaymentMethod
import breez_sdk_spark.SendPaymentOptions
import breez_sdk_spark.SendPaymentRequest
import breez_sdk_spark.SyncWalletRequest
import breez_sdk_spark.connect as breezConnect
import breez_sdk_spark.defaultServerConfig
import java.io.File

// Thin Breez Spark adapter for the NWC methods (same as the iOS NwcWallet).
// Server mode: no background sync/claim/optimization tasks, the handler drives
// sync explicitly. Same seed + derivation as the JS Spark SDK (m/8797555'/1' on
// mainnet), so this is the user's existing NWC wallet.
class NwcWallet private constructor(private val sdk: BreezSdk) {
  companion object {
    suspend fun connect(mnemonic: String, apiKey: String, storageDirectory: File): NwcWallet {
      storageDirectory.mkdirs()
      val config = defaultServerConfig(Network.MAINNET).also { it.apiKey = apiKey }
      val sdk = breezConnect(ConnectRequest(config, Seed.Mnemonic(mnemonic, null), storageDirectory.absolutePath))
      return NwcWallet(sdk).also { it.sync() }
    }
  }

  // Also claims incoming transfers, so a paid invoice shows up as completed.
  suspend fun sync() {
    sdk.syncWallet(SyncWalletRequest)
  }

  suspend fun disconnect() {
    runCatching { sdk.disconnect() }
  }

  suspend fun balanceSats(): Long = sdk.getInfo(GetInfoRequest(false)).balanceSats.toLong()

  suspend fun parseInvoice(invoice: String): Bolt11InvoiceDetails =
    (sdk.parse(invoice) as? InputType.Bolt11Invoice)?.v1 ?: throw NwcHandOff("not a bolt11 invoice")

  suspend fun createInvoice(amountSats: Long, description: String, expirySeconds: Long): String =
    sdk.receivePayment(
      ReceivePaymentRequest(
        ReceivePaymentMethod.Bolt11Invoice(description, amountSats.toULong(), expirySeconds.toUInt(), null, null),
      ),
    ).paymentRequest

  suspend fun prepare(invoice: String): Pair<PrepareSendPaymentResponse, Long> {
    val prepared = sdk.prepareSendPayment(PrepareSendPaymentRequest(PaymentRequest.Input(invoice)))
    val method = prepared.paymentMethod as? SendPaymentMethod.Bolt11Invoice ?: throw NwcHandOff("unexpected payment method")
    return prepared to method.lightningFeeSats.toLong()
  }

  // No idempotency key: the payment_hash claim (NwcInvoices.claimPayment) allows
  // one send per attempt, and a key fixed per invoice made Breez return the old
  // failed payment on every retry.
  suspend fun send(prepared: PrepareSendPaymentResponse, timeoutSeconds: Int): Payment =
    sdk.sendPayment(
      SendPaymentRequest(prepared, SendPaymentOptions.Bolt11Invoice(false, timeoutSeconds.toUInt()), null),
    ).payment

  suspend fun payments(offset: Int, limit: Int, from: Long?, until: Long?, type: PaymentType?): List<Payment> =
    sdk.listPayments(
      ListPaymentsRequest(
        typeFilter = type?.let { listOf(it) },
        fromTimestamp = from?.toULong(),
        toTimestamp = until?.toULong(),
        offset = offset.toUInt(),
        limit = limit.toUInt(),
      ),
    ).payments

  // Most recent Lightning payment for a payment hash (either direction).
  suspend fun lightningPayment(paymentHash: String): Payment? =
    sdk.listPayments(
      ListPaymentsRequest(paymentDetailsFilter = listOf(PaymentDetailsFilter.Lightning(null)), limit = 100u),
    ).payments.firstOrNull { it.lightning?.htlcDetails?.paymentHash == paymentHash }
}

val Payment.lightning: PaymentDetails.Lightning? get() = details as? PaymentDetails.Lightning
val Payment.amountSats: Long get() = amount.toLong()
val Payment.feeSats: Long get() = fees.toLong()
