import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchAlerts, fetchWorkspace, type FleetAlert, type Vehicle } from "../../lib/api";
import { getUser } from "../_layout";
import { C } from "../../lib/colors";

const SEVERITY_COLOR: Record<string, string> = {
  critical: C.red,
  warning: C.amber,
  info: C.forest,
};

const TYPE_EMOJI: Record<string, string> = {
  speeding: "🚨",
  geofence_enter: "📥",
  geofence_exit: "📤",
  hard_brake: "⚠️",
  rapid_accel: "⚡",
};

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<(FleetAlert & { vehicleName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = getUser();
      if (!user) return;
      try {
        const ws = await fetchWorkspace(user.token);
        const vehicles: Vehicle[] = ws.workspace?.vehicles ?? [];
        const assigned = vehicles.filter((v) => v.deviceAssignment);
        const all: (FleetAlert & { vehicleName: string })[] = [];
        await Promise.all(
          assigned.map(async (v) => {
            try {
              const res = await fetchAlerts(user.token, v.deviceAssignment!);
              for (const a of res.alerts ?? []) {
                all.push({ ...a, vehicleName: v.name });
              }
            } catch { /* skip */ }
          }),
        );
        all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setAlerts(all.slice(0, 100));
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Alerts</Text>

      {loading && <View style={styles.center}><ActivityIndicator color={C.forest} size="large" /></View>}

      {!loading && alerts.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptySub}>Speeding events and geofence crossings appear here.</Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: a }) => {
          const color = SEVERITY_COLOR[a.severity] ?? C.slate;
          const emoji = TYPE_EMOJI[a.type] ?? "ℹ️";
          const time = new Date(a.time).toLocaleString([], {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          });
          return (
            <View style={styles.card}>
              <View style={[styles.stripe, { backgroundColor: color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.emoji}>{emoji}</Text>
                  <Text style={[styles.alertTitle, { color }]}>{a.title}</Text>
                </View>
                <Text style={styles.meta}>{a.vehicleName} · {time}</Text>
                {a.speed_kph > 0 && (
                  <Text style={styles.detail}>{Math.round(a.speed_kph * 0.621371)} mph</Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cloud },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { fontSize: 26, fontWeight: "800", color: C.ink, paddingHorizontal: 16, paddingVertical: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.slate, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row", backgroundColor: C.white, borderRadius: 14, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  emoji: { fontSize: 18 },
  alertTitle: { fontSize: 15, fontWeight: "700", flex: 1 },
  meta: { fontSize: 12, color: C.slate },
  detail: { fontSize: 13, fontWeight: "600", color: C.ink },
});
