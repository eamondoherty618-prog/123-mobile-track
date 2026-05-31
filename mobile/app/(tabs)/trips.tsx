import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchTrips, fetchWorkspace, type Trip, type Vehicle } from "../../lib/api";
import { getUser } from "../_layout";
import { C } from "../../lib/colors";

function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TripsScreen() {
  const [trips, setTrips] = useState<(Trip & { vehicleName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const user = getUser();
      if (!user) return;
      try {
        const ws = await fetchWorkspace(user.token);
        const vehicles: Vehicle[] = ws.workspace?.vehicles ?? [];
        const assigned = vehicles.filter((v) => v.deviceAssignment);
        const all: (Trip & { vehicleName: string })[] = [];
        await Promise.all(
          assigned.map(async (v) => {
            try {
              const res = await fetchTrips(user.token, v.deviceAssignment!);
              for (const t of res.trips ?? []) {
                all.push({ ...t, vehicleName: v.name });
              }
            } catch {
              // skip device
            }
          }),
        );
        all.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        setTrips(all);
      } catch {
        setError("Could not load trips.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Trips</Text>

      {loading && <View style={styles.center}><ActivityIndicator color={C.forest} size="large" /></View>}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && !error && trips.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No trips recorded yet</Text>
          <Text style={styles.emptySub}>Trips appear once a tracker moves over 4 km/h for at least a minute.</Text>
        </View>
      )}

      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: t }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.vehicleName}>{t.vehicleName}</Text>
              <Text style={styles.date}>{fmtDate(t.start_time)}</Text>
            </View>
            <View style={styles.statsRow}>
              <StatPill label="Distance" value={`${t.distance_km.toFixed(1)} km`} />
              <StatPill label="Duration" value={fmtDuration(t.duration_s)} />
              <StatPill label="Top speed" value={`${Math.round(t.max_speed_kph * 0.621371)} mph`} />
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cloud },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { fontSize: 26, fontWeight: "800", color: C.ink, paddingHorizontal: 16, paddingVertical: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.slate, textAlign: "center", lineHeight: 20 },
  errorText: { color: C.red, padding: 16 },
  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  vehicleName: { fontSize: 15, fontWeight: "700", color: C.ink },
  date: { fontSize: 12, color: C.slate },
  statsRow: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, backgroundColor: C.cloud, borderRadius: 10, padding: 10, alignItems: "center" },
  pillLabel: { fontSize: 10, fontWeight: "600", color: C.slate, textTransform: "uppercase", marginBottom: 2 },
  pillValue: { fontSize: 14, fontWeight: "700", color: C.ink },
});
