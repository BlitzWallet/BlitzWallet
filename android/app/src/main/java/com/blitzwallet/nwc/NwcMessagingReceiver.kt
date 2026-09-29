package com.blitzwallet.nwc

import android.content.Context
import android.content.Intent
import android.util.Log
import io.invertase.firebase.common.SharedUtils
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingReceiver
import org.json.JSONObject

// Replaces RNFirebase's FCM receiver (see AndroidManifest). NWC pushes that
// arrive while the app is not in the foreground go to the native handler in the
// ":nwc" process instead of booting React Native in a headless task. Everything
// else, and anything the native service cannot start for, keeps the RNFirebase
// path unchanged.
class NwcMessagingReceiver : ReactNativeFirebaseMessagingReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val extras = intent.extras
    if (extras != null && isNwcRequest(extras.getString("body")) && !SharedUtils.isAppInForeground(context)) {
      try {
        context.startService(Intent(context, NwcNativeService::class.java).putExtras(extras))
        Log.i(NWC_TAG, "NWC push routed to native handler")
        return
      } catch (e: IllegalStateException) {
        Log.w(NWC_TAG, "native handler start refused, using JS path", e)
      }
    }
    super.onReceive(context, intent)
  }

  private fun isNwcRequest(body: String?) =
    body != null && runCatching { JSONObject(body).has("events") }.getOrDefault(false)
}
