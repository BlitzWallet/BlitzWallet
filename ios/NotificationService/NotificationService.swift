import UserNotifications

// Handles NWC request pushes natively: no React Native, no app launch. The
// backend only sends this mutable-content format to app versions that
// advertise `nativeHandler` (see NWC-Backend processBulkNotifications).
final class NotificationService: UNNotificationServiceExtension {
  private let lock = NSLock()
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var original: UNNotificationContent?
  private var handler: NwcHandler?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    lock.lock()
    self.contentHandler = contentHandler
    original = request.content
    lock.unlock()

    // The OS allows ~30 s. Stop starting wallet work at 22 s so there is time to
    // publish and to hand the rest to the app.
    let start = Date()
    let handler = NwcHandler(
      deadline: start.addingTimeInterval(22), hardDeadline: start.addingTimeInterval(27))
    self.handler = handler
    nonisolated(unsafe) let userInfo = request.content.userInfo
    Task {
      let outcome = await NwcSerial.shared.run { await handler.handle(userInfo) }
      self.deliver(outcome)
    }
  }

  override func serviceExtensionTimeWillExpire() {
    handler?.expire()
    var outcome = NwcOutcome()
    outcome.isNwc = true
    outcome.handedOff = true
    deliver(outcome)
  }

  private func deliver(_ outcome: NwcOutcome) {
    lock.lock()
    let contentHandler = self.contentHandler
    self.contentHandler = nil
    let original = self.original
    lock.unlock()
    guard let contentHandler, let original else { return }

    guard outcome.isNwc else { return contentHandler(original) }
    let strings = outcome.strings
    let content = UNMutableNotificationContent()
    if outcome.handedOff {
      content.title = strings["title"] ?? "Nostr Connect"
      content.body = strings["openApp"] ?? "Open Blitz to finish this request"
    } else if let method = outcome.notifyMethod {
      content.title = strings["title"] ?? "Nostr Connect"
      content.body = strings[method] ?? original.body
    }
    // Otherwise (duplicate, rejected, error response) deliver empty content: the
    // JS handler stays silent for these too.
    contentHandler(content)
  }
}

// One request at a time per extension process: iOS may deliver several pushes
// to the same process and they share one Breez storage directory and ledger.
actor NwcSerial {
  static let shared = NwcSerial()
  private var tail: Task<Void, Never>?

  func run<T: Sendable>(_ work: @escaping @Sendable () async -> T) async -> T {
    let previous = tail
    let task = Task<T, Never> {
      await previous?.value
      return await work()
    }
    tail = Task { _ = await task.value }
    return await task.value
  }
}
