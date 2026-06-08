"use client";

import {
  BatteryMedium,
  Bike,
  Car,
  CircleDot,
  MapPin,
  Plus,
  RadioTower,
  ShieldAlert,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AddVehicleModal } from "@/components/forms/AddVehicleModal";
import { SetupWorkspaceModal } from "@/components/forms/SetupWorkspaceModal";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { LiveTrackerPacket } from "@/lib/liveTracker";
import { useAllTrips, useAllAlerts, kmToMiles } from "@/lib/fleetHistory";
import { useWorkspace } from "@/lib/workspace";
import { canManageFleet, isDriver } from "@/lib/permissions";
import { Vehicle } from "@/types";

function VehicleTypeIcon({ type, ...props }: { type: string } & Parameters<typeof Car>[0]) {
  const lower = type.toLowerCase();
  if (lower.includes("motorcycle") || lower.includes("bike")) return <Bike {...props} />;
  if (lower.includes("truck") || lower.includes("van") || lower.includes("trailer") || lower.includes("box"))
    return <Truck {...props} />;
  return <Car {...props} />;
}

function formatStoppedSince(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const isToday = d.toDateString() === now.toDateString();
  return isToday ? `Here since ${time}` : `Here since ${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VehicleCard({
  vehicle,
  tracker,
  onClick,
  onNoGpsClick,
}: {
  vehicle: Vehicle;
  tracker: LiveTrackerPacket | null;
  onClick?: () => void;
  onNoGpsClick?: () => void;
}) {
  const speedMph = Math.round(Number(tracker?.gps?.speed_kph ?? 0) * 0.621371);
  const stoppedSinceMs = tracker?.stopped_since ? Date.now() - new Date(tracker.stopped_since).getTime() : Infinity;
  const isMoving = tracker?.motion_state === "moving" || stoppedSinceMs < 3 * 60 * 1000;
  const isOnline = Boolean(tracker?.received_at);
  const hasGps = Boolean(tracker?.has_fix);
  const hasTracker = vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned";

  const battPct =
    tracker?.battery_mv != null
      ? Math.max(0, Math.min(100, Math.round((((tracker.battery_mv) - 3300) / 900) * 100)))
      : null;
  const signalPct =
    tracker?.cell_rssi != null
      ? Math.max(0, Math.min(100, Math.round(((tracker.cell_rssi) / 31) * 100)))
      : null;

  const ignitionOn = Boolean(tracker?.ignition_on);

  const dotColor = !hasTracker
    ? "bg-slate-200"
    : isMoving
    ? "bg-green-500"
    : ignitionOn
    ? "bg-amber-400"
    : isOnline && hasGps
    ? "bg-brand-navy"
    : isOnline
    ? "bg-slate-400"
    : "bg-slate-300";

  const statusLabel = !hasTracker
    ? "No tracker"
    : isMoving
    ? `${speedMph} mph`
    : ignitionOn
    ? "Engine running"
    : isOnline
    ? "Stopped"
    : "Offline";

  const statusColor = !hasTracker
    ? "text-slate-400"
    : isMoving
    ? "text-green-600 font-semibold"
    : isOnline
    ? "text-slate-600"
    : "text-slate-400";

  const hasLiveLocation = Boolean(tracker?.has_fix || tracker?.last_gps);
  const hasStoredLocation = Boolean(vehicle.location?.lat && vehicle.location?.lng);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer hover:bg-brand-cloud/60 active:bg-brand-cloud"
      onClick={hasLiveLocation ? onClick : (hasStoredLocation || hasTracker ? onNoGpsClick : undefined)}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-brand-line bg-brand-cloud flex items-center justify-center">
          {vehicle.photo ? (
            <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" />
          ) : (
            <VehicleTypeIcon type={vehicle.type} size={20} className="text-brand-navy" />
          )}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${dotColor} ${isMoving ? "animate-pulse" : ""}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-ink truncate">{vehicle.name}</p>
          <span className={`shrink-0 text-xs ${statusColor}`}>{statusLabel}</span>
        </div>
        <p className="text-xs text-slate-400 truncate">{vehicle.type}</p>
        {isOnline && (
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            {battPct !== null && (
              <span className="flex items-center gap-0.5">
                <BatteryMedium size={11} />
                {battPct}%
              </span>
            )}
            {signalPct !== null && (
              <span className="flex items-center gap-0.5">
                <RadioTower size={11} />
                {signalPct}%
              </span>
            )}
            {!isMoving && tracker?.stopped_since
              ? <span>{formatStoppedSince(tracker.stopped_since)}</span>
              : <span>{formatRelativeTime(tracker?.received_at)}</span>
            }
          </div>
        )}
      </div>
    </div>
  );
}

function useSecondsTick() {
  const [secs, setSecs] = useState(0);
  const ref = useRef(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setSecs(Math.floor((Date.now() - ref.current) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const reset = () => { ref.current = Date.now(); setSecs(0); };
  return { secs, reset };
}

export default function DashboardPage() {
  const { state, hasServiceArea, serviceArea, userRole, driverVehicleId, liveTrackers: allTrackers } = useWorkspace();
  const router = useRouter();
  const driverMode = isDriver(userRole);
  const canManage = canManageFleet(userRole);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const mapRef = useRef<HTMLDivElement>(null);
  const { secs, reset } = useSecondsTick();

  const deviceIds = useMemo(
    () => state.vehicles.map((v) => v.deviceAssignment).filter((id): id is string => Boolean(id) && id !== "Not assigned"),
    [state.vehicles],
  );
  const { trips } = useAllTrips(deviceIds);
  const { alerts } = useAllAlerts(deviceIds);

  const weekAgo = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), []);
  const weeklyTrips = useMemo(() => trips.filter((t) => t.start_time >= weekAgo), [trips, weekAgo]);
  const weeklyMiles = useMemo(() => Math.round(weeklyTrips.reduce((s, t) => s + kmToMiles(t.distance_km), 0)), [weeklyTrips]);
  const weeklyEvents = useMemo(() => alerts.filter((a) => a.time >= weekAgo).length, [alerts, weekAgo]);

  // Reset the "updated ago" counter whenever trackers refresh
  const prevTrackerCount = useRef(0);
  useEffect(() => {
    if (allTrackers.length !== prevTrackerCount.current || allTrackers.length > 0) {
      prevTrackerCount.current = allTrackers.length;
      reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTrackers]);

  const trackerMap = useMemo(
    () => Object.fromEntries(allTrackers.map((t) => [t.device_id, t])),
    [allTrackers],
  );

  // Device IDs that are already claimed by a real vehicle.
  const claimedDeviceIds = useMemo(
    () =>
      new Set(
        state.vehicles
          .map((v) => v.deviceAssignment)
          .filter((id): id is string => Boolean(id) && id !== "Not assigned"),
      ),
    [state.vehicles],
  );

  const vehiclesWithLiveData = useMemo(
    () =>
      state.vehicles
        .filter((v) => {
          if (driverMode && driverVehicleId && v.id !== driverVehicleId) return false;
          const isUnassigned = !v.deviceAssignment || v.deviceAssignment === "Not assigned";
          if (!isUnassigned) return true;
          return !claimedDeviceIds.has(v.name) && !claimedDeviceIds.has(v.id);
        })
        .map((v) => ({
          ...v,
          tracker:
            v.deviceAssignment && v.deviceAssignment !== "Not assigned"
              ? (trackerMap[v.deviceAssignment] ?? null)
              : null,
        })),
    [state.vehicles, trackerMap, claimedDeviceIds],
  );

  const movingCount = vehiclesWithLiveData.filter(
    (v) => Math.round(Number(v.tracker?.gps?.speed_kph ?? 0) * 0.621371) > 3,
  ).length;
  const onlineCount = vehiclesWithLiveData.filter((v) => v.tracker?.received_at).length;
  const gpsCount = allTrackers.filter((t) => t.has_fix).length;

  const unassignedTrackers = useMemo(
    () => allTrackers.filter((t) => !claimedDeviceIds.has(t.device_id)),
    [allTrackers, claimedDeviceIds],
  );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-forest">
            {state.companyName}
          </p>
          <h1 className="text-xl font-bold text-brand-ink sm:text-2xl lg:text-3xl">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCompanyOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm font-medium text-brand-ink transition hover:bg-brand-cloud sm:inline-flex"
          >
            <SlidersHorizontal size={14} />
            Settings
          </button>
          {canManage && (
            <Button onClick={() => setAddVehicleOpen(true)} className="h-9 px-3 text-sm">
              <Plus size={14} className="mr-1.5" />
              Add vehicle
            </Button>
          )}
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SectionCard className="flex items-center gap-2.5 px-3 py-3 sm:px-4">
          <CircleDot size={16} className={movingCount > 0 ? "text-green-500" : "text-slate-300"} />
          <div>
            <p className="text-xs text-slate-500">In motion</p>
            <p className="text-base font-bold text-brand-ink sm:text-lg">{movingCount}</p>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-2.5 px-3 py-3 sm:px-4">
          <RadioTower size={16} className={onlineCount > 0 ? "text-brand-navy" : "text-slate-300"} />
          <div>
            <p className="text-xs text-slate-500">Online</p>
            <p className="text-base font-bold text-brand-ink sm:text-lg">{onlineCount}</p>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-2.5 px-3 py-3 sm:px-4">
          <MapPin size={16} className={gpsCount > 0 ? "text-brand-forest" : "text-slate-300"} />
          <div>
            <p className="text-xs text-slate-500">GPS active</p>
            <p className="text-base font-bold text-brand-ink sm:text-lg">{gpsCount}</p>
          </div>
        </SectionCard>
      </div>

      {/* Unassigned tracker banner */}
      {unassignedTrackers.length > 0 && canManage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
              <RadioTower size={15} className="text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-900">
                {unassignedTrackers.length === 1
                  ? "New tracker online"
                  : `${unassignedTrackers.length} new trackers online`}
              </p>
              <p className="text-xs text-green-700 truncate">
                {unassignedTrackers.map((t) => t.device_id).join(", ")} · ready to assign
              </p>
            </div>
          </div>
          <Button
            onClick={() => setAddVehicleOpen(true)}
            className="shrink-0 bg-green-700 hover:bg-green-800 border-green-700 text-xs h-8 px-3"
          >
            Assign
          </Button>
        </div>
      )}

      {/* Map — takes up the full width, prominent */}
      <div ref={mapRef}>
        <MapView selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
      </div>

      {/* Weekly summary */}
      {weeklyTrips.length > 0 && (
        <SectionCard className="grid grid-cols-3 divide-x divide-brand-line overflow-hidden">
          {[
            { label: "Trips this week", value: String(weeklyTrips.length) },
            { label: "Miles driven", value: weeklyMiles.toLocaleString() },
            { label: "Driving events", value: String(weeklyEvents) },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 sm:px-5">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold text-brand-ink sm:text-xl">{value}</p>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Fleet status */}
      <SectionCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-brand-ink sm:text-base">Fleet status</h2>
            <p className="text-xs text-slate-500">
              {state.vehicles.length > 0
                ? `${state.vehicles.length} vehicle${state.vehicles.length > 1 ? "s" : ""}`
                : "No vehicles yet"}
              {allTrackers.length > 0 ? ` · ${allTrackers.length} tracker${allTrackers.length > 1 ? "s" : ""} online` : ""}
              {" · "}<span className={secs > 20 ? "text-amber-500" : "text-slate-400"}>updated {secs}s ago</span>
            </p>
          </div>
          {state.vehicles.length > 0 && (
            <Link
              href="/vehicles"
              className="text-xs font-medium text-brand-navy hover:underline"
            >
              View all
            </Link>
          )}
        </div>

        {vehiclesWithLiveData.length > 0 ? (
          <div className="divide-y divide-brand-line">
            {vehiclesWithLiveData.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                tracker={v.tracker}
                onClick={() => {
                  setSelectedVehicleId(v.id);
                  mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                onNoGpsClick={() => router.push(`/vehicles/${v.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-cloud">
              <Car size={22} className="text-brand-navy" />
            </div>
            <p className="text-sm font-semibold text-brand-ink">No vehicles yet</p>
            <p className="mt-1 text-xs text-slate-500">Add a vehicle to see live status here</p>
            {canManage && (
              <Button onClick={() => setAddVehicleOpen(true)} className="mt-4">
                Add vehicle
              </Button>
            )}
          </div>
        )}
      </SectionCard>

      {/* Bottom row: alerts link + quick settings */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/alerts"
          className="flex items-center gap-3 rounded-xl border border-brand-line bg-white px-4 py-3 transition hover:bg-brand-cloud"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
            <ShieldAlert size={18} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">Alerts</p>
            <p className="text-xs text-slate-500 truncate">Speed, hard stops, offline</p>
          </div>
        </Link>
        <Link
          href="/trips"
          className="flex items-center gap-3 rounded-xl border border-brand-line bg-white px-4 py-3 transition hover:bg-brand-cloud"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint">
            <MapPin size={18} className="text-brand-forest" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">Trips</p>
            <p className="text-xs text-slate-500 truncate">History & routes</p>
          </div>
        </Link>
      </div>

      {!hasServiceArea && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">Service area not set — </p>
          <Link href="/settings" className="text-sm font-semibold text-amber-700 hover:underline">
            Set it now
          </Link>
        </div>
      )}

      <SetupWorkspaceModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
      <AddVehicleModal open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} />
    </div>
  );
}
