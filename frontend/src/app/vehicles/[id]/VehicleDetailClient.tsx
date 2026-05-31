"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Battery, Bell, CheckCircle2, Clock, Navigation, Pencil, RadioTower, Route, TriangleAlert, User, Wrench, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import type { VehicleAlertThresholds } from "@/types";

import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EditVehicleModal } from "@/components/forms/EditVehicleModal";
import { formatDate, formatDuration, formatTime, kmToMiles, kphToMph, useAlerts, useTrips } from "@/lib/fleetHistory";
import { useAllTrackers } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";

const LiveVehicleMapClient = dynamic(
  () => import("@/components/map/LiveVehicleMapClient"),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg bg-brand-cloud" /> },
);

const ALERT_COLORS: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

export function VehicleDetailClient() {
  const pathname = usePathname();
  const id = pathname.split("/").filter(Boolean).pop() ?? "";
  const { state, loaded, assignDriverToVehicle, removeDriverFromVehicle } = useWorkspace();
  const allTrackers = useAllTrackers();
  const [editOpen, setEditOpen] = useState(false);
  const [addingDriver, setAddingDriver] = useState(false);
  const [confirmRemoveDriverId, setConfirmRemoveDriverId] = useState<string | null>(null);

  const vehicle = state.vehicles.find((v) => v.id === id);
  const tracker = allTrackers.find((t) => t.device_id === vehicle?.deviceAssignment);

  const { trips, loading: tripsLoading } = useTrips(vehicle?.deviceAssignment ?? "");
  const { alerts, loading: alertsLoading } = useAlerts(vehicle?.deviceAssignment ?? "");

  const maintItems = state.maintenanceItems.filter((m) => m.vehicleId === id);
  const maintDueCount = useMemo(() => {
    const now = Date.now();
    return maintItems.filter((item) => {
      if (!item.alertEnabled || item.intervalMonths === 0) return false;
      const monthsSince = (now - new Date(item.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      return monthsSince >= item.intervalMonths;
    }).length;
  }, [maintItems]);

  const recentTrips = trips.slice(0, 5);
  const recentAlerts = alerts.slice(0, 5);

  const speedMph = tracker?.gps?.speed_kph ? Math.round(kphToMph(Number(tracker.gps.speed_kph))) : 0;
  const batteryLevel = tracker?.battery_mv
    ? Math.max(0, Math.min(100, Math.round((((tracker.battery_mv) - 3300) / 900) * 100)))
    : null;
  const signalPct = tracker?.cell_rssi
    ? Math.max(0, Math.min(100, Math.round((tracker.cell_rssi / 31) * 100)))
    : null;
  const isOnline = tracker?.received_at
    ? Date.now() - new Date(tracker.received_at).getTime() < 5 * 60 * 1000
    : false;
  const hasGps = Boolean(tracker?.has_fix && tracker.gps?.lat && tracker.gps?.lon);

  if (!loaded) {
    return (
      <div className="space-y-5">
        <div className="h-5 w-32 animate-pulse rounded bg-brand-cloud" />
        <div className="h-24 animate-pulse rounded-xl bg-brand-cloud" />
        <div className="h-52 animate-pulse rounded-xl bg-brand-cloud" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-5">
        <Link href="/vehicles" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-navy">
          <ArrowLeft size={15} /> Back to vehicles
        </Link>
        <SectionCard className="p-10 text-center">
          <p className="font-semibold text-brand-ink">Vehicle not found</p>
          <p className="mt-2 text-sm text-slate-500">This vehicle may have been removed.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <Link href="/vehicles" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-navy mb-3">
          <ArrowLeft size={15} /> Back to vehicles
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-brand-forest">Vehicle</p>
            <h1 className="mt-1 text-3xl font-bold text-brand-ink">{vehicle.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")}
              {vehicle.plate && ` · ${vehicle.plate}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isOnline ? "online" : "offline"}>{isOnline ? "Online" : "Offline"}</Badge>
            {hasGps && <Badge tone="online">GPS fix</Badge>}
            {maintDueCount > 0 && <Badge tone="warning">{maintDueCount} maintenance due</Badge>}
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-cloud"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Live location map */}
      {vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned" ? (
        <SectionCard className="overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3">
            <div className="flex items-center gap-2">
              <Navigation size={16} className="text-brand-navy" />
              <h2 className="text-base font-semibold text-brand-ink">Live location</h2>
              {hasGps && (
                <span className="text-xs text-slate-400">
                  · {speedMph > 3 ? `${speedMph} mph` : "stopped"}
                </span>
              )}
            </div>
          </div>
          <div className="h-52">
            <LiveVehicleMapClient
              vehicleName={vehicle.name}
              vehicleType={vehicle.type}
              vehicleColor={vehicle.color}
              photo={vehicle.photo}
              tracker={tracker ?? null}
            />
          </div>
        </SectionCard>
      ) : null}

      {/* Tracker stats row */}
      {tracker && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            icon={<RadioTower size={16} />}
            label="Tracker"
            value={vehicle.deviceAssignment}
            sub={isOnline ? "Online" : "Offline"}
            color={isOnline ? "text-brand-forest" : "text-slate-400"}
          />
          <StatTile
            icon={<Battery size={16} />}
            label="Battery"
            value={batteryLevel !== null ? `${batteryLevel}%` : "—"}
            sub={tracker.battery_mv ? `${tracker.battery_mv} mV` : "—"}
            color={batteryLevel !== null && batteryLevel < 20 ? "text-red-500" : "text-brand-forest"}
          />
          <StatTile
            icon={<Zap size={16} />}
            label="Signal"
            value={signalPct !== null ? `${signalPct}%` : "—"}
            sub={tracker.cell_rssi ? `RSSI ${tracker.cell_rssi}` : "—"}
            color={signalPct !== null && signalPct < 25 ? "text-amber-500" : "text-brand-forest"}
          />
          <StatTile
            icon={<Clock size={16} />}
            label="Last ping"
            value={tracker.received_at ? relativeTime(tracker.received_at) : "Never"}
            sub={tracker.firmware ?? "—"}
            color="text-brand-forest"
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent trips */}
        <SectionCard>
          <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3">
            <Route size={16} className="text-brand-navy" />
            <h2 className="text-base font-semibold text-brand-ink">Recent trips</h2>
          </div>
          {tripsLoading ? (
            <div className="p-5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-brand-cloud" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-brand-cloud" />
            </div>
          ) : recentTrips.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              {vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned"
                ? "No trips recorded yet."
                : "Assign a tracker to start recording trips."}
            </p>
          ) : (
            <div className="divide-y divide-brand-line">
              {recentTrips.map((trip) => (
                <div key={trip.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-ink">
                      {formatDate(trip.start_time)}
                    </p>
                    <span className="text-xs text-slate-400">
                      {formatTime(trip.start_time)} – {formatTime(trip.end_time)}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-slate-500">
                    <span>{kmToMiles(trip.distance_km).toFixed(1)} mi</span>
                    <span>{formatDuration(trip.duration_s)}</span>
                    <span>max {Math.round(kphToMph(trip.max_speed_kph))} mph</span>
                    {trip.event_count > 0 && (
                      <span className="text-amber-600">{trip.event_count} event{trip.event_count !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {trips.length > 5 && (
            <div className="border-t border-brand-line px-5 py-3">
              <Link href="/trips" className="text-xs text-brand-navy hover:underline">
                View all {trips.length} trips →
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Recent alerts */}
        <SectionCard>
          <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3">
            <TriangleAlert size={16} className="text-brand-navy" />
            <h2 className="text-base font-semibold text-brand-ink">Recent alerts</h2>
          </div>
          {alertsLoading ? (
            <div className="p-5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-brand-cloud" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-brand-cloud" />
            </div>
          ) : recentAlerts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No alerts for this vehicle.</p>
          ) : (
            <div className="divide-y divide-brand-line">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className={`px-5 py-3 border-l-4 ${alert.severity === "critical" ? "border-l-red-400" : alert.severity === "warning" ? "border-l-amber-400" : "border-l-blue-400"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-ink">{alert.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${ALERT_COLORS[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{formatDate(alert.time)} {formatTime(alert.time)}</p>
                </div>
              ))}
            </div>
          )}
          {alerts.length > 5 && (
            <div className="border-t border-brand-line px-5 py-3">
              <Link href="/alerts" className="text-xs text-brand-navy hover:underline">
                View all {alerts.length} alerts →
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Maintenance */}
      <SectionCard>
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-brand-navy" />
            <h2 className="text-base font-semibold text-brand-ink">Maintenance</h2>
          </div>
          <Link href="/maintenance" className="text-xs text-brand-navy hover:underline">Manage →</Link>
        </div>
        {maintItems.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            No maintenance items tracked. <Link href="/maintenance" className="text-brand-navy hover:underline">Add one →</Link>
          </p>
        ) : (
          <div className="divide-y divide-brand-line">
            {maintItems.map((item) => {
              const now = Date.now();
              const monthsSince = (now - new Date(item.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
              const due = item.alertEnabled && item.intervalMonths > 0 && monthsSince >= item.intervalMonths;
              const upcoming = !due && item.alertEnabled && item.intervalMonths > 0 && monthsSince >= item.intervalMonths * 0.85;
              return (
                <div key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-brand-ink">{item.label}</p>
                      {due && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 border border-red-200">Due</span>}
                      {upcoming && !due && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600 border border-amber-200">Due soon</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Last: {item.lastServiceDate || "—"}
                      {item.intervalMonths > 0 && ` · every ${item.intervalMonths} mo`}
                    </p>
                  </div>
                  {!due && !upcoming && (
                    <CheckCircle2 size={16} className="text-brand-forest shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Driver assignment */}
      <SectionCard>
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3">
          <div className="flex items-center gap-2">
            <User size={16} className="text-brand-navy" />
            <h2 className="text-base font-semibold text-brand-ink">Assigned drivers</h2>
          </div>
          {!addingDriver && (
            <button
              onClick={() => setAddingDriver(true)}
              className="text-xs text-brand-navy hover:underline"
            >
              + Add driver
            </button>
          )}
        </div>

        {/* Current assigned drivers */}
        {(vehicle.assignedDriverIds ?? []).length > 0 && (
          <div className="divide-y divide-brand-line">
            {(vehicle.assignedDriverIds ?? []).map((driverId) => {
              const driver = state.drivers.find((d) => d.id === driverId);
              if (!driver) return null;
              return (
                <div key={driverId} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-mint text-brand-forest text-sm font-bold shrink-0">
                    {driver.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-ink">{driver.name}</p>
                    <p className="text-xs text-slate-400">{driver.phone || "No phone"}</p>
                  </div>
                  {confirmRemoveDriverId === driverId ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { removeDriverFromVehicle(vehicle.id, driverId); setConfirmRemoveDriverId(null); }}
                        className="rounded px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
                      >
                        Remove
                      </button>
                      <button onClick={() => setConfirmRemoveDriverId(null)} className="text-xs text-slate-400 hover:text-slate-600">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveDriverId(driverId)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add driver picker */}
        {addingDriver ? (
          <div className="flex items-center gap-3 border-t border-brand-line p-5">
            <select
              defaultValue=""
              className="h-10 flex-1 rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-navy"
              onChange={(e) => {
                if (e.target.value) {
                  assignDriverToVehicle(vehicle.id, e.target.value);
                  setAddingDriver(false);
                }
              }}
            >
              <option value="">— Select driver —</option>
              {state.drivers
                .filter((d) => !(vehicle.assignedDriverIds ?? []).includes(d.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
            <button onClick={() => setAddingDriver(false)} className="text-sm text-slate-400 hover:text-brand-ink">
              Cancel
            </button>
          </div>
        ) : (vehicle.assignedDriverIds ?? []).length === 0 && (
          <div className="px-5 py-4">
            <p className="text-sm text-slate-400">
              No drivers assigned.{" "}
              {state.drivers.length === 0 ? (
                <Link href="/drivers" className="text-brand-navy hover:underline">Add a driver first →</Link>
              ) : (
                <button onClick={() => setAddingDriver(true)} className="text-brand-navy hover:underline">Assign one →</button>
              )}
            </p>
          </div>
        )}
      </SectionCard>

      {/* Vehicle info */}
      <SectionCard>
        <div className="border-b border-brand-line px-5 py-3">
          <h2 className="text-base font-semibold text-brand-ink">Vehicle details</h2>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["ID", vehicle.id],
            ["Type", vehicle.type],
            ["Plate", vehicle.plate || "—"],
            ["VIN", vehicle.vin || "—"],
            ["Tracker", vehicle.deviceAssignment !== "Not assigned" ? vehicle.deviceAssignment : "—"],
            ["Install date", vehicle.installDate || "—"],
            ["Hardware", vehicle.hardwareType || "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-brand-line bg-brand-cloud px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-semibold text-brand-ink truncate">{value}</p>
            </div>
          ))}
        </div>
        {vehicle.notes && (
          <p className="border-t border-brand-line px-5 py-4 text-sm leading-6 text-slate-500">{vehicle.notes}</p>
        )}
      </SectionCard>

      {/* Alert settings */}
      <AlertSettingsCard vehicle={vehicle} />

      <EditVehicleModal vehicle={vehicle} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

const DEFAULT_THRESHOLDS: VehicleAlertThresholds = {
  speedingMph: 75,
  hardBrakeEnabled: true,
  rapidAccelEnabled: true,
  gpsOfflineMinutes: 0,
};

function AlertSettingsCard({ vehicle }: { vehicle: { id: string; alertThresholds?: VehicleAlertThresholds } }) {
  const { updateVehicle } = useWorkspace();
  const t = { ...DEFAULT_THRESHOLDS, ...vehicle.alertThresholds };

  const [speedingMph, setSpeedingMph] = useState(String(t.speedingMph));
  const [hardBrake, setHardBrake] = useState(t.hardBrakeEnabled);
  const [rapidAccel, setRapidAccel] = useState(t.rapidAccelEnabled);
  const [gpsOffline, setGpsOffline] = useState(t.gpsOfflineMinutes);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updateVehicle(vehicle.id, {
      alertThresholds: {
        speedingMph: Math.max(0, Number(speedingMph) || 0),
        hardBrakeEnabled: hardBrake,
        rapidAccelEnabled: rapidAccel,
        gpsOfflineMinutes: gpsOffline,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SectionCard>
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3">
        <Bell size={16} className="text-brand-navy" />
        <h2 className="text-base font-semibold text-brand-ink">Alert settings</h2>
        <span className="ml-auto text-xs text-slate-400">Per-vehicle thresholds</span>
      </div>
      <div className="space-y-5 p-5">

        {/* Speed limit */}
        <div>
          <label className="block text-sm font-medium text-brand-ink mb-2">Speed limit (mph)</label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={0}
              max={150}
              value={speedingMph}
              onChange={(e) => setSpeedingMph(e.target.value)}
              className="h-9 w-20 rounded-md border border-brand-line px-3 text-sm font-mono"
            />
            {[45, 55, 65, 75, 80].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSpeedingMph(String(v))}
                className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                  Number(speedingMph) === v
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-brand-line bg-brand-cloud text-slate-600 hover:border-brand-navy"
                }`}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSpeedingMph("0")}
              className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                Number(speedingMph) === 0
                  ? "border-slate-400 bg-slate-100 text-slate-600"
                  : "border-brand-line bg-brand-cloud text-slate-400 hover:border-slate-400"
              }`}
            >
              Off
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Alert fires when speed exceeds this value. Set to 0 to disable.</p>
        </div>

        {/* Toggles */}
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Hard brake alerts", hardBrake, setHardBrake, "Fires when the tracker reports sudden deceleration"] as const,
            ["Rapid accel alerts", rapidAccel, setRapidAccel, "Fires when the tracker reports sudden acceleration"] as const,
          ]).map(([label, value, setter, hint]) => (
            <div key={label} className="flex items-start justify-between gap-3 rounded-lg border border-brand-line px-4 py-3">
              <div>
                <p className="text-sm font-medium text-brand-ink">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setter(!value)}
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${value ? "bg-brand-forest" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>

        {/* GPS offline */}
        <div>
          <label className="block text-sm font-medium text-brand-ink mb-2">GPS offline alert</label>
          <div className="flex flex-wrap gap-2">
            {[
              [0, "Off"],
              [5, "5 min"],
              [15, "15 min"],
              [30, "30 min"],
              [60, "1 hour"],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setGpsOffline(val as number)}
                className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                  gpsOffline === val
                    ? val === 0 ? "border-slate-400 bg-slate-100 text-slate-600" : "border-brand-navy bg-brand-navy text-white"
                    : "border-brand-line bg-brand-cloud text-slate-600 hover:border-brand-navy"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Alert fires when the tracker reconnects after being silent for this long.</p>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-brand-line">
          <button
            onClick={handleSave}
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-forest transition-colors"
          >
            Save settings
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-brand-forest">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-white px-4 py-3 shadow-soft">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold text-brand-ink">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
