import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { logout } from "../../lib/auth";
import { getUser, setGlobalUser } from "../_layout";
import { C } from "../../lib/colors";

function Row({ label, value, onPress, danger }: { label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = getUser();

  function handleLogout() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
          setGlobalUser(null);
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={styles.title}>Settings</Text>

        <Section title="Account">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Fleet server" value="123mobiletrack.com" />
        </Section>

        <Section title="Devices">
          <Row label="Add new device" onPress={() => router.push("/devices/add")} />
        </Section>

        <Section title="More">
          <Row label="Open web app" value="123mobiletrack.com" />
          <Row label="Sign out" onPress={handleLogout} danger />
        </Section>

        <Text style={styles.footer}>
          123 Mobile Track · Hardware GPS fleet tracking{"\n"}
          LilyGo T-SIM7000G · Netlify · 1NCE SIM
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.section}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cloud },
  title: { fontSize: 26, fontWeight: "800", color: C.ink, paddingVertical: 4 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: C.slate, textTransform: "uppercase", marginBottom: 6, marginLeft: 4 },
  section: { backgroundColor: C.white, borderRadius: 14, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line,
  },
  rowLabel: { fontSize: 15, color: C.ink },
  rowValue: { fontSize: 14, color: C.slate },
  danger: { color: C.red },
  footer: { fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 18, marginTop: 8 },
});
