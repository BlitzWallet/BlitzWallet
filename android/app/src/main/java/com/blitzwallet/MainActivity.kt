package com.blitzwallet

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. 
   * This is used to schedule rendering of the component.
   */
  override fun getMainComponentName(): String = "BlitzWallet"

  /**
   * For react-native-screens
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    // Must run before super.onCreate(): ReactActivity calls setContentView()
    // inside super.onCreate(), and installSplashScreen() applies
    // postSplashScreenTheme (AppTheme) — which must be the active AppCompat
    // theme before setContentView, otherwise AppCompat throws.
    SplashScreenManager.registerOnActivity(this)
    // expo-splash-screen auto-hides the splash on React's CONTENT_APPEARED marker
    // unless preventAutoHideCalled is true. The JS preventAutoHideAsync() is an
    // AsyncFunction (bridge-queued), so it can lose the race against CONTENT_APPEARED —
    // which fires on our first (empty) provider-tree commit while theme/darkModeType are
    // still loading from async storage. Auto-hiding then tears down the splash before any
    // real pixels exist, exposing the black Fabric surface (intermittently). Setting the
    // flag here, synchronously before any marker can fire, makes the splash stay until JS
    // calls hideAsync() (gated on real content paint). hideAsync() is now mandatory.
    SplashScreenManager.preventAutoHideCalled = true
    super.onCreate(savedInstanceState)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. 
   * We use [DefaultReactActivityDelegate] which allows 
   * you to enable New Architecture with a single boolean flag [fabricEnabled].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
      )
}
