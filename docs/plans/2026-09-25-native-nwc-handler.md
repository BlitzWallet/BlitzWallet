# Native NWC background handler

Goal: handle incoming NWC (NIP-47) pushes natively (iOS Notification Service
Extension, Android native service) with the Breez Spark SDK, without starting
React Native. The existing JS handler stays as the fallback.

## Current path (traced)

| Step | iOS | Android |
| --- | --- | --- |
| Push | Expo silent push (`_contentAvailable`, data `{count, events[]}`) | Expo data-only FCM, high priority |
| Receipt | `expo-notifications` background task → `index.background.js` TaskManager task | RNFirebase `ReactNativeFirebaseMessagingReceiver` (c2dm broadcast) → `HeadlessJsTaskService` |
| Wakes | whole app process: `AppDelegate` starts the RN factory, loads JS bundle | RN host + JS bundle in a headless task |
| Before NWC code | full JS bundle eval (`index.js` → `App` registration, polyfills, i18n) | same |
| Wallet init | `SparkWallet.initialize` (JS Spark SDK, full leaf sync) / `SparkReadonlyClient` | same |
| Handler | `app/functions/nwc/backgroundNofifications.js` `handleNWCBackgroundEvent` | same |
| State | NWC secrets in SecureStore, account settings in AsyncStorage, ledger + invoice cache in expo-sqlite | same |

iOS silent pushes are also throttled and never delivered after a user
force-quits the app, so the old iOS path is unreliable exactly when it matters.

## New path

```
push ─► native handler ─► load shared state ─► Breez Spark (server mode) ─► respond
            │ can't complete safely
            └─► hand off: ledger row status 'handoff' + raw event ─► existing JS handler
```

- iOS: `ios/NotificationService` NSE. Backend sends a `mutable-content` alert
  push (no `content-available`) to devices that advertise
  `pushNotifications.nativeHandler` in their Firestore `NWC` doc; older app
  versions keep receiving the old silent push.
- Android: `BlitzNwcMessagingReceiver` replaces the RNFirebase receiver. App in
  foreground → existing JS path (runtime already up). Otherwise → `NwcNativeService`
  in the separate `:nwc` process (no React Native). Fallback starts the RNFirebase
  headless service with the original message.

## Shared state (single authority)

| State | Location | Written by |
| --- | --- | --- |
| NWC service keys (`NWC_SECURE_STORE_KEY`), NWC wallet mnemonic | existing SecureStore items (iOS shared keychain group `38WX44YTA6.com.blitzwallet.SharedKeychain`, already `AFTER_FIRST_UNLOCK`) | JS (unchanged) |
| Account permissions / budget settings, Breez API key, relay, localized strings | `nwc/native_config.json` in the shared dir | JS (`writeNativeNWCConfig`) |
| Event claims, budget spend state, handoff queue | `nwc_event_ledger.db` | JS + native |
| Invoice / payment cache | `nwc_invoices.db` | JS + native |

Shared dir: iOS App Group `group.com.blitzwallet.application/nwc` (DBs migrated
from `Documents/SQLite` once); Android the default expo-sqlite dir. The native
Android handler runs in its own process so the system SQLite and expo-sqlite's
bundled SQLite never share one process (POSIX lock loss). Rollback journal only
(no WAL) so no lock is held while the iOS app is suspended.

## Idempotency

- Claim = `INSERT OR IGNORE` into `handled_events` (same as JS). Native never
  reclaims; JS reclaims only `handoff` rows or native rows abandoned > 60 s.
- Native stores the raw event in `nwc_handoff` at claim time, deletes it when it
  reaches `done`/`failed`. A killed NSE/process therefore leaves a recoverable row.
- `pay_invoice`: budget reserved and a pending OUTGOING marker keyed by
  `payment_hash` written before sending (same as JS). Once a send starts, the
  event is never handed off or retried; any later attempt hits the marker.
- Response publish failure after a completed payment → event `done`; a client
  retry gets the stored preimage from the marker.

## Budget (shared across processes)

JS, the Android `:nwc` process and the iOS extension each pay from the same
`nwc_ledger_state` row with no shared lock, so the spend total is only ever
changed by single atomic statements (`reserveSpend` / `adjustSpend`, same SQL in
all three):

- Reserve: `UPDATE … SET budget_sent_msat = budget_sent_msat + ? WHERE … AND
  (? IS NULL OR budget_sent_msat + ? <= ?)`; pay only if one row changed.
- An expired window is reset by compare-and-swap on `window_start`, so only one
  payer resets it.
- Release / settle are relative (`+ actual - reserved`, `- reserved`), scoped to
  the window reserved in; no handler writes an absolute total.

`get_info` and the info event (kind 13194) advertise `notifications`
(`payment_sent` only) and `encryption`. The info event only changes for
connections created or edited after this.

## Failure classification

| Failure | Result |
| --- | --- |
| Bad structure / stale / wrong signer / bad signature / undecryptable | rejected (same as JS) |
| Duplicate event | skipped |
| Config or keychain unavailable, Breez init/sync failure, deadline before send | handoff to JS |
| Payment failed before leaving | error response, reservation released |
| Deadline or crash after send started | marker stays pending; never retried blindly |

## Verification

Done (repeatable):

- Crypto conformance, both platforms, same vectors
  (`android/app/src/test/resources/nwc-crypto-vectors.json`: official NIP-44 set +
  nostr-tools NIP-04 / NIP-01 id / Schnorr cases): `ios/NotificationServiceTests/run.sh`
  (121/121) and `NwcCryptoTest` (JVM).
- Ledger contract native ↔ JS on real SQLite, incl. the drain running a handed-off
  event through the JS handler once: `__tests__/functions/nwc/nativeHandoffContract.test.js`.
- Budget reservations native ↔ JS on real SQLite (no over-spend, no erased spend,
  single window reset): same contract test.
- iOS extension type-checks and links for the simulator against Breez 0.26.0 +
  libsecp256k1; Android `nwc` package compiles against Breez 0.26.0 + secp256k1-kmp.

Needs a device (not possible from the agent sandbox):

1. `cd ios && pod install`, then build. The extension needs a provisioning profile for
   `org.reactjs.native.example.BlitzWallet.NotificationService` with the App Group and
   the `com.blitzwallet.SharedKeychain` keychain group.
2. Android: debug build on an emulator/device with an NWC connection, then
   `node scripts/nwc-native-e2e.mjs "<connection uri>"` (native path) and the same with
   `--js` (previous path). Artifacts land in `e2e-artifacts/nwc-native/`: per-method
   results + latency, native timing log lines, and the React-Native-never-started check.
3. iOS on a physical device (APNs + NSE don't run in the simulator): foreground,
   background, force-quit, locked; watch Console.app (device selected, search
   `subsystem:com.blitzwallet.nwc`).
4. Deploy NWC-Backend (`processBulkNotifications` sends the NSE format to iOS apps that
   advertise `nativeHandler`).

Config: the native handlers use `BREEZ_SPARK_API_KEY` from `.env`, falling back to
`LIQUID_BREEZ_KEY`. Without a key only `get_info` runs natively; the rest hands off.
