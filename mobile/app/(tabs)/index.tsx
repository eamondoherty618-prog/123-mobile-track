import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";

import { fetchLatest, fetchWorkspace, type TrackerPacket, type Vehicle } from "../../lib/api";
import { getUser } from "../_layout";
import { C } from "../../lib/colors";

type MarkerData = {
  deviceId: string;
  vehicleName: string;
  lat: number;
  lon: number;
  speedMph: number;
  isLive: boolean;
  lastTime?: string;
};

function isRecentReport(receivedAt: string | undefined): boolean {
  if (!receivedAt) return false;
  return Date.now() - new Date(receivedAt).getTime() < 5 * 60 * 1000;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [statusRows, setStatusRows] = useState<{ id: string; name: string; online: boolean; live: boolean; speedMph: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

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

      const newMarkers: MarkerData[] = [];
      const rows: typeof statusRows = [];

      for (const t of packets) {
        const vehicle = vehicles.find((v) => v.deviceAssignment === t.device_id);
        const name = vehicle?.name ?? t.device_id;
        const live = Boolean(t.has_fix && t.gps?.lat && t.gps?.lon);
        const hasLast = !live && Boolean(t.last_gps?.lat && t.last_gps?.lon);
        const online = isRecentReport(t.received_at);
        const speedMph = live ? Math.round(Number(t.gps?.speed_kph ?? 0) * 0.621371) : 0;

        rows.push({ id: t.device_id, name, online, live, speedMph });

        if (live) {
          newMarkers.push({
            deviceId: t.device_id,
            vehicleName: name,
            lat: Number(t.gps!.lat),
            lon: Number(t.gps!.lon),
            speedMph,
            isLive: true,
          });
        } else if (hasLast) {
          newMarkers.push({
            deviceId: t.device_id,
            vehicleName: name,
            lat: Number(t.last_gps!.lat),
            lon: Number(t.last_gps!.lon),
            speedMph: 0,
            isLive: false,
            lastTime: t.last_gps?.time,
          });
        }
      }

      setMarkers(newMarkers);
      setStatusRows(rows);

      if (newMarkers.length > 0 && mapRef.current) {
        const coords = newMarkers.map((m) => ({ latitude: m.lat, longitude: m.lon }));
        mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 80, right: 40, bottom: 200, left: 40 }, animated: true });
      }
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

  return (
    <View style={{ flex: 1, backgroundColor: C.cloud }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ latitude: 40.735, longitude: -74.172, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        showsUserLocation={false}
        showsCompass
      >
        {markers.map((m) => (
          <Marker
            key={m.deviceId}
            coordinate={{ latitude: m.lat, longitude: m.lon }}
            pinColor={m.isLive ? C.navy : C.slate}
            opacity={m.isLive ? 1 : 0.5}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{m.vehicleName}</Text>
                <Text style={styles.calloutSub}>
                  {m.isLive
                    ? m.speedMph > 3 ? `${m.speedMph} mph · Live GPS` : "Stopped · Live GPS"
                    : `Last known · ${m.lastTime ? new Date(m.lastTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "unknown"}`}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <SafeAreaView pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Live Fleet</Text>
          {loading && <ActivityIndicator size="small" color={C.forest} style={{ marginLeft: 8 }} />}
          <Pressable style={styles.addBtn} onPress={() => router.push("/devices/add")}>
            <Text style={styles.addBtnLabel}>+ Add device</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Status strip at bottom */}
      <View style={styles.strip} pointerEvents="none">
        {statusRows.length === 0 ? (
          <Text style={styles.stripEmpty}>No trackers online yet · take one outside for GPS</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripScroll}>
            {statusRows.map((row) => (
              <View key={row.id} style={styles.stripItem}>
                <View style={[styles.dot, row.live ? styles.dotLive : row.online ? styles.dotOnline : styles.dotOff]} />
                <Text style={styles.stripName}>{row.name}</Text>
                <Text style={styles.stripSub}>
                  {row.live ? (row.speedMph > 3 ? `${row.speedMph} mph` : "stopped") : row.online ? "no fix" : "offline"}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", margin: 16,
    backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: C.ink },
  addBtn: { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnLabel: { color: C.white, fontSize: 13, fontWeight: "600" },
  callout: { minWidth: 140, padding: 4 },
  calloutTitle: { fontSize: 14, fontWeight: "700", color: C.ink },
  calloutSub: { fontSize: 12, color: C.slate, marginTop: 2 },
  strip: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(255,255,255,0.95)", paddingTop: 12, paddingBottom: 32, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  stripEmpty: { fontSize: 13, color: C.slate, textAlign: "center" },
  stripScroll: { gap: 20, paddingRight: 16 },
  stripItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLive: { backgroundColor: C.navy },
  dotOnline: { backgroundColor: C.amber },
  dotOff: { backgroundColor: "#cbd5e1" },
  stripName: { fontSize: 13, fontWeight: "600", color: C.ink },
  stripSub: { fontSize: 12, color: C.slate },
});
