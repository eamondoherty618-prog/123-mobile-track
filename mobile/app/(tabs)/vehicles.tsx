import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchLatest, fetchWorkspace, type TrackerPacket, type Vehicle } from "../../lib/api";
import { getUser } from "../_layout";
import { C } from "../../lib/colors";

type VehicleRow = Vehicle & { tracker?: TrackerPacket; online: boolean };

export default function VehiclesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const user = getUser();
    if (!user) return;
    try {
      const [ws, latest] = await Promise.all([
        fetchWorkspace(user.token),
        fetchLatest(user.token),
      ]);
      const vehicles: Vehicle[] = ws.workspace?.vehicles ?? [];
      const packets = latest.devices ?? {};
      const result: VehicleRow[] = vehicles.map((v) => {
        const tracker = v.deviceAssignment ? packets[v.deviceAssignment] : undefined;
        const online = Boolean(tracker?.received_at && Date.now() - new Date(tracker.received_at).getTime() < 5 * 60 * 1000);
        return { ...v, tracker, online };
      });
      setRows(result);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={C.forest} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Vehicles</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push("/devices/add")}>
          <Text style={styles.addBtnLabel}>+ Add device</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No vehicles yet</Text>
          <Text style={styles.emptySub}>Add vehicles in the web app, then assign a tracker to each one.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item: v }) => {
            const speedMph = v.tracker?.has_fix
              ? Math.round(Number(v.tracker.gps?.speed_kph ?? 0) * 0.621371)
              : 0;
            const statusLabel = v.tracker?.has_fix
              ? v.tracker.motion_state === "moving" ? `${speedMph} mph` : "Stopped"
              : v.online ? "Online · no GPS fix" : v.tracker ? "Offline" : "No tracker";
            const statusColor = v.tracker?.has_fix ? C.forest : v.online ? C.amber : C.slate;

            return (
              <View style={styles.card}>
                <View style={styles.cardLeft}>
                  {v.photo
                    ? <Image source={{ uri: v.photo }} style={styles.photo} />
                    : <View style={styles.photoPlaceholder}><Text style={styles.photoEmoji}>🚐</Text></View>}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.vehicleName}>{v.name}</Text>
                  {(v.plate || v.make) && (
                    <Text style={styles.vehicleSub}>
                      {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                      {v.plate ? ` · ${v.plate}` : ""}
                    </Text>
                  )}
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                  {v.tracker?.firmware && (
                    <Text style={styles.firmware}>fw v{v.tracker.firmware}</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cloud },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  title: { flex: 1, fontSize: 26, fontWeight: "800", color: C.ink },
  addBtn: { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnLabel: { color: C.white, fontSize: 13, fontWeight: "600" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.slate, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row", backgroundColor: C.white, borderRadius: 14, padding: 14, gap: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardLeft: { justifyContent: "flex-start" },
  photo: { width: 52, height: 52, borderRadius: 10 },
  photoPlaceholder: {
    width: 52, height: 52, borderRadius: 10, backgroundColor: C.mint,
    alignItems: "center", justifyContent: "center",
  },
  photoEmoji: { fontSize: 24 },
  cardBody: { flex: 1, gap: 3 },
  vehicleName: { fontSize: 16, fontWeight: "700", color: C.ink },
  vehicleSub: { fontSize: 13, color: C.slate },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: "600" },
  firmware: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
});
