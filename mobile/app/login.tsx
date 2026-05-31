import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { login, signup } from "../lib/auth";
import { C } from "../lib/colors";
import { setGlobalUser } from "./_layout";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const user = mode === "login" ? await login(email, password) : await signup(email, password);
      setGlobalUser(user);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>123 Mobile Track</Text>
        <Text style={styles.sub}>Fleet management · Powered by hardware GPS</Text>

        <View style={styles.segmented}>
          {(["login", "signup"] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.seg, mode === m && styles.segActive]}
              onPress={() => { setMode(m); setError(""); }}
            >
              <Text style={[styles.segLabel, mode === m && styles.segLabelActive]}>
                {m === "login" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.slate}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.slate}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.btnLabel}>{mode === "login" ? "Sign in" : "Create account"}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.forest, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, backgroundColor: C.white, borderRadius: 20, padding: 28, gap: 14 },
  logo: { fontSize: 22, fontWeight: "800", color: C.forest, textAlign: "center" },
  sub: { fontSize: 13, color: C.slate, textAlign: "center", marginTop: -8 },
  segmented: { flexDirection: "row", backgroundColor: C.cloud, borderRadius: 10, padding: 4, gap: 4 },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segActive: { backgroundColor: C.white },
  segLabel: { fontSize: 14, fontWeight: "600", color: C.slate },
  segLabelActive: { color: C.ink },
  input: {
    height: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, color: C.ink, backgroundColor: C.cloud,
  },
  error: { fontSize: 13, color: C.red, textAlign: "center" },
  btn: { height: 50, backgroundColor: C.forest, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnDisabled: { opacity: 0.6 },
  btnLabel: { color: C.white, fontSize: 16, fontWeight: "700" },
});
