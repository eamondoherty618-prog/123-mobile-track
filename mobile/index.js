import { registerRootComponent } from "expo";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const SITE_URL = "https://123mobiletrack.com";
const BRAND = "#1a2e1a";

function App() {
  const webRef = React.useRef(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);

  // Android hardware back navigates the WebView instead of closing the app.
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
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowsBackForwardNavigationGestures
              pullToRefreshEnabled
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
