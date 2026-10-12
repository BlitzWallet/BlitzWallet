import UIKit
import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Add me --- \/
    FirebaseApp.configure()
    // Add me --- /\
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    
    // The window and React Native are started in SceneDelegate (iOS 27 requires the UIScene lifecycle).

    // A silent push that relaunches a terminated app connects no scene, so start React Native
    // in an offscreen window here so BACKGROUND-NOTIFICATION-TASK can run. SceneDelegate adopts
    // this root view controller if the user opens the app. applicationState can't be used as the
    // gate: under scenes it reads .background here even for normal launches.
    if launchOptions?[.remoteNotification] != nil {
      let window = UIWindow(frame: UIScreen.main.bounds)
      self.window = window
      factory.startReactNative(
        withModuleName: "BlitzWallet",
        in: window,
        launchOptions: launchOptions
      )
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    // iOS can disconnect a background scene while the process (and React Native) stays alive.
    // On reconnect, reuse the running app and deliver any link as a normal 'url' event,
    // because launchOptions are only read when React Native first starts.
    if let rootViewController = appDelegate.window?.rootViewController {
      appDelegate.window?.rootViewController = nil
      window.rootViewController = rootViewController
      window.makeKeyAndVisible()
      appDelegate.window = window
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
      if let activity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
        self.scene(scene, continue: activity)
      }
      return
    }
    appDelegate.window = window

    // With scenes, launch URLs arrive here instead of in didFinishLaunching's launchOptions.
    // Rebuild them so Linking.getInitialURL() keeps working on cold start.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
      // RCTLinkingManager.getInitialURL checks the type key before reading the activity.
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "BlitzWallet",
      in: window,
      launchOptions: launchOptions
    )
  }

  // With scenes, UIKit no longer calls the AppDelegate open-url / continue-activity methods.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
