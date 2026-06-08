import { Stack } from "expo-router";
import { Text, View } from "react-native";

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#ff0000", padding: 24, justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
        Startup Error
      </Text>
      <Text style={{ color: "#fff", fontSize: 13 }}>
        {error?.message ?? String(error)}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#ff0000" }}>
      <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "700", padding: 60 }}>
        TEST - APP IS LOADING
      </Text>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
