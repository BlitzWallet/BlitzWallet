package com.blitzwallet.nwc

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingReceiver

// Debug builds only. adb cannot send FCM broadcasts, so scripts/nwc-native-e2e.mjs
// delivers the push body (base64, `body64` extra) here and it goes through the
// same receiver FCM uses (`js` = true: the previous RNFirebase headless-JS path,
// for before/after measurements). The script puts the app on the temporary
// power allowlist first, as a high-priority FCM message does.
class NwcDebugPushReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val body = String(Base64.decode(intent.getStringExtra("body64") ?: return, Base64.DEFAULT))
    val push = Intent().putExtra("body", body)
    if (intent.getBooleanExtra("js", false)) {
      ReactNativeFirebaseMessagingReceiver().onReceive(context, push)
    } else {
      NwcMessagingReceiver().onReceive(context, push)
    }
  }
}
