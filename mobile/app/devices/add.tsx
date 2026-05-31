import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { claimDevice, fetchPendingDevices, fetchWorkspace, type Vehicle } from "../../lib/api";
import { getUser } from "../_layout";
import { C } from "../../lib/colors";

type Step = "scan" | "select" | "name" | "done";

export default function AddDeviceScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("scan");
  const [pending, setPending] = useState<{ hardware_id: string; created_at: string }[]>([]);
  const [selectedHw, setSelectedHw] = useState("");
  const [manualHw, setManualHw] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [doneDeviceId, setDoneDeviceId] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unassigned = vehicles.filter((v) => !v.deviceAssignment);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadData() {
    const user = getUser();
    if (!user) return;
    try {
      const [pendingRes, wsRes] = await Promise.all([
        fetchPendingDevices(user.token),
        fetchWorkspace(user.token),
      ]);
      setPending(pendingRes.pending ?? []);
      setVehicles(wsRes.workspace?.vehicles ?? []);
    } catch { /* non-fatal */ }
  }

  function selectDevice(hw: string) {
    setSelectedHw(hw);
    setStep("name");
  }

  async function claim() {
    const hw = selectedHw || manualHw.trim();
    if (!hw) return;
    const user = getUser();
    if (!user) return;

    setClaiming(true);
    setError("");
    try {
      const usingExisting = selectedVehicleId && selectedVehicleId !== "__new__";
      const res = await claimDevice(user.token, hw, usingExisting
        ? { vehicle_id: selectedVehicleId }
        : { device_name: newVehicleName.trim() || `tracker-${hw.slice(-4)}` });
      if (!res.ok) { setError(res.error ?? "Claim failed"); return; }
      setDoneDeviceId(res.device_id ?? hw);
      setStep("done");
    } catch {
      setError("Network error — try again.");
    } finally {
      setClaiming(false);
    }
  }

  const claimReady = (() => {
    const hw = selectedHw || manualHw.trim();
    if (!hw) return false;
    if (unassigned.length > 0) {
      if (!selectedVehicleId) return false;
      if (selectedVehicleId === "__new__") return newVehicleName.trim().length > 0;
      return true;
    }
    return newVehicleName.trim().length > 0;
  })();

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>

        {step === "scan" && (
          <>
            <Text style={styles.heading}>Looking for nearby trackers…</Text>
            <Text style={styles.sub}>
              Power on a new tracker. It will broadcast a WiFi network starting with <Text style={styles.mono}>123Track-</Text> and appear below within 30 seconds.
            </Text>

            {pending.length === 0 ? (
              <View style={styles.scanningCard}>
                <ActivityIndicator color={C.forest} />
                <Text style={styles.scanningLabel}>Scanning every 10 seconds</Text>
              </View>
            ) : (
              pending.map((p) => (
                <Pressable key={p.hardware_id} style={styles.deviceCard} onPress={() => selectDevice(p.hardware_id)}>
                  <View style={styles.deviceCardLeft}>
                    <Text style={styles.deviceCardTitle}>New tracker ready</Text>
                    <Text style={styles.deviceCardHw}>{p.hardware_id}</Text>
                    <Text style={styles.deviceCardTime}>
                      Detected {Math.round((Date.now() - new Date(p.created_at).getTime()) / 60000)} min ago
                    </Text>
                  </View>
                  <Text style={styles.deviceCardArrow}>›</Text>
                </Pressable>
              ))
            )}

            <Text style={styles.orLabel}>— or enter hardware ID manually —</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 884112088304"
                placeholderTextColor={C.slate}
                value={manualHw}
                onChangeText={setManualHw}
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.continueBtn, !manualHw.trim() && styles.btnDisabled]}
                disabled={!manualHw.trim()}
                onPress={() => { setSelectedHw(""); setStep("name"); }}
              >
                <Text style={styles.continueBtnLabel}>Continue</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === "name" && (
          <>
            <Text style={styles.heading}>Assign this tracker</Text>
            <Text style={styles.hwLabel}>HW: <Text style={styles.mono}>{selectedHw || manualHw}</Text></Text>

            {unassigned.length > 0 ? (
              <>
                <Text style={styles.sub}>Assign to an existing vehicle or create a new one.</Text>
                <View style={styles.pickerWrap}>
                  {[{ id: "", name: "— Choose a vehicle —" }, ...unassigned, { id: "__new__", name: "+ Create new vehicle…" }].map((v) => (
                    <Pressable
                      key={v.id}
                      style={[styles.pickerOption, selectedVehicleId === v.id && styles.pickerOptionActive]}
                      onPress={() => setSelectedVehicleId(v.id)}
                    >
                      <Text style={[styles.pickerLabel, selectedVehicleId === v.id && styles.pickerLabelActive]}>{v.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {selectedVehicleId === "__new__" && (
                  <TextInput
                    style={styles.input}
                    placeholder="Vehicle name, e.g. Van 3"
                    placeholderTextColor={C.slate}
                    value={newVehicleName}
                    onChangeText={setNewVehicleName}
                    autoFocus
                  />
                )}
              </>
            ) : (
              <>
                <Text style={styles.sub}>Give it a name that matches the vehicle it will be installed in.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Van 3, Truck 07"
                  placeholderTextColor={C.slate}
                  value={newVehicleName}
                  onChangeText={setNewVehicleName}
                  autoFocus
                />
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.claimBtn, (!claimReady || claiming) && styles.btnDisabled]}
              disabled={!claimReady || claiming}
              onPress={claim}
            >
              {claiming
                ? <ActivityIndicator color={C.white} />
                : <Text style={styles.claimBtnLabel}>Claim device</Text>}
            </Pressable>
            <Pressable style={styles.backBtn} onPress={() => setStep("scan")}>
              <Text style={styles.backBtnLabel}>Back</Text>
            </Pressable>
          </>
        )}

        {step === "done" && (
          <>
            <Text style={styles.heading}>✅ Tracker linked!</Text>
            <Text style={styles.sub}>
              <Text style={styles.mono}>{doneDeviceId}</Text> is now linked to your fleet.
              It will appear on the map once it gets a GPS fix outdoors.
            </Text>
            <Pressable style={styles.claimBtn} onPress={() => router.back()}>
              <Text style={styles.claimBtnLabel}>Done</Text>
            </Pressable>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cloud },
  heading: { fontSize: 22, fontWeight: "800", color: C.ink },
  sub: { fontSize: 14, color: C.slate, lineHeight: 20 },
  hwLabel: { fontSize: 14, color: C.ink },
  mono: { fontFamily: "Menlo", fontSize: 13 },
  scanningCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 24,
    alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  scanningLabel: { color: C.slate, fontSize: 14 },
  deviceCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  deviceCardLeft: { flex: 1, gap: 3 },
  deviceCardTitle: { fontSize: 15, fontWeight: "700", color: C.forest },
  deviceCardHw: { fontSize: 13, fontFamily: "Menlo", color: C.ink },
  deviceCardTime: { fontSize: 12, color: C.slate },
  deviceCardArrow: { fontSize: 22, color: C.slate },
  orLabel: { textAlign: "center", fontSize: 13, color: C.slate },
  manualRow: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1, height: 48, backgroundColor: C.white, borderWidth: 1, borderColor: C.line,
    borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: C.ink,
  },
  continueBtn: { height: 48, paddingHorizontal: 18, backgroundColor: C.forest, borderRadius: 12, justifyContent: "center" },
  continueBtnLabel: { color: C.white, fontWeight: "700", fontSize: 15 },
  pickerWrap: { gap: 6 },
  pickerOption: { padding: 14, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  pickerOptionActive: { borderColor: C.forest, backgroundColor: C.mint },
  pickerLabel: { fontSize: 15, color: C.ink },
  pickerLabelActive: { color: C.forest, fontWeight: "600" },
  claimBtn: { height: 52, backgroundColor: C.forest, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  claimBtnLabel: { color: C.white, fontSize: 16, fontWeight: "700" },
  backBtn: { alignItems: "center", paddingVertical: 12 },
  backBtnLabel: { color: C.slate, fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  error: { color: C.red, fontSize: 13 },
});
