import { registerRootComponent } from "expo";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const SITE_URL = "https://123mobiletrack.com";
const BRAND = "#1a2e1a";

// Runs before the page loads: lock the viewport to phone scale (no pinch-zoom /
// drifting), flag the native app so the site can hide web-only UI, and add
// app-like touch behavior (no text selection, no long-press callout, no bounce).
const BEFORE_LOAD_JS = `
(function() {
  window.isNativeApp = true;
  function lockViewport() {
    var m = document.querySelector('meta[name=viewport]');
    if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
    m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover');
  }
  function addAppCss() {
    var s = document.createElement('style');
    s.textContent = '*{ -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; } html,body{ overscroll-behavior:none; -webkit-text-size-adjust:100%; } input,textarea,[contenteditable]{ -webkit-user-select:text; user-select:text; }';
    (document.head || document.documentElement).appendChild(s);
  }
  lockViewport();
  if (document.head) addAppCss();
  else document.addEventListener('DOMContentLoaded', addAppCss);
})();
true;
`;

function App() {
  const webRef = React.useRef(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  function reload() {
    setError(false);
    setLoading(true);
    webRef.current?.reload();
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errTitle}>Can’t reach 123 Mobile Track</Text>
            <Text style={styles.errMsg}>Check your internet connection and try again.</Text>
            <TouchableOpacity style={styles.btn} onPress={reload}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <WebView
              ref={webRef}
              source={{ uri: SITE_URL }}
              style={styles.web}
              originWhitelist={["*"]}
              applicationNameForUserAgent="123MobileTrackApp/1.0"
              injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD_JS}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowsBackForwardNavigationGestures
              scalesPageToFit={false}
              bounces={false}
              overScrollMode="never"
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
              setSupportMultipleWindows={false}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
              onHttpError={() => setLoading(false)}
              renderLoading={() => <View />}
            />
            {loading && (
              <View style={styles.loading} pointerEvents="none">
                <ActivityIndicator size="large" color={BRAND} />
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  web: { flex: 1, backgroundColor: "#ffffff" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errTitle: { fontSize: 17, fontWeight: "700", color: BRAND, marginBottom: 8, textAlign: "center" },
  errMsg: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20 },
  btn: { backgroundColor: BRAND, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

registerRootComponent(App);
