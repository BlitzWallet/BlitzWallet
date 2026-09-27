package com.blitzwallet.nwc

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.blitzwallet.R
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// Runs NWC pushes natively in the ":nwc" process: no React Native, no JS
// bundle. Started by NwcMessagingReceiver with the FCM message extras.
class NwcNativeService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val extras = intent?.extras
    if (extras == null) {
      stopSelf(startId)
      return START_NOT_STICKY
    }
    val received = SystemClock.elapsedRealtime()
    val wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "blitz:nwc")
      .apply { acquire(60_000) }
    scope.launch {
      try {
        val outcome = serial.withLock {
          Log.i(NWC_TAG, "push queued for ${SystemClock.elapsedRealtime() - received} ms")
          NwcHandler(this@NwcNativeService, received + 40_000, received + 50_000)
            .handle(extras.getString("body"))
        }
        when {
          outcome.handedOff -> fallBackToJs(extras, outcome.strings)
          outcome.notifyMethod != null -> notify(outcome.strings["title"], outcome.strings[outcome.notifyMethod!!])
        }
      } catch (e: Throwable) {
        // Throwable, not Exception: a native library that fails to load throws an
        // Error, and the JS path must still get the push.
        Log.e(NWC_TAG, "native handler crashed", e)
        fallBackToJs(extras, emptyMap())
      } finally {
        if (wakeLock.isHeld) wakeLock.release()
        stopSelf(startId)
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    Log.i(NWC_TAG, "native service stopped")
  }

  // The existing JS handler, exactly as RNFirebase would have started it. It
  // re-verifies the push and only processes events whose ledger status lets it
  // (the ones handed off here). If Android no longer lets us start it, the user
  // is asked to open the app, which drains the handoff queue.
  private fun fallBackToJs(extras: Bundle, strings: Map<String, String>) {
    try {
      val headless = Intent().setComponent(
        ComponentName(packageName, "io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService"),
      ).putExtra("message", RemoteMessage(extras))
      startService(headless)
      Log.i(NWC_TAG, "handed off to JS headless task")
    } catch (e: Exception) {
      Log.w(NWC_TAG, "JS headless start refused, asking user to open the app", e)
      notify(strings["title"], strings["openApp"] ?: "Open Blitz to finish this request")
    }
  }

  private fun notify(title: String?, body: String?) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    // Same channel the app registers for its notifications.
    if (manager.getNotificationChannel(CHANNEL) == null) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL, CHANNEL, NotificationManager.IMPORTANCE_HIGH))
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.mipmap.ic_stat_transparenticon)
      .setContentTitle(title ?: "Nostr Connect")
      .setContentText(body ?: "")
      .setAutoCancel(true)
      .apply {
        if (launch != null) {
          setContentIntent(
            android.app.PendingIntent.getActivity(
              this@NwcNativeService, 0, launch, android.app.PendingIntent.FLAG_IMMUTABLE,
            ),
          )
        }
      }
      .build()
    runCatching { manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification) }
  }

  companion object {
    private const val CHANNEL = "blitzWalletNotifications"

    // One push at a time: pushes share one Breez storage directory and ledger.
    private val serial = Mutex()
  }
}
