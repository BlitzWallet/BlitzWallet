import CommonCrypto
import CryptoKit
import Foundation
import BlitzSecp256k1

// Nostr primitives the NWC handler needs: BIP-340 Schnorr, NIP-01 event ids,
// NIP-44 v2 and NIP-04 encryption. Mirrors nostr-tools byte for byte; checked
// against android/app/src/test/resources/nwc-crypto-vectors.json by
// ios/NotificationServiceTests/run.sh.
enum NwcCryptoError: Error {
  case invalidKey, invalidPayload, invalidMac, invalidPadding
}

enum NwcCrypto {
  private static let ctx: OpaquePointer = {
    let context = secp256k1_context_create(UInt32(SECP256K1_CONTEXT_NONE))!
    var seed = randomBytes(32)
    _ = secp256k1_context_randomize(context, &seed)
    return context
  }()

  static func randomBytes(_ count: Int) -> [UInt8] {
    var bytes = [UInt8](repeating: 0, count: count)
    precondition(SecRandomCopyBytes(kSecRandomDefault, count, &bytes) == errSecSuccess)
    return bytes
  }

  static func sha256(_ data: [UInt8]) -> [UInt8] { Array(SHA256.hash(data: data)) }

  static func hmacSHA256(key: [UInt8], data: [UInt8]) -> [UInt8] {
    Array(HMAC<SHA256>.authenticationCode(for: data, using: SymmetricKey(data: key)))
  }

  // MARK: Keys and Schnorr

  private static func keypair(_ secret: [UInt8]) throws -> secp256k1_keypair {
    var keypair = secp256k1_keypair()
    guard secret.count == 32, secp256k1_keypair_create(ctx, &keypair, secret) == 1 else {
      throw NwcCryptoError.invalidKey
    }
    return keypair
  }

  static func publicKey(secret: [UInt8]) throws -> [UInt8] {
    var keypair = try keypair(secret)
    var xonly = secp256k1_xonly_pubkey()
    var out = [UInt8](repeating: 0, count: 32)
    guard secp256k1_keypair_xonly_pub(ctx, &xonly, nil, &keypair) == 1,
      secp256k1_xonly_pubkey_serialize(ctx, &out, &xonly) == 1
    else { throw NwcCryptoError.invalidKey }
    return out
  }

  static func sign(_ message32: [UInt8], secret: [UInt8]) throws -> [UInt8] {
    var keypair = try keypair(secret)
    var signature = [UInt8](repeating: 0, count: 64)
    let aux = randomBytes(32)
    guard secp256k1_schnorrsig_sign32(ctx, &signature, message32, &keypair, aux) == 1 else {
      throw NwcCryptoError.invalidKey
    }
    return signature
  }

  static func verify(_ signature: [UInt8], message32: [UInt8], publicKey: [UInt8]) -> Bool {
    var xonly = secp256k1_xonly_pubkey()
    guard signature.count == 64, message32.count == 32, publicKey.count == 32,
      secp256k1_xonly_pubkey_parse(ctx, &xonly, publicKey) == 1
    else { return false }
    return secp256k1_schnorrsig_verify(ctx, signature, message32, 32, &xonly) == 1
  }

  // Unhashed x coordinate of secret * lift_x(publicKey), as used by NIP-04/44.
  static func sharedX(secret: [UInt8], publicKey: [UInt8]) throws -> [UInt8] {
    var point = secp256k1_pubkey()
    guard secret.count == 32, publicKey.count == 32,
      secp256k1_ec_pubkey_parse(ctx, &point, [0x02] + publicKey, 33) == 1,
      secp256k1_ec_pubkey_tweak_mul(ctx, &point, secret) == 1
    else { throw NwcCryptoError.invalidKey }
    var out = [UInt8](repeating: 0, count: 33)
    var length = 33
    secp256k1_ec_pubkey_serialize(ctx, &out, &length, &point, UInt32(SECP256K1_EC_COMPRESSED))
    return Array(out[1..<33])
  }

  // MARK: NIP-01 event id

  static func eventId(pubkey: String, createdAt: Int64, kind: Int, tags: [[String]], content: String)
    -> [UInt8]
  {
    let tagJson = tags.map { "[" + $0.map(jsonString).joined(separator: ",") + "]" }
      .joined(separator: ",")
    let serialized =
      "[0,\(jsonString(pubkey)),\(createdAt),\(kind),[\(tagJson)],\(jsonString(content))]"
    return sha256(Array(serialized.utf8))
  }

  // JSON.stringify string escaping (what nostr-tools hashes). JSONSerialization
  // would also escape "/", which changes the id.
  static func jsonString(_ value: String) -> String {
    var out = "\""
    for scalar in value.unicodeScalars {
      switch scalar {
      case "\"": out += "\\\""
      case "\\": out += "\\\\"
      case "\n": out += "\\n"
      case "\r": out += "\\r"
      case "\t": out += "\\t"
      case "\u{08}": out += "\\b"
      case "\u{0C}": out += "\\f"
      default:
        if scalar.value < 0x20 {
          out += String(format: "\\u%04x", scalar.value)
        } else {
          out.unicodeScalars.append(scalar)
        }
      }
    }
    return out + "\""
  }

  // MARK: NIP-44 v2

  static func conversationKey(secret: [UInt8], publicKey: [UInt8]) throws -> [UInt8] {
    hmacSHA256(key: Array("nip44-v2".utf8), data: try sharedX(secret: secret, publicKey: publicKey))
  }

  static func calcPaddedLength(_ length: Int) -> Int {
    if length <= 32 { return 32 }
    let nextPower = 1 << (Int.bitWidth - (length - 1).leadingZeroBitCount)
    let chunk = nextPower <= 256 ? 32 : nextPower / 8
    return chunk * ((length - 1) / chunk + 1)
  }

  private static func messageKeys(_ conversationKey: [UInt8], _ nonce: [UInt8]) -> (
    key: [UInt8], nonce: [UInt8], hmac: [UInt8]
  ) {
    let okm = HKDF<SHA256>.expand(
      pseudoRandomKey: SymmetricKey(data: conversationKey), info: nonce, outputByteCount: 76)
    let bytes = okm.withUnsafeBytes { Array($0) }
    return (Array(bytes[0..<32]), Array(bytes[32..<44]), Array(bytes[44..<76]))
  }

  static func nip44Encrypt(_ plaintext: String, conversationKey: [UInt8], nonce: [UInt8]? = nil)
    throws -> String
  {
    let text = Array(plaintext.utf8)
    guard (1...65535).contains(text.count) else { throw NwcCryptoError.invalidPadding }
    let nonce = nonce ?? randomBytes(32)
    let keys = messageKeys(conversationKey, nonce)
    var padded = [UInt8(text.count >> 8), UInt8(text.count & 0xff)] + text
    padded += [UInt8](repeating: 0, count: 2 + calcPaddedLength(text.count) - padded.count)
    let ciphertext = chacha20(key: keys.key, nonce: keys.nonce, data: padded)
    let mac = hmacSHA256(key: keys.hmac, data: nonce + ciphertext)
    return Data([2] + nonce + ciphertext + mac).base64EncodedString()
  }

  static func nip44Decrypt(_ payload: String, conversationKey: [UInt8]) throws -> String {
    guard (132...87472).contains(payload.count), !payload.hasPrefix("#"),
      let data = Data(base64Encoded: payload).map(Array.init),
      (99...65603).contains(data.count), data[0] == 2
    else { throw NwcCryptoError.invalidPayload }
    let nonce = Array(data[1..<33])
    let ciphertext = Array(data[33..<(data.count - 32)])
    let mac = Array(data[(data.count - 32)...])
    let keys = messageKeys(conversationKey, nonce)
    let expected = hmacSHA256(key: keys.hmac, data: nonce + ciphertext)
    guard zip(expected, mac).reduce(0, { $0 | ($1.0 ^ $1.1) }) == 0 else {
      throw NwcCryptoError.invalidMac
    }
    let padded = chacha20(key: keys.key, nonce: keys.nonce, data: ciphertext)
    let length = Int(padded[0]) << 8 | Int(padded[1])
    guard length > 0, padded.count == 2 + calcPaddedLength(length),
      let text = String(bytes: padded[2..<(2 + length)], encoding: .utf8)
    else { throw NwcCryptoError.invalidPadding }
    return text
  }

  // RFC 8439 ChaCha20, counter 0 (NIP-44 uses the bare stream cipher).
  static func chacha20(key: [UInt8], nonce: [UInt8], data: [UInt8]) -> [UInt8] {
    func word(_ b: [UInt8], _ i: Int) -> UInt32 {
      UInt32(b[i]) | UInt32(b[i + 1]) << 8 | UInt32(b[i + 2]) << 16 | UInt32(b[i + 3]) << 24
    }
    var state: [UInt32] = [0x6170_7865, 0x3320_646e, 0x7962_2d32, 0x6b20_6574]
    state += (0..<8).map { word(key, $0 * 4) }
    state += [0] + (0..<3).map { word(nonce, $0 * 4) }

    var out = [UInt8](repeating: 0, count: data.count)
    var offset = 0
    while offset < data.count {
      var x = state
      func quarter(_ a: Int, _ b: Int, _ c: Int, _ d: Int) {
        x[a] &+= x[b]; x[d] ^= x[a]; x[d] = x[d] << 16 | x[d] >> 16
        x[c] &+= x[d]; x[b] ^= x[c]; x[b] = x[b] << 12 | x[b] >> 20
        x[a] &+= x[b]; x[d] ^= x[a]; x[d] = x[d] << 8 | x[d] >> 24
        x[c] &+= x[d]; x[b] ^= x[c]; x[b] = x[b] << 7 | x[b] >> 25
      }
      for _ in 0..<10 {
        quarter(0, 4, 8, 12); quarter(1, 5, 9, 13); quarter(2, 6, 10, 14); quarter(3, 7, 11, 15)
        quarter(0, 5, 10, 15); quarter(1, 6, 11, 12); quarter(2, 7, 8, 13); quarter(3, 4, 9, 14)
      }
      for i in 0..<16 {
        let value = x[i] &+ state[i]
        for j in 0..<4 where offset + i * 4 + j < data.count {
          out[offset + i * 4 + j] = data[offset + i * 4 + j] ^ UInt8(truncatingIfNeeded: value >> (8 * j))
        }
      }
      state[12] &+= 1
      offset += 64
    }
    return out
  }

  // MARK: NIP-04

  static func nip04Encrypt(_ plaintext: String, secret: [UInt8], publicKey: [UInt8]) throws -> String {
    let iv = randomBytes(16)
    let ciphertext = try aesCBC(
      CCOperation(kCCEncrypt), key: try sharedX(secret: secret, publicKey: publicKey), iv: iv,
      data: Array(plaintext.utf8))
    return Data(ciphertext).base64EncodedString() + "?iv=" + Data(iv).base64EncodedString()
  }

  static func nip04Decrypt(_ payload: String, secret: [UInt8], publicKey: [UInt8]) throws -> String {
    let parts = payload.components(separatedBy: "?iv=")
    guard parts.count == 2, let ciphertext = Data(base64Encoded: parts[0]),
      let iv = Data(base64Encoded: parts[1]), iv.count == 16
    else { throw NwcCryptoError.invalidPayload }
    let plaintext = try aesCBC(
      CCOperation(kCCDecrypt), key: try sharedX(secret: secret, publicKey: publicKey),
      iv: Array(iv), data: Array(ciphertext))
    guard let text = String(bytes: plaintext, encoding: .utf8) else {
      throw NwcCryptoError.invalidPayload
    }
    return text
  }

  private static func aesCBC(_ operation: CCOperation, key: [UInt8], iv: [UInt8], data: [UInt8])
    throws -> [UInt8]
  {
    var out = [UInt8](repeating: 0, count: data.count + kCCBlockSizeAES128)
    var moved = 0
    let status = CCCrypt(
      operation, CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding), key, key.count,
      iv, data, data.count, &out, out.count, &moved)
    guard status == kCCSuccess else { throw NwcCryptoError.invalidPayload }
    return Array(out[0..<moved])
  }
}

extension Array where Element == UInt8 {
  init?(hex: String) {
    guard hex.count % 2 == 0 else { return nil }
    var bytes = [UInt8]()
    var index = hex.startIndex
    while index < hex.endIndex {
      let next = hex.index(index, offsetBy: 2)
      guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
      bytes.append(byte)
      index = next
    }
    self = bytes
  }

  var hex: String { map { String(format: "%02x", $0) }.joined() }
}
