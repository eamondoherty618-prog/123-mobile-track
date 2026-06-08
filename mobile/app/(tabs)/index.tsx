import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { fetchLatest, fetchWorkspace, type TrackerPacket, type Vehicle } from "../../lib/api";
import { getUser } from "../_layout";
import { C } from "../../lib/colors";

type TrackerRow = {
  deviceId: string;
  vehicleName: string;
  online: boolean;
  live: boolean;
  speedMph: number;
  lat?: number;
  lon?: number;
  lastTime?: string;
  firmware?: string;
  batteryMv?: number;
};

function isRecent(receivedAt: string | undefined): boolean {
  if (!receivedAt) return false;
  return Date.now() - new Date(receivedAt).getTime() < 35 * 60 * 1000;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function batteryPct(mv: number | undefined): string {
  if (!mv) return "";
  const pct = Math.max(0, Math.min(100, Math.round(((mv - 3300) / 900) * 100)));
  return `${pct}%`;
}

export default function FleetScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const user = getUser();
    if (!user) return;
    try {
      const [latest, ws] = await Promise.all([
        fetchLatest(user.token),
        fetchWorkspace(user.token),
      ]);
      const vehicles: Vehicle[] = ws.workspace?.vehicles ?? [];
      const packets = Object.values(latest.devices ?? {}) as TrackerPacket[];

      const result: TrackerRow[] = packets.map((t) => {
        const vehicle = vehicles.find((v) => v.deviceAssignment === t.device_id);
        const live = Boolean(t.has_fix && t.gps?.lat && t.gps?.lon);
        const speedMph = live ? Math.round(Number(t.gps?.speed_kph ?? 0) * 0.621371) : 0;
        const lastGps = t.last_gps;
        return {
          deviceId: t.device_id,
          vehicleName: vehicle?.name ?? t.device_id,
          online: isRecent(t.received_at),
          live,
          speedMph,
          lat: live ? Number(t.gps!.lat) : (lastGps ? Number(lastGps.lat) : undefined),
          lon: live ? Number(t.gps!.lon) : (lastGps ? Number(lastGps.lon) : undefined),
          lastTime: t.received_at,
          firmware: t.firmware,
          batteryMv: t.battery_mv,
        };
      });

      result.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
      setRows(result);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const onlineCount = rows.filter((r) => r.online).length;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Fleet</Text>
          <Text style={styles.subtitle}>
            {loading ? "Loading…" : `${onlineCount} of ${rows.length} online`}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => router.push("/devices/add")}>
          <Text style={styles.addBtnLabel}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.forest} size="large" />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No trackers found</Text>
          <Text style={styles.emptySub}>Add a device to start tracking your fleet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {rows.map((r) => (
            <View key={r.deviceId} style={[styles.card, !r.online && styles.cardOffline]}>
              <View style={styles.cardTop}>
                <View style={[styles.dot,
                  r.live ? styles.dotLive : r.online ? styles.dotOnline : styles.dotOff]} />
                <Text style={styles.name}>{r.vehicleName}</Text>
                <Text style={[styles.status,
                  { color: r.live ? C.forest : r.online ? C.amber : "#94a3b8" }]}>
                  {r.live
                    ? r.speedMph > 3 ? `${r.speedMph} mph` : "Stopped"
                    : r.online ? "Online · no GPS" : "Offline"}
                </Text>
              </View>

              <View style={styles.cardMeta}>
                {r.lat != null && r.lon != null && (
                  <Text style={styles.meta}>
                    📍 {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
                    {!r.live && " (last known)"}
                  </Text>
                )}
                {r.lastTime && (
                  <Text style={styles.meta}>🕐 {fmtTime(r.lastTime)}</Text>
                )}
                {r.batteryMv != null && r.batteryMv > 0 && (
                  <Text style={styles.meta}>🔋 {batteryPct(r.batteryMv)}</Text>
                )}
                {r.firmware && (
                  <Text style={styles.meta}>fw {r.firmware}</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cloud },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  title: { fontSize: 26, fontWeight: "800", color: C.ink },
  subtitle: { fontSize: 13, color: C.slate, marginTop: 2 },
  addBtn: { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnLabel: { color: C.white, fontSize: 13, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.slate, textAlign: "center", lineHeight: 20 },
  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardOffline: { opacity: 0.65 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLive: { backgroundColor: C.forest },
  dotOnline: { backgroundColor: C.amber },
  dotOff: { backgroundColor: "#cbd5e1" },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: C.ink },
  status: { fontSize: 13, fontWeight: "600" },
  cardMeta: { gap: 3, paddingLeft: 18 },
  meta: { fontSize: 12, color: C.slate },
});
