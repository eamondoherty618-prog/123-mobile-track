internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  private var _bridge: RCTBridge?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // iOS 26 workaround: ExpoReactNativeFactory uses RCTHost which never calls
    // host:didInitializeRuntime: on iOS 26, preventing the JS runtime from starting.
    // Use RCTBridge directly (legacy bridge) which works on all iOS versions.
    let bridgeDelegate = LegacyBridgeDelegate()
    _bridge = RCTBridge(delegate: bridgeDelegate, launchOptions: launchOptions)

    if let bridge = _bridge {
      let rootView = RCTRootView(bridge: bridge, moduleName: "main", initialProperties: nil)
      rootView.backgroundColor = UIColor(red: 0.1, green: 0.18, blue: 0.1, alpha: 1)

      let rootVC = UIViewController()
      rootVC.view = rootView

      window = UIWindow(frame: UIScreen.main.bounds)
      window?.rootViewController = rootVC
      window?.makeKeyAndVisible()
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

private class LegacyBridgeDelegate: NSObject, RCTBridgeDelegate {
  func sourceURL(for bridge: RCTBridge!) -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
