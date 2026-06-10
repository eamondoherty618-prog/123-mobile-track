internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    NSLog("AppDelegate: start")
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    NSLog("AppDelegate: creating window")
    window = UIWindow(frame: UIScreen.main.bounds)
    NSLog("AppDelegate: calling startReactNative")
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    NSLog("AppDelegate: startReactNative done, rootVC=\(String(describing: window?.rootViewController))")
    window?.makeKeyAndVisible()
    NSLog("AppDelegate: makeKeyAndVisible done")
#endif

    NSLog("AppDelegate: calling super")
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    NSLog("AppDelegate: super returned \(result)")
    return result
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    NSLog("ReactNativeDelegate: sourceURL called")
    return bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    NSLog("ReactNativeDelegate: bundleURL=\(String(describing: url))")
    return url
#endif
  }
}
