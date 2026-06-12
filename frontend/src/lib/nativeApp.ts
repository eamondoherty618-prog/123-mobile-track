// True when the web app is running inside the native iOS/Android shell
// (the WebView sets window.isNativeApp and appends "123MobileTrackApp" to the UA).
// Used to hide web-only UI like the PWA install banner and Web Push settings,
// which don't work inside a native WebView.
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { isNativeApp?: boolean };
  if (w.isNativeApp) return true;
  return /123MobileTrackApp/i.test(window.navigator.userAgent);
}
