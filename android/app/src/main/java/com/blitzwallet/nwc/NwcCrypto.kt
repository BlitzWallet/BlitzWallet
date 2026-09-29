package com.blitzwallet.nwc

import fr.acinq.secp256k1.Secp256k1
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

// Nostr primitives for the native NWC handler: BIP-340 Schnorr, NIP-01 event
// ids, NIP-44 v2 and NIP-04. Mirrors nostr-tools byte for byte; checked against
// src/test/resources/nwc-crypto-vectors.json by NwcCryptoTest (same vectors as
// the iOS extension). No android.* imports so it runs in JVM unit tests.
class NwcCryptoException(message: String) : Exception(message)

object NwcCrypto {
  private val random = SecureRandom()

  fun randomBytes(count: Int) = ByteArray(count).also { random.nextBytes(it) }

  fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)

  fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray =
    Mac.getInstance("HmacSHA256").run {
      init(SecretKeySpec(key, "HmacSHA256"))
      doFinal(data)
    }

  // MARK: keys and Schnorr

  fun publicKey(secret: ByteArray): ByteArray {
    if (secret.size != 32 || !Secp256k1.secKeyVerify(secret)) throw NwcCryptoException("invalid key")
    return Secp256k1.pubKeyCompress(Secp256k1.pubkeyCreate(secret)).copyOfRange(1, 33)
  }

  fun sign(message32: ByteArray, secret: ByteArray): ByteArray {
    if (secret.size != 32 || !Secp256k1.secKeyVerify(secret)) throw NwcCryptoException("invalid key")
    return Secp256k1.signSchnorr(message32, secret, randomBytes(32))
  }

  fun verify(signature: ByteArray, message32: ByteArray, publicKey: ByteArray): Boolean =
    try {
      signature.size == 64 && message32.size == 32 && publicKey.size == 32 &&
        Secp256k1.verifySchnorr(signature, message32, publicKey)
    } catch (e: Exception) {
      false
    }

  // Unhashed x coordinate of secret * lift_x(publicKey), as used by NIP-04/44.
  fun sharedX(secret: ByteArray, publicKey: ByteArray): ByteArray {
    if (secret.size != 32 || publicKey.size != 32 || !Secp256k1.secKeyVerify(secret)) {
      throw NwcCryptoException("invalid key")
    }
    return try {
      val point = Secp256k1.pubkeyParse(byteArrayOf(2) + publicKey)
      Secp256k1.pubKeyTweakMul(point, secret).copyOfRange(1, 33)
    } catch (e: Exception) {
      throw NwcCryptoException("invalid key")
    }
  }

  // MARK: NIP-01 event id

  fun eventId(pubkey: String, createdAt: Long, kind: Int, tags: List<List<String>>, content: String): ByteArray {
    val tagJson = tags.joinToString(",") { tag -> tag.joinToString(",", "[", "]") { jsonString(it) } }
    val serialized = "[0,${jsonString(pubkey)},$createdAt,$kind,[$tagJson],${jsonString(content)}]"
    return sha256(serialized.toByteArray(Charsets.UTF_8))
  }

  // JSON.stringify string escaping (what nostr-tools hashes); org.json would
  // also escape "/", which changes the id.
  fun jsonString(value: String): String {
    val out = StringBuilder("\"")
    for (c in value) {
      when (c) {
        '"' -> out.append("\\\"")
        '\\' -> out.append("\\\\")
        '\n' -> out.append("\\n")
        '\r' -> out.append("\\r")
        '\t' -> out.append("\\t")
        '\b' -> out.append("\\b")
        '\u000C' -> out.append("\\f")
        else -> if (c < ' ') out.append(String.format("\\u%04x", c.code)) else out.append(c)
      }
    }
    return out.append('"').toString()
  }

  // MARK: NIP-44 v2

  fun conversationKey(secret: ByteArray, publicKey: ByteArray): ByteArray =
    hmacSha256("nip44-v2".toByteArray(), sharedX(secret, publicKey))

  fun calcPaddedLength(length: Int): Int {
    if (length <= 32) return 32
    val nextPower = 1 shl (32 - Integer.numberOfLeadingZeros(length - 1))
    val chunk = if (nextPower <= 256) 32 else nextPower / 8
    return chunk * ((length - 1) / chunk + 1)
  }

  private fun messageKeys(conversationKey: ByteArray, nonce: ByteArray): Triple<ByteArray, ByteArray, ByteArray> {
    // HKDF-expand (RFC 5869) to 76 bytes.
    var okm = ByteArray(0)
    var block = ByteArray(0)
    var counter = 1
    while (okm.size < 76) {
      block = hmacSha256(conversationKey, block + nonce + byteArrayOf(counter++.toByte()))
      okm += block
    }
    return Triple(okm.copyOfRange(0, 32), okm.copyOfRange(32, 44), okm.copyOfRange(44, 76))
  }

  fun nip44Encrypt(plaintext: String, conversationKey: ByteArray, nonce: ByteArray = randomBytes(32)): String {
    val text = plaintext.toByteArray(Charsets.UTF_8)
    if (text.size !in 1..65535) throw NwcCryptoException("invalid plaintext length")
    val (key, chachaNonce, hmacKey) = messageKeys(conversationKey, nonce)
    val padded = ByteArray(2 + calcPaddedLength(text.size))
    padded[0] = (text.size shr 8).toByte()
    padded[1] = text.size.toByte()
    text.copyInto(padded, 2)
    val ciphertext = chacha20(key, chachaNonce, padded)
    val mac = hmacSha256(hmacKey, nonce + ciphertext)
    return Base64.getEncoder().encodeToString(byteArrayOf(2) + nonce + ciphertext + mac)
  }

  fun nip44Decrypt(payload: String, conversationKey: ByteArray): String {
    if (payload.length !in 132..87472 || payload.startsWith("#")) throw NwcCryptoException("invalid payload")
    val data = try {
      Base64.getDecoder().decode(payload)
    } catch (e: IllegalArgumentException) {
      throw NwcCryptoException("invalid base64")
    }
    if (data.size !in 99..65603 || data[0] != 2.toByte()) throw NwcCryptoException("invalid payload")
    val nonce = data.copyOfRange(1, 33)
    val ciphertext = data.copyOfRange(33, data.size - 32)
    val mac = data.copyOfRange(data.size - 32, data.size)
    val (key, chachaNonce, hmacKey) = messageKeys(conversationKey, nonce)
    if (!MessageDigest.isEqual(hmacSha256(hmacKey, nonce + ciphertext), mac)) throw NwcCryptoException("invalid mac")
    val padded = chacha20(key, chachaNonce, ciphertext)
    val length = (padded[0].toInt() and 0xff shl 8) or (padded[1].toInt() and 0xff)
    if (length == 0 || padded.size != 2 + calcPaddedLength(length)) throw NwcCryptoException("invalid padding")
    return String(padded, 2, length, Charsets.UTF_8)
  }

  // RFC 8439 ChaCha20, counter 0 (NIP-44 uses the bare stream cipher).
  fun chacha20(key: ByteArray, nonce: ByteArray, data: ByteArray): ByteArray {
    fun word(b: ByteArray, i: Int) =
      (b[i].toInt() and 0xff) or (b[i + 1].toInt() and 0xff shl 8) or
        (b[i + 2].toInt() and 0xff shl 16) or (b[i + 3].toInt() and 0xff shl 24)
    val state = IntArray(16)
    state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574
    for (i in 0 until 8) state[4 + i] = word(key, i * 4)
    for (i in 0 until 3) state[13 + i] = word(nonce, i * 4)

    val out = ByteArray(data.size)
    val x = IntArray(16)
    var offset = 0
    while (offset < data.size) {
      state.copyInto(x)
      fun quarter(a: Int, b: Int, c: Int, d: Int) {
        x[a] += x[b]; x[d] = Integer.rotateLeft(x[d] xor x[a], 16)
        x[c] += x[d]; x[b] = Integer.rotateLeft(x[b] xor x[c], 12)
        x[a] += x[b]; x[d] = Integer.rotateLeft(x[d] xor x[a], 8)
        x[c] += x[d]; x[b] = Integer.rotateLeft(x[b] xor x[c], 7)
      }
      repeat(10) {
        quarter(0, 4, 8, 12); quarter(1, 5, 9, 13); quarter(2, 6, 10, 14); quarter(3, 7, 11, 15)
        quarter(0, 5, 10, 15); quarter(1, 6, 11, 12); quarter(2, 7, 8, 13); quarter(3, 4, 9, 14)
      }
      for (i in 0 until 16) {
        val value = x[i] + state[i]
        for (j in 0 until 4) {
          val index = offset + i * 4 + j
          if (index < data.size) out[index] = (data[index].toInt() xor (value ushr (8 * j))).toByte()
        }
      }
      state[12]++
      offset += 64
    }
    return out
  }

  // MARK: NIP-04

  fun nip04Encrypt(plaintext: String, secret: ByteArray, publicKey: ByteArray): String {
    val iv = randomBytes(16)
    val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(sharedX(secret, publicKey), "AES"), IvParameterSpec(iv))
    val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
    return Base64.getEncoder().encodeToString(ciphertext) + "?iv=" + Base64.getEncoder().encodeToString(iv)
  }

  fun nip04Decrypt(payload: String, secret: ByteArray, publicKey: ByteArray): String {
    val parts = payload.split("?iv=")
    if (parts.size != 2) throw NwcCryptoException("invalid payload")
    return try {
      val iv = Base64.getDecoder().decode(parts[1])
      val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(sharedX(secret, publicKey), "AES"), IvParameterSpec(iv))
      String(cipher.doFinal(Base64.getDecoder().decode(parts[0])), Charsets.UTF_8)
    } catch (e: NwcCryptoException) {
      throw e
    } catch (e: Exception) {
      throw NwcCryptoException("invalid payload")
    }
  }
}

fun String.hexToBytes(): ByteArray? {
  if (length % 2 != 0) return null
  return try {
    ByteArray(length / 2) { substring(it * 2, it * 2 + 2).toInt(16).toByte() }
  } catch (e: NumberFormatException) {
    null
  }
}

fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
