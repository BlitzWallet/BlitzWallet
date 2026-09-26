import Foundation

// Conformance check for NotificationService/NwcCrypto.swift against the shared
// vectors (official NIP-44 set + nostr-tools generated NIP-04/NIP-01 cases),
// plus NwcStorage.swift budget parsing and payment claims on real SQLite.
// Run: ios/NotificationServiceTests/run.sh
let path = CommandLine.arguments[1]
let vectors = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: path))) as! [String: Any]
var failures = 0
var checks = 0
func check(_ ok: Bool, _ label: String) {
  checks += 1
  if !ok { failures += 1; print("FAIL:", label) }
}
func bytes(_ any: Any?) -> [UInt8] { [UInt8](hex: any as! String)! }

for item in vectors["pubkeys"] as! [[String: String]] {
  check((try? NwcCrypto.publicKey(secret: bytes(item["sec"])))?.hex == item["pub"], "pubkey \(item["pub"]!)")
}

for event in vectors["events"] as! [[String: Any]] {
  let id = NwcCrypto.eventId(
    pubkey: event["pubkey"] as! String, createdAt: (event["created_at"] as! NSNumber).int64Value,
    kind: event["kind"] as! Int, tags: event["tags"] as! [[String]], content: event["content"] as! String)
  check(id.hex == event["id"] as! String, "event id \(event["content"]!)")
  check(NwcCrypto.verify(bytes(event["sig"]), message32: id, publicKey: bytes(event["pubkey"])), "verify \(event["id"]!)")
  var tampered = bytes(event["sig"]); tampered[5] ^= 1
  check(!NwcCrypto.verify(tampered, message32: id, publicKey: bytes(event["pubkey"])), "reject tampered sig")
}
let signer = bytes((vectors["pubkeys"] as! [[String: String]])[3]["sec"])
let message = NwcCrypto.sha256(Array("blitz".utf8))
let sig = try! NwcCrypto.sign(message, secret: signer)
check(NwcCrypto.verify(sig, message32: message, publicKey: try! NwcCrypto.publicKey(secret: signer)), "sign/verify roundtrip")

for item in vectors["nip04"] as! [[String: String]] {
  let secret = bytes(item["sec"]), pub = bytes(item["pub"])
  check((try? NwcCrypto.nip04Decrypt(item["ciphertext"]!, secret: secret, publicKey: pub)) == item["plaintext"], "nip04 decrypt \(item["plaintext"]!.prefix(12))")
  let again = try! NwcCrypto.nip04Encrypt(item["plaintext"]!, secret: secret, publicKey: pub)
  check((try? NwcCrypto.nip04Decrypt(again, secret: secret, publicKey: pub)) == item["plaintext"], "nip04 roundtrip")
}

let nip44 = vectors["nip44"] as! [String: Any]
for item in nip44["get_conversation_key"] as! [[String: String]] {
  check((try? NwcCrypto.conversationKey(secret: bytes(item["sec1"]), publicKey: bytes(item["pub2"])))?.hex == item["conversation_key"], "conversation key \(item["conversation_key"]!)")
}
for item in nip44["invalid_get_conversation_key"] as! [[String: String]] {
  check((try? NwcCrypto.conversationKey(secret: bytes(item["sec1"]), publicKey: bytes(item["pub2"]))) == nil, "invalid conversation key: \(item["note"] ?? "")")
}
for pair in nip44["calc_padded_len"] as! [[Int]] {
  check(NwcCrypto.calcPaddedLength(pair[0]) == pair[1], "padded len \(pair[0])")
}
for item in nip44["encrypt_decrypt"] as! [[String: String]] {
  let sec1 = bytes(item["sec1"]), sec2 = bytes(item["sec2"])
  let key = try! NwcCrypto.conversationKey(secret: sec1, publicKey: try! NwcCrypto.publicKey(secret: sec2))
  check(key.hex == item["conversation_key"], "nip44 key \(item["conversation_key"]!)")
  let payload = try! NwcCrypto.nip44Encrypt(item["plaintext"]!, conversationKey: key, nonce: bytes(item["nonce"]))
  check(payload == item["payload"], "nip44 encrypt \(item["plaintext"]!.prefix(12))")
  let key2 = try! NwcCrypto.conversationKey(secret: sec2, publicKey: try! NwcCrypto.publicKey(secret: sec1))
  check((try? NwcCrypto.nip44Decrypt(item["payload"]!, conversationKey: key2)) == item["plaintext"], "nip44 decrypt \(item["plaintext"]!.prefix(12))")
}
for item in nip44["invalid_decrypt"] as! [[String: String]] {
  check((try? NwcCrypto.nip44Decrypt(item["payload"]!, conversationKey: bytes(item["conversation_key"]))) == nil, "invalid decrypt: \(item["note"]!)")
}

// MARK: NwcStorage
// Budget: the value is user input (no keypad cap). Must never trap (Int64(Double)
// does past 2^63 / on NaN / inf) and must match the Kotlin/JS coercion:
// "Unlimited" → nil, junk or missing → 0, out of range saturates.
let budgetCases: [(Any?, Int64?)] = [
  (NSNumber(value: 100_000), 100_000_000), ("5000", 5_000_000), ("Unlimited", nil), (nil, 0),
  (NSNull(), 0), ("junk", 0), ("nan", 0), (NSNumber(value: 9_999_999_999_999_999 as Int64), .max),
  ("1e400", .max), ("-1e400", .min),
]
for (amount, expected) in budgetCases {
  check(NwcConfig.budgetLimitMsat(amount) == expected, "budget \(String(describing: amount))")
}

// Payment claim: the payment_hash marker is the only thing stopping two payers
// in separate processes from sending the same invoice. Ways it fails: both
// claim a new hash; a pending or completed marker is taken over; a failed one
// is never retryable or is retried twice; an INCOMING invoice becomes a payment.
let storageDir = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try! FileManager.default.createDirectory(at: storageDir, withIntermediateDirectories: true)
let payerA = try! NwcInvoices(directory: storageDir)
let payerB = try! NwcInvoices(directory: storageDir)  // second connection = another process
func claim(_ payer: NwcInvoices, _ hash: String) -> Bool {
  try! payer.claimPayment(paymentHash: hash, invoice: "lnbc-\(hash)", amountSats: 5)
}
func markerStatus(_ hash: String) -> String? {
  try! payerA.lookup(invoice: nil, paymentHash: hash)?["status"] as? String
}
check(claim(payerA, "h1"), "claim a new hash")
check(!claim(payerB, "h1"), "pending hash not claimed twice")
try! payerA.updateStatus(paymentHash: "h1", status: "completed", preimage: "p")
check(!claim(payerB, "h1"), "completed hash not claimed")
try! payerA.updateStatus(paymentHash: "h1", status: "failed", preimage: "")
check(claim(payerB, "h1"), "failed hash reclaimed")
check(!claim(payerA, "h1"), "failed hash reclaimed once")
check(markerStatus("h1") == "pending", "reclaimed marker is pending")
try! payerA.store(
  paymentHash: "h2", invoice: "lnbc-incoming", amountSats: 5, description: nil, expiresAt: nil,
  type: "INCOMING")
check(!claim(payerB, "h2"), "incoming invoice not claimed")
check(try! payerA.lookup(invoice: nil, paymentHash: "h2")?["type"] as? String == "INCOMING", "incoming untouched")

print("\(checks - failures)/\(checks) checks passed")
exit(failures == 0 ? 0 : 1)
