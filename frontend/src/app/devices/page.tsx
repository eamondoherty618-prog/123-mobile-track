"use client";

import { ChevronDown, ChevronUp, Clock, Cpu, Link2, Loader2, Plus, RadioTower, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { TrackingProfileCard } from "@/components/ui/TrackingProfileCard";
import { getStoredToken } from "@/lib/auth";
import { buildPrototypeDevice, useAllTrackers } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";

type FwMeta = { version: string; size: number; uploaded_at: string };

function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function FirmwareCard({ trackerFirmwares }: { trackerFirmwares: { name: string; version: string }[] }) {
  const [latest, setLatest] = useState<FwMeta | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/fleet/ota/latest")
      .then((r) => r.json())
      .then((d) => { if (d.latest) setLatest(d.latest); })
      .catch(() => {});
  }, []);

  async function upload() {
    if (!file || !version.trim()) return;
    setUploading(true);
    setMsg("");
    try {
      const buf = await file.arrayBuffer();
      const token = getStoredToken();
      const res = await fetch(`/api/fleet/ota/upload?version=${encodeURIComponent(version.trim())}`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: buf,
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`v${data.version} uploaded — trackers will update automatically on next check-in.`);
        setLatest({ version: data.version, size: data.size, uploaded_at: new Date().toISOString() });
        setVersion("");
        setFile(null);
      } else {
        setMsg(data.error ?? "Upload failed");
      }
    } catch {
      setMsg("Network error — check your connection.");
    } finally {
      setUploading(false);
    }
  }

  const anyOutdated = latest && trackerFirmwares.some((t) => semverGt(latest.version, t.version));

  return (
    <SectionCard className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
          <Cpu size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-brand-ink">Firmware</h2>
          <p className="text-sm text-slate-500">
            {latest
              ? `Server has v${latest.version} · Trackers update automatically on check-in`
              : "Trackers update over-the-air automatically"}
          </p>
        </div>
      </div>

      {trackerFirmwares.length > 0 && (
        <div className="space-y-2">
          {trackerFirmwares.map((t) => {
            const outdated = latest && semverGt(latest.version, t.version);
            return (
              <div key={t.name} className="flex items-center justify-between rounded-md border border-brand-line px-4 py-2.5">
                <span className="text-sm font-medium text-brand-ink">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">v{t.version}</span>
                  {outdated ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Update pending → v{latest!.version}
                    </span>
                  ) : latest ? (
                    <span className="rounded-full bg-brand-mint px-2 py-0.5 text-xs font-medium text-brand-forest">
                      Up to date
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {anyOutdated && (
            <p className="text-xs text-slate-400">
              Update installs automatically — tracker will reboot within a minute of its next check-in.
            </p>
          )}
        </div>
      )}

      {/* Collapsible admin upload */}
      <div className="border-t border-brand-line pt-3">
        <button
          onClick={() => setAdminOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-ink"
        >
          {adminOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Upload new firmware build
        </button>
        {adminOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                className="h-10 w-28 rounded-md border border-brand-line px-3 text-sm font-mono"
                placeholder="1.2.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
              <label className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-brand-line px-3 text-sm text-slate-500 hover:bg-brand-cloud">
                {file ? file.name : "Choose .bin file…"}
                <input
                  type="file"
                  accept=".bin"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button
              variant="primary"
              disabled={!file || !version.trim() || uploading}
              onClick={upload}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : "Upload"}
            </Button>
            {msg && (
              <p className={`text-sm ${msg.includes("uploaded") ? "text-brand-forest" : "text-red-500"}`}>
                {msg}
              </p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}


export default function DevicesPage() {
  const trackers = useAllTrackers();
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const selectedTracker = trackers.find((t) => t.device_id === (selectedTrackerId ?? trackers[0]?.device_id)) ?? trackers[0] ?? null;
  const profileDevice = buildPrototypeDevice(selectedTracker);
  const { state, assignTrackerToVehicle, addVehicle } = useWorkspace();

  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [savedTrackers, setSavedTrackers] = useState<Set<string>>(new Set());

  // "Link existing tracker" form
  const [linkDeviceId, setLinkDeviceId] = useState("");
  const [linkVehicleName, setLinkVehicleName] = useState("");
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleLinkTracker() {
    const devId = linkDeviceId.trim();
    const vName = linkVehicleName.trim() || devId;
    if (!devId) return;

    const already = state.vehicles.find((v) => v.deviceAssignment === devId);
    if (already) {
      setLinkMsg({ ok: false, text: `Already linked to "${already.name}".` });
      return;
    }

    // Assign to an existing unassigned vehicle, or create a new one with the tracker pre-assigned.
    const unassigned = state.vehicles.find((v) => !v.deviceAssignment || v.deviceAssignment === "Not assigned");
    if (unassigned) {
      assignTrackerToVehicle(unassigned.id, devId);
    } else {
      addVehicle({
        name: vName, vehicleNumber: "", plate: "", make: "", model: "",
        year: new Date().getFullYear(), type: "Van", notes: "", installDate: "",
        enabledFeatures: ["GPS Tracking", "Live Location"],
        deviceAssignment: devId,
      });
    }
    setLinkMsg({ ok: true, text: `Linked — tracker "${devId}" will appear on the map on its next check-in.` });
    setLinkDeviceId("");
    setLinkVehicleName("");
  }

  // Devices linked in workspace but not yet seen in live telemetry
  const pendingDevices = state.vehicles
    .filter((v) => v.deviceAssignment && v.deviceAssignment !== "Not assigned" && !trackers.find((t) => t.device_id === v.deviceAssignment))
    .map((v) => ({ deviceId: v.deviceAssignment!, vehicleName: v.name, vehicleId: v.id }));

  // Assigned count from workspace — doesn't require live telemetry
  const assignedCount = state.vehicles.filter(
    (v) => v.deviceAssignment && v.deviceAssignment !== "Not assigned",
  ).length;
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const onlineCount = trackers.filter(
    (t) => t.received_at && new Date(t.received_at).getTime() > fiveMinAgo,
  ).length;
  const fixCount = trackers.filter((t) => t.has_fix).length;

  const deviceKpis = [
    { label: "Online now", value: String(onlineCount), icon: RadioTower },
    { label: "Assigned to vehicle", value: String(assignedCount), icon: Zap },
    { label: "GPS fix", value: trackers.length ? `${fixCount} / ${trackers.length}` : "—", icon: Cpu },
  ] as const;

  function currentVehicleId(trackerId: string) {
    return state.vehicles.find((v) => v.deviceAssignment === trackerId)?.id ?? "";
  }

  function currentVehicleName(trackerId: string) {
    return state.vehicles.find((v) => v.deviceAssignment === trackerId)?.name ?? "Not assigned";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-forest">Devices</p>
          <h1 className="mt-1 text-3xl font-bold text-brand-ink">Devices</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review tracker health, assignment, and reporting behavior from one place.
          </p>
        </div>
        <Link href="/devices/add">
          <Button variant="primary" className="flex items-center gap-2 whitespace-nowrap">
            <Plus size={16} /> Add Device
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {deviceKpis.map(({ label, value, icon: Icon }) => (
          <SectionCard key={label} className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-brand-ink">{value}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          {trackers.length === 0 && pendingDevices.length === 0 && (
            <SectionCard className="p-5">
              <p className="text-sm text-slate-500">No trackers linked yet. Use the form below to link an existing tracker, or add a new device.</p>
            </SectionCard>
          )}

          {/* Link an existing tracker by device ID */}
          <SectionCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
                <Link2 size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-brand-ink">Link existing tracker</h2>
                <p className="text-sm text-slate-500">
                  Already have a tracker sending data? Enter its device ID to link it to this account.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                className="h-10 flex-1 min-w-[180px] rounded-md border border-brand-line bg-brand-cloud px-3 font-mono text-sm outline-none transition focus:border-brand-forest"
                placeholder="Device ID — e.g. tracker-002"
                value={linkDeviceId}
                onChange={(e) => setLinkDeviceId(e.target.value)}
              />
              <input
                className="h-10 flex-1 min-w-[180px] rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none transition focus:border-brand-forest"
                placeholder="Vehicle name (optional)"
                value={linkVehicleName}
                onChange={(e) => setLinkVehicleName(e.target.value)}
              />
              <Button variant="primary" disabled={!linkDeviceId.trim()} onClick={handleLinkTracker}>
                Link tracker
              </Button>
            </div>
            {linkMsg && (
              <p className={`mt-3 text-sm font-medium ${linkMsg.ok ? "text-brand-forest" : "text-red-600"}`}>
                {linkMsg.text}
              </p>
            )}
          </SectionCard>

          {pendingDevices.map(({ deviceId, vehicleName }) => (
            <SectionCard key={deviceId} className="overflow-hidden opacity-80">
              <div className="border-b border-brand-line px-5 py-4">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-slate-400" />
                  <h3 className="text-base font-semibold text-brand-ink">{vehicleName}</h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Waiting for first check-in
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {deviceId} · Linked to this account — no telemetry received yet.
                </p>
              </div>
              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                {([
                  ["Device ID", deviceId],
                  ["Assignment", vehicleName],
                  ["Status", "Pending first check-in"],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="rounded-md border border-brand-line bg-brand-cloud px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">{value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}

          {trackers.map((tracker) => {
            const signalPct = Math.max(0, Math.min(100, Math.round(((tracker.cell_rssi ?? 0) / 31) * 100)));
            const battPct = Math.max(0, Math.min(100, Math.round((((tracker.battery_mv ?? 3600) - 3300) / 900) * 100)));
            const savedVehicleId = currentVehicleId(tracker.device_id);
            const savedVehicleName = currentVehicleName(tracker.device_id);
            const pendingVehicleId = pendingAssignments[tracker.device_id] ?? savedVehicleId;
            const isSaved = savedTrackers.has(tracker.device_id);
            const isSelected = (selectedTrackerId ?? trackers[0]?.device_id) === tracker.device_id;

            return (
              <SectionCard
                key={tracker.device_id}
                className={`overflow-hidden cursor-pointer transition-shadow ${isSelected ? "ring-2 ring-brand-navy" : ""}`}
                onClick={() => setSelectedTrackerId(tracker.device_id)}
              >
                <div className="border-b border-brand-line px-5 py-4">
                  <h3 className="text-base font-semibold text-brand-ink">
                    {savedVehicleName !== "Not assigned" ? savedVehicleName : tracker.device_id}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {savedVehicleName !== "Not assigned"
                      ? `${tracker.device_id} · Live status from the last check-in.`
                      : "Not assigned to a vehicle · Live status from the last check-in."}
                  </p>
                </div>
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {([
                    ["Device ID", tracker.device_id],
                    ["Assignment", savedVehicleName],
                    ["SIM", "1NCE SIM installed"],
                    ["Firmware", tracker.firmware ?? "0.1.0"],
                    ["Battery", `${battPct}%`],
                    ["Signal", `${signalPct}%`],
                    ["Location", tracker.has_fix ? "Available" : "Waiting for GPS"],
                    ["Motion", tracker.motion_state === "moving" ? "Moving" : "Stopped"],
                    ["Last update", tracker.received_at ?? "No updates yet"],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded-md border border-brand-line bg-brand-cloud px-4 py-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-brand-ink">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-brand-line px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="h-10 min-w-[220px] rounded-md border border-brand-line bg-white px-3 text-sm"
                      value={pendingVehicleId}
                      onChange={(e) => {
                        setPendingAssignments((prev) => ({ ...prev, [tracker.device_id]: e.target.value }));
                        setSavedTrackers((prev) => {
                          const next = new Set(prev);
                          next.delete(tracker.device_id);
                          return next;
                        });
                      }}
                      disabled={state.vehicles.length === 0}
                    >
                      <option value="">Assign to vehicle</option>
                      {state.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      disabled={state.vehicles.length === 0 || !pendingVehicleId}
                      onClick={() => {
                        assignTrackerToVehicle(pendingVehicleId, tracker.device_id);
                        setSavedTrackers((prev) => new Set(prev).add(tracker.device_id));
                      }}
                    >
                      Save Assignment
                    </Button>
                  </div>
                  {state.vehicles.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">
                      Add a vehicle first, then link a tracker here.
                    </p>
                  )}
                  {state.vehicles.length > 0 && !pendingVehicleId && (
                    <p className="mt-2 text-sm text-slate-500">
                      Choose the vehicle to assign {tracker.device_id} to.
                    </p>
                  )}
                  {isSaved && (
                    <p className="mt-2 text-sm text-brand-forest">Assignment saved.</p>
                  )}
                  {!isSaved && savedVehicleName !== "Not assigned" && (
                    <p className="mt-2 text-sm text-slate-500">
                      Currently assigned to: {savedVehicleName}.
                    </p>
                  )}
                </div>
              </SectionCard>
            );
          })}

          <FirmwareCard
            trackerFirmwares={trackers.map((t) => {
              const vehicle = state.vehicles.find((v) => v.deviceAssignment === t.device_id);
              return { name: vehicle?.name ?? t.device_id, version: t.firmware ?? "0.1.0" };
            })}
          />
        </div>
        <TrackingProfileCard device={profileDevice} />
      </div>
    </div>
  );
}
