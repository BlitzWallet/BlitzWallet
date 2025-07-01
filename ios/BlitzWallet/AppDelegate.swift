import UIKit
import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase

@main
class AppDelegate: ExpoAppDelegate {
    // Keep window property for compatibility with Expo framework
    var window: UIWindow? {
        get {
            // Return the window from the active scene
            guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let sceneDelegate = windowScene.delegate as? SceneDelegate else {
                return nil
            }
            return sceneDelegate.window
        }
        set {
            // Allow setting for compatibility, but we'll manage it in SceneDelegate
        }
    }
    
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?
    
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        
        let delegate = ReactNativeDelegate()
        let factory = ExpoReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()
        reactNativeDelegate = delegate
        reactNativeFactory = factory
        bindReactNativeFactory(factory)
        
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
    
    // MARK: UISceneSession Lifecycle
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
    
    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {}
    
    // Keep URL handling for fallback
    override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        return RCTLinkingManager.application(app, open: url, options: options)
    }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? {
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
