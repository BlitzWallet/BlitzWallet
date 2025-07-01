import UIKit
import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    var window: UIWindow?
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        window = UIWindow(windowScene: windowScene)
        
        // Get the shared AppDelegate and its factory
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
           let factory = appDelegate.reactNativeFactory {
            
            // Handle initial URL from launch
            var launchOptions: [String: Any]? = nil
            if let url = connectionOptions.urlContexts.first?.url {
                launchOptions = ["url": url]
            }
            
            factory.startReactNative(
                withModuleName: "BlitzWallet",
                in: window,
                launchOptions: launchOptions
            )
        }
    }
    
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {}
    
    func sceneDidBecomeActive(_ scene: UIScene) {}
    
    func sceneWillResignActive(_ scene: UIScene) {}
    
    func sceneWillEnterForeground(_ scene: UIScene) {}
    
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
