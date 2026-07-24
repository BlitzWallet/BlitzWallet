package com.blitzwallet.deeplink

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.Intent
import android.app.Activity
import com.blitzwallet.MainActivity

class DeepLinkIntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DeepLinkIntentModule"
    }

    // True when the current intent was already delivered to a prior activity
    // instance (recents/icon relaunch after process death, config-change
    // recreation), as opposed to a genuine new link tap. Primary signal is
    // MainActivity.launchIntentIsHistorical (savedInstanceState-based — works
    // on every launch path and OEM); FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY is
    // kept as belt-and-braces. Must be read before clearIntent().
    @ReactMethod
    fun isLaunchedFromHistory(promise: Promise) {
        val intent: Intent? = reactApplicationContext.currentActivity?.intent
        val fromHistoryFlag = intent != null &&
            (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0
        promise.resolve(MainActivity.launchIntentIsHistorical || fromHistoryFlag)
    }

    @ReactMethod
    fun clearIntent() {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity != null) {
            activity.runOnUiThread {
                val newIntent = Intent()
                // Replace the existing intent with an empty one so it is not handled twice.
                activity.intent = newIntent
                println("DeepLinkIntentModule: Cleared Android Intent Data.")
            }
        }
    }
}