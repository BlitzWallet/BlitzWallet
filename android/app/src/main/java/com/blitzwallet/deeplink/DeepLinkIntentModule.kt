package com.blitzwallet.deeplink

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.content.Intent
import android.app.Activity

class DeepLinkIntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DeepLinkIntentModule"
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