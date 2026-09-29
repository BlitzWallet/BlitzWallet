package com.blitzwallet.nwc

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Same vectors as ios/NotificationServiceTests: official NIP-44 set plus
// nostr-tools generated NIP-04 / NIP-01 / Schnorr cases.
class NwcCryptoTest {
  private val vectors = JSONObject(javaClass.classLoader!!.getResource("nwc-crypto-vectors.json")!!.readText())
  private fun JSONObject.bytes(key: String) = getString(key).hexToBytes()!!
  private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }

  @Test
  fun publicKeys() {
    for (item in vectors.getJSONArray("pubkeys").objects()) {
      assertEquals(item.getString("pub"), NwcCrypto.publicKey(item.bytes("sec")).toHex())
    }
  }

  @Test
  fun eventIdsAndSignatures() {
    for (event in vectors.getJSONArray("events").objects()) {
      val tagsJson = event.getJSONArray("tags")
      val tags = (0 until tagsJson.length()).map { i ->
        val tag = tagsJson.getJSONArray(i)
        (0 until tag.length()).map { tag.getString(it) }
      }
      val id = NwcCrypto.eventId(
        event.getString("pubkey"), event.getLong("created_at"), event.getInt("kind"), tags, event.getString("content"),
      )
      assertEquals(event.getString("content"), event.getString("id"), id.toHex())
      assertTrue(NwcCrypto.verify(event.bytes("sig"), id, event.bytes("pubkey")))
      val tampered = event.bytes("sig").also { it[5] = (it[5].toInt() xor 1).toByte() }
      assertFalse(NwcCrypto.verify(tampered, id, event.bytes("pubkey")))
    }
    val secret = vectors.getJSONArray("pubkeys").getJSONObject(3).bytes("sec")
    val message = NwcCrypto.sha256("blitz".toByteArray())
    assertTrue(NwcCrypto.verify(NwcCrypto.sign(message, secret), message, NwcCrypto.publicKey(secret)))
  }

  @Test
  fun nip04() {
    for (item in vectors.getJSONArray("nip04").objects()) {
      val secret = item.bytes("sec")
      val pub = item.bytes("pub")
      assertEquals(item.getString("plaintext"), NwcCrypto.nip04Decrypt(item.getString("ciphertext"), secret, pub))
      val again = NwcCrypto.nip04Encrypt(item.getString("plaintext"), secret, pub)
      assertEquals(item.getString("plaintext"), NwcCrypto.nip04Decrypt(again, secret, pub))
    }
  }

  @Test
  fun nip44() {
    val nip44 = vectors.getJSONObject("nip44")
    for (item in nip44.getJSONArray("get_conversation_key").objects()) {
      assertEquals(item.getString("conversation_key"), NwcCrypto.conversationKey(item.bytes("sec1"), item.bytes("pub2")).toHex())
    }
    for (item in nip44.getJSONArray("invalid_get_conversation_key").objects()) {
      assertNull(item.optString("note"), runCatching { NwcCrypto.conversationKey(item.bytes("sec1"), item.bytes("pub2")) }.getOrNull())
    }
    val lengths = nip44.getJSONArray("calc_padded_len")
    for (i in 0 until lengths.length()) {
      val pair = lengths.getJSONArray(i)
      assertEquals(pair.getInt(1), NwcCrypto.calcPaddedLength(pair.getInt(0)))
    }
    for (item in nip44.getJSONArray("encrypt_decrypt").objects()) {
      val sec1 = item.bytes("sec1")
      val sec2 = item.bytes("sec2")
      val key = NwcCrypto.conversationKey(sec1, NwcCrypto.publicKey(sec2))
      assertEquals(item.getString("conversation_key"), key.toHex())
      assertEquals(item.getString("payload"), NwcCrypto.nip44Encrypt(item.getString("plaintext"), key, item.bytes("nonce")))
      val key2 = NwcCrypto.conversationKey(sec2, NwcCrypto.publicKey(sec1))
      assertEquals(item.getString("plaintext"), NwcCrypto.nip44Decrypt(item.getString("payload"), key2))
    }
    for (item in nip44.getJSONArray("invalid_decrypt").objects()) {
      assertNull(
        item.getString("note"),
        runCatching { NwcCrypto.nip44Decrypt(item.getString("payload"), item.bytes("conversation_key")) }.getOrNull(),
      )
    }
  }
}
