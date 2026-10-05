package com.blitzwallet
import android.content.res.Configuration
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import android.os.Process
import android.util.Log
import com.blitzwallet.deeplink.DeepLinkIntentModulePackage
import com.blitzwallet.nwc.NWC_TAG
import com.google.firebase.FirebaseApp
import kotlin.system.exitProcess

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      ReactNativeHostWrapper(this, object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(DeepLinkIntentModulePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      })

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // The native NWC handler process (nwc/NwcNativeService) never runs React Native.
    // FirebaseInitProvider only runs in the main process; without this, Java
    // crashes in :nwc never reach Crashlytics.
    if (getProcessName().endsWith(":nwc")) {
      // Set before Firebase: Crashlytics wraps this handler, records the crash,
      // then calls it. Exiting here instead of through Android's handler skips
      // the "keeps stopping" dialog a repeat crash would show for the whole app.
      // Native crashes (signals) still go through the system and aren't reported
      // (crashlytics-ndk is excluded in app/build.gradle).
      Thread.setDefaultUncaughtExceptionHandler { _, e ->
        Log.e(NWC_TAG, ":nwc crashed", e)
        Process.killProcess(Process.myPid())
        exitProcess(10)
      }
      FirebaseApp.initializeApp(this)
      return
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
